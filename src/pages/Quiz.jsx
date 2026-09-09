import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, arrayRemove, serverTimestamp,
} from "firebase/firestore";
import { useNavigate, useBlocker } from "react-router-dom";
import {
  Trophy, Users, Clock, Play, Plus, ArrowRight, CheckCircle,
  XCircle, Brain, Loader2, Pencil, X, Save,
  GraduationCap, BookOpen, Search, AlertTriangle,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export default function Quiz() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  // ── Auth ────────────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");

  // ── Mode ────────────────────────────────────────────────────────────────────
  // menu | create | lobby | game | result
  const [mode, setMode] = useState("menu");

  // ── Room ────────────────────────────────────────────────────────────────────
  const [roomId, setRoomId] = useState("");
  const [roomData, setRoomData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [removedPlayers, setRemovedPlayers] = useState([]); // Track removed players for this room

  // ── Creation form ───────────────────────────────────────────────────────────
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [questionCount, setQuestionCount] = useState(5);
  const [timerPerQ, setTimerPerQ] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [hostRole, setHostRole] = useState(""); // "teacher" | "student"

  // ── Game ────────────────────────────────────────────────────────────────────
  const [myAnswer, setMyAnswer] = useState(null);
  const [lastAnsweredIndex, setLastAnsweredIndex] = useState(-1);
  const hasAnsweredCurrent = lastAnsweredIndex === currentQuestionIndex;
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [timerAutoAdvance, setTimerAutoAdvance] = useState(false);
  const [hasRecordedSkip, setHasRecordedSkip] = useState(false); // Track if skip was recorded
  const [tabSwitchWarning, setTabSwitchWarning] = useState(false);

  // ── Teacher edit modal ──────────────────────────────────────────────────────
  const [showEditModal, setShowEditModal] = useState(false);
  const [editQuestions, setEditQuestions] = useState([]);
  const [editingQIdx, setEditingQIdx] = useState(0);
  const [isSavingEdits, setIsSavingEdits] = useState(false);

  // ── Inspect modal ───────────────────────────────────────────────────────────
  const [showInspectModal, setShowInspectModal] = useState(false);

  // ── Notifications ───────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const prevPlayersRef = useRef([]);
  const tabSwitchCountRef = useRef(0);
  const removalTimeoutRef = useRef(null);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const isInRoom = mode === "lobby" || mode === "game";
  const isRemoved = removedPlayers.includes(user?.uid);

  // ─────────────────────────────────────────────────────────────────────────────
  // LEAVE PROTECTION  – block in-app navigation while in a room
  // ─────────────────────────────────────────────────────────────────────────────
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isInRoom && currentLocation.pathname !== nextLocation.pathname
  );

  // Warn on browser tab close / refresh
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (isInRoom && mode === "game") {
        e.preventDefault();
        e.returnValue = "You will be removed from the quiz if you leave!";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isInRoom, mode]);

  // Tab switch detection with removal
  useEffect(() => {
    let visibilityTimeout = null;
    
    const onVisibilityChange = () => {
      if (mode === "game" && isInRoom && user && !isRemoved) {
        if (document.hidden) {
          // User switched away from tab
          tabSwitchCountRef.current += 1;
          setTabSwitchWarning(true);
          
          addNotification("⚠️ Tab switch detected! You will be removed in 3 seconds if you don't return.", "warning");
          
          // Set timeout to remove user if they don't come back
          removalTimeoutRef.current = setTimeout(async () => {
            if (document.hidden && mode === "game" && user && !isRemoved) {
              await removePlayerForTabSwitch();
            }
          }, 3000);
        } else {
          // User returned to tab - cancel removal
          if (removalTimeoutRef.current) {
            clearTimeout(removalTimeoutRef.current);
            removalTimeoutRef.current = null;
          }
          setTabSwitchWarning(false);
          addNotification("✅ You returned to the quiz. Stay on this tab to continue playing.", "success");
        }
      }
    };
    
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (removalTimeoutRef.current) {
        clearTimeout(removalTimeoutRef.current);
      }
    };
  }, [mode, isInRoom, user, isRemoved]);

  // ─────────────────────────────────────────────────────────────────────────────
  // NOTIFICATIONS helper
  // ─────────────────────────────────────────────────────────────────────────────
  const addNotification = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setNotifications((prev) => prev.filter((n) => n.id !== id)),
      4500
    );
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Remove player for tab switching
  // ─────────────────────────────────────────────────────────────────────────────
  const removePlayerForTabSwitch = async () => {
    if (!roomId || !user || !roomData || isRemoved) return;
    
    try {
      // Add user to removed players list in the room
      const roomRef = doc(db, "quiz_rooms", roomId);
      
      // Check if user is still in the room
      const currentPlayer = roomData.players.find(p => p.uid === user.uid);
      if (!currentPlayer) return;
      
      // Update the room: remove player and add to removedPlayers array
      const updatedPlayers = roomData.players.filter(p => p.uid !== user.uid);
      
      await updateDoc(roomRef, {
        players: updatedPlayers,
        removedPlayers: arrayUnion(user.uid)
      });
      
      setRemovedPlayers(prev => [...prev, user.uid]);
      addNotification("❌ You were removed from the quiz for switching tabs!", "error");
      
      // Leave the room locally
      setMode("menu");
      setRoomId("");
      setRoomData(null);
      prevPlayersRef.current = [];
      
      // Show message about not being able to rejoin
      addNotification("⚠️ You cannot rejoin this quiz as you were removed for tab switching.", "warning");
      
    } catch (error) {
      console.error("Error removing player for tab switch:", error);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const snap = await getDoc(doc(db, "users", u.uid));
        setUsername(
          snap.exists() ? snap.data().username || "User" : u.email.split("@")[0]
        );
      } else {
        setUser(null);
        navigate("/login");
      }
    });
    return () => unsub();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // ROOM LISTENER  (real-time Firestore)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;

    const unsub = onSnapshot(doc(db, "quiz_rooms", roomId), (snap) => {
      if (!snap.exists()) {
        addNotification("Room ended or not found.", "error");
        setMode("menu");
        setRoomId("");
        return;
      }

      const data = snap.data();
      const newPlayers = data.players || [];
      const newRemovedPlayers = data.removedPlayers || [];

      setRemovedPlayers(newRemovedPlayers);
      
      // Check if current user was removed
      if (user && newRemovedPlayers.includes(user.uid)) {
        addNotification("❌ You were removed from this quiz and cannot rejoin.", "error");
        setMode("menu");
        setRoomId("");
        setRoomData(null);
        prevPlayersRef.current = [];
        return;
      }

      // ── Detect player leaves → notify host ──
      if (prevPlayersRef.current.length > 0 && user) {
        if (data.hostUid === user.uid) {
          const left = prevPlayersRef.current.filter(
            (p) => !newPlayers.some((np) => np.uid === p.uid)
          );
          left.forEach((p) => {
            const wasRemoved = newRemovedPlayers.includes(p.uid);
            addNotification(
              wasRemoved ? `🚫 ${p.name} was removed for tab switching` : `🚪 ${p.name} left the quiz`,
              wasRemoved ? "error" : "warning"
            );
          });
        }
      }
      prevPlayersRef.current = newPlayers;

      setRoomData(data);
      setPlayers(newPlayers);
      setCurrentQuestionIndex(data.currentQuestionIndex || 0);
      setShowLeaderboard(data.showLeaderboard || false);

      if (data.status === "ended" || data.expired) setMode("result");
      else if (data.status === "active") setMode("game");
      else setMode("lobby");
    });

    return () => unsub();
  }, [roomId, user]);

  // ─────────────────────────────────────────────────────────────────────────────
  // TIMER
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let interval;
    if (mode === "game" && !showLeaderboard && timeLeft > 0 && !timerAutoAdvance && !isRemoved) {
      interval = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    } else if (mode === "game" && !showLeaderboard && timeLeft === 0 && !timerAutoAdvance && !hasRecordedSkip && !isRemoved) {
      setTimerAutoAdvance(true);
      handleTimeUp();
    }
    return () => clearInterval(interval);
  }, [mode, showLeaderboard, timeLeft, timerAutoAdvance, hasRecordedSkip, isRemoved]);

  // All players answered
  useEffect(() => {
    if (mode === "game" && !showLeaderboard && roomData && players.length > 0 && !isRemoved) {
      const answered = players.filter((p) =>
        p.answers?.some((a) => a.q === currentQuestionIndex)
      ).length;
      if (answered >= players.length) handleAllPlayersAnswered();
    }
  }, [players, currentQuestionIndex, mode, showLeaderboard, isRemoved]);

  // Reset per-question state on new question
  useEffect(() => {
    if (roomData?.currentQuestionIndex !== undefined && !isRemoved) {
      setMyAnswer(null);
      setTimerAutoAdvance(false);
      setHasRecordedSkip(false); // Reset skip flag for new question
      setTimeLeft(roomData.settings?.timer || 30);
    }
  }, [roomData?.currentQuestionIndex, isRemoved]);

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  const handleTimeUp = async () => {
    if (!roomData || roomData.hostUid !== user?.uid || roomData.showLeaderboard) return;
    // Record skip for the host if they haven't answered
    if (user && !hasAnsweredCurrent && !hasRecordedSkip && !isRemoved) {
      await recordSkipAnswer();
    }
    await updateDoc(doc(db, "quiz_rooms", roomId), { showLeaderboard: true });
  };

  const handleAllPlayersAnswered = async () => {
    if (!roomData || roomData.hostUid !== user?.uid || roomData.showLeaderboard) return;
    setTimeout(async () => {
      await updateDoc(doc(db, "quiz_rooms", roomId), { showLeaderboard: true });
    }, 500);
  };

  // Function to record a skipped answer (incorrect with 0 points)
  const recordSkipAnswer = async () => {
    if (hasRecordedSkip || hasAnsweredCurrent || isRemoved) return;
    setHasRecordedSkip(true);
    
    const question = roomData.questions[currentQuestionIndex];
    // Skip means no answer selected -> incorrect, 0 points
    const isCorrect = false;
    const points = 0;

    const updated = roomData.players.map((p) =>
      p.uid === user.uid
        ? {
            ...p,
            score: (p.score || 0) + points,
            answers: [...(p.answers || []), { 
              q: currentQuestionIndex, 
              correct: isCorrect, 
              choiceIndex: null, // null indicates skipped/no answer
              skipped: true 
            }],
          }
        : p
    );
    await updateDoc(doc(db, "quiz_rooms", roomId), { players: updated });
    setMyAnswer(null);
    setLastAnsweredIndex(currentQuestionIndex);
  };

  const generateRoomId = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATE QUESTIONS — calls dedicated backend endpoint
  // ─────────────────────────────────────────────────────────────────────────────
  const generateQuestions = async () => {
    const res = await fetch(`${API_BASE}/api/quiz/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, difficulty, questionCount }),
    });

    const data = await res.json();

    if (!res.ok || !data.success || !Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error(data.error || "AI could not generate questions for this topic. Try again.");
    }
    return data.questions;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE ROOM
  // ─────────────────────────────────────────────────────────────────────────────
  const createRoom = async () => {
    if (!topic.trim()) return alert("Please enter a topic.");
    if (!hostRole) return alert("Please select your role (Teacher or Student).");

    setIsGenerating(true);
    setGenerationError("");

    try {
      const questions = await generateQuestions();
      const newRoomId = generateRoomId();
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 24);

      const timerByDiff = { easy: timerPerQ, medium: 20, hard: 10 };

      await setDoc(doc(db, "quiz_rooms", newRoomId), {
        id: newRoomId,
        hostUid: user.uid,
        hostName: username,
        hostRole,
        topic,
        status: "waiting",
        currentQuestionIndex: 0,
        showLeaderboard: false,
        expired: false,
        expirationDate: expiry.toISOString(),
        settings: {
          difficulty,
          questionCount: questions.length,
          timer: timerByDiff[difficulty] ?? 20,
        },
        questions,
        players: [{ uid: user.uid, name: username, score: 0, answers: [], isHost: true, role: hostRole }],
        removedPlayers: [], // Track users removed for tab switching
        createdAt: serverTimestamp(),
      });

      setRoomId(newRoomId);
      setMode("lobby");
      setGenerationError("");
    } catch (e) {
      console.error("Room creation error:", e);
      setGenerationError(e.message || "Failed to generate questions. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // JOIN ROOM
  // ─────────────────────────────────────────────────────────────────────────────
  const joinRoom = async (idInput) => {
    const id = idInput.trim().toUpperCase();
    if (!id) return;

    const roomRef = doc(db, "quiz_rooms", id);
    const snap = await getDoc(roomRef);

    if (!snap.exists()) return alert("Room not found.");

    const data = snap.data();
    
    // Check if user was removed from this room
    const removedList = data.removedPlayers || [];
    if (removedList.includes(user.uid)) {
      alert("You were removed from this quiz for switching tabs and cannot rejoin.");
      return;
    }
    
    if (data.status === "ended" || data.expired) return alert("This quiz has already ended.");
    if (data.expirationDate && new Date(data.expirationDate) < new Date()) {
      await updateDoc(roomRef, { expired: true, status: "ended" });
      return alert("This quiz room has expired.");
    }
    if ((data.players || []).length >= 25) return alert("Room is full (max 25).");

    if (!data.players.some((p) => p.uid === user.uid)) {
      await updateDoc(roomRef, {
        players: arrayUnion({ uid: user.uid, name: username, score: 0, answers: [], isHost: false }),
      });
    }
    setRoomId(id);
    setRemovedPlayers([]); // Reset removed status for this room
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // LEAVE ROOM  (called when user confirms leaving)
  // ─────────────────────────────────────────────────────────────────────────────
  const leaveRoom = async () => {
    if (!roomId || !user || !roomData) return;

    if (roomData.hostUid === user.uid) {
      // Host leaves → end the room for everyone
      await updateDoc(doc(db, "quiz_rooms", roomId), { status: "ended", expired: true });
    } else {
      // Player leaves → remove from players array
      const updated = roomData.players.filter((p) => p.uid !== user.uid);
      await updateDoc(doc(db, "quiz_rooms", roomId), { players: updated });
    }

    setMode("menu");
    setRoomId("");
    setRoomData(null);
    prevPlayersRef.current = [];
    setRemovedPlayers([]);
    setTabSwitchWarning(false);
    if (removalTimeoutRef.current) {
      clearTimeout(removalTimeoutRef.current);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // GAME CONTROLS
  // ─────────────────────────────────────────────────────────────────────────────
  const startGame = async () => {
    if (!roomData) return;
    await updateDoc(doc(db, "quiz_rooms", roomId), {
      status: "active",
      currentQuestionIndex: 0,
      showLeaderboard: false,
    });
  };

  const submitAnswer = async (optionIndex) => {
    if (hasAnsweredCurrent || showLeaderboard || isRemoved) return;
    setMyAnswer(optionIndex);
    setLastAnsweredIndex(currentQuestionIndex);

    const question = roomData.questions[currentQuestionIndex];
    const isCorrect = optionIndex === question.correctIndex;
    const points = isCorrect
      ? Math.ceil(100 * (timeLeft / (roomData.settings.timer || 30)))
      : 0;

    const updated = roomData.players.map((p) =>
      p.uid === user.uid
        ? {
            ...p,
            score: (p.score || 0) + points,
            answers: [...(p.answers || []), { q: currentQuestionIndex, correct: isCorrect, choiceIndex: optionIndex, skipped: false }],
          }
        : p
    );
    await updateDoc(doc(db, "quiz_rooms", roomId), { players: updated });
  };

  const nextQuestion = async () => {
    if (!roomData) return;
    const nextIdx = roomData.currentQuestionIndex + 1;
    if (nextIdx >= roomData.questions.length) {
      await updateDoc(doc(db, "quiz_rooms", roomId), { status: "ended", expired: true });
    } else {
      await updateDoc(doc(db, "quiz_rooms", roomId), {
        currentQuestionIndex: nextIdx,
        showLeaderboard: false,
      });
    }
  };

  const kickPlayer = async (uid) => {
    const updated = roomData.players.filter((p) => p.uid !== uid);
    await updateDoc(doc(db, "quiz_rooms", roomId), { players: updated });
  };

  const deleteRoom = async () => {
    if (!window.confirm("End quiz and remove all players?")) return;
    await updateDoc(doc(db, "quiz_rooms", roomId), { status: "ended", expired: true });
    setMode("menu");
    setRoomId("");
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TEACHER EDIT
  // ─────────────────────────────────────────────────────────────────────────────
  const openEditModal = () => {
    setEditQuestions(JSON.parse(JSON.stringify(roomData.questions)));
    setEditingQIdx(0);
    setShowEditModal(true);
  };

  const saveEdits = async () => {
    setIsSavingEdits(true);
    try {
      await updateDoc(doc(db, "quiz_rooms", roomId), { questions: editQuestions });
      setShowEditModal(false);
      addNotification("✅ Questions updated for all players!", "success");
    } catch {
      addNotification("❌ Failed to save changes.", "error");
    } finally {
      setIsSavingEdits(false);
    }
  };

  const updateEditQ = (qi, field, value) =>
    setEditQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, [field]: value } : q)));

  const updateEditOpt = (qi, oi, value) =>
    setEditQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qi) return q;
        const opts = [...q.options];
        opts[oi] = value;
        return { ...q, options: opts };
      })
    );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER GUARDS
  // ─────────────────────────────────────────────────────────────────────────────
  if (!user) return <div className="p-10 text-center">Loading...</div>;
  
  // If user was removed, show message
  if (isRemoved && mode !== "menu") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: theme.background, color: theme.textPrimary }}>
        <div className="text-center max-w-md p-8 rounded-2xl border-2 border-red-500/30" style={{ background: theme.card }}>
          <AlertTriangle size={64} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-red-400">Removed from Quiz</h2>
          <p className="mb-4 opacity-70">You were removed for switching tabs during the quiz.</p>
          <p className="mb-6 text-sm opacity-60">You cannot rejoin this quiz room.</p>
          <button
            onClick={() => { setMode("menu"); setRoomId(""); setRoomData(null); setRemovedPlayers([]); }}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  const isHost = roomData?.hostUid === user.uid;
  const isTeacher = isHost && roomData?.hostRole === "teacher";
  const currentQ = roomData?.questions?.[currentQuestionIndex];

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen p-4 sm:p-6 lg:p-8 transition-colors duration-300"
      style={{ background: theme.background, color: theme.textPrimary }}
    >
      {/* Tab Switch Warning Banner */}
      {tabSwitchWarning && mode === "game" && !isRemoved && (
        <div className="fixed top-0 left-0 right-0 z-50 animate-pulse">
          <div className="bg-red-500 text-white px-4 py-2 text-center text-sm font-medium">
            ⚠️ Tab switch detected! Return to this tab within 3 seconds or you will be removed from the quiz.
          </div>
        </div>
      )}

      {/* ── LEAVE CONFIRMATION OVERLAY ── */}
      {blocker.state === "blocked" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div
            className="rounded-2xl p-6 sm:p-8 max-w-sm w-full mx-4 shadow-2xl border animate-fade-in"
            style={{ background: theme.card, borderColor: theme.border }}
          >
            <div className="text-5xl mb-4 text-center">⚠️</div>
            <h3 className="text-xl font-bold text-center mb-2">Leave the Quiz?</h3>
            <p className="text-center opacity-70 mb-6 text-sm leading-relaxed">
              You will be{" "}
              <span className="text-red-400 font-bold">removed from the quiz room</span>{" "}
              if you leave. This cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => { leaveRoom(); blocker.proceed(); }}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors"
              >
                Leave Anyway
              </button>
              <button
                onClick={() => blocker.reset()}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors"
              >
                Stay in Quiz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS ── */}
      <div className="fixed top-4 right-4 z-40 flex flex-col gap-2 pointer-events-none max-w-[90vw] sm:max-w-sm">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`px-4 py-3 rounded-xl shadow-xl text-white font-medium text-sm animate-fade-in break-words
              ${n.type === "error" ? "bg-red-500" :
                n.type === "warning" ? "bg-orange-500" :
                n.type === "success" ? "bg-green-500" : "bg-blue-500"}`}
          >
            {n.message}
          </div>
        ))}
      </div>

      {/* ── TEACHER EDIT MODAL ── */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)" }}
        >
          <div
            className="rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border"
            style={{ background: theme.card, borderColor: theme.border }}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 sm:p-5 border-b flex-wrap gap-2" style={{ borderColor: theme.border }}>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Pencil size={18} className="text-purple-400" /> Preview &amp; Edit Questions
              </h2>
              <button onClick={() => setShowEditModal(false)} className="opacity-60 hover:opacity-100">
                <X size={22} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
              {/* Question list */}
              <div
                className="sm:w-2/5 border-r overflow-y-auto p-3 space-y-2 shrink-0 max-h-[40vh] sm:max-h-full"
                style={{ borderColor: theme.border }}
              >
                {editQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => setEditingQIdx(i)}
                    className={`w-full text-left p-3 rounded-xl text-xs leading-snug transition-all
                      ${editingQIdx === i ? "bg-purple-600 text-white" : "bg-white/5 hover:bg-white/10"}`}
                  >
                    <span className="font-bold">Q{i + 1}. </span>
                    {q.question.substring(0, 60)}{q.question.length > 60 ? "…" : ""}
                  </button>
                ))}
              </div>

              {/* Editor pane */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                {editQuestions[editingQIdx] && (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold mb-2 text-purple-400 uppercase tracking-wider">
                        Question Text
                      </label>
                      <textarea
                        value={editQuestions[editingQIdx].question}
                        onChange={(e) => updateEditQ(editingQIdx, "question", e.target.value)}
                        rows={3}
                        className="w-full p-3 rounded-xl border bg-transparent resize-none text-sm"
                        style={{ borderColor: theme.border }}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-3 text-purple-400 uppercase tracking-wider">
                        Answer Options <span className="opacity-60 normal-case">(select radio = correct answer)</span>
                      </label>
                      {editQuestions[editingQIdx].options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-3 mb-3 flex-wrap sm:flex-nowrap">
                          <input
                            type="radio"
                            name={`correct-${editingQIdx}`}
                            checked={editQuestions[editingQIdx].correctIndex === oi}
                            onChange={() => updateEditQ(editingQIdx, "correctIndex", oi)}
                            className="w-4 h-4 accent-purple-500 shrink-0"
                          />
                          <span className="font-bold text-sm w-5 opacity-50 shrink-0">
                            {String.fromCharCode(65 + oi)}.
                          </span>
                          <input
                            value={opt}
                            onChange={(e) => updateEditOpt(editingQIdx, oi, e.target.value)}
                            className="flex-1 min-w-[200px] p-2 rounded-lg border bg-transparent text-sm"
                            style={{ borderColor: theme.border }}
                          />
                          {editQuestions[editingQIdx].correctIndex === oi && (
                            <CheckCircle size={16} className="text-green-400 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-4 sm:p-5 border-t flex-col sm:flex-row" style={{ borderColor: theme.border }}>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-3 rounded-xl font-bold border opacity-60 hover:opacity-100 text-sm"
                style={{ borderColor: theme.border }}
              >
                Cancel
              </button>
              <button
                onClick={saveEdits}
                disabled={isSavingEdits}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {isSavingEdits ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save &amp; Push to Players
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2 sm:gap-3">
          <Brain className="text-purple-500" size={28} /> Quiz Arena
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {isTeacher && isInRoom && (
            <button
              onClick={openEditModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold border transition-all hover:scale-105"
              style={{
                background: "rgba(168,85,247,0.15)",
                borderColor: "rgba(168,85,247,0.5)",
                color: "#c084fc",
              }}
            >
              <Pencil size={14} /> Edit Questions
            </button>
          )}
          {roomId && mode !== "result" && (
            <div className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs sm:text-sm font-mono">
              Room: {roomId}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MENU MODE
      ══════════════════════════════════════════════════════════════════════ */}
      {mode === "menu" && (
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mt-6 sm:mt-10">
          {/* Join */}
          <div
            className="p-6 sm:p-8 rounded-2xl border-2 transition-all hover:scale-[1.02]"
            style={{ borderColor: theme.border, background: theme.card }}
          >
            <Users size={40} className="mb-4 text-blue-500" />
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Join a Quiz</h2>
            <p className="mb-6 opacity-70 text-sm sm:text-base">Enter a code to join an existing game.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="room-input"
                placeholder="X7Y2Z9"
                className="flex-1 p-3 rounded-xl border-4 bg-transparent text-lg uppercase font-mono tracking-widest text-center"
                style={{ borderColor: theme.border }}
              />
              <button
                onClick={() => joinRoom(document.getElementById("room-input").value)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
              >
                JOIN
              </button>
            </div>
          </div>

          {/* Host */}
          <div
            className="p-6 sm:p-8 rounded-2xl border-2 transition-all hover:scale-[1.02]"
            style={{ borderColor: theme.border, background: theme.card }}
          >
            <Trophy size={40} className="mb-4 text-yellow-500" />
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Host a Quiz</h2>
            <p className="mb-6 opacity-70 text-sm sm:text-base">Create a room and challenge your friends.</p>
            <button
              onClick={() => setMode("create")}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"
            >
              <Plus size={20} /> Create Room
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CREATE MODE
      ══════════════════════════════════════════════════════════════════════ */}
      {mode === "create" && (
        <div
          className="max-w-xl mx-auto p-6 sm:p-8 rounded-2xl border shadow-lg"
          style={{ borderColor: theme.border, background: theme.card }}
        >
          <h2 className="text-xl sm:text-2xl font-bold mb-6">Quiz Settings</h2>

          {generationError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-sm text-red-400">
              ❌ {generationError}
            </div>
          )}

          <div className="space-y-5">
            {/* Topic */}
            <div>
              <label className="block text-sm font-bold mb-2">Topic / Subject</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Food, History of Rome, Java Programming…"
                className="w-full p-3 rounded-lg border bg-transparent text-sm sm:text-base"
                style={{ borderColor: theme.border }}
              />
            </div>

            {/* Role selection */}
            <div>
              <label className="block text-sm font-bold mb-3">Your Role</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setHostRole("student")}
                  className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all ${
                    hostRole === "student"
                      ? "border-blue-500 bg-blue-500/15"
                      : "hover:border-blue-500/50"
                  }`}
                  style={{ borderColor: hostRole === "student" ? undefined : theme.border }}
                >
                  <GraduationCap size={24} className={hostRole === "student" ? "text-blue-400" : "opacity-50"} />
                  <span className="font-bold text-xs sm:text-sm">Student</span>
                  <span className="text-xs opacity-50 text-center">Play the quiz</span>
                </button>
                <button
                  onClick={() => setHostRole("teacher")}
                  className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all ${
                    hostRole === "teacher"
                      ? "border-purple-500 bg-purple-500/15"
                      : "hover:border-purple-500/50"
                  }`}
                  style={{ borderColor: hostRole === "teacher" ? undefined : theme.border }}
                >
                  <BookOpen size={24} className={hostRole === "teacher" ? "text-purple-400" : "opacity-50"} />
                  <span className="font-bold text-xs sm:text-sm">Teacher</span>
                  <span className="text-xs opacity-50 text-center">Preview &amp; edit questions</span>
                </button>
              </div>
            </div>

            {/* Difficulty + Count */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full p-3 rounded-lg border bg-transparent text-sm"
                  style={{ borderColor: theme.border }}
                >
                  <option value="easy" style={{ background: theme.background }}>Easy</option>
                  <option value="medium" style={{ background: theme.background }}>Medium</option>
                  <option value="hard" style={{ background: theme.background }}>Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Questions</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full p-3 rounded-lg border bg-transparent text-sm"
                  style={{ borderColor: theme.border }}
                >
                  {[5, 10, 15, 20].map((n) => (
                    <option key={n} value={n} style={{ background: theme.background }}>{n} Questions</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom timer for Easy */}
            {difficulty === "easy" && (
              <div>
                <label className="block text-sm font-bold mb-2">Time per Question (sec)</label>
                <input
                  type="number"
                  value={timerPerQ}
                  min={10}
                  max={120}
                  onChange={(e) => setTimerPerQ(Number(e.target.value))}
                  className="w-full p-3 rounded-lg border bg-transparent text-sm"
                  style={{ borderColor: theme.border }}
                />
              </div>
            )}

            <button
              onClick={createRoom}
              disabled={isGenerating || !hostRole}
              className="w-full py-4 mt-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Generating Questions with AI…
                </>
              ) : (
                <>
                  <Play size={20} /> Start Hosting
                </>
              )}
            </button>

            <button
              onClick={() => { setMode("menu"); setGenerationError(""); setHostRole(""); }}
              className="w-full text-sm opacity-60 hover:opacity-100 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          LOBBY MODE
      ══════════════════════════════════════════════════════════════════════ */}
      {mode === "lobby" && (
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold mb-2 text-purple-500 tracking-wider break-all">{roomId}</h2>
            <p className="opacity-70 text-sm sm:text-base">Share this code with your friends!</p>
            {roomData?.topic && (
              <p className="mt-2 text-xs sm:text-sm opacity-50">
                Topic: <span className="font-bold opacity-100">{roomData.topic}</span>
                {" · "}{roomData.settings?.difficulty} · {roomData.questions?.length} Qs
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
            {players.map((p) => (
              <div key={p.uid} className="p-3 sm:p-4 rounded-xl bg-white/10 relative group">
                {isHost && p.uid !== user.uid && (
                  <button
                    onClick={() => kickPlayer(p.uid)}
                    className="absolute top-1 right-1 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <XCircle size={16} />
                  </button>
                )}
                <div className="font-bold truncate text-sm sm:text-base">{p.name}</div>
                <div className="flex justify-center gap-1 text-xs">
                  {p.isHost && <span className="text-yellow-500">HOST</span>}
                  {p.role === "teacher" && <span className="text-purple-400">👩‍🏫</span>}
                </div>
              </div>
            ))}
          </div>

          {isHost ? (
            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={startGame}
                className="px-6 sm:px-10 py-3 sm:py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-base sm:text-xl shadow-lg hover:scale-105 transition-transform"
              >
                Start Quiz
              </button>
              <button
                onClick={deleteRoom}
                className="px-4 sm:px-6 py-3 sm:py-4 bg-red-500/20 text-red-400 rounded-xl font-bold hover:bg-red-500/30 text-sm sm:text-base"
              >
                Cancel Room
              </button>
            </div>
          ) : (
            <div className="text-base sm:text-xl animate-pulse">Waiting for host to start…</div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GAME MODE
      ══════════════════════════════════════════════════════════════════════ */}
      {mode === "game" && (
        <div className="max-w-5xl mx-auto">
          {/* Top Bar */}
          <div className="flex justify-between items-center mb-4 sm:mb-6 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg font-bold text-xs sm:text-sm">
                Q{currentQuestionIndex + 1}/{roomData?.questions?.length}
              </span>
              {isHost && (
                <span className="text-[10px] sm:text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                  Host
                </span>
              )}
              {isTeacher && (
                <span className="text-[10px] sm:text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full flex items-center gap-1">
                  <BookOpen size={10} /> Teacher
                </span>
              )}
            </div>
            <div className={`flex items-center gap-2 text-base sm:text-xl font-mono font-bold ${timeLeft < 5 ? "text-red-400 animate-pulse" : ""}`}>
              <Clock size={18} /> {timeLeft}s
            </div>
          </div>

          {showLeaderboard ? (
            /* LEADERBOARD */
            <div className="text-center animate-fade-in">
              <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Leaderboard</h2>
              <div className="space-y-3 max-w-2xl mx-auto px-2">
                {[...players].sort((a, b) => b.score - a.score).slice(0, 5).map((p, i) => (
                  <div
                    key={p.uid}
                    className="flex justify-between items-center p-3 sm:p-4 rounded-xl border-2"
                    style={{
                      borderColor: p.uid === user.uid ? "#a855f7" : theme.border,
                      background: p.uid === user.uid ? "rgba(168,85,247,0.1)" : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div className="flex items-center gap-2 sm:gap-4">
                      <span className="font-mono font-bold text-base sm:text-xl w-6 sm:w-8">#{i + 1}</span>
                      <span className="font-bold text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">{p.name}</span>
                      {p.isHost && <span className="text-[10px] sm:text-xs text-yellow-400">(Host)</span>}
                    </div>
                    <span className="font-mono font-bold text-purple-400 text-sm sm:text-base">{p.score} pts</span>
                  </div>
                ))}
              </div>

              {/* Show my rank if not top 5 */}
              {![...players].sort((a, b) => b.score - a.score).slice(0, 5).find((p) => p.uid === user.uid) && (
                <div className="mt-4 p-3 sm:p-4 rounded-xl border border-purple-500 bg-purple-500/10 max-w-2xl mx-auto flex justify-between">
                  <span className="text-sm sm:text-base">You</span>
                  <span className="text-sm sm:text-base">{players.find((p) => p.uid === user.uid)?.score || 0} pts</span>
                </div>
              )}

              {isHost && (
                <button
                  onClick={nextQuestion}
                  className="mt-8 sm:mt-10 px-6 sm:px-8 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm sm:text-base"
                >
                  Next Question <ArrowRight className="inline ml-2" size={18} />
                </button>
              )}
            </div>
          ) : (
            /* QUESTION VIEW */
            <div className="animate-fade-in">
              <div className="text-center mb-6 sm:mb-10">
                <h2 className="text-xl sm:text-2xl md:text-4xl font-bold mb-4 sm:mb-6 leading-tight px-2">
                  {currentQ?.question}
                </h2>
                <div className="text-xs sm:text-sm opacity-60">
                  {players.filter((p) => p.answers?.some((a) => a.q === currentQuestionIndex)).length}
                  {" / "}{players.length} answered
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 max-w-4xl mx-auto px-2">
                {currentQ?.options.map((opt, idx) => {
                  const colors = [
                    "bg-blue-500 border-blue-600",
                    "bg-purple-500 border-purple-600",
                    "bg-orange-500 border-orange-600",
                    "bg-pink-500 border-pink-600",
                  ];
                  const base = colors[idx % 4];

                  let cls = `${base} text-white`;
                  if (hasAnsweredCurrent) {
                    if (idx === currentQ.correctIndex) cls = "bg-green-500 border-green-600 text-white";
                    else if (myAnswer === idx) cls = "bg-red-500 border-red-600 text-white";
                    else cls = `${base} text-white opacity-40`;
                  }

                  return (
                    <button
                      key={idx}
                      disabled={hasAnsweredCurrent}
                      onClick={() => submitAnswer(idx)}
                      className={`p-4 sm:p-6 rounded-2xl text-left text-sm sm:text-lg font-bold border-2 transition-all transform hover:scale-[1.01] ${cls}`}
                    >
                      <span className="inline-block w-6 sm:w-8 opacity-60 text-sm sm:text-base">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <span className="break-words">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {isHost && !showLeaderboard && (
                <div className="mt-6 sm:mt-8 text-center">
                  <button
                    onClick={async () => {
                      if (!hasRecordedSkip && !hasAnsweredCurrent && user) {
                        await recordSkipAnswer();
                      }
                      await updateDoc(doc(db, "quiz_rooms", roomId), { showLeaderboard: true });
                    }}
                    className="px-4 sm:px-6 py-1.5 sm:py-2 bg-white/10 rounded-lg hover:bg-white/20 text-xs sm:text-sm"
                  >
                    Skip to Leaderboard
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          RESULT MODE
      ══════════════════════════════════════════════════════════════════════ */}
      {mode === "result" && (
        <div className="text-center py-6 sm:py-10 animate-fade-in">
          <Trophy size={60} className="text-yellow-400 mx-auto mb-4 sm:mb-6 animate-bounce" />
          <h1 className="text-2xl sm:text-4xl font-bold mb-2">Quiz Completed!</h1>
          <p className="opacity-70 mb-6 sm:mb-10 text-sm sm:text-base">Here are the champions</p>

          <div className="flex justify-center items-end gap-2 sm:gap-4 mb-8 sm:mb-12 h-48 sm:h-64">
            {[...players].sort((a, b) => b.score - a.score).length > 1 && (
              <div className="w-16 sm:w-24 bg-gray-400 rounded-t-xl flex flex-col items-center justify-end pb-4 h-24 sm:h-32">
                <div className="mb-1 sm:mb-2 font-bold truncate max-w-full px-1 text-xs sm:text-sm">
                  {[...players].sort((a, b) => b.score - a.score)[1].name}
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white/60">2</div>
              </div>
            )}
            {[...players].sort((a, b) => b.score - a.score).length > 0 && (
              <div className="w-20 sm:w-28 bg-yellow-400 text-black rounded-t-xl flex flex-col items-center justify-end pb-4 h-36 sm:h-48 shadow-[0_0_30px_rgba(250,204,21,0.5)]">
                <Trophy size={20} className="mb-1 sm:mb-2" />
                <div className="mb-1 sm:mb-2 font-bold text-base sm:text-xl truncate max-w-full px-1">
                  {[...players].sort((a, b) => b.score - a.score)[0].name}
                </div>
                <div className="text-3xl sm:text-5xl font-bold">1</div>
              </div>
            )}
            {[...players].sort((a, b) => b.score - a.score).length > 2 && (
              <div className="w-16 sm:w-24 bg-orange-700 rounded-t-xl flex flex-col items-center justify-end pb-4 h-20 sm:h-24">
                <div className="mb-1 sm:mb-2 font-bold truncate max-w-full px-1 text-xs sm:text-sm">
                  {[...players].sort((a, b) => b.score - a.score)[2].name}
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white/60">3</div>
              </div>
            )}
          </div>

          {/* My score summary */}
          {(() => {
            const me = players.find(p => p.uid === user?.uid);
            if (!me) return null;
            const myAnswers = me.answers || [];
            const correctCount = myAnswers.filter(a => a.correct).length;
            const totalQuestions = roomData?.questions?.length || myAnswers.length;
            return (
              <div className="max-w-sm mx-auto mb-6 p-3 sm:p-4 rounded-2xl border" style={{ background: 'rgba(168,85,247,0.1)', borderColor: 'rgba(168,85,247,0.5)' }}>
                <p className="text-base sm:text-lg font-bold mb-1">Your Score: <span className="text-purple-400">{me.score} pts</span></p>
                <p className="text-xs sm:text-sm opacity-70">{correctCount} / {totalQuestions} correct</p>
              </div>
            );
          })()}

          <div className="flex gap-3 sm:gap-4 justify-center flex-wrap">
            <button
              onClick={() => setShowInspectModal(true)}
              className="px-5 sm:px-8 py-2 sm:py-3 rounded-xl font-bold text-white flex items-center gap-2 transition-all hover:scale-105 text-sm sm:text-base"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}
            >
              <Search size={16} /> Inspect My Answers
            </button>
            <button
              onClick={() => { setMode("menu"); setRoomId(""); setRoomData(null); prevPlayersRef.current = []; setRemovedPlayers([]); }}
              className="px-5 sm:px-8 py-2 sm:py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm sm:text-base"
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}

      {/* ── INSPECT MODAL ── */}
      {showInspectModal && roomData?.questions && (() => {
        const me = players.find(p => p.uid === user?.uid);
        const myAnswers = me?.answers || [];
        const questions = roomData.questions;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)" }}
          >
            <div
              className="rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border"
              style={{ background: theme.card, borderColor: theme.border }}
            >
              {/* Header */}
              <div className="flex justify-between items-center p-4 sm:p-5 border-b" style={{ borderColor: theme.border }}>
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <Search size={18} className="text-blue-400" />
                  Answer Inspection
                  <span className="text-xs font-normal opacity-60 ml-1">— Review what you got wrong</span>
                </h2>
                <button onClick={() => setShowInspectModal(false)} className="opacity-60 hover:opacity-100 transition-opacity">
                  <X size={20} />
                </button>
              </div>

              {/* Summary bar */}
              {(() => {
                const correct = myAnswers.filter(a => a.correct).length;
                const total = questions.length;
                const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                return (
                  <div className="px-4 sm:px-5 py-2 sm:py-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 border-b" style={{ borderColor: theme.border, background: 'rgba(168,85,247,0.05)' }}>
                    <div className="flex-1 w-full">
                      <div className="flex justify-between text-[10px] sm:text-xs mb-1 opacity-70">
                        <span>{correct} correct out of {total}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 sm:h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: pct >= 70 ? '#22c55e' : pct >= 40 ? '#eab308' : '#ef4444' }}
                        />
                      </div>
                    </div>
                    <span className={`font-bold text-sm sm:text-lg ${pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {pct >= 70 ? '🎉 Great job!' : pct >= 40 ? '📚 Keep studying!' : '💪 Keep practicing!'}
                    </span>
                  </div>
                );
              })()}

              {/* Questions list */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 sm:space-y-5">
                {questions.map((q, qi) => {
                  const myAns = myAnswers.find(a => a.q === qi);
                  const answered = myAns !== undefined;
                  const isCorrect = myAns?.correct === true;
                  const myChoiceIdx = answered
                    ? (me?.answers?.find(a => a.q === qi)?.choiceIndex ?? null)
                    : null;
                  const isSkipped = myAns?.skipped === true;

                  return (
                    <div
                      key={qi}
                      className="rounded-xl border-2 overflow-hidden"
                      style={{
                        borderColor: !answered ? 'rgba(255,255,255,0.15)' : isCorrect ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
                        background: !answered ? 'rgba(255,255,255,0.03)' : isCorrect ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                      }}
                    >
                      {/* Question header */}
                      <div className="px-3 sm:px-4 py-2 sm:py-3 flex items-start gap-2 sm:gap-3">
                        <span className={`text-base sm:text-lg mt-0.5 flex-shrink-0 ${!answered ? 'opacity-40' : isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                          {!answered ? '⏭️' : isCorrect ? '✅' : '❌'}
                        </span>
                        <div className="flex-1">
                          <span className="text-[10px] sm:text-xs font-bold opacity-50 uppercase tracking-wider mr-2">Q{qi + 1}</span>
                          <span className="font-semibold text-xs sm:text-sm leading-relaxed">{q.question}</span>
                        </div>
                      </div>

                      {/* Options */}
                      <div className="px-3 sm:px-4 pb-2 sm:pb-3 grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2">
                        {q.options.map((opt, oi) => {
                          const isCorrectOpt = oi === q.correctIndex;
                          const isUserChoice = answered && myChoiceIdx === oi;

                          let optStyle = { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' };
                          let optTextClass = 'opacity-60';
                          let badge = null;

                          if (isCorrectOpt) {
                            optStyle = { background: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.5)' };
                            optTextClass = 'text-green-300 font-bold';
                            badge = <span className="ml-auto text-green-400 text-[8px] sm:text-[10px] font-bold whitespace-nowrap">✓ Correct</span>;
                          }
                          if (isUserChoice && !isCorrectOpt) {
                            optStyle = { background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.5)' };
                            optTextClass = 'text-red-300 font-bold';
                            badge = <span className="ml-auto text-red-400 text-[8px] sm:text-[10px] font-bold whitespace-nowrap">✗ Your answer</span>;
                          }
                          if (isUserChoice && isCorrectOpt) {
                            badge = <span className="ml-auto text-green-400 text-[8px] sm:text-[10px] font-bold whitespace-nowrap">✓ Your correct answer</span>;
                          }

                          return (
                            <div
                              key={oi}
                              className={`flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2.5 rounded-lg border text-[10px] sm:text-xs ${optTextClass}`}
                              style={optStyle}
                            >
                              <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] sm:text-[10px] font-bold"
                                style={{ background: isCorrectOpt ? 'rgba(34,197,94,0.4)' : isUserChoice && !isCorrectOpt ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)' }}>
                                {String.fromCharCode(65 + oi)}
                              </span>
                              <span className="flex-1 break-words">{opt}</span>
                              {badge}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation — always shown for wrong or skipped questions */}
                      {(!isCorrect || !answered || isSkipped) && (
                        <div className="mx-2 sm:mx-4 mb-2 sm:mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(59,130,246,0.4)' }}>
                          {/* Correct answer callout */}
                          <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2.5" style={{ background: 'rgba(34,197,94,0.12)', borderBottom: '1px solid rgba(59,130,246,0.2)' }}>
                            <span className="text-green-400 text-xs sm:text-base">✅</span>
                            <span className="text-[10px] sm:text-xs font-bold text-green-300">
                              Correct Answer: {String.fromCharCode(65 + q.correctIndex)}. {q.options[q.correctIndex]}
                            </span>
                          </div>

                          {/* User's wrong choice (only if answered and wrong) */}
                          {answered && myChoiceIdx !== null && myChoiceIdx !== q.correctIndex && (
                            <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2" style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(59,130,246,0.2)' }}>
                              <span className="text-red-400 text-xs sm:text-base">❌</span>
                              <span className="text-[10px] sm:text-xs text-red-300">
                                You chose: {String.fromCharCode(65 + myChoiceIdx)}. {q.options[myChoiceIdx]}
                              </span>
                            </div>
                          )}

                          {/* Explanation text */}
                          <div className="px-3 sm:px-4 py-2 sm:py-3" style={{ background: 'rgba(59,130,246,0.07)' }}>
                            <p className="text-[10px] sm:text-xs font-bold text-blue-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                              💡 Why this answer?
                            </p>
                            <p className="text-[11px] sm:text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.88)' }}>
                              {q.explanation
                                ? q.explanation
                                : `The correct answer is "${q.options[q.correctIndex]}". Review this topic to understand why the other options are incorrect.`}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Skip note */}
                      {!answered && (
                        <div className="mx-2 sm:mx-4 mb-2 sm:mb-4 px-2 sm:px-3 py-1 sm:py-2 rounded-lg text-[10px] sm:text-xs italic" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)' }}>
                          ⏱️ You ran out of time and didn't answer this question.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-5 border-t" style={{ borderColor: theme.border }}>
                <button
                  onClick={() => setShowInspectModal(false)}
                  className="w-full py-2 sm:py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors text-sm sm:text-base"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  ); 
}