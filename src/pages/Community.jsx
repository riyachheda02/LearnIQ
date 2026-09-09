import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc, arrayRemove, arrayUnion, collection, doc, getDoc, limit,
  onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc,
  where, deleteDoc,
} from "firebase/firestore";
import axios from "axios";
import { Paperclip, X, Loader2, Smile, Reply, Pencil, Trash2, Send, Menu, ChevronLeft } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const UPLOADTHING_ENDPOINT = `${API_BASE}/api/upload-thing`;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const EMOJI_LIST = [
  // Reactions
  "👍", "👎", "❤️", "🔥", "💯", "🎉", "👏", "✨",
  // Expressions
  "😂", "😭", "😮", "😢", "😍", "🥹", "😎", "🤔",
  "🤧", "😤", "🥺", "😏", "🤯", "🫡", "😴", "🤮",
  // Gestures & People
  "👀", "🙌", "🫶", "🤝", "🙏", "💪", "🫠", "🤌",
  // Symbols & Objects
  "💀", "👻", "🚀", "💡", "⚡", "🎯", "💎", "🫧",
];

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
const formatDateHeader = (ts) => {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return null;
  const diff = Math.floor((new Date() - d) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString();
};

// ─── AttachmentPreview ───────────────────────────────────────────────────────
function AttachmentPreview({ att }) {
  if (!att?.url) return null;
  const isImg = att.type?.startsWith("image/");
  return isImg ? (
    <a href={att.url} target="_blank" rel="noopener noreferrer" className="inline-block">
      <img src={att.url} alt={att.name} className="max-w-[180px] sm:max-w-[220px] max-h-32 sm:max-h-40 rounded-xl object-cover mt-2 border border-white/10" />
    </a>
  ) : (
    <a href={att.url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm">
      <Paperclip size={14} /> <span className="truncate max-w-[150px] sm:max-w-[200px]">{att.name}</span>
    </a>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export default function Community() {
  const { theme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState("servers"); // "servers" or "chat"
  
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile && mobileView === "chat") {
        setMobileView("servers");
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [mobileView]);

  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState(null);
  const selectedServerIdRef = useRef(selectedServerId);
  useEffect(() => { selectedServerIdRef.current = selectedServerId; }, [selectedServerId]);

  const CHANNELS = ["announcements", "discussion"];
  const [selectedChannel, setSelectedChannel] = useState("discussion");
  const [messages, setMessages] = useState({ announcements: [], discussion: [] });
  const [publicServers, setPublicServers] = useState([]);
  const [suggestedServers, setSuggestedServers] = useState([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllExplore, setShowAllExplore] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");

  const selectedServer = useMemo(
    () => servers.find((s) => s.id === selectedServerId) || null,
    [servers, selectedServerId]
  );

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      if (u) {
        const ud = await getDoc(doc(db, "users", u.uid));
        const data = ud.exists() ? ud.data() : null;
        const name = data?.username || (u.email ? u.email.split("@")[0] : "User");
        setUsername(name);
        if (!ud.exists()) {
          await setDoc(doc(db, "users", u.uid), {
            uid: u.uid, username: name, email: u.email || "",
            createdAt: serverTimestamp(), createdServers: [], joinedServers: [],
          }, { merge: true });
        }
      }
    });
    return () => unsub();
  }, []);

  // Fetch my servers
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "servers"), where("membersIds", "array-contains", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.deleted !== true)
        .sort((a, b) => a.name.localeCompare(b.name));
      setServers(list);
      const cur = selectedServerIdRef.current;
      if (list.length > 0 && (!cur || !list.find((s) => s.id === cur))) {
        setSelectedServerId(list[0].id);
        if (isMobile) setMobileView("chat");
      }
      else if (list.length === 0) setSelectedServerId(null);
    });
    return () => unsub();
  }, [user, isMobile]);

  // Public servers & suggestions
  useEffect(() => {
    const q = query(collection(db, "servers"), where("visibility", "==", "public"), limit(100));
    const unsub = onSnapshot(q, async (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.deleted !== true && (s.membersCount || 0) > 0);
      setPublicServers(list);
      let suggestions = [];
      if (user) {
        try {
          const chatSnap = await getDoc(doc(db, "chats", user.uid));
          if (chatSnap.exists()) {
            const recentText = (chatSnap.data().chats || []).slice(0, 5)
              .flatMap((c) => c.messages || []).slice(-20)
              .map((m) => m.content).join(" ").toLowerCase();
            suggestions = list.map((s) => {
              let score = 0;
              if ((s.keywords || []).some((k) => recentText.includes(k.toLowerCase()))) score += 5;
              if (recentText.includes(s.name.toLowerCase())) score += 3;
              return { ...s, score };
            }).filter((s) => s.score > 0)
              .sort((a, b) => b.score - a.score || (b.membersCount || 0) - (a.membersCount || 0))
              .slice(0, 5);
          }
        } catch (e) { console.error("Suggestions error:", e); }
      }
      if (!suggestions.length) suggestions = [...list].sort((a, b) => (b.membersCount || 0) - (a.membersCount || 0)).slice(0, 3);
      setSuggestedServers(suggestions);
    });
    return () => unsub();
  }, [user]);

  // Fetch messages
  useEffect(() => {
    if (!selectedServerId) return;
    const discRef = collection(db, "servers", selectedServerId, "discussionMessages");
    const annRef = collection(db, "servers", selectedServerId, "announcementMessages");
    const u1 = onSnapshot(query(discRef, orderBy("time", "asc"), limit(200)), (snap) =>
      setMessages((p) => ({ ...p, discussion: snap.docs.map((d) => ({ id: d.id, ...d.data() })) })));
    const u2 = onSnapshot(query(annRef, orderBy("time", "asc"), limit(200)), (snap) =>
      setMessages((p) => ({ ...p, announcements: snap.docs.map((d) => ({ id: d.id, ...d.data() })) })));
    return () => { u1(); u2(); };
  }, [selectedServerId]);

  const isAdmin = selectedServer && user && selectedServer.adminUid === user.uid;

  const generateServerId = () => {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  };

  // Create/Join server state
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerHeader, setNewServerHeader] = useState("");
  const [newServerKeywords, setNewServerKeywords] = useState("");
  const [newServerVisibility, setNewServerVisibility] = useState("public");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleCreateServer = async () => {
    setErrorMsg("");
    if (!user) { setErrorMsg("Please sign in."); return; }
    if (!newServerName.trim()) { setErrorMsg("Enter a server name."); return; }
    setCreating(true);
    try {
      const id = generateServerId();
      await setDoc(doc(db, "servers", id), {
        adminUid: user.uid, adminUsername: username,
        header: newServerHeader.trim(), name: newServerName.trim(),
        keywords: newServerKeywords.split(",").map((k) => k.trim()).filter(Boolean),
        visibility: newServerVisibility, deleted: false, membersCount: 1,
        membersIds: [user.uid],
        members: [{ uid: user.uid, username, joinedAt: Date.now() }],
        emoji: "💠", createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "users", user.uid), { uid: user.uid, username, email: user.email || "" }, { merge: true });
      await updateDoc(doc(db, "users", user.uid), { createdServers: arrayUnion(id), joinedServers: arrayUnion(id) });
      setSelectedServerId(id);
      if (isMobile) setMobileView("chat");
      setNewServerName(""); setNewServerHeader(""); setNewServerKeywords("");
      setNewServerVisibility("public"); setCreateOpen(false);
    } catch (err) { setErrorMsg(err?.message || "Failed to create server."); }
    finally { setCreating(false); }
  };

  const handleJoinServer = async (idParam) => {
    setErrorMsg("");
    if (!user) { setErrorMsg("Please sign in."); return; }
    const id = (idParam || joinCode.trim()).toUpperCase();
    if (!id) return;
    setJoining(true);
    try {
      const ref = doc(db, "servers", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) { setErrorMsg("Server not found."); return; }
      const data = snap.data();
      if (data.deleted) { setErrorMsg("Server has been deleted."); return; }
      if (!(data.membersIds || []).includes(user.uid)) {
        await updateDoc(ref, {
          membersIds: arrayUnion(user.uid),
          members: arrayUnion({ uid: user.uid, username, joinedAt: Date.now() }),
          membersCount: (data.membersCount || 0) + 1,
        });
        await setDoc(doc(db, "users", user.uid), { uid: user.uid, username, email: user.email || "" }, { merge: true });
        await updateDoc(doc(db, "users", user.uid), { joinedServers: arrayUnion(id) });
      }
      setSelectedServerId(id);
      if (isMobile) setMobileView("chat");
      setJoinCode(""); setJoinOpen(false);
    } catch (err) { setErrorMsg(err?.message || "Failed to join."); }
    finally { setJoining(false); }
  };

  // Send message (supports attachments + replyTo)
  const sendMessage = async (text, attachments = [], replyTo = null) => {
    if (!user || !selectedServerId) return;
    if (!text.trim() && attachments.length === 0) return;
    if (selectedChannel === "announcements" && !isAdmin) return;
    const colRef = collection(db, "servers", selectedServerId,
      selectedChannel === "announcements" ? "announcementMessages" : "discussionMessages");
    const payload = {
      text: text.trim(),
      time: serverTimestamp(),
      date: new Date().toISOString().split("T")[0],
      user: username,
      userUid: user.uid,
      reactions: {},
      edited: false,
    };
    if (attachments.length > 0) payload.attachments = attachments;
    if (replyTo) payload.replyTo = { id: replyTo.id, user: replyTo.user, text: replyTo.text?.substring(0, 80) || "📎 Attachment" };
    await addDoc(colRef, payload);
  };

  // Edit message
  const editMessage = async (msgId, newText) => {
    if (!selectedServerId) return;
    const colName = selectedChannel === "announcements" ? "announcementMessages" : "discussionMessages";
    await updateDoc(doc(db, "servers", selectedServerId, colName, msgId), {
      text: newText, edited: true,
    });
  };

  // Delete message
  const deleteMessage = async (msgId) => {
    if (!selectedServerId) return;
    const colName = selectedChannel === "announcements" ? "announcementMessages" : "discussionMessages";
    await deleteDoc(doc(db, "servers", selectedServerId, colName, msgId));
  };

  // Toggle emoji reaction
  const toggleReaction = async (msgId, emoji) => {
    if (!user || !selectedServerId) return;
    const colName = selectedChannel === "announcements" ? "announcementMessages" : "discussionMessages";
    const msgRef = doc(db, "servers", selectedServerId, colName, msgId);
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return;
    const reactions = snap.data().reactions || {};
    const users = reactions[emoji] || [];
    const hasReacted = users.includes(user.uid);
    await updateDoc(msgRef, {
      [`reactions.${emoji}`]: hasReacted ? users.filter((u) => u !== user.uid) : [...users, user.uid],
    });
  };

  const exitServer = async () => {
    if (!user || !selectedServerId || !selectedServer) return;
    const ref = doc(db, "servers", selectedServerId);
    const filtered = (selectedServer.members || []).filter((m) => m.uid !== user.uid);
    const newCount = Math.max(0, (selectedServer.membersCount || 1) - 1);
    if (selectedServer.adminUid === user.uid) {
      const next = [...filtered].sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))[0] || null;
      await updateDoc(ref, { membersIds: arrayRemove(user.uid), members: filtered, membersCount: newCount, adminUid: next?.uid || null, adminUsername: next?.username || "" });
      await updateDoc(doc(db, "users", user.uid), { createdServers: arrayRemove(selectedServerId), joinedServers: arrayRemove(selectedServerId) });
    } else {
      await updateDoc(ref, { membersIds: arrayRemove(user.uid), members: filtered, membersCount: newCount });
      await updateDoc(doc(db, "users", user.uid), { joinedServers: arrayRemove(selectedServerId) });
    }
    setSelectedServerId(null);
    if (isMobile) setMobileView("servers");
  };

  const deleteServer = async () => {
    if (!user || !selectedServerId || !selectedServer) return;
    if (!(selectedServer.adminUid === user.uid && (selectedServer.membersCount || 0) <= 1)) return;
    await updateDoc(doc(db, "servers", selectedServerId), { deleted: true, deletedAt: serverTimestamp() });
    await updateDoc(doc(db, "users", user.uid), { createdServers: arrayRemove(selectedServerId), joinedServers: arrayRemove(selectedServerId) });
    setSelectedServerId(null);
    if (isMobile) setMobileView("servers");
  };

  // Handle back button on mobile
  const handleBackToServers = () => {
    setMobileView("servers");
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 min-h-screen" style={{ background: theme.background, color: theme.textPrimary }}>
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Community</h1>
        {isMobile && selectedServer && mobileView === "chat" && (
          <button
            onClick={handleBackToServers}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm"
            style={{ borderColor: theme.border, background: theme.card }}
          >
            <ChevronLeft size={16} /> Servers
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4"
        style={{ height: isMobile ? "calc(100dvh - 100px)" : "calc(100dvh - 130px)", minHeight: 0 }}>
        
        {/* ── Servers Panel ── */}
        {(!isMobile || mobileView === "servers") && (
          <div className="flex-shrink-0 overflow-y-auto"
            style={{ 
              width: isMobile ? "100%" : "300px",
              background: theme.card, 
              border: `1px solid ${theme.border}`, 
              borderRadius: 16, 
              padding: "12px",
              height: "100%",
            }}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <span className="font-semibold text-sm sm:text-base">Your Servers</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCreateOpen(true)} 
                  className="px-3 py-1.5 rounded-lg border text-sm transition-all hover:scale-105"
                  style={{ borderColor: theme.border, background: theme.card }}
                >
                  + Create
                </button>
                <button 
                  onClick={() => setJoinOpen(true)} 
                  className="px-3 py-1.5 rounded-lg border text-sm transition-all hover:scale-105"
                  style={{ borderColor: theme.border, background: theme.card }}
                >
                  + Join
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-3 p-2 rounded-lg text-sm text-red-400 bg-red-500/10 border border-red-500/20">
                {errorMsg}
              </div>
            )}

            {/* Servers list */}
            <div className="flex flex-col gap-2 mb-4">
              {servers.length === 0 ? (
                <div className="text-center py-8 opacity-60 text-sm">
                  <div className="text-3xl mb-2">🏠</div>
                  <p>No servers yet</p>
                  <p className="text-xs mt-1">Create or join one to get started!</p>
                </div>
              ) : (
                servers.map((s) => {
                  const isActive = selectedServerId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => { 
                        setSelectedServerId(s.id); 
                        setSelectedChannel("discussion");
                        if (isMobile) setMobileView("chat");
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl transition-all text-left w-full"
                      style={{
                        border: `1.5px solid ${isActive ? "#8b5cf6" : theme.border}`,
                        background: isActive
                          ? "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(99,102,241,0.12) 100%)"
                          : theme.background,
                        borderLeft: isActive ? "4px solid #8b5cf6" : `1.5px solid ${theme.border}`,
                        boxShadow: isActive ? "0 2px 12px rgba(139,92,246,0.20)" : "none",
                      }}
                    >
                      <span className="text-2xl">{s.emoji || "💠"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate text-sm sm:text-base">{s.name}</div>
                        <div className="text-xs opacity-70">{s.membersCount || 0} members</div>
                      </div>
                      {isActive && (
                        <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 shadow-[0_0_6px_#8b5cf6]" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Create Server Form */}
            {createOpen && (
              <div className="mb-4 pt-3 border-t" style={{ borderColor: theme.border }}>
                <div className="font-semibold text-sm mb-3">Create a server</div>
                <input 
                  value={newServerName} 
                  onChange={(e) => setNewServerName(e.target.value)} 
                  placeholder="Server name" 
                  className="w-full p-2.5 rounded-lg border text-sm mb-2"
                  style={{ borderColor: theme.border, background: theme.background, color: theme.textPrimary }}
                />
                <input 
                  value={newServerHeader} 
                  onChange={(e) => setNewServerHeader(e.target.value)} 
                  placeholder="Description (why join?)" 
                  className="w-full p-2.5 rounded-lg border text-sm mb-2"
                  style={{ borderColor: theme.border, background: theme.background, color: theme.textPrimary }}
                />
                <input 
                  value={newServerKeywords} 
                  onChange={(e) => setNewServerKeywords(e.target.value)} 
                  placeholder="Keywords (e.g. java, coding)" 
                  className="w-full p-2.5 rounded-lg border text-sm mb-2"
                  style={{ borderColor: theme.border, background: theme.background, color: theme.textPrimary }}
                />
                <div className="flex gap-2 mb-3">
                  {["public", "private"].map((v) => (
                    <button 
                      key={v} 
                      onClick={() => setNewServerVisibility(v)} 
                      className="flex-1 py-2 rounded-lg border text-sm capitalize transition-all"
                      style={{ 
                        borderColor: theme.border, 
                        background: newServerVisibility === v ? theme.primary : theme.card,
                        color: newServerVisibility === v ? "#fff" : theme.textPrimary,
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateServer} disabled={creating} 
                    className="flex-1 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
                    style={{ background: theme.gradientPrimary, color: "#fff" }}>
                    {creating ? "Creating..." : "Create"}
                  </button>
                  <button onClick={() => setCreateOpen(false)} 
                    className="px-4 py-2 rounded-lg border text-sm"
                    style={{ borderColor: theme.border, background: theme.card }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Join Server Form */}
            {joinOpen && (
              <div className="mb-4 pt-3 border-t" style={{ borderColor: theme.border }}>
                <div className="font-semibold text-sm mb-3">Join a server</div>
                <input 
                  value={joinCode} 
                  onChange={(e) => setJoinCode(e.target.value)} 
                  placeholder="Server ID" 
                  className="w-full p-2.5 rounded-lg border text-sm mb-2 uppercase"
                  style={{ borderColor: theme.border, background: theme.background, color: theme.textPrimary }}
                />
                <div className="flex gap-2">
                  <button onClick={() => handleJoinServer()} disabled={joining}
                    className="flex-1 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
                    style={{ background: theme.gradientPrimary, color: "#fff" }}>
                    {joining ? "Joining..." : "Join"}
                  </button>
                  <button onClick={() => setJoinOpen(false)} 
                    className="px-4 py-2 rounded-lg border text-sm"
                    style={{ borderColor: theme.border, background: theme.card }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Suggested Servers */}
            {!showAllExplore && (
              <div className="mt-4 pt-3 border-t" style={{ borderColor: theme.border }}>
                <div className="font-semibold text-sm mb-3">Suggested for you</div>
                {suggestedServers.length === 0 ? (
                  <div className="text-center text-sm opacity-60 py-4">No suggestions available.</div>
                ) : (
                  suggestedServers.map((ps) => (
                    <ServerCard key={ps.id} server={ps} user={user} theme={theme} onJoin={handleJoinServer} isMobile={isMobile} />
                  ))
                )}
                <button 
                  onClick={() => setShowAllExplore(true)} 
                  className="w-full mt-2 py-2 rounded-lg border text-sm transition-all"
                  style={{ borderColor: theme.border, background: theme.card }}
                >
                  Explore More
                </button>
              </div>
            )}

            {/* Explore All Public Servers */}
            {showAllExplore && (
              <div className="mt-4 pt-3 border-t" style={{ borderColor: theme.border }}>
                <div className="flex justify-between items-center mb-3">
                  <div className="font-semibold text-sm">Explore Public Servers</div>
                  <button onClick={() => setShowAllExplore(false)} className="text-xs opacity-70 hover:opacity-100">Hide</button>
                </div>
                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                  {publicServers.length === 0 ? (
                    <div className="text-center text-sm opacity-60 py-4">No public servers found.</div>
                  ) : (
                    publicServers.map((ps) => (
                      <ServerCard key={ps.id} server={ps} user={user} theme={theme} onJoin={handleJoinServer} isMobile={isMobile} />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Chat Panel ── */}
        {(!isMobile || mobileView === "chat") && (
          <div className="flex-1 flex flex-col min-h-0"
            style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden" }}>
            {!selectedServer ? (
              <div className="flex-1 flex items-center justify-center text-center p-6">
                <div>
                  <div className="text-5xl mb-3">🧩</div>
                  <div className="text-base sm:text-lg font-medium">No server selected</div>
                  <div className="text-sm opacity-60 mt-1">Create or join a server to start chatting</div>
                </div>
              </div>
            ) : (
              <>
                {/* Server Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4 border-b"
                  style={{ borderColor: theme.border, background: theme.background }}>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: theme.gradientPrimary }}>{selectedServer.emoji || "💠"}</div>
                    <button onClick={() => setInfoOpen(true)} className="text-left flex-1 min-w-0">
                      <div className="font-bold truncate text-sm sm:text-base">{selectedServer.name}</div>
                      <div className="text-xs opacity-70">{selectedServer.membersCount || 0} members</div>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                    <button 
                      onClick={async () => { 
                        await navigator.clipboard.writeText(selectedServerId); 
                        setCopyFeedback("Copied!"); 
                        setTimeout(() => setCopyFeedback(""), 2000); 
                      }}
                      className="px-3 py-1.5 rounded-lg border text-xs sm:text-sm transition-all"
                      style={{ borderColor: theme.border, background: theme.card, minWidth: "70px", textAlign: "center" }}>
                      {copyFeedback || "Copy ID"}
                    </button>
                    {CHANNELS.map((c) => (
                      <button 
                        key={c} 
                        onClick={() => setSelectedChannel(c)} 
                        className="px-3 py-1.5 rounded-lg border text-xs sm:text-sm capitalize transition-all"
                        style={{ 
                          borderColor: theme.border, 
                          background: selectedChannel === c ? theme.background : theme.card,
                          fontWeight: selectedChannel === c ? "bold" : "normal",
                        }}>
                        {c}
                      </button>
                    ))}
                    <div className="relative">
                      <button onClick={() => setMenuOpen((v) => !v)} 
                        className="p-1.5 rounded-lg border transition-all"
                        style={{ borderColor: theme.border, background: theme.card }}>
                        ⋮
                      </button>
                      {menuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-36 rounded-lg border shadow-lg p-2 z-50"
                          style={{ background: theme.card, borderColor: theme.border }}>
                          {selectedServer.adminUid === user?.uid && (selectedServer.membersCount || 0) <= 1
                            ? <button onClick={() => { setMenuOpen(false); deleteServer(); }} 
                                className="w-full text-left px-2 py-1.5 rounded text-red-500 text-sm hover:bg-red-500/10">
                                Delete Server
                              </button>
                            : <button onClick={() => { setMenuOpen(false); exitServer(); }} 
                                className="w-full text-left px-2 py-1.5 rounded text-red-500 text-sm hover:bg-red-500/10">
                                Exit Server
                              </button>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chat Window */}
                <ChatWindow
                  theme={theme}
                  messages={selectedChannel === "announcements" ? messages.announcements : messages.discussion}
                  onSend={sendMessage}
                  onEdit={editMessage}
                  onDelete={deleteMessage}
                  onReact={toggleReaction}
                  inputDisabled={selectedChannel === "announcements" && !isAdmin}
                  members={selectedServer?.members || []}
                  currentUser={user}
                  isMobile={isMobile}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Info Modal */}
      {infoOpen && selectedServer && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setInfoOpen(false)}>
          <div className="rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto p-5"
            style={{ background: theme.card, border: `1px solid ${theme.border}` }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedServer.emoji || "💠"}</span>
                <div className="font-bold text-lg">{selectedServer.name}</div>
              </div>
              <button onClick={() => setInfoOpen(false)} 
                className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="text-xs font-mono opacity-60 mb-2 break-all">ID: {selectedServerId}</div>
            <div className="text-sm opacity-70 mb-3">Admin: {selectedServer.adminUsername}</div>
            {selectedServer.header && (
              <div className="text-sm mb-4 p-3 rounded-lg bg-white/5">{selectedServer.header}</div>
            )}
            <div className="font-semibold text-sm mb-3">Members ({selectedServer.members?.length || 0})</div>
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
              {(selectedServer.members || []).map((m) => (
                <div key={m.uid} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: theme.gradientPrimary, color: "#fff" }}>
                    {(m.username || "").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{m.username}</div>
                  </div>
                  {m.uid === selectedServer.adminUid && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">Admin</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ServerCard ───────────────────────────────────────────────────────────────
function ServerCard({ server, user, theme, onJoin, isMobile }) {
  const isJoined = (server.membersIds || []).includes(user?.uid || "");
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg mb-2"
      style={{ border: `1px solid ${theme.border}`, background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-lg flex-shrink-0">{server.emoji || "🌐"}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{server.name}</div>
          <div className="text-[10px] opacity-60 truncate">ID: {server.id}</div>
        </div>
      </div>
      {isJoined ? (
        <button disabled className="px-3 py-1 rounded-lg text-xs opacity-60 flex-shrink-0"
          style={{ background: theme.card, border: `1px solid ${theme.border}` }}>
          Joined
        </button>
      ) : (
        <button onClick={() => onJoin(server.id)} 
          className="px-3 py-1 rounded-lg text-xs font-medium flex-shrink-0 transition-all hover:scale-105"
          style={{ background: theme.gradientPrimary, color: "#fff" }}>
          Join
        </button>
      )}
    </div>
  );
}

// ─── ChatWindow ───────────────────────────────────────────────────────────────
function ChatWindow({ theme, messages, onSend, onEdit, onDelete, onReact, inputDisabled, members, currentUser, isMobile }) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);        // message being replied to
  const [editingMsg, setEditingMsg] = useState(null);  // { id, text }
  const [activeMenu, setActiveMenu] = useState(null);  // message id with context menu open
  const [emojiPickerFor, setEmojiPickerFor] = useState(null); // message id
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]); // uploaded file metas
  const [uploadError, setUploadError] = useState("");

  const fileInputRef = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Close menus when clicking outside
  useEffect(() => {
    const handler = () => { setActiveMenu(null); setEmojiPickerFor(null); };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleSend = async () => {
    if (inputDisabled) return;
    if (!text.trim() && pendingFiles.length === 0) return;
    await onSend(text, pendingFiles, replyTo);
    setText(""); setReplyTo(null); setPendingFiles([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleEditSave = async () => {
    if (!editingMsg || !editingMsg.text.trim()) return;
    await onEdit(editingMsg.id, editingMsg.text);
    setEditingMsg(null);
  };

  // UploadThing file upload
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setUploadError("");

    // Check size limit first
    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setUploadError(`File${oversized.length > 1 ? "s" : ""} too large: ${oversized.map(f => f.name).join(", ")}. Max size is 10 MB.`);
      setTimeout(() => setUploadError(""), 4000);
      return;
    }

    setUploading(true);
    try {
      const uploads = await Promise.all(files.map(async (file) => {
        const fd = new FormData();
        fd.append("file", file);
        const res = await axios.post(UPLOADTHING_ENDPOINT, fd, { headers: { "Content-Type": "multipart/form-data" } });
        if (!res.data.success || !res.data.url) throw new Error("Upload failed");
        return { url: res.data.url, name: file.name, type: file.type, size: file.size };
      }));
      setPendingFiles((p) => [...p, ...uploads]);
    } catch (err) { console.error("Upload error:", err); setUploadError("Upload failed. Please try again."); setTimeout(() => setUploadError(""), 4000); }
    finally { setUploading(false); }
  };

  const removePendingFile = (idx) => setPendingFiles((p) => p.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-12 opacity-60 text-sm">
            <div className="text-3xl mb-2">💬</div>
            <p>No messages yet.</p>
            <p className="text-xs mt-1">Be the first to say hello!</p>
          </div>
        ) : (
          messages.map((m, idx) => {
            const dateLabel = formatDateHeader(m.time || m.date);
            const showDate = dateLabel && (idx === 0 || m.date !== messages[idx - 1]?.date);
            const isOwn = m.userUid === currentUser?.uid;
            const memberName = (members || []).find((mm) => mm.uid === m.userUid)?.username || m.user || "Unknown";

            return (
              <React.Fragment key={m.id || idx}>
                {showDate && (
                  <div className="relative text-center my-3">
                    <span className="text-xs px-3 py-1 rounded-full bg-white/10" style={{ color: theme.textSecondary }}>
                      {dateLabel}
                    </span>
                  </div>
                )}

                {/* Message Row */}
                <div className={`flex items-start gap-2 group ${isOwn ? "justify-end" : "justify-start"}`}>
                  {/* Avatar (others only) */}
                  {!isOwn && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1"
                      style={{ background: theme.gradientPrimary, color: "#fff" }}>
                      {memberName.slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  {/* Bubble */}
                  <div className={`max-w-[85%] sm:max-w-[72%] ${isOwn ? "items-end" : "items-start"}`}>
                    {/* Reply preview */}
                    {m.replyTo && (
                      <div className="text-[10px] sm:text-xs px-2 py-1.5 rounded-lg mb-1"
                        style={{ borderLeft: `3px solid ${theme.primary}`, background: "rgba(255,255,255,0.05)", color: theme.textSecondary }}>
                        ↩ <span className="font-semibold">{m.replyTo.user}</span>: {m.replyTo.text}
                      </div>
                    )}

                    <div className={`rounded-2xl px-3 py-2 ${isOwn ? "rounded-br-sm" : "rounded-bl-sm"}`}
                      style={{
                        background: isOwn ? theme.gradientPrimary : theme.background,
                        border: `1px solid ${isOwn ? "transparent" : theme.border}`,
                      }}>
                      {/* Sender name (others) */}
                      {!isOwn && (
                        <div className="font-semibold text-xs mb-1" style={{ color: theme.primary }}>
                          {memberName}
                        </div>
                      )}

                      {/* Editing inline */}
                      {editingMsg?.id === m.id ? (
                        <div>
                          <textarea
                            value={editingMsg.text}
                            onChange={(e) => setEditingMsg((prev) => ({ ...prev, text: e.target.value }))}
                            rows={2}
                            className="w-full bg-transparent resize-none text-sm focus:outline-none"
                            style={{ color: isOwn ? "#fff" : theme.textPrimary }}
                            autoFocus
                          />
                          <div className="flex gap-2 mt-1">
                            <button onClick={handleEditSave} className="text-xs px-2 py-0.5 rounded bg-green-500 text-white">Save</button>
                            <button onClick={() => setEditingMsg(null)} className="text-xs px-2 py-0.5 rounded bg-white/20">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm break-words whitespace-pre-wrap"
                          style={{ color: isOwn ? "#fff" : theme.textPrimary }}>
                          {m.text}
                          {m.edited && <span className="text-[10px] opacity-50 ml-1">(edited)</span>}
                        </div>
                      )}

                      {/* Attachments */}
                      {(m.attachments || []).map((att, i) => <AttachmentPreview key={i} att={att} />)}

                      {/* Time */}
                      <div className={`text-[9px] sm:text-[10px] opacity-55 mt-1 text-right ${isOwn ? "text-white/70" : ""}`}>
                        {formatTime(m.time)}
                      </div>
                    </div>

                    {/* Reactions display */}
                    {m.reactions && Object.entries(m.reactions).some(([, users]) => users?.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(m.reactions).filter(([, users]) => users?.length > 0).map(([emoji, users]) => (
                          <button key={emoji} onClick={(e) => { e.stopPropagation(); onReact(m.id, emoji); }}
                            className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full transition-all"
                            style={{
                              background: users.includes(currentUser?.uid) ? `${theme.primary}30` : "rgba(255,255,255,0.08)",
                              border: `1px solid ${users.includes(currentUser?.uid) ? theme.primary : "transparent"}`,
                            }}>
                            {emoji} {users.length}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action toolbar — appears on hover */}
                  <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ${isOwn ? "order-first" : "order-last"}`}>
                    {/* Emoji react button */}
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setEmojiPickerFor(emojiPickerFor === m.id ? null : m.id); setActiveMenu(null); }}
                        className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="React">
                        <Smile size={isMobile ? 12 : 14} />
                      </button>
                      {emojiPickerFor === m.id && (
                        <div onClick={(e) => e.stopPropagation()}
                          className={`absolute bottom-full mb-1 flex flex-wrap gap-1 p-2 rounded-xl border shadow-xl z-30 w-44 overflow-y-auto ${isOwn ? "right-0" : "left-0"}`}
                          style={{ maxHeight: "150px", background: theme.card, borderColor: theme.border }}>
                          {EMOJI_LIST.map((em) => (
                            <button key={em} onClick={() => { onReact(m.id, em); setEmojiPickerFor(null); }}
                              className="text-base hover:scale-125 transition-transform p-0.5">{em}</button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Reply */}
                    <button onClick={(e) => { e.stopPropagation(); setReplyTo(m); inputRef.current?.focus(); setEmojiPickerFor(null); }}
                      className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="Reply">
                      <Reply size={isMobile ? 12 : 14} />
                    </button>

                    {/* Edit / Delete — own messages only */}
                    {isOwn && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setEditingMsg({ id: m.id, text: m.text }); setActiveMenu(null); }}
                          className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="Edit">
                          <Pencil size={isMobile ? 12 : 14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete this message?")) onDelete(m.id); }}
                          className="p-1 rounded-lg hover:bg-red-500/20 transition-colors text-red-400" title="Delete">
                          <Trash2 size={isMobile ? 12 : 14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Upload error banner */}
      {uploadError && (
        <div className="flex items-center gap-2 mx-2 mb-1 p-2 rounded-lg text-xs bg-red-500/15 border border-red-500/40 text-red-400">
          <X size={12} className="flex-shrink-0" />
          <span className="truncate">{uploadError}</span>
        </div>
      )}

      {/* Pending file previews */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 py-2 border-t" style={{ borderColor: theme.border }}>
          {pendingFiles.map((f, i) => (
            <div key={i} className="relative flex items-center gap-2 px-2 py-1 rounded-lg text-xs border"
              style={{ background: theme.background, borderColor: theme.border }}>
              {f.type?.startsWith("image/")
                ? <img src={f.url} alt={f.name} className="h-6 w-6 object-cover rounded" />
                : <Paperclip size={10} />}
              <span className="max-w-[80px] truncate">{f.name}</span>
              <button onClick={() => removePendingFile(i)} className="text-red-400 hover:text-red-500"><X size={10} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Reply preview bar */}
      {replyTo && (
        <div className="flex items-center justify-between px-3 py-2 border-t text-xs sm:text-sm"
          style={{ borderColor: theme.border, background: "rgba(255,255,255,0.03)" }}>
          <div className="truncate flex-1">
            <span className="opacity-70">↩ Replying to </span>
            <span className="font-semibold" style={{ color: theme.primary }}>{replyTo.user}</span>
            <span className="opacity-60 ml-1 truncate">{replyTo.text?.substring(0, 40)}</span>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-red-400 hover:text-red-500 ml-2 flex-shrink-0"><X size={14} /></button>
        </div>
      )}

      {/* Input bar */}
      <div className="flex gap-2 p-3 border-t" style={{ borderColor: theme.border }}>
        {/* Upload button */}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} disabled={inputDisabled} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={inputDisabled || uploading}
          title="Attach file"
          className="flex-shrink-0 flex items-center justify-center rounded-xl border transition-all hover:scale-105"
          style={{ width: 40, height: 40, borderColor: theme.border, background: theme.background, cursor: inputDisabled ? "not-allowed" : "pointer", opacity: inputDisabled ? 0.5 : 1 }}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
        </button>

        {/* Text input */}
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={inputDisabled ? "Announcements are admin-only" : "Type a message…"}
          disabled={inputDisabled}
          rows={1}
          className="flex-1 resize-none rounded-xl px-3 py-2 text-sm focus:outline-none"
          style={{
            border: `1px solid ${theme.border}`,
            background: theme.background,
            color: theme.textPrimary,
            minHeight: 40,
            maxHeight: 100,
            lineHeight: 1.4,
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={inputDisabled || uploading}
          className="flex-shrink-0 flex items-center justify-center gap-1 rounded-xl px-4 transition-all hover:scale-105 disabled:opacity-50"
          style={{ background: theme.gradientPrimary, color: "#fff", height: 40 }}>
          <Send size={16} />
          {!isMobile && <span className="text-sm hidden sm:inline">Send</span>}
        </button>
      </div>
    </div>
  );
}