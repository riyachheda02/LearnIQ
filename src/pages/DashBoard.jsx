// src/pages/DashBoard.jsx - Complete working dashboard with responsive design
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import { Timer, MessageSquare, Users, Calendar, CheckSquare, Folder, Clock, Plus, Star, Zap, Smile, Flame, Trash2, CheckCircle, Circle } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  updateDoc,
  orderBy,
  setDoc
} from "firebase/firestore";

// Custom Card Component
const Card = ({ children, className, style, onClick }) => (
  <div
    onClick={onClick}
    className={`rounded-xl shadow-sm transition-all duration-300 ${className || ''}`}
    style={style}
  >
    {children}
  </div>
);

export default function DashBoard() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [joinedServers, setJoinedServers] = useState([]);
  const [existingServers, setExistingServers] = useState([]);
  const [user, setUser] = useState(null);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Timer states
  const [minutesInput, setMinutesInput] = useState(25);
  const [secondsInput, setSecondsInput] = useState(0);
  const [timeLeft, setTimeLeft] = useState(1500); // 25 minutes default
  const [isRunning, setIsRunning] = useState(false);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState("");
  const [currentYear, setCurrentYear] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().getDate());
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [firstDayOfMonth, setFirstDayOfMonth] = useState(0);

  // Tasks state
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all, active, completed

  // Timer sessions state
  const [timerSessions, setTimerSessions] = useState([]);

  // Streak state
  const [streak, setStreak] = useState(0);
  const [lastCompletedDate, setLastCompletedDate] = useState(null);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [longestStreak, setLongestStreak] = useState(0);

  // Gradient color for all buttons
  const buttonGradient = "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)";

  // Get today's date string
  const getTodayDateString = () => {
    const today = new Date();
    return `${today.getDate()} ${currentMonth.slice(0, 3)} ${currentYear}`;
  };

  // Initialize or load streak data
  const initializeStreak = async (userId) => {
    try {
      const streakRef = doc(db, "userStreaks", userId);
      const streakSnap = await getDoc(streakRef);

      if (!streakSnap.exists()) {
        await setDoc(streakRef, {
          currentStreak: 0,
          lastCompletedDate: null,
          longestStreak: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setStreak(0);
        setLongestStreak(0);
        setLastCompletedDate(null);
      } else {
        const data = streakSnap.data();
        setStreak(data.currentStreak || 0);
        setLongestStreak(data.longestStreak || 0);
        setLastCompletedDate(data.lastCompletedDate || null);
      }
    } catch (error) {
      console.error("Error initializing streak:", error);
    }
  };

  // Update streak when tasks are completed
  const updateStreak = useCallback(async () => {
    if (!user) return;

    try {
      const today = new Date();
      const todayString = today.toDateString();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = yesterday.toDateString();

      const todayStr = getTodayDateString();
      const todayTasks = tasks.filter(task => task.date === todayStr);

      if (todayTasks.length === 0) return;

      const allCompleted = todayTasks.length > 0 && todayTasks.every(task => task.completed);

      if (!allCompleted) return;

      const streakRef = doc(db, "userStreaks", user.uid);
      const streakSnap = await getDoc(streakRef);
      const currentData = streakSnap.data() || { currentStreak: 0, lastCompletedDate: null, longestStreak: 0 };
      const lastDate = currentData.lastCompletedDate ? new Date(currentData.lastCompletedDate).toDateString() : null;

      if (lastDate === todayString) return;

      let newStreak = currentData.currentStreak || 0;

      if (lastDate === yesterdayString) {
        newStreak = (currentData.currentStreak || 0) + 1;
      } else {
        newStreak = 1;
      }

      const newLongestStreak = Math.max(newStreak, currentData.longestStreak || 0);

      await updateDoc(streakRef, {
        currentStreak: newStreak,
        lastCompletedDate: today.toISOString(),
        longestStreak: newLongestStreak,
        updatedAt: serverTimestamp()
      });

      setStreak(newStreak);
      setLongestStreak(newLongestStreak);
      setLastCompletedDate(today);
      setTodayCompleted(true);

    } catch (error) {
      console.error("Error updating streak:", error);
    }
  }, [user, tasks, currentMonth, currentYear]);

  // Check today's tasks completion
  const checkTodayTasksCompletion = useCallback(async () => {
    if (!user || tasks.length === 0) return;

    const todayStr = getTodayDateString();
    const todayTasks = tasks.filter(task => task.date === todayStr);
    const allCompleted = todayTasks.length > 0 && todayTasks.every(task => task.completed);

    setTodayCompleted(allCompleted);

    if (allCompleted) {
      await updateStreak();
    }
  }, [user, tasks, updateStreak]);

  // Fetch user data
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUsername(userSnap.data().username || "User");
          } else {
            setUsername(currentUser.email.split("@")[0]);
          }

          await initializeStreak(currentUser.uid);
          loadDashboardData(currentUser.uid);

        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        navigate("/login");
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load dashboard data with listeners
  const loadDashboardData = (userId) => {
    try {
      // Load tasks
      const tasksQuery = query(
        collection(db, "dashboardData"),
        where("userId", "==", userId),
        where("type", "==", "task")
      );

      const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
        const taskList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
        })).sort((a, b) => b.createdAt - a.createdAt);
        setTasks(taskList);
      });

      // Load folders/files from the real folders collection
      const foldersQuery = query(
        collection(db, "folders"),
        where("userId", "==", userId)
      );

      const unsubFolders = onSnapshot(foldersQuery, (snapshot) => {
        const folderList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })).sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
        setFolders(folderList);
      });

      // Load timer sessions
      const timerQuery = query(
        collection(db, "dashboardData"),
        where("userId", "==", userId),
        where("type", "==", "timer")
      );

      const unsubTimer = onSnapshot(timerQuery, (snapshot) => {
        const sessions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })).sort((a, b) => (b.completedAt?.toDate?.() || 0) - (a.completedAt?.toDate?.() || 0));
        setTimerSessions(sessions);
      });

      return () => {
        unsubTasks();
        unsubFolders();
        unsubTimer();
      };
    } catch (error) {
      console.error("Error setting up listeners:", error);
    }
  };

  // Check tasks completion when tasks change
  useEffect(() => {
    if (tasks.length > 0 && user) {
      checkTodayTasksCompletion();
    }
  }, [tasks, user, checkTodayTasksCompletion]);

  // Fetch servers
  useEffect(() => {
    if (!user) return;

    const joinedQuery = query(
      collection(db, "servers"),
      where("membersIds", "array-contains", user.uid)
    );

    const unsubJoined = onSnapshot(joinedQuery, (snap) => {
      const servers = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((server) => server.deleted !== true);
      setJoinedServers(servers.slice(0, 3));
    });

    const publicQuery = query(
      collection(db, "servers"),
      where("visibility", "==", "public")
    );

    const unsubPublic = onSnapshot(publicQuery, (snap) => {
      const servers = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((server) => server.deleted !== true && (!user || !server.membersIds?.includes(user.uid)))
        .sort((a, b) => (b.membersCount || 0) - (a.membersCount || 0));
      setExistingServers(servers.slice(0, 3));
    });

    return () => {
      unsubJoined();
      unsubPublic();
    };
  }, [user]);

  // Date updater and calendar calculations
  useEffect(() => {
    const updateDate = () => {
      const today = new Date();
      const formatted = today.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
        "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
      setCurrentMonth(monthNames[today.getMonth()]);
      setCurrentYear(today.getFullYear().toString());
      setCurrentDate(formatted);

      // Calculate days in month
      const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      setDaysInMonth(daysInCurrentMonth);

      // Calculate first day of month (0 = Sunday)
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
      setFirstDayOfMonth(firstDay);
    };
    updateDate();
    const interval = setInterval(updateDate, 60000);
    return () => clearInterval(interval);
  }, []);

  // Timer countdown
  useEffect(() => {
    let timer;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      saveTimerSession();
      setIsRunning(false);
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const saveTimerSession = async () => {
    if (!user) return;

    const totalSeconds = minutesInput * 60 + secondsInput;
    if (totalSeconds === 0) return;

    const sessionData = {
      type: "timer",
      userId: user.uid,
      duration: totalSeconds,
      minutes: minutesInput,
      seconds: secondsInput,
      completedAt: serverTimestamp(),
      date: new Date().toISOString(),
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, "dashboardData"), sessionData);
      setMinutesInput(25);
      setSecondsInput(0);
      setTimeLeft(1500);
    } catch (error) {
      console.error("Error saving timer session:", error);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleQuickJoin = (serverId) => {
    navigate(`/Community?server=${serverId}`);
  };

  // Add task
  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !user) return;

    const displayDate = newTaskDate.trim() || getTodayDateString();

    const newTask = {
      type: "task",
      userId: user.uid,
      title: newTaskTitle.trim(),
      date: displayDate,
      completed: false,
      priority: 'medium',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, "dashboardData"), newTask);
      setNewTaskTitle("");
      setNewTaskDate("");
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "dashboardData", taskId));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  // Toggle task completion
  const handleToggleTaskComplete = async (taskId, currentStatus) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "dashboardData", taskId), {
        completed: !currentStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  };

  // Filter tasks
  const getFilteredTasks = () => {
    switch (filterStatus) {
      case "active":
        return tasks.filter(task => !task.completed);
      case "completed":
        return tasks.filter(task => task.completed);
      default:
        return tasks;
    }
  };

  const filteredTasks = getFilteredTasks();
  const todayStr = getTodayDateString();
  const todayTasks = tasks.filter(task => task.date === todayStr);
  const completedToday = todayTasks.filter(task => task.completed).length;
  const totalToday = todayTasks.length;
  const folderMetric = folders.filter((item) => item.type === "folder").length || folders.length;
  
  // Calculate progress percentage (0 to 1)
  const progressPercentage = totalToday > 0 ? completedToday / totalToday : 0;
  // Calculate stroke dashoffset - full circle circumference is 2 * π * radius (radius is 40% of the viewBox which is 100, so radius = 40)
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressPercentage);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-screen p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 pb-20 sm:pb-24 transition-colors duration-500 relative overflow-x-hidden"
      style={{
        background: theme.background,
        color: theme.textPrimary
      }}
    >
      {/* Aesthetic Background Elements */}
      <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-purple-500/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-72 sm:w-96 h-72 sm:h-96 bg-blue-500/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 flex items-center gap-2 sm:gap-3 flex-wrap">
            Dashboard
            <Zap className="text-yellow-400 fill-current animate-pulse" size={28} />
          </h1>
          <p className="text-lg sm:text-xl font-medium flex items-center gap-2 flex-wrap" style={{ color: theme.textSecondary }}>
            Welcome back, <span className="text-purple-500 font-bold">{username}</span>
            <Smile className="text-yellow-500" size={18} />
          </p>
        </div>
        <div className="backdrop-blur-sm px-4 py-2 rounded-lg border" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <p className="text-sm font-bold text-purple-500">TODAY</p>
          <p className="text-xl font-bold" style={{ color: theme.textPrimary }}>{currentDate}</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <div className="p-3 sm:p-4 rounded-xl backdrop-blur-sm border flex flex-col justify-center" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <p className="text-xs sm:text-sm font-medium" style={{ color: theme.textSecondary }}>Total Tasks</p>
          <p className="text-xl sm:text-2xl font-bold mt-1" style={{ color: theme.textPrimary }}>{tasks.length}</p>
        </div>
        <div className="p-3 sm:p-4 rounded-xl backdrop-blur-sm border flex flex-col justify-center" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <p className="text-xs sm:text-sm font-medium" style={{ color: theme.textSecondary }}>Completed</p>
          <p className="text-xl sm:text-2xl font-bold mt-1" style={{ color: theme.textPrimary }}>{tasks.filter(t => t.completed).length}</p>
        </div>
        <div className="p-3 sm:p-4 rounded-xl backdrop-blur-sm border col-span-2 sm:col-span-2 lg:col-span-1 flex items-center justify-between" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <div>
            <p className="text-xs sm:text-sm font-medium" style={{ color: theme.textSecondary }}>Today's Progress</p>
            <p className="text-xl sm:text-2xl font-bold mt-1" style={{ color: theme.textPrimary }}>{completedToday} <span className="text-sm sm:text-base font-normal opacity-50">/ {totalToday}</span></p>
          </div>
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="10"
                fill="transparent"
                className="opacity-10"
                style={{ color: theme.textSecondary }}
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="url(#progressGradient)"
                strokeWidth="10"
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs font-bold" style={{ color: theme.textPrimary }}>
              {totalToday > 0 ? Math.round(progressPercentage * 100) : 0}%
            </div>
          </div>
        </div>
        <div className="p-3 sm:p-4 rounded-xl backdrop-blur-sm border hidden sm:flex flex-col justify-center" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <p className="text-xs sm:text-sm font-medium" style={{ color: theme.textSecondary }}>Folders</p>
          <p className="text-xl sm:text-2xl font-bold mt-1" style={{ color: theme.textPrimary }}>{folderMetric}</p>
        </div>
        <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-orange-500/20 to-red-500/20 dark:from-orange-500/30 dark:to-red-500/30 backdrop-blur-sm border border-orange-300/50 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-20">
            <Flame size={80} className="text-orange-500" />
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <Flame className="text-orange-500 dark:text-orange-400 animate-pulse" size={20} />
            <p className="text-xs sm:text-sm font-semibold" style={{ color: theme.textSecondary }}>Current Streak</p>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1" style={{ color: theme.textPrimary }}>{streak} {streak === 1 ? 'day' : 'days'}</p>
          {todayCompleted && (
            <p className="text-xs text-green-600 dark:text-green-300 mt-1 font-medium">✓ Today's tasks completed!</p>
          )}
        </div>
      </div>

      {/* Communities Grid */}
      <div className="flex overflow-x-auto md:overflow-hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pb-4 md:pb-0 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {[
          { icon: Users, title: "Joined Communities", data: joinedServers, emptyMsg: "No communities joined yet", color: "text-white" },
          { icon: Star, title: "Explore", data: existingServers, emptyMsg: "Explore more communities", color: "text-white" }
        ].map((section, idx) => (
          <Card
            key={idx}
            className="min-w-[85vw] md:min-w-0 snap-center rounded-2xl shadow-lg p-4 sm:p-6 cursor-pointer hover:scale-[1.02] group relative overflow-hidden"
            style={{
              background: buttonGradient,
              border: `1px solid #7c3aed`,
              boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)'
            }}
            onClick={() => navigate("/Community")}
          >
            <div className="absolute top-[-20px] right-[-20px] opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-500">
              <section.icon size={100} className="text-white" />
            </div>
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <section.icon size={20} className="text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">{section.title}</h2>
            </div>
            {section.data.length > 0 ? (
              <div className="space-y-3 relative z-10">
                {section.data.map((server) => (
                  <div
                    key={server.id}
                    className="p-3 rounded-xl cursor-pointer transition-all hover:translate-x-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickJoin(server.id);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg sm:text-xl bg-white/20">
                        {server.emoji || "💠"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm sm:text-lg text-white truncate">{server.name}</h3>
                        <p className="text-xs text-white/80">{server.membersCount || 0} members</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 relative z-10">
                <section.icon size={40} className="mx-auto mb-4 text-white/60" />
                <p className="text-base sm:text-lg text-white/80">{section.emptyMsg}</p>
              </div>
            )}
          </Card>
        ))}

        {/* Create New Community */}
        <Card
          onClick={() => navigate("/Community")}
          className="min-w-[85vw] md:min-w-0 snap-center rounded-2xl shadow-lg p-4 sm:p-6 cursor-pointer hover:scale-[1.02] group relative overflow-hidden"
          style={{
            background: buttonGradient,
            border: `1px solid #7c3aed`,
            boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)'
          }}
        >
          <div className="absolute bottom-[-20px] right-[-20px] opacity-10 rotate-[-12deg] group-hover:rotate-0 transition-transform duration-500">
            <Plus size={120} className="text-white" />
          </div>
          <div className="flex flex-col items-center justify-center h-full relative z-10">
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-white/20 rounded-full backdrop-blur-md shadow-lg group-hover:scale-110 transition-transform">
              <Plus size={32} className="text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2 text-white text-center">Create Community</h2>
            <p className="text-center text-white/80 text-sm max-w-[180px]">Start your own community and collaborate</p>
          </div>
        </Card>
      </div>

      {/* Middle Row - Ask, Timer, Folders */}
      <div className="flex overflow-x-auto md:overflow-hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pb-4 md:pb-0 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <Card
          onClick={() => navigate("/Ask")}
          className="min-w-[85vw] md:min-w-0 snap-center rounded-2xl shadow-lg p-4 sm:p-6 cursor-pointer hover:scale-[1.02] group relative overflow-hidden flex flex-col justify-between"
          style={{
            background: buttonGradient,
            border: `1px solid #7c3aed`,
            boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)'
          }}
        >
          <div className="absolute top-[-20px] right-[-20px] opacity-10 group-hover:opacity-20 transition-opacity">
            <MessageSquare size={100} className="text-white" />
          </div>
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <div className="p-2 bg-white/20 rounded-lg">
              <MessageSquare size={20} className="text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Ask Anything</h2>
          </div>
          <p className="text-white/80 text-sm relative z-10">Get answers from the community and AI.</p>
          <div className="mt-4 flex gap-2 relative z-10">
            <span className="text-xs bg-white/20 px-2 py-1 rounded text-white">#Help</span>
            <span className="text-xs bg-white/20 px-2 py-1 rounded text-white">#Discussion</span>
          </div>
        </Card>

        {/* Timer */}
        <Card
          className="min-w-[85vw] md:min-w-0 snap-center rounded-2xl shadow-lg p-4 sm:p-6 hover:scale-[1.02] relative overflow-hidden"
          style={{
            background: buttonGradient,
            border: `1px solid #7c3aed`,
            boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)'
          }}
        >
          <div className="absolute bottom-[-10px] left-[-10px] opacity-10">
            <Timer size={80} className="text-white" />
          </div>
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <div className="p-2 bg-white/20 rounded-lg">
              <Timer size={20} className="text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Focus Timer</h2>
          </div>
          <div className="text-center mb-4 relative z-10">
            <div className="text-4xl sm:text-5xl font-mono font-bold mb-2 text-white">
              {isRunning || timeLeft > 0 ? formatTime(timeLeft) : formatTime(minutesInput * 60 + secondsInput)}
            </div>
            <p className="text-xs text-white/80 uppercase">{isRunning ? "Running" : "Stopped"}</p>
          </div>
          <div className="flex gap-2 relative z-10">
            <input
              type="number"
              min="0"
              placeholder="Min"
              value={minutesInput}
              onChange={(e) => {
                setMinutesInput(Number(e.target.value));
                if (!isRunning && timeLeft === 0) {
                  setTimeLeft(Number(e.target.value) * 60 + secondsInput);
                }
              }}
              className="p-2 rounded-lg flex-1 text-center border bg-white/20 text-white placeholder-white/60 focus:bg-white/30 outline-none text-sm"
              style={{ borderColor: 'rgba(255,255,255,0.3)' }}
            />
            <input
              type="number"
              min="0"
              max="59"
              placeholder="Sec"
              value={secondsInput}
              onChange={(e) => {
                setSecondsInput(Number(e.target.value));
                if (!isRunning && timeLeft === 0) {
                  setTimeLeft(minutesInput * 60 + Number(e.target.value));
                }
              }}
              className="p-2 rounded-lg flex-1 text-center border bg-white/20 text-white placeholder-white/60 focus:bg-white/30 outline-none text-sm"
              style={{ borderColor: 'rgba(255,255,255,0.3)' }}
            />
          </div>
          <div className="flex gap-2 mt-3 relative z-10">
            <button
              onClick={() => {
                if (timeLeft === 0) {
                  const totalSeconds = minutesInput * 60 + secondsInput;
                  if (totalSeconds > 0) {
                    setTimeLeft(totalSeconds);
                    setIsRunning(true);
                  }
                } else {
                  setIsRunning(!isRunning);
                }
              }}
              className="flex-1 px-3 py-2 rounded-xl font-semibold text-white text-sm bg-white/30 hover:bg-white/40"
            >
              {isRunning ? "Pause" : timeLeft > 0 ? "Resume" : "Start"}
            </button>
            <button
              onClick={() => {
                setIsRunning(false);
                setTimeLeft(minutesInput * 60 + secondsInput);
              }}
              className="flex-1 px-3 py-2 rounded-xl font-semibold text-white text-sm bg-white/20 hover:bg-white/30"
            >
              Reset
            </button>
          </div>
        </Card>

        <Card
          onClick={() => navigate("/Folders")}
          className="min-w-[85vw] md:min-w-0 snap-center rounded-2xl shadow-lg p-4 sm:p-6 cursor-pointer hover:scale-[1.02] group relative overflow-hidden"
          style={{
            background: buttonGradient,
            border: `1px solid #7c3aed`,
            boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)'
          }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 group-hover:opacity-10 scale-150">
            <Folder size={150} className="text-white" />
          </div>
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <div className="p-2 bg-white/20 rounded-lg">
              <Folder size={20} className="text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">My Folders</h2>
          </div>
          <div className="text-center py-6 relative z-10">
            <Folder size={48} className="mx-auto mb-4 text-white/80" />
            <p className="text-base sm:text-lg text-white/90 font-medium">
              {folderMetric > 0 ? `${folderMetric} folders` : "Manage your files"}
            </p>
          </div>
        </Card>
      </div>

      {/* Bottom Row - Calendar, Tasks, Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Calendar */}
        <Card
          className="rounded-2xl shadow-lg p-4 sm:p-6 hover:scale-[1.02] overflow-x-auto"
          style={{
            background: buttonGradient,
            border: `1px solid #7c3aed`,
            boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)'
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <Calendar size={20} className="text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Calendar</h2>
          </div>
          <div className="text-center mb-4 p-2 bg-white/10 rounded-xl">
            <div className="text-2xl sm:text-3xl font-bold text-white">{currentMonth}</div>
            <div className="text-base sm:text-xl font-semibold text-white/80">{currentYear}</div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <div key={index} className="text-center py-1 text-xs sm:text-sm font-bold text-white/60">{day}</div>
            ))}
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div key={`empty-${idx}`} className="text-center py-1 text-sm"></div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const isSelected = day === selectedDate;
              const isToday = day === new Date().getDate();
              const hasTasks = tasks.some(t => {
                const taskDay = parseInt(t.date?.split(' ')[0]);
                return taskDay === day;
              });
              return (
                <div
                  key={index}
                  className="text-center py-1 rounded-lg text-xs sm:text-sm cursor-pointer transition-all relative"
                  onClick={() => setSelectedDate(day)}
                  style={{
                    color: isSelected ? "#7c3aed" : "white",
                    background: isSelected ? "white" : 'transparent',
                    border: isToday && !isSelected ? `1px solid rgba(255,255,255,0.5)` : '1px solid transparent',
                    fontWeight: isSelected ? 'bold' : 'normal',
                  }}
                >
                  {day}
                  {hasTasks && !isSelected && (
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full"></div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-white/20">
            <h3 className="font-bold mb-2 text-white text-sm flex justify-between">
              <span>Tasks for {selectedDate}</span>
              <span className="text-xs bg-white/20 px-2 py-1 rounded">
                {tasks.filter(t => {
                  const taskDay = parseInt(t.date?.split(' ')[0]);
                  return taskDay === selectedDate;
                }).length}
              </span>
            </h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {tasks.filter(t => {
                const taskDay = parseInt(t.date?.split(' ')[0]);
                return taskDay === selectedDate;
              }).length > 0 ? (
                tasks.filter(t => {
                  const taskDay = parseInt(t.date?.split(' ')[0]);
                  return taskDay === selectedDate;
                }).map((task) => (
                  <div key={task.id} className="p-2 rounded-lg border flex items-center text-xs bg-white/20 border-white/20">
                    <input
                      type="checkbox"
                      checked={task.completed || false}
                      onChange={() => handleToggleTaskComplete(task.id, task.completed)}
                      className="mr-2 rounded border-white/30"
                    />
                    <span className={`truncate text-white ${task.completed ? 'line-through opacity-60' : ''}`}>
                      {task.title}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs italic text-center py-4 text-white/60">No tasks for this day</p>
              )}
            </div>
          </div>
        </Card>

        {/* My Tasks */}
        <Card
          className="rounded-2xl shadow-lg p-4 sm:p-6 hover:scale-[1.02]"
          style={{
            background: buttonGradient,
            border: `1px solid #7c3aed`,
            boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)'
          }}
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <CheckSquare size={20} className="text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">My Tasks</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-2 py-1 rounded text-xs ${filterStatus === "all" ? "bg-white/40" : "bg-white/20"}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus("active")}
                className={`px-2 py-1 rounded text-xs ${filterStatus === "active" ? "bg-white/40" : "bg-white/20"}`}
              >
                Active
              </button>
              <button
                onClick={() => setFilterStatus("completed")}
                className={`px-2 py-1 rounded text-xs ${filterStatus === "completed" ? "bg-white/40" : "bg-white/20"}`}
              >
                Done
              </button>
            </div>
          </div>
          <div className="mb-4 bg-white/10 p-3 rounded-xl">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
              placeholder="What needs to be done?"
              className="w-full p-2 sm:p-3 rounded-lg border mb-2 bg-white/20 text-white placeholder-white/60 focus:bg-white/30 outline-none text-sm"
              style={{ borderColor: 'rgba(255,255,255,0.2)' }}
            />
            <div className="flex gap-2 w-full">
              <input
                type="text"
                value={newTaskDate}
                onChange={(e) => setNewTaskDate(e.target.value)}
                placeholder={`e.g. ${selectedDate} ${currentMonth.slice(0, 3)}`}
                className="flex-1 min-w-0 p-2 sm:p-3 rounded-lg border text-sm bg-white/20 text-white placeholder-white/60 focus:bg-white/30 outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.2)' }}
              />
              <button
                onClick={handleAddTask}
                className="shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-bold text-white bg-white/30 hover:bg-white/40 text-sm"
              >
                Add
              </button>
            </div>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-white/20 border-white/20 group"
                >
                  <div className="flex items-center gap-3 flex-1 w-full">
                    <input
                      type="checkbox"
                      checked={task.completed || false}
                      onChange={() => handleToggleTaskComplete(task.id, task.completed)}
                      className="rounded border-white/30 w-4 h-4 flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className={`font-semibold text-sm sm:text-base text-white ${task.completed ? 'line-through opacity-60' : ''}`}>
                        {task.title}
                      </div>
                      <div className="text-xs mt-1 text-white/70 bg-white/10 inline-block px-2 py-0.5 rounded">
                        {task.date}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-white opacity-0 group-hover:opacity-100 px-2 py-1 rounded-lg text-xs font-semibold bg-red-500/50 hover:bg-red-500/70 w-full sm:w-auto"
                  >
                    Delete
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <CheckSquare size={40} className="mx-auto mb-4 text-white/40" />
                <p className="text-white/60 text-sm">No tasks yet. Stay productive!</p>
              </div>
            )}
          </div>
        </Card>

        {/* Schedule */}
        <Card
          onClick={() => navigate("/Schedule")}
          className="rounded-2xl shadow-lg p-4 sm:p-6 cursor-pointer hover:scale-[1.02] group relative overflow-hidden"
          style={{
            background: buttonGradient,
            border: `1px solid #7c3aed`,
            boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)'
          }}
        >
          <div className="absolute top-[-20px] right-[-20px] opacity-10 rotate-12 group-hover:rotate-0 transition-transform">
            <Clock size={100} className="text-white" />
          </div>
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <div className="p-2 bg-white/20 rounded-lg">
              <Clock size={20} className="text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Schedule</h2>
          </div>
          <div className="text-center py-8 relative z-10">
            <Clock size={40} className="mx-auto mb-4 text-white/80" />
            <p className="text-white/90 font-medium text-sm">View your timetable</p>
          </div>
          <div className="text-center relative z-10">
            <button className="px-4 py-2 rounded-xl font-bold text-white w-full bg-white/30 hover:bg-white/40 text-sm">
              Open Schedule
            </button>
          </div>
        </Card>
      </div>

      {/* Date Display */}
      <div className="mt-6 sm:mt-8 text-center pb-8">
        <p className="text-sm sm:text-base font-medium inline-block px-4 py-2 rounded-full border"
          style={{
            color: theme.textSecondary,
            borderColor: theme.border,
            background: theme.card
          }}>
          Today's Date: <span className="text-purple-500 font-bold ml-1 sm:ml-2">{currentDate}</span>
        </p>
      </div>

      {/* Mobile Floating Action Button (FAB) for Tasks */}
      <button 
        className="md:hidden fixed bottom-20 right-4 sm:right-6 w-14 h-14 rounded-full shadow-[0_4px_20px_rgba(124,58,237,0.5)] flex items-center justify-center text-white z-50 hover:scale-110 active:scale-95 transition-transform"
        style={{ background: buttonGradient }}
        onClick={() => {
          window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'});
          // Focus the input if available
          const inputs = document.querySelectorAll('input');
          const lastInput = inputs[inputs.length - 1];
          if (lastInput) lastInput.focus();
        }}
        title="Add Task"
      >
        <Plus size={28} />
      </button>
    </div>
  );
}