// src/pages/Schedule.jsx - COMPLETE VERSION WITH ALL FEATURES & RESPONSIVENESS
import React, { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, serverTimestamp, getDocs, deleteDoc, query, orderBy, writeBatch, getDoc, addDoc, setDoc, updateDoc } from "firebase/firestore";
import axios from "axios";
import { 
  Calendar, Clock, BookOpen, Trash2, Plus, X,
  Brain, Target, Sparkles,
  Loader2,
  ArrowRight, ArrowLeft, 
  History, Eye, ChevronDown, ChevronUp, Search,
  Youtube, Link, GraduationCap, Layers, CheckCircle, ExternalLink, Save, BookMarked, Check
} from "lucide-react";

// ========== AI TOPIC CURRICULUM COMPONENT ==========
const TopicCurriculumView = ({ theme, apiBaseUrl, user }) => {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [curriculum, setCurriculum] = useState(null);
  const [error, setError] = useState("");
  const [activeLevel, setActiveLevel] = useState(0);
  const [openSections, setOpenSections] = useState({ topics: true, youtube: false, links: false, books: false });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [savedRoadmaps, setSavedRoadmaps] = useState([]);
  const [loadingRoadmaps, setLoadingRoadmaps] = useState(false);
  const [showSavedPanel, setShowSavedPanel] = useState(false);

  const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  // Load saved roadmaps from Firestore
  useEffect(() => {
    if (!user) return;
    setLoadingRoadmaps(true);
    const q = query(collection(db, "savedRoadmaps", user.uid, "roadmaps"), orderBy("savedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setSavedRoadmaps(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingRoadmaps(false);
    }, () => setLoadingRoadmaps(false));
    return () => unsub();
  }, [user]);

  // Save roadmap to Firebase
  const saveRoadmap = async () => {
    if (!user || !curriculum) return;
    setSaving(true);
    setSavedMsg("");
    try {
      const roadmapRef = collection(db, "savedRoadmaps", user.uid, "roadmaps");
      await addDoc(roadmapRef, {
        topic: curriculum.topic,
        description: curriculum.description,
        totalDuration: curriculum.totalDuration,
        levels: curriculum.levels,
        savedAt: serverTimestamp(),
      });
      setSavedMsg("Roadmap saved!");
      setTimeout(() => setSavedMsg(""), 3000);
    } catch (err) {
      console.error("Save error:", err);
      setSavedMsg("Failed to save.");
      setTimeout(() => setSavedMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Delete a saved roadmap
  const deleteSavedRoadmap = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "savedRoadmaps", user.uid, "roadmaps", id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const generateCurriculum = async () => {
    if (!topic.trim()) { setError("Please enter a topic"); return; }
    setLoading(true);
    setError("");
    setCurriculum(null);
    try {
      const res = await axios.post(`${apiBaseUrl}/generate-topic-schedule`, { topic: topic.trim() }, { timeout: 60000 });
      if (res.data.success && res.data.curriculum) {
        setCurriculum(res.data.curriculum);
        setActiveLevel(0);
        setOpenSections({ topics: true, youtube: false, links: false, books: false });
      } else {
        throw new Error(res.data.error || "Failed to generate curriculum");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to generate curriculum. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const levelColors = [
    { bg: "rgba(16,185,129,0.1)", border: "#10B981", text: "#10B981", badge: "#10B981" },
    { bg: "rgba(245,158,11,0.1)", border: "#F59E0B", text: "#F59E0B", badge: "#F59E0B" },
    { bg: "rgba(139,92,246,0.1)", border: "#8B5CF6", text: "#8B5CF6", badge: "#8B5CF6" },
  ];

  const activeL = curriculum?.levels?.[activeLevel];
  const lc = levelColors[activeLevel] || levelColors[0];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Topic Input Card */}
      <div className="p-4 sm:p-6 rounded-2xl border" style={{ background: theme.card, borderColor: theme.border }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 text-purple-500 flex-shrink-0" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold">AI Learning Curriculum Generator</h2>
              <p className="text-xs sm:text-sm opacity-60">Enter any educational topic — AI creates a full Beginner → Advanced roadmap with resources</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && generateCurriculum()}
            placeholder="e.g. Python, Machine Learning, Web Development, Data Structures..."
            className="flex-1 p-3 sm:p-4 rounded-xl border text-sm sm:text-base"
            style={{ background: theme.background, borderColor: theme.border, color: theme.textPrimary }}
            disabled={loading}
          />
          <button
            onClick={generateCurriculum}
            disabled={loading || !topic.trim()}
            className="px-4 sm:px-6 py-3 sm:py-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all whitespace-nowrap text-sm sm:text-base"
          >
            {loading ? <><Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4 sm:w-5 sm:h-5" /> Generate Curriculum</>}
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-lg border border-red-500/50 bg-red-500/10 text-red-400 text-xs sm:text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Example topics */}
        {!curriculum && !loading && (
          <div className="mt-4">
            <p className="text-xs opacity-50 mb-2">Try these topics:</p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {["Python Programming", "Machine Learning", "React.js", "Data Structures", "Digital Marketing", "SQL & Databases", "Cybersecurity", "UI/UX Design"].map(t => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs border hover:bg-purple-500/10 hover:border-purple-500 transition-all"
                  style={{ borderColor: theme.border, color: theme.textPrimary }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-8 sm:p-12 rounded-2xl border text-center" style={{ background: theme.card, borderColor: theme.border }}>
          <Loader2 className="w-10 h-10 sm:w-14 sm:h-14 animate-spin mx-auto mb-4 text-purple-500" />
          <h3 className="text-lg sm:text-xl font-bold mb-2">Crafting Your Learning Roadmap</h3>
          <p className="text-sm sm:text-base opacity-50">AI is building a personalized curriculum with resources for <strong>{topic}</strong>...</p>
          <div className="flex justify-center gap-1.5 sm:gap-2 mt-4 flex-wrap">
            {["Analyzing topic...", "Structuring levels...", "Finding resources..."].map((txt, i) => (
              <span key={i} className="text-xs px-2 sm:px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }}>{txt}</span>
            ))}
          </div>
        </div>
      )}

      {/* Curriculum Result */}
      {curriculum && !loading && (
        <div className="space-y-4 sm:space-y-6">
          {/* Overview Banner */}
          <div className="p-4 sm:p-5 rounded-2xl border relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(59,130,246,0.15) 100%)', borderColor: theme.border }}>
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl sm:text-2xl font-bold break-words">{curriculum.topic} Curriculum</h2>
                  <p className="opacity-70 text-xs sm:text-sm mt-1 break-words">{curriculum.description}</p>
                </div>
                <div className="sm:ml-auto flex gap-2 flex-wrap">
                  <span className="text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">📅 {curriculum.totalDuration}</span>
                  <span className="text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">3 Skill Levels</span>
                  <button
                    onClick={saveRoadmap}
                    disabled={saving}
                    className="text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-bold flex items-center gap-1 transition-all hover:scale-105"
                    style={{ background: savedMsg ? "#22c55e" : "linear-gradient(135deg,#8b5cf6,#3b82f6)", color: "#fff" }}
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    <span className="hidden xs:inline">{savedMsg || (saving ? "Saving..." : "Save Roadmap")}</span>
                    <span className="xs:hidden">{savedMsg ? "✓" : (saving ? "..." : "Save")}</span>
                  </button>
                  <button
                    onClick={() => { setCurriculum(null); setTopic(""); }}
                    className="text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border opacity-60 hover:opacity-100 transition-all flex items-center gap-1"
                    style={{ borderColor: theme.border }}
                  >
                    <X className="w-3 h-3" /> <span className="hidden xs:inline">New Topic</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Level Selector */}
          <div className="grid grid-cols-1 xs:grid-cols-3 gap-3">
            {curriculum.levels.map((level, idx) => (
              <button
                key={idx}
                onClick={() => { setActiveLevel(idx); setOpenSections({ topics: true, youtube: false, links: false, books: false }); }}
                className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] ${
                  activeLevel === idx ? 'scale-[1.02]' : 'opacity-70 hover:opacity-100'
                }`}
                style={{
                  borderColor: activeLevel === idx ? levelColors[idx]?.border : theme.border,
                  background: activeLevel === idx ? levelColors[idx]?.bg : theme.card
                }}
              >
                <div className="text-xl sm:text-2xl mb-1">{level.emoji}</div>
                <div className="font-bold text-sm sm:text-base break-words" style={{ color: activeLevel === idx ? levelColors[idx]?.text : theme.textPrimary }}>{level.level}</div>
                <div className="text-xs opacity-60 mt-0.5">{level.duration}</div>
                <div className="text-xs mt-1 opacity-50">{level.topics?.length || 0} topics</div>
              </button>
            ))}
          </div>

          {/* Active Level Detail */}
          {activeL && (
            <div className="space-y-3 sm:space-y-4">
              {/* Level Header */}
              <div className="p-4 sm:p-5 rounded-xl border overflow-hidden" style={{ background: lc.bg, borderColor: lc.border }}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
                  <span className="text-2xl sm:text-3xl flex-shrink-0">{activeL.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg sm:text-xl font-bold break-words" style={{ color: lc.text }}>{activeL.level} Level</h3>
                    <p className="text-xs sm:text-sm opacity-80 mt-0.5 break-words">{activeL.description}</p>
                  </div>
                  <span className="self-start sm:ml-auto text-xs px-2 sm:px-3 py-1 rounded-full font-medium max-w-full break-words" style={{ background: lc.border + '25', color: lc.text }}>
                    ⏱️ {activeL.duration}
                  </span>
                </div>
              </div>

              {/* Topics Section */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: theme.border }}>
                <button
                  onClick={() => toggleSection('topics')}
                  className="w-full p-3 sm:p-4 flex items-center justify-between hover:bg-opacity-50 transition-all"
                  style={{ background: theme.card }}
                >
                  <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                    <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                    📚 Topics to Learn ({activeL.topics?.length || 0})
                  </div>
                  {openSections.topics ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 opacity-50" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 opacity-50" />}
                </button>
                {openSections.topics && (
                  <div className="p-3 sm:p-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ borderColor: theme.border, background: theme.background }}>
                    {(activeL.topics || []).map((t, idx) => (
                      <div key={idx} className="p-3 rounded-lg border flex gap-3" style={{ borderColor: theme.border, background: theme.card }}>
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5" style={{ background: lc.border + '25', color: lc.text }}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-xs sm:text-sm break-words">{t.title}</div>
                          <div className="text-xs opacity-60 mt-0.5 leading-relaxed break-words">{t.description}</div>
                          {t.estimatedHours && (
                            <div className="text-xs mt-1" style={{ color: lc.text }}>{t.estimatedHours}h estimated</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* YouTube Section */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: theme.border }}>
                <button
                  onClick={() => toggleSection('youtube')}
                  className="w-full p-3 sm:p-4 flex items-center justify-between hover:bg-opacity-50 transition-all"
                  style={{ background: theme.card }}
                >
                  <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                    <Youtube className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                    🎬 YouTube Resources ({activeL.youtubeLinks?.length || activeL.youtubeSearches?.length || 0})
                  </div>
                  {openSections.youtube ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 opacity-50" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 opacity-50" />}
                </button>
                {openSections.youtube && (
                  <div className="p-3 sm:p-4 border-t space-y-3" style={{ borderColor: theme.border, background: theme.background }}>
                    {(activeL.youtubeLinks || []).map((yl, idx) => (
                      <a
                        key={idx}
                        href={yl.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border group hover:border-red-500/50 hover:bg-red-500/5 transition-all"
                        style={{ borderColor: theme.border, background: theme.card }}
                      >
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-red-500/10 flex-shrink-0">
                          <Youtube className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs sm:text-sm group-hover:text-red-400 transition-colors break-words">{yl.title}</div>
                          <div className="text-xs opacity-50 mt-0.5 truncate">Search: {yl.query}</div>
                        </div>
                        <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 opacity-40 group-hover:opacity-100 flex-shrink-0" />
                      </a>
                    ))}
                    {(!activeL.youtubeLinks || activeL.youtubeLinks.length === 0) && (
                      <div className="text-center opacity-50 py-4 text-xs sm:text-sm">No YouTube resources available for this level</div>
                    )}
                  </div>
                )}
              </div>

              {/* Reference Links Section */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: theme.border }}>
                <button
                  onClick={() => toggleSection('links')}
                  className="w-full p-3 sm:p-4 flex items-center justify-between hover:bg-opacity-50 transition-all"
                  style={{ background: theme.card }}
                >
                  <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                    <Link className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                    🔗 Reference Links ({activeL.referenceLinks?.length || 0})
                  </div>
                  {openSections.links ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 opacity-50" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 opacity-50" />}
                </button>
                {openSections.links && (
                  <div className="p-3 sm:p-4 border-t space-y-3" style={{ borderColor: theme.border, background: theme.background }}>
                    {(activeL.referenceLinks || []).map((ref, idx) => (
                      <a
                        key={idx}
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border group hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
                        style={{ borderColor: theme.border, background: theme.card }}
                      >
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-blue-500/10 flex-shrink-0">
                          <Link className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs sm:text-sm group-hover:text-blue-400 transition-colors break-words">{ref.title}</div>
                          <div className="text-xs opacity-50 mt-0.5 truncate">{ref.url}</div>
                          {ref.type && <span className="text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 mt-1 inline-block capitalize">{ref.type}</span>}
                        </div>
                        <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 opacity-40 group-hover:opacity-100 flex-shrink-0" />
                      </a>
                    ))}
                    {(!activeL.referenceLinks || activeL.referenceLinks.length === 0) && (
                      <div className="text-center opacity-50 py-4 text-xs sm:text-sm">No reference links available</div>
                    )}
                  </div>
                )}
              </div>

              {/* Books Section */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: theme.border }}>
                <button
                  onClick={() => toggleSection('books')}
                  className="w-full p-3 sm:p-4 flex items-center justify-between hover:bg-opacity-50 transition-all"
                  style={{ background: theme.card }}
                >
                  <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                    📖 Recommended Books ({activeL.books?.length || 0})
                  </div>
                  {openSections.books ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 opacity-50" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 opacity-50" />}
                </button>
                {openSections.books && (
                  <div className="p-3 sm:p-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ borderColor: theme.border, background: theme.background }}>
                    {(activeL.books || []).map((book, idx) => (
                      <div key={idx} className="p-3 sm:p-4 rounded-lg border" style={{ borderColor: theme.border, background: theme.card }}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs sm:text-sm break-words">{book.title}</div>
                            <div className="text-xs text-purple-400 font-medium mt-0.5">by {book.author}</div>
                            {book.description && <div className="text-xs opacity-60 mt-1 leading-relaxed break-words">{book.description}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!activeL.books || activeL.books.length === 0) && (
                      <div className="text-center opacity-50 py-4 text-xs sm:text-sm col-span-2">No book recommendations available</div>
                    )}
                  </div>
                )}
              </div>

              {/* Level Progress Tip */}
              <div className="p-3 sm:p-4 rounded-xl border" style={{ background: lc.bg, borderColor: lc.border + '40' }}>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" style={{ color: lc.text }} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs sm:text-sm break-words" style={{ color: lc.text }}>Level Completion Goal</div>
                    <div className="text-xs sm:text-sm opacity-70 mt-0.5 break-words">{activeL.description}</div>
                    {activeLevel < (curriculum.levels.length - 1) && (
                      <button
                        onClick={() => { setActiveLevel(activeLevel + 1); setOpenSections({ topics: true, youtube: false, links: false, books: false }); }}
                        className="mt-3 text-xs px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold flex items-center gap-1 transition-all hover:scale-105"
                        style={{ background: lc.border, color: '#fff' }}
                      >
                        Next Level: {curriculum.levels[activeLevel + 1]?.level} <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Saved Roadmaps Panel — always visible below */}
      <SavedRoadmapsPanel
        savedRoadmaps={savedRoadmaps}
        loadingRoadmaps={loadingRoadmaps}
        onLoad={(rm) => { setCurriculum(rm); setActiveLevel(0); setOpenSections({ topics: true, youtube: false, links: false, books: false }); }}
        onDelete={deleteSavedRoadmap}
        theme={theme}
      />
    </div>
  );
};

// ========== SAVED ROADMAPS PANEL ==========
const SavedRoadmapsPanel = ({ savedRoadmaps, loadingRoadmaps, onLoad, onDelete, theme }) => {
  if (!savedRoadmaps.length && !loadingRoadmaps) return null;
  return (
    <div className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: theme.border }}>
        <BookMarked className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
        <h3 className="text-base sm:text-lg font-bold">Saved Roadmaps</h3>
        <span className="text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">{savedRoadmaps.length}</span>
      </div>
      {loadingRoadmaps ? (
        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-purple-500" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {savedRoadmaps.map(rm => (
            <div key={rm.id} className="p-3 sm:p-4 rounded-xl border group relative hover:border-purple-500/50 transition-all" style={{ background: theme.card, borderColor: theme.border }}>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-xs sm:text-sm truncate flex-1 pr-2">{rm.topic}</h4>
                <button
                  onClick={() => onDelete(rm.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-all flex-shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs opacity-60 mb-3 line-clamp-2 break-words">{rm.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">{rm.totalDuration}</span>
                <button
                  onClick={() => onLoad(rm)}
                  className="text-xs px-2 sm:px-3 py-1 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-all"
                >
                  Load →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========== QUESTION COMPONENTS ==========

// Welcome Question Component
const WelcomeQuestion = ({ onNext }) => (
  <div className="text-center py-6 sm:py-8">
    <div className="mb-4 sm:mb-6 flex justify-center">
      <Sparkles className="w-16 h-16 sm:w-20 sm:h-20 text-purple-500 animate-pulse" />
    </div>
    <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 px-2">Welcome to FocusForge AI Scheduler</h2>
    <p className="text-base sm:text-lg opacity-70 mb-6 sm:mb-8 max-w-xl mx-auto px-4">
      I'll help you create the perfect study schedule based on your unique needs, learning style, and goals.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-2xl mx-auto mb-6 sm:mb-8 px-4">
      <div className="p-3 sm:p-4 rounded-xl border" style={{ borderColor: 'currentColor' }}>
        <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 mx-auto mb-2" />
        <h3 className="font-semibold text-sm sm:text-base">Smart</h3>
        <p className="text-xs opacity-70">AI-powered optimization</p>
      </div>
      <div className="p-3 sm:p-4 rounded-xl border" style={{ borderColor: 'currentColor' }}>
        <Target className="w-6 h-6 sm:w-8 sm:h-8 text-pink-500 mx-auto mb-2" />
        <h3 className="font-semibold text-sm sm:text-base">Personalized</h3>
        <p className="text-xs opacity-70">Adapts to your style</p>
      </div>
      <div className="p-3 sm:p-4 rounded-xl border" style={{ borderColor: 'currentColor' }}>
        <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500 mx-auto mb-2" />
        <h3 className="font-semibold text-sm sm:text-base">Effective</h3>
        <p className="text-xs opacity-70">Optimized for results</p>
      </div>
    </div>
    <button
      onClick={onNext}
      className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-base sm:text-lg hover:opacity-90 transition-all flex items-center gap-2 mx-auto"
    >
      Let's Get Started
      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
    </button>
  </div>
);

// Basic Info Question Component
const BasicInfoQuestion = ({ data, updateData, theme }) => (
  <div className="space-y-5 sm:space-y-6 py-3 sm:py-4">
    <div>
      <label className="block text-sm font-medium mb-2">What's your name?</label>
      <input
        type="text"
        value={data.name}
        onChange={(e) => updateData('name', e.target.value)}
        placeholder="Enter your name"
        className="w-full p-3 sm:p-4 rounded-xl border text-base sm:text-lg"
        style={{ background: theme.card, borderColor: theme.border, color: theme.textPrimary }}
      />
    </div>
    <div>
      <label className="block text-sm font-medium mb-2">What's your main goal?</label>
      <select
        value={data.goal}
        onChange={(e) => updateData('goal', e.target.value)}
        className="w-full p-3 sm:p-4 rounded-xl border text-base sm:text-lg"
        style={{ background: theme.card, borderColor: theme.border, color: theme.textPrimary }}
      >
        <option value="">Select a goal</option>
        <option value="exams">Prepare for exams</option>
        <option value="daily">Daily study routine</option>
        <option value="skills">Learn new skills</option>
        <option value="projects">Work on projects</option>
        <option value="improve">Improve grades</option>
      </select>
    </div>
  </div>
);

// Subjects Question Component
const SubjectsQuestion = ({ data, updateData, theme }) => {
  const addSubject = () => {
    updateData('subjects', [...data.subjects, { 
      name: "", 
      difficulty: "medium", 
      priority: 3,
      topics: []
    }]);
  };

  const updateSubject = (index, field, value) => {
    const newSubjects = [...data.subjects];
    newSubjects[index][field] = value;
    updateData('subjects', newSubjects);
  };

  const removeSubject = (index) => {
    updateData('subjects', data.subjects.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
      {data.subjects.map((subject, index) => (
        <div key={index} className="p-4 sm:p-5 rounded-xl border space-y-3 sm:space-y-4" style={{ borderColor: theme.border }}>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={subject.name}
              onChange={(e) => updateSubject(index, 'name', e.target.value)}
              placeholder="Subject name (e.g., Mathematics)"
              className="flex-1 p-2.5 sm:p-3 rounded-lg border text-sm sm:text-base"
              style={{ background: theme.card, borderColor: theme.border, color: theme.textPrimary }}
            />
            <select
              value={subject.difficulty}
              onChange={(e) => updateSubject(index, 'difficulty', e.target.value)}
              className="p-2.5 sm:p-3 rounded-lg border text-sm sm:text-base"
              style={{ background: theme.card, borderColor: theme.border, color: theme.textPrimary }}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <button
              onClick={() => removeSubject(index)}
              className="p-2.5 sm:p-3 text-red-500 hover:bg-red-500/10 rounded-lg"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
          <div>
            <label className="block text-xs sm:text-sm opacity-70 mb-2">Priority Level</label>
            <div className="flex gap-1.5 sm:gap-2">
              {[1,2,3,4,5].map(num => (
                <button
                  key={num}
                  onClick={() => updateSubject(index, 'priority', num)}
                  className={`flex-1 py-1.5 sm:py-2 text-center rounded-lg transition-all text-sm ${
                    subject.priority >= num 
                      ? 'bg-purple-500 text-white scale-105' 
                      : 'border opacity-50'
                  }`}
                  style={{ borderColor: theme.border }}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
      
      <button
        onClick={addSubject}
        className="w-full p-3 sm:p-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 hover:opacity-70 transition-all text-sm sm:text-base"
        style={{ borderColor: theme.border, color: theme.textPrimary }}
      >
        <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
        Add Subject
      </button>
    </div>
  );
};

// Schedule Question Component
const ScheduleQuestion = ({ data, updateData, theme }) => (
  <div className="space-y-5 sm:space-y-6 py-3 sm:py-4">
    <div>
      <label className="block text-sm font-medium mb-2">How many hours can you study daily?</label>
      <input
        type="range"
        min="1"
        max="10"
        step="0.5"
        value={data.availableHours}
        onChange={(e) => updateData('availableHours', parseFloat(e.target.value))}
        className="w-full accent-purple-500"
      />
      <div className="flex justify-between mt-2">
        <span className="text-xs sm:text-sm opacity-70">1 hour</span>
        <span className="font-bold text-base sm:text-lg">{data.availableHours} hours</span>
        <span className="text-xs sm:text-sm opacity-70">10 hours</span>
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium mb-2">When do you study best?</label>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {[
          { value: "morning", label: "🌅 Morning", time: "6 AM - 12 PM" },
          { value: "afternoon", label: "☀️ Afternoon", time: "12 PM - 5 PM" },
          { value: "evening", label: "🌆 Evening", time: "5 PM - 9 PM" },
          { value: "night", label: "🌙 Night", time: "9 PM - 2 AM" }
        ].map(option => (
          <button
            key={option.value}
            onClick={() => updateData('preferredTime', option.value)}
            className={`p-3 sm:p-4 rounded-xl border text-left transition-all ${
              data.preferredTime === option.value ? 'ring-2 ring-purple-500 bg-purple-500/10' : ''
            }`}
            style={{ borderColor: theme.border, color: theme.textPrimary }}
          >
            <div className="font-semibold text-sm sm:text-base">{option.label}</div>
            <div className="text-xs opacity-70 mt-1">{option.time}</div>
          </button>
        ))}
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium mb-2">How often do you need breaks?</label>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {[
          { value: "low", label: "Few breaks", desc: "Study 90min, break 5min" },
          { value: "medium", label: "Regular breaks", desc: "Study 50min, break 10min" },
          { value: "high", label: "Frequent breaks", desc: "Study 30min, break 15min" }
        ].map(option => (
          <button
            key={option.value}
            onClick={() => updateData('breakFrequency', option.value)}
            className={`flex-1 p-3 sm:p-4 rounded-xl border text-center ${
              data.breakFrequency === option.value ? 'ring-2 ring-purple-500 bg-purple-500/10' : ''
            }`}
            style={{ borderColor: theme.border, color: theme.textPrimary }}
          >
            <div className="font-semibold text-sm sm:text-base">{option.label}</div>
            <div className="text-xs opacity-70 mt-1">{option.desc}</div>
          </button>
        ))}
      </div>
    </div>
  </div>
);

// Learning Style Question Component
const LearningStyleQuestion = ({ data, updateData, theme }) => (
  <div className="space-y-5 sm:space-y-6 py-3 sm:py-4">
    <div>
      <label className="block text-sm font-medium mb-2">How do you learn best?</label>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {[
          { value: "visual", label: "👁️ Visual", desc: "Diagrams, charts, videos" },
          { value: "auditory", label: "👂 Auditory", desc: "Listening, discussions" },
          { value: "reading", label: "📚 Reading/Writing", desc: "Notes, textbooks" },
          { value: "kinesthetic", label: "✋ Kinesthetic", desc: "Hands-on practice" }
        ].map(option => (
          <button
            key={option.value}
            onClick={() => updateData('learningStyle', option.value)}
            className={`p-3 sm:p-4 rounded-xl border text-left transition-all ${
              data.learningStyle === option.value ? 'ring-2 ring-purple-500 bg-purple-500/10' : ''
            }`}
            style={{ borderColor: theme.border, color: theme.textPrimary }}
          >
            <div className="font-semibold text-sm sm:text-base">{option.label}</div>
            <div className="text-xs opacity-70 mt-1">{option.desc}</div>
          </button>
        ))}
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium mb-2">What's your focus level?</label>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {[
          { value: "low", label: "😴 Low", desc: "Easily distracted" },
          { value: "medium", label: "😊 Medium", desc: "Can focus with effort" },
          { value: "high", label: "🎯 High", desc: "Deep focus easily" }
        ].map(option => (
          <button
            key={option.value}
            onClick={() => updateData('focusLevel', option.value)}
            className={`flex-1 p-3 sm:p-4 rounded-xl border text-center ${
              data.focusLevel === option.value ? 'ring-2 ring-purple-500 bg-purple-500/10' : ''
            }`}
            style={{ borderColor: theme.border, color: theme.textPrimary }}
          >
            <div className="font-semibold text-sm sm:text-base">{option.label}</div>
            <div className="text-xs opacity-70 mt-1">{option.desc}</div>
          </button>
        ))}
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium mb-2">When do you have the most energy?</label>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {[
          { value: "morning", label: "🌅 Morning person" },
          { value: "balanced", label: "⚖️ Balanced" },
          { value: "night", label: "🌙 Night owl" }
        ].map(option => (
          <button
            key={option.value}
            onClick={() => updateData('energyPattern', option.value)}
            className={`flex-1 p-3 sm:p-4 rounded-xl border text-center ${
              data.energyPattern === option.value ? 'ring-2 ring-purple-500 bg-purple-500/10' : ''
            }`}
            style={{ borderColor: theme.border, color: theme.textPrimary }}
          >
            <div className="font-semibold text-sm sm:text-base">{option.label}</div>
          </button>
        ))}
      </div>
    </div>
  </div>
);

// Goals Question Component
const GoalsQuestion = ({ data, updateData, theme }) => {
  const addDeadline = () => {
    updateData('deadlines', [...data.deadlines, { subject: "", date: "" }]);
  };

  return (
    <div className="space-y-5 sm:space-y-6 py-3 sm:py-4">
      <div>
        <label className="block text-sm font-medium mb-2">Do you have any upcoming exams?</label>
        {data.deadlines.map((deadline, index) => (
          <div key={index} className="flex flex-col sm:flex-row gap-3 mb-3">
            <select
              value={deadline.subject}
              onChange={(e) => {
                const newDeadlines = [...data.deadlines];
                newDeadlines[index].subject = e.target.value;
                updateData('deadlines', newDeadlines);
              }}
              className="flex-1 p-2.5 sm:p-3 rounded-lg border text-sm sm:text-base"
              style={{ background: theme.card, borderColor: theme.border, color: theme.textPrimary }}
            >
              <option value="">Select subject</option>
              {data.subjects.filter(s => s.name).map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={deadline.date}
              onChange={(e) => {
                const newDeadlines = [...data.deadlines];
                newDeadlines[index].date = e.target.value;
                updateData('deadlines', newDeadlines);
              }}
              className="p-2.5 sm:p-3 rounded-lg border text-sm sm:text-base"
              style={{ background: theme.card, borderColor: theme.border, color: theme.textPrimary }}
            />
            <button
              onClick={() => {
                updateData('deadlines', data.deadlines.filter((_, i) => i !== index));
              }}
              className="p-2.5 sm:p-3 text-red-500 hover:bg-red-500/10 rounded-lg"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        ))}
        <button
          onClick={addDeadline}
          className="w-full p-2.5 sm:p-3 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 mt-2 text-sm sm:text-base"
          style={{ borderColor: theme.border, color: theme.textPrimary }}
        >
          <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
          Add Exam/Deadline
        </button>
      </div>
    </div>
  );
};

// Lifestyle Question Component
const LifestyleQuestion = ({ data, updateData, theme }) => (
  <div className="space-y-5 sm:space-y-6 py-3 sm:py-4">
    <div>
      <label className="block text-sm font-medium mb-2">How many hours of sleep do you get?</label>
      <input
        type="range"
        min="5"
        max="10"
        step="0.5"
        value={data.sleepHours}
        onChange={(e) => updateData('sleepHours', parseFloat(e.target.value))}
        className="w-full accent-purple-500"
      />
      <div className="flex justify-between mt-2">
        <span className="text-xs sm:text-sm opacity-70">5 hours</span>
        <span className="font-bold text-base sm:text-lg">{data.sleepHours} hours</span>
        <span className="text-xs sm:text-sm opacity-70">10 hours</span>
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium mb-2">How often do you exercise?</label>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {[
          { value: "low", label: "🛋️ Rarely", desc: "Once a week or less" },
          { value: "moderate", label: "🚶 Moderate", desc: "2-3 times a week" },
          { value: "high", label: "💪 Active", desc: "4+ times a week" }
        ].map(option => (
          <button
            key={option.value}
            onClick={() => updateData('exerciseFrequency', option.value)}
            className={`flex-1 p-3 sm:p-4 rounded-xl border text-center ${
              data.exerciseFrequency === option.value ? 'ring-2 ring-purple-500 bg-purple-500/10' : ''
            }`}
            style={{ borderColor: theme.border, color: theme.textPrimary }}
          >
            <div className="font-semibold text-sm sm:text-base">{option.label}</div>
            <div className="text-xs opacity-70 mt-1">{option.desc}</div>
          </button>
        ))}
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium mb-2">How many social commitments do you have?</label>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {[
          { value: "low", label: "🏠 Low", desc: "Mostly free" },
          { value: "moderate", label: "👥 Moderate", desc: "Some plans" },
          { value: "high", label: "🎉 High", desc: "Very social" }
        ].map(option => (
          <button
            key={option.value}
            onClick={() => updateData('socialCommitments', option.value)}
            className={`flex-1 p-3 sm:p-4 rounded-xl border text-center ${
              data.socialCommitments === option.value ? 'ring-2 ring-purple-500 bg-purple-500/10' : ''
            }`}
            style={{ borderColor: theme.border, color: theme.textPrimary }}
          >
            <div className="font-semibold text-sm sm:text-base">{option.label}</div>
            <div className="text-xs opacity-70 mt-1">{option.desc}</div>
          </button>
        ))}
      </div>
    </div>
  </div>
);

// Generate Question Component
const GenerateQuestion = ({ data, loading, onGenerate, theme }) => (
  <div className="space-y-5 sm:space-y-6 py-3 sm:py-4">
    <div className="p-4 sm:p-6 rounded-xl border" style={{ background: theme.card, borderColor: theme.border }}>
      <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4">Your Preferences Summary</h3>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div>
          <p className="text-xs sm:text-sm opacity-70">Name</p>
          <p className="font-medium text-sm sm:text-base break-words">{data.name || "Not set"}</p>
        </div>
        <div>
          <p className="text-xs sm:text-sm opacity-70">Goal</p>
          <p className="font-medium text-sm sm:text-base capitalize break-words">{data.goal || "Not set"}</p>
        </div>
        <div>
          <p className="text-xs sm:text-sm opacity-70">Subjects</p>
          <p className="font-medium text-sm sm:text-base">{data.subjects.filter(s => s.name).length} subjects</p>
        </div>
        <div>
          <p className="text-xs sm:text-sm opacity-70">Daily Hours</p>
          <p className="font-medium text-sm sm:text-base">{data.availableHours} hours</p>
        </div>
        <div>
          <p className="text-xs sm:text-sm opacity-70">Learning Style</p>
          <p className="font-medium text-sm sm:text-base capitalize break-words">{data.learningStyle}</p>
        </div>
        <div>
          <p className="text-xs sm:text-sm opacity-70">Energy Pattern</p>
          <p className="font-medium text-sm sm:text-base capitalize break-words">{data.energyPattern}</p>
        </div>
      </div>
    </div>

    <button
      onClick={onGenerate}
      disabled={loading}
      className="w-full py-3.5 sm:py-5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-base sm:text-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 sm:gap-3"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
          Generating Your Perfect Schedule...
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          Generate My Schedule
        </>
      )}
    </button>
  </div>
);

// ========== SCHEDULE VIEWER COMPONENT ==========
const ScheduleViewer = ({ schedule, generatedDays, onBack, onViewDay, activeDay, theme, user, scheduleId }) => {
  const [expandedDays, setExpandedDays] = useState({});
  // Track completed sessions: key = `${day.date}_${slotIdx}`, value = true/false
  const [completedSlots, setCompletedSlots] = useState({});

  useEffect(() => {
    const nextCompleted = {};
    (generatedDays || []).forEach((day) => {
      const persisted = day.completedSlots || {};
      Object.entries(persisted).forEach(([slotIdx, isDone]) => {
        nextCompleted[`${day.date}_${slotIdx}`] = !!isDone;
      });
    });
    setCompletedSlots(nextCompleted);
  }, [generatedDays]);

  const toggleDay = (date) => {
    setExpandedDays(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  const toggleSlot = async (dayDate, slotIdx) => {
    const key = `${dayDate}_${slotIdx}`;
    const nextValue = !completedSlots[key];
    setCompletedSlots(prev => ({ ...prev, [key]: nextValue }));

    if (!user?.uid || !scheduleId) return;

    try {
      const dayDocRef = doc(db, "timetable", user.uid, "schedules", scheduleId, "days", dayDate);
      const targetDay = generatedDays.find((day) => day.date === dayDate);
      const nextDayCompletedSlots = {
        ...(targetDay?.completedSlots || {}),
        [slotIdx]: nextValue
      };
      await updateDoc(dayDocRef, {
        completedSlots: nextDayCompletedSlots,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving slot progress:", error);
    }
  };

  const getDayProgress = (day) => {
    const total = day.slots?.length || 0;
    const done = (day.slots || []).filter((_, i) => completedSlots[`${day.date}_${i}`]).length;
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  if (!schedule) return null;

  // Calculate stats
  const totalHours = generatedDays.reduce((sum, day) => sum + (day.totalStudyTime || 0), 0) / 60;
  const avgHours = generatedDays.length > 0 ? totalHours / generatedDays.length : 0;
  const totalSessions = generatedDays.reduce((sum, day) => sum + (day.slots?.length || 0), 0);
  const progressTrackColor = theme.background === "#0E0E14" ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)";

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Schedule Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2 break-words">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 flex-shrink-0" />
            <span className="break-words">{schedule.name || "Unnamed Schedule"}</span>
          </h2>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
            <span className="text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-purple-500/10 text-purple-600">
              {schedule.subjects?.length || 0} subjects
            </span>
            <span className="text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-blue-500/10 text-blue-600">
              {schedule.questionnaire?.learningStyle || "mixed"} learner
            </span>
            <span className="text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-green-500/10 text-green-600">
              {schedule.generatedWithAI ? '🤖 AI' : '📝 Manual'}
            </span>
          </div>
        </div>
        <button
          onClick={onBack}
          className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border flex items-center gap-2 hover:bg-opacity-50 transition-all text-xs sm:text-sm self-start"
          style={{ borderColor: theme.border, color: theme.textPrimary }}
        >
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
          Back to List
        </button>
      </div>

      {/* Stats Cards */}
      {generatedDays.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
          {[
            { label: 'Total Study Hours', value: `${totalHours.toFixed(1)}h` },
            { label: 'Days Generated', value: generatedDays.length },
            { label: 'Avg. Daily Hours', value: `${avgHours.toFixed(1)}h` },
            { label: 'Total Sessions', value: totalSessions },
          ].map(({ label, value }) => (
            <div key={label} className="p-2.5 sm:p-4 rounded-xl border" style={{ background: theme.card, borderColor: theme.border }}>
              <div className="text-xs sm:text-sm opacity-70">{label}</div>
              <div className="text-sm sm:text-2xl font-bold mt-0.5 sm:mt-1">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Days List */}
      {generatedDays.length === 0 ? (
        <div className="text-center py-8 sm:py-12 rounded-xl border" style={{ borderColor: theme.border }}>
          <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-30" />
          <h3 className="text-lg sm:text-xl font-semibold mb-2">No Days Generated</h3>
          <p className="text-xs sm:text-sm opacity-50">This schedule doesn't have any days yet</p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {generatedDays.map((day) => {
            const { total, done, pct } = getDayProgress(day);
            const allDone = total > 0 && done === total;
            return (
              <div key={day.date} className="border rounded-xl overflow-hidden" style={{ borderColor: allDone ? 'rgba(34,197,94,0.5)' : theme.border }}>
                {/* Day Header */}
                <div
                  className="p-2.5 sm:p-4 flex items-center justify-between cursor-pointer hover:bg-opacity-50 transition-all"
                  onClick={() => toggleDay(day.date)}
                  style={{ background: theme.card }}
                >
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="text-center min-w-[40px] sm:min-w-[48px]">
                      <div className="font-bold text-xs sm:text-base">{day.dayOfWeek?.substring(0, 3) || 'Day'}</div>
                      <div className="text-[10px] sm:text-xs opacity-70">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        {day.energyLevel && (
                          <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full ${
                            day.energyLevel === 'high' ? 'bg-green-500/20 text-green-500' :
                            day.energyLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                            'bg-red-500/20 text-red-500'
                          }`}>
                            {day.energyLevel}
                          </span>
                        )}
                        <span className="text-[10px] sm:text-xs opacity-70">{total} sessions</span>
                        <span className={`text-[10px] sm:text-xs font-bold ${allDone ? 'text-green-400' : 'text-purple-400'}`}>
                          {done}/{total} done
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1 h-1 sm:h-1.5 rounded-full overflow-hidden" style={{ background: progressTrackColor }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: allDone ? '#22c55e' : pct > 50 ? '#a78bfa' : '#8b5cf6'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 sm:gap-1 ml-1 sm:ml-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewDay(day); }}
                      className="p-1 sm:p-1.5 rounded-lg hover:bg-purple-500/10 transition-all"
                      title="View details"
                    >
                      <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                    {expandedDays[day.date] ? (
                      <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4 opacity-50" />
                    ) : (
                      <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 opacity-50" />
                    )}
                  </div>
                </div>

                {/* Expanded Day Content — with checkboxes */}
                {expandedDays[day.date] && day.slots && (
                  <div className="p-2.5 sm:p-4 border-t" style={{ borderColor: theme.border, background: theme.background }}>
                    <div className="space-y-1.5 sm:space-y-2">
                      {day.slots.map((slot, idx) => {
                        const slotKey = `${day.date}_${idx}`;
                        const isChecked = !!completedSlots[slotKey];
                        const diffColor = slot.difficulty === 'hard' ? '#EF4444' :
                          slot.difficulty === 'medium' ? '#F59E0B' : '#10B981';
                        return (
                          <div
                            key={idx}
                            className="p-2 sm:p-3 rounded-lg border-l-4 flex items-center gap-2 sm:gap-3 transition-all"
                            style={{
                              background: isChecked ? 'rgba(34,197,94,0.06)' : theme.card,
                              borderLeftColor: isChecked ? '#22c55e' : diffColor,
                              opacity: isChecked ? 0.75 : 1,
                            }}
                          >
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleSlot(day.date, idx)}
                              className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 rounded border-2 flex items-center justify-center transition-all hover:scale-110"
                              style={{
                                borderColor: isChecked ? '#22c55e' : diffColor,
                                background: isChecked ? '#22c55e' : 'transparent',
                              }}
                            >
                              {isChecked && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2">
                                <div className="min-w-0">
                                  <span className={`font-semibold text-xs sm:text-sm ${isChecked ? 'line-through opacity-60' : ''} break-words`}>
                                    {slot.subject}
                                  </span>
                                  <span className="text-[10px] sm:text-xs ml-1.5 sm:ml-2 opacity-60">{slot.difficulty}</span>
                                </div>
                                <span className="text-[10px] sm:text-xs font-medium flex-shrink-0">{slot.start} – {slot.end}</span>
                              </div>
                              <div className="text-[10px] sm:text-xs opacity-50 mt-0.5">{slot.duration} min</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Active Day Modal */}
      {activeDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50">
          <div className="max-w-2xl w-full rounded-2xl border p-4 sm:p-6 max-h-[90vh] flex flex-col" style={{ background: theme.card, borderColor: theme.border }}>
            <div className="flex justify-between items-start mb-4">
              <div className="min-w-0 flex-1 pr-2">
                <h3 className="text-base sm:text-xl font-bold break-words">
                  {activeDay.dayOfWeek}, {new Date(activeDay.date).toLocaleDateString('en-US', { 
                    weekday: 'long',
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h3>
                {activeDay.focusSubject && (
                  <p className="text-xs sm:text-sm opacity-70 mt-1 break-words">
                    <Target className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                    Focus: {activeDay.focusSubject}
                  </p>
                )}
              </div>
              <button 
                onClick={() => onViewDay(null)}
                className="p-1.5 sm:p-2 hover:bg-opacity-10 rounded-lg flex-shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4 overflow-y-auto flex-1 pr-1 sm:pr-2">
              {activeDay.slots?.map((slot, idx) => (
                <div 
                  key={idx}
                  className="p-3 sm:p-4 rounded-xl border-l-4"
                  style={{ 
                    background: theme.background,
                    borderLeftColor: slot.difficulty === 'hard' ? '#EF4444' : 
                                   slot.difficulty === 'medium' ? '#F59E0B' : '#10B981'
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm sm:text-lg break-words">{slot.subject}</div>
                      <div className="text-xs sm:text-sm opacity-70 capitalize">{slot.difficulty} • {slot.duration} min</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-sm sm:text-lg">{slot.start}</div>
                      <div className="text-xs sm:text-sm opacity-70">to {slot.end}</div>
                    </div>
                  </div>
                  {slot.notes && (
                    <p className="text-xs sm:text-sm mt-2 p-2 rounded break-words" style={{ background: theme.card }}>
                      {slot.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ========== SCHEDULE LIST COMPONENT ==========
const ScheduleList = ({ schedules, onSelect, onDelete, onCreateNew, theme }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSchedules = schedules.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.questionnaire?.goal?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <History className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
          Your Timetables
        </h2>
        <button
          onClick={onCreateNew}
          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90 transition-all flex items-center gap-2 text-sm sm:text-base self-start sm:self-auto"
        >
          <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
          Create New
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search schedules..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2.5 sm:p-3 pl-8 sm:pl-10 rounded-lg border text-sm sm:text-base"
          style={{ background: theme.card, borderColor: theme.border, color: theme.textPrimary }}
        />
        <Search className="w-3 h-3 sm:w-4 sm:h-4 absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 opacity-50" />
      </div>

      {/* Schedule Grid */}
      {filteredSchedules.length === 0 ? (
        <div className="text-center py-8 sm:py-12 rounded-xl border" style={{ borderColor: theme.border }}>
          {schedules.length === 0 ? (
            <>
              <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-30" />
              <h3 className="text-lg sm:text-xl font-semibold mb-2">No Schedules Yet</h3>
              <p className="text-xs sm:text-sm opacity-50 mb-4 sm:mb-6 px-4">Create your first AI-powered timetable</p>
              <button
                onClick={onCreateNew}
                className="px-4 sm:px-6 py-2 sm:py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90 text-sm sm:text-base"
              >
                Create New Schedule
              </button>
            </>
          ) : (
            <p className="text-xs sm:text-sm opacity-50">No schedules match your search</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredSchedules.map((schedule) => (
            <div
              key={schedule.id}
              className="group relative rounded-xl border overflow-hidden cursor-pointer hover:scale-[1.02] transition-all"
              style={{ background: theme.card, borderColor: theme.border }}
              onClick={() => onSelect(schedule)}
            >
              {/* Schedule Card Content */}
              <div className="p-3 sm:p-5">
                <div className="flex justify-between items-start mb-2 sm:mb-3">
                  <h3 className="font-bold text-sm sm:text-base truncate flex-1">{schedule.name || "Unnamed"}</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(schedule.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 sm:p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                  <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-purple-500/10 text-purple-600">
                    {schedule.subjects?.length || 0} subjects
                  </span>
                  {schedule.generatedWithAI && (
                    <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-blue-500/10 text-blue-600">
                      🤖 AI
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  {schedule.questionnaire?.goal && (
                    <p className="opacity-70 truncate">
                      <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3 inline mr-1" />
                      {schedule.questionnaire.goal}
                    </p>
                  )}
                  {schedule.dailyStudyHours && (
                    <p className="opacity-70">
                      <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 inline mr-1" />
                      {schedule.dailyStudyHours}h/day
                    </p>
                  )}
                </div>

                {/* Subjects Preview */}
                {schedule.subjects && schedule.subjects.length > 0 && (
                  <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t" style={{ borderColor: theme.border }}>
                    <div className="flex flex-wrap gap-1">
                      {schedule.subjects.slice(0, 3).map((subject, idx) => (
                        <span key={idx} className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-opacity-20" style={{
                          backgroundColor: subject.difficulty === 'hard' ? '#EF444420' :
                                         subject.difficulty === 'medium' ? '#F59E0B20' : '#10B98120',
                          color: subject.difficulty === 'hard' ? '#EF4444' :
                                subject.difficulty === 'medium' ? '#F59E0B' : '#10B981'
                        }}>
                          {subject.name}
                        </span>
                      ))}
                      {schedule.subjects.length > 3 && (
                        <span className="text-[10px] sm:text-xs opacity-50">+{schedule.subjects.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Date */}
                <p className="text-[10px] sm:text-xs opacity-50 mt-2 sm:mt-3">
                  Updated: {schedule.updatedAt?.toDate ? new Date(schedule.updatedAt.toDate()).toLocaleDateString() : 'Recently'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========== MAIN COMPONENT ==========
export default function Schedule() {
  const { theme } = useTheme();
  const [user, setUser] = useState(null);
  
  // API Configuration
  const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? '/api/schedule-ai'
    : 'http://localhost:5000/api/schedule-ai';
  
  // State Management
  const [schedules, setSchedules] = useState([]);
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [currentScheduleId, setCurrentScheduleId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'create', 'view'
  
  // Questionnaire State
  const [step, setStep] = useState(0);
  const [questionnaire, setQuestionnaire] = useState({
    name: "",
    goal: "",
    subjects: [],
    availableHours: 4,
    preferredTime: "morning",
    breakFrequency: "medium",
    learningStyle: "visual",
    focusLevel: "medium",
    energyPattern: "balanced",
    deadlines: [],
    examDates: [],
    sleepHours: 8,
    exerciseFrequency: "moderate",
    socialCommitments: "moderate",
  });
  
  // AI Configuration
  const [aiConfig] = useState({
    enabled: true,
    considerEnergyLevels: true,
    optimizeForRetention: true,
    includeReviews: true
  });
  
  // Display State
  const [generatedDays, setGeneratedDays] = useState([]);
  const [activeDay, setActiveDay] = useState(null);
  const [showSummary, setShowSummary] = useState(false);

  // Questions flow
  const questions = [
    {
      id: "welcome",
      title: "Let's Create Your Perfect Study Schedule",
      description: "I'll ask you a few questions to understand your needs and create a personalized timetable.",
      icon: <Sparkles className="w-8 h-8 sm:w-12 sm:h-12 text-purple-500" />,
    },
    {
      id: "basic",
      title: "Tell me about yourself",
      description: "What's your name and what's your main goal?",
      icon: <Brain className="w-8 h-8 sm:w-12 sm:h-12 text-blue-500" />,
    },
    {
      id: "subjects",
      title: "What are you studying?",
      description: "Add the subjects you need to study and their importance",
      icon: <BookOpen className="w-8 h-8 sm:w-12 sm:h-12 text-green-500" />,
    },
    {
      id: "schedule",
      title: "Your Daily Schedule",
      description: "When do you prefer to study and how much time do you have?",
      icon: <Clock className="w-8 h-8 sm:w-12 sm:h-12 text-orange-500" />,
    },
    {
      id: "learning",
      title: "Learning Style",
      description: "How do you learn best?",
      icon: <Brain className="w-8 h-8 sm:w-12 sm:h-12 text-purple-500" />,
    },
    {
      id: "goals",
      title: "Goals & Deadlines",
      description: "Do you have any upcoming exams or deadlines?",
      icon: <Target className="w-8 h-8 sm:w-12 sm:h-12 text-red-500" />,
    },
    {
      id: "lifestyle",
      title: "Lifestyle Balance",
      description: "Let's understand your daily routine",
      icon: <Calendar className="w-8 h-8 sm:w-12 sm:h-12 text-pink-500" />,
    },
    {
      id: "generate",
      title: "Ready to Generate!",
      description: "Review your preferences and generate your personalized schedule",
      icon: <Sparkles className="w-8 h-8 sm:w-12 sm:h-12 text-indigo-500" />,
    }
  ];

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log("👤 Auth state changed:", u ? `User: ${u.email}` : "No user");
      setUser(u || null);
    });
    return () => unsub();
  }, []);

  // Load Schedules from Firebase
  useEffect(() => {
    if (!user) {
      console.log("No user, skipping schedule load");
      return;
    }
    
    console.log("📂 Loading schedules for user:", user.uid);
    const q = query(collection(db, "timetable", user.uid, "schedules"), orderBy("updatedAt", "desc"));
    
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log("Loaded schedules:", list.length);
      setSchedules(list);
    });
    
    return () => unsub();
  }, [user]);

  // Load Generated Days when a schedule is selected
  useEffect(() => {
    if (!user || !currentScheduleId) {
      setGeneratedDays([]);
      return;
    }
    
    console.log("📅 Loading days for schedule:", currentScheduleId);
    const daysRef = collection(db, "timetable", user.uid, "schedules", currentScheduleId, "days");
    
    const unsub = onSnapshot(query(daysRef), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log("Loaded days:", list.length);
      setGeneratedDays(list.sort((a, b) => a.id.localeCompare(b.id)));
    });
    
    return () => unsub();
  }, [user, currentScheduleId]);

  // Load Schedule
  const loadSchedule = (schedule) => {
    setCurrentSchedule(schedule);
    setCurrentScheduleId(schedule.id);
    setViewMode('view');
  };

  // Create New Schedule
  const createNewSchedule = () => {
    setCurrentSchedule(null);
    setCurrentScheduleId(null);
    setStep(0);
    setViewMode('create');
    setQuestionnaire({
      name: "",
      goal: "",
      subjects: [],
      availableHours: 4,
      preferredTime: "morning",
      breakFrequency: "medium",
      learningStyle: "visual",
      focusLevel: "medium",
      energyPattern: "balanced",
      deadlines: [],
      examDates: [],
      sleepHours: 8,
      exerciseFrequency: "moderate",
      socialCommitments: "moderate",
    });
    setGeneratedDays([]);
    setActiveDay(null);
    setShowSummary(false);
  };

  // Delete Schedule
  const deleteSchedule = async (scheduleId) => {
    if (!user || !scheduleId) return;
    
    if (!window.confirm("Delete this schedule permanently?")) return;
    
    try {
      await deleteDoc(doc(db, "timetable", user.uid, "schedules", scheduleId));
      
      const batch = writeBatch(db);
      const daysRef = collection(db, "timetable", user.uid, "schedules", scheduleId, "days");
      const daysSnap = await getDocs(daysRef);
      daysSnap.forEach((dayDoc) => {
        batch.delete(dayDoc.ref);
      });
      await batch.commit();
      
      if (currentScheduleId === scheduleId) {
        setCurrentSchedule(null);
        setCurrentScheduleId(null);
        setViewMode('list');
      }
    } catch (error) {
      console.error("Error deleting schedule:", error);
    }
  };

  // Generate Schedule with AI
  const generateWithAI = async () => {
    setLoading(true);

    try {
      const validSubjects = questionnaire.subjects.filter(s => s.name?.trim());
      
      if (validSubjects.length === 0) {
        alert("Please add at least one subject");
        setLoading(false);
        return;
      }

      console.log("🚀 Generating with AI...");
      
      const response = await axios.post(`${API_BASE_URL}/generate-timetable`, {
        subjects: validSubjects.map(subject => ({
          name: subject.name,
          difficulty: subject.difficulty || 'medium',
          priority: subject.priority || 3,
          topics: subject.topics || []
        })),
        constraints: {
          dailyStudyHours: questionnaire.availableHours,
          sessionDuration: 50,
          breakMinutes: questionnaire.breakFrequency === "high" ? 15 : questionnaire.breakFrequency === "low" ? 5 : 10,
          preferredTime: questionnaire.preferredTime,
          learningStyle: questionnaire.learningStyle,
          energyPattern: questionnaire.energyPattern,
          daysToGenerate: 7
        },
        preferences: aiConfig,
        userId: user?.uid
      }, {
        timeout: 45000
      });

      if (response.data.success && response.data.schedule?.days) {
        await saveScheduleToFirestore(response.data.schedule.days, validSubjects);
        setShowSummary(true);
        setStep(questions.length - 1);
        setViewMode('view');
      } else {
        throw new Error(response.data.error || "AI failed to generate schedule");
      }
      
    } catch (error) {
      console.error("❌ Generation error:", error);
      alert("⚠️ Error generating timetable. Using enhanced algorithm.");
      
      const fallbackDays = generateEnhancedTimetable(questionnaire.subjects.filter(s => s.name?.trim()));
      await saveScheduleToFirestore(fallbackDays, questionnaire.subjects.filter(s => s.name?.trim()));
      setShowSummary(true);
      setStep(questions.length - 1);
      setViewMode('view');
    } finally {
      setLoading(false);
    }
  };

  // Enhanced Fallback Generator
  const generateEnhancedTimetable = (validSubjects) => {
    const days = [];
    const now = new Date();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const sortedSubjects = [...validSubjects].sort((a, b) => (b.priority || 3) - (a.priority || 3));
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i + 1);
      const dateId = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      
      const dailyMins = questionnaire.availableHours * 60;
      const slots = [];
      let remainingMins = dailyMins;
      let currentTime = 9 * 60;
      
      const breakDuration = questionnaire.breakFrequency === "high" ? 15 : questionnaire.breakFrequency === "low" ? 5 : 10;
      const sessionDuration = 50;
      
      while (remainingMins > 0 && currentTime < 22 * 60 && slots.length < 6) {
        const subject = sortedSubjects[slots.length % sortedSubjects.length];
        const duration = Math.min(sessionDuration, remainingMins);
        
        if (duration < 30) break;
        
        slots.push({
          subject: subject.name,
          difficulty: subject.difficulty,
          start: minutesToTime(currentTime),
          end: minutesToTime(currentTime + duration),
          duration,
          type: 'study'
        });
        
        currentTime += duration + breakDuration;
        remainingMins -= duration;
      }
      
      days.push({
        date: dateId,
        dayOfWeek: daysOfWeek[dayOfWeek],
        slots,
        totalStudyTime: dailyMins - remainingMins,
        focusSubject: sortedSubjects[i % sortedSubjects.length]?.name || "General Study",
        energyLevel: questionnaire.energyPattern === "morning person" && i < 3 ? 'high' : 'medium',
        notes: `${questionnaire.learningStyle} learning style schedule`
      });
    }
    
    return days;
  };

  // Save to Firestore
  const saveScheduleToFirestore = async (days, validSubjects) => {
    try {
      const batch = writeBatch(db);
      const scheduleId = currentScheduleId || doc(collection(db, "timetable", user.uid, "schedules")).id;
      const scheduleRef = doc(db, "timetable", user.uid, "schedules", scheduleId);
      
      batch.set(scheduleRef, {
        name: questionnaire.name || "My Schedule",
        goal: questionnaire.goal,
        subjects: validSubjects,
        questionnaire,
        dailyStudyHours: questionnaire.availableHours,
        updatedAt: serverTimestamp(),
        generatedWithAI: true,
        userId: user.uid
      });

      const daysRef = collection(scheduleRef, "days");
      const oldDays = await getDocs(daysRef);
      oldDays.forEach(d => batch.delete(d.ref));

      days.forEach(day => {
        const dayRef = doc(daysRef, day.date);
        batch.set(dayRef, {
          ...day,
          scheduleId,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();
      setCurrentScheduleId(scheduleId);
      
      // Fetch the newly created schedule
      const newScheduleSnap = await getDoc(scheduleRef);
      if (newScheduleSnap.exists()) {
        setCurrentSchedule({ id: scheduleId, ...newScheduleSnap.data() });
      }
      
    } catch (error) {
      console.error("❌ Save error:", error);
      throw error;
    }
  };

  // Helper Functions
  const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const nextStep = () => {
    if (step < questions.length - 1) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const updateQuestionnaire = (field, value) => {
    setQuestionnaire(prev => ({ ...prev, [field]: value }));
  };

  // Tab state: 'schedule' | 'curriculum'
  const [activeTab, setActiveTab] = useState('schedule');

  return (
    <div className="p-3 sm:p-4 lg:p-8 min-h-screen" style={{ background: theme.background, color: theme.textPrimary }}>
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8" />
            AI Study Planner
          </h1>
          <p className="text-xs sm:text-sm opacity-70 mt-1">Build timetables or generate a full learning roadmap with AI</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-4 sm:mb-6 p-1 rounded-xl border" style={{ background: theme.card, borderColor: theme.border }}>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 py-2 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-2 transition-all ${
              activeTab === 'schedule' ? 'bg-purple-600 text-white shadow' : 'opacity-60 hover:opacity-100'
            }`}
          >
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Schedule Builder</span>
            <span className="xs:hidden">Builder</span>
          </button>
          <button
            onClick={() => setActiveTab('curriculum')}
            className={`flex-1 py-2 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-2 transition-all ${
              activeTab === 'curriculum' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow' : 'opacity-60 hover:opacity-100'
            }`}
          >
            <GraduationCap className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">AI Curriculum</span>
            <span className="xs:hidden">Curriculum</span>
            <span className="text-[10px] sm:text-xs px-1 py-0.5 rounded-full bg-white/20 text-white ml-0.5 sm:ml-1">New</span>
          </button>
        </div>

        {/* AI Curriculum Tab */}
        {activeTab === 'curriculum' && (
          <TopicCurriculumView theme={theme} apiBaseUrl={API_BASE_URL} user={user} />
        )}

        {/* Schedule Builder Tab */}
        {activeTab === 'schedule' && viewMode === 'list' && (
          <ScheduleList
            schedules={schedules}
            onSelect={loadSchedule}
            onDelete={deleteSchedule}
            onCreateNew={createNewSchedule}
            theme={theme}
          />
        )}

        {activeTab === 'schedule' && viewMode === 'create' && (
          <div className="max-w-4xl mx-auto">
            {/* Progress Bar */}
            {step < questions.length - 1 && !showSummary && (
              <div className="mb-6 sm:mb-8">
                <div className="flex justify-between mb-2">
                  <span className="text-xs sm:text-sm opacity-70">Question {step + 1} of {questions.length - 1}</span>
                  <span className="text-xs sm:text-sm font-medium">{Math.round((step / (questions.length - 2)) * 100)}% Complete</span>
                </div>
                <div className="h-1.5 sm:h-2 rounded-full bg-gray-200">
                  <div 
                    className="h-1.5 sm:h-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                    style={{ width: `${(step / (questions.length - 2)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Main Content Card */}
            <div className="rounded-2xl border p-4 sm:p-6 lg:p-8" style={{ background: theme.card, borderColor: theme.border }}>
              {!showSummary && step < questions.length - 1 ? (
                <>
                  {/* Question Header */}
                  <div className="mb-4 sm:mb-6">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                      {questions[step].icon}
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold break-words">{questions[step].title}</h2>
                        <p className="text-xs sm:text-sm opacity-70 break-words">{questions[step].description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Question Component */}
                  {step === 0 && <WelcomeQuestion onNext={nextStep} />}
                  {step === 1 && <BasicInfoQuestion data={questionnaire} updateData={updateQuestionnaire} theme={theme} />}
                  {step === 2 && <SubjectsQuestion data={questionnaire} updateData={updateQuestionnaire} theme={theme} />}
                  {step === 3 && <ScheduleQuestion data={questionnaire} updateData={updateQuestionnaire} theme={theme} />}
                  {step === 4 && <LearningStyleQuestion data={questionnaire} updateData={updateQuestionnaire} theme={theme} />}
                  {step === 5 && <GoalsQuestion data={questionnaire} updateData={updateQuestionnaire} theme={theme} />}
                  {step === 6 && <LifestyleQuestion data={questionnaire} updateData={updateQuestionnaire} theme={theme} />}

                  {/* Navigation Buttons */}
                  {step > 0 && step < questions.length - 1 && (
                    <div className="flex justify-between mt-6 sm:mt-8 pt-4 sm:pt-6 border-t" style={{ borderColor: theme.border }}>
                      <button
                        onClick={prevStep}
                        className="px-4 sm:px-6 py-2 sm:py-3 rounded-lg border flex items-center gap-2 text-sm sm:text-base"
                        style={{ borderColor: theme.border, color: theme.textPrimary }}
                      >
                        <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                        Previous
                      </button>
                      <button
                        onClick={nextStep}
                        className="px-4 sm:px-6 py-2 sm:py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white flex items-center gap-2 text-sm sm:text-base"
                      >
                        Next
                        <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {!showSummary ? (
                    <GenerateQuestion 
                      data={questionnaire} 
                      loading={loading} 
                      onGenerate={generateWithAI} 
                      theme={theme} 
                    />
                  ) : (
                    <ScheduleViewer
                      schedule={currentSchedule || { name: questionnaire.name, subjects: questionnaire.subjects, questionnaire }}
                      generatedDays={generatedDays}
                      onBack={() => setViewMode('list')}
                      onViewDay={setActiveDay}
                      activeDay={activeDay}
                      theme={theme}
                      user={user}
                      scheduleId={currentScheduleId}
                    />
                  )}
                </>
              )}
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => setViewMode('list')}
              className="mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border flex items-center gap-2 mx-auto text-sm sm:text-base"
              style={{ borderColor: theme.border, color: theme.textPrimary }}
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4" />
              Cancel Creation
            </button>
          </div>
        )}

        {activeTab === 'schedule' && viewMode === 'view' && currentSchedule && (
          <ScheduleViewer
            schedule={currentSchedule}
            generatedDays={generatedDays}
            onBack={() => setViewMode('list')}
            onViewDay={setActiveDay}
            activeDay={activeDay}
            theme={theme}
            user={user}
            scheduleId={currentScheduleId}
          />
        )}
      </div>
    </div>
  );
}