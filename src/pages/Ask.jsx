// src/pages/Ask.jsx - COMPLETE FIXED VERSION
import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { useTheme } from "../context/ThemeContext";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp
} from "firebase/firestore";
import AttachmentPreview from "../components/AttachmentPreview";
import TypingDots from "../components/TypingDots";
import { MoreVertical, Plus, MessageSquare, Paperclip, Send, X, Loader2, Mic, Search, DownloadCloud, HelpCircle, Check, Volume2, VolumeX, Copy, Share2, FileText, Link, FileJson, File } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const UPLOADTHING_ENDPOINT = `${API_BASE}/api/upload-thing`;
const MAX_SIZE = 50 * 1024 * 1024;

// ========== UTILITY FUNCTIONS ==========
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

const formatChatTime = (timestamp) => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

// ========== INTERNAL COMPONENTS ==========

const ChatSidebar = ({
  chats,
  selectedChatId,
  onSelectChat,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  theme
}) => {
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Get the correct accent color (handle both light and dark theme properties)
  const accentColor = theme.accent || theme.accentSolid || "#7B5CFF";

  // Create input background color for dark mode
  const inputBackground = theme.mode === 'dark' ? '#2A2A33' : theme.card;

  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      className="flex flex-col h-full w-[280px] max-w-[85vw]"
      style={{
        backgroundColor: theme.sidebar || theme.background,
        borderRight: `1px solid ${theme.border}`
      }}
    >
      {/* Sidebar Header */}
      <div className="p-4 sm:p-5 border-b" style={{
        borderColor: theme.border,
        backgroundColor: theme.sidebar || theme.background
      }}>
        <h2 className="text-base sm:text-lg font-medium" style={{ color: theme.textPrimary }}>
          Chat
        </h2>
      </div>

      {/* Search Bar */}
      <div className="p-3 sm:p-4">
        <div className="relative">
          <Search
            size={14}
            className="sm:w-4 sm:h-4 absolute left-3 top-1/2 transform -translate-y-1/2"
            style={{ color: theme.textSecondary }}
          />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm focus:outline-none"
            style={{
              backgroundColor: inputBackground,
              border: `1px solid ${theme.border}`,
              color: theme.textPrimary,
            }}
          />
        </div>
      </div>

      {/* New Chat Button */}
      <div className="px-3 sm:px-4 pb-3 sm:pb-4">
        <button
          onClick={onNewChat}
          className="flex items-center justify-center gap-2 w-full p-2.5 sm:p-3 rounded-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md text-sm sm:text-base"
          style={{
            background: theme.gradientPrimary,
            color: 'white'
          }}
        >
          <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
          New Chat
        </button>
      </div>

      {/* Chats List */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-3 pb-3 sm:pb-4 pt-1">
        {filteredChats.length === 0 ? (
          <div className="text-center p-6 sm:p-8">
            <MessageSquare size={40} className="sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-30" style={{ color: theme.textSecondary }} />
            <p className="text-xs sm:text-sm font-medium" style={{ color: theme.textPrimary }}>No chats yet</p>
            <p className="text-[10px] sm:text-xs mt-1" style={{ color: theme.textSecondary }}>Start by creating a new chat</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredChats.map((chat) => {
              const lastMessage = chat.messages?.[chat.messages.length - 1];
              const lastActive = lastMessage?.time || chat.createdAt;

              return (
                <div
                  key={chat.id}
                  className={`group relative rounded-xl p-2.5 sm:p-3 transition-all cursor-pointer border ${selectedChatId === chat.id ? 'ring-2 ring-opacity-50' : 'hover:bg-opacity-50'
                    }`}
                  style={{
                    backgroundColor: selectedChatId === chat.id ? `${accentColor}20` : 'transparent',
                    borderColor: selectedChatId === chat.id ? accentColor : `${theme.border}80`
                  }}
                  onClick={() => onSelectChat(chat.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-medium truncate text-xs sm:text-sm"
                        style={{
                          color: selectedChatId === chat.id ? accentColor : theme.textPrimary
                        }}
                      >
                        {chat.title}
                      </p>
                      {lastMessage && (
                        <p className="text-[10px] sm:text-xs truncate mt-0.5 sm:mt-1" style={{ color: theme.textSecondary }}>
                          {lastMessage.content.substring(0, 30)}
                          {lastMessage.content.length > 30 ? '...' : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      <span className="text-[10px] sm:text-xs whitespace-nowrap" style={{ color: theme.textSecondary }}>
                        {formatChatTime(lastActive)}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === chat.id ? null : chat.id);
                        }}
                        className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${menuOpenId === chat.id ? 'opacity-100' : ''
                          }`}
                        style={{
                          backgroundColor: `${accentColor}15`,
                          color: accentColor
                        }}
                      >
                        <MoreVertical size={12} className="sm:w-[14px] sm:h-[14px]" />
                      </button>
                    </div>
                  </div>

                  {menuOpenId === chat.id && (
                    <div
                      className="absolute right-2 top-full mt-1 z-50 w-28 sm:w-32 rounded-md shadow-lg py-1"
                      style={{
                        backgroundColor: theme.card,
                        border: `1px solid ${theme.border}`,
                        boxShadow: theme.mode === 'dark' ? '0 4px 6px -1px rgba(0, 0, 0, 0.5)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRenameChat(chat.id);
                          setMenuOpenId(null);
                        }}
                        className="w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm hover:bg-opacity-20 transition-colors"
                        style={{
                          color: theme.textPrimary,
                          backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = `${accentColor}15`}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteChat(chat.id);
                          setMenuOpenId(null);
                        }}
                        className="w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm hover:bg-opacity-20 transition-colors"
                        style={{
                          color: '#EF4444',
                          backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#EF444415'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const ExportMenu = ({ messages, title, theme }) => {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const accent = theme.accent || theme.accentSolid || "#7B5CFF";

  if (!messages?.length) return null;

  const slugify = (str) => (str || "chat").replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 40);

  const downloadBlob = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const payload = {
      title,
      exportedAt: new Date().toISOString(),
      messages
    };
    downloadBlob(JSON.stringify(payload, null, 2), `${slugify(title)}_chat.json`, "application/json");
    setShow(false);
  };

  const exportText = () => {
    const text = messages.map((m) => `[${m.role}] ${formatTime(m.time)}\n${m.content}`).join("\n\n");
    downloadBlob(text, `${slugify(title)}_chat.txt`, "text/plain");
    setShow(false);
  };

  const exportMarkdown = () => {
    const markdown = [
      `# ${title || "Chat"}`,
      "",
      `Exported on ${new Date().toLocaleString()}`,
      "",
      "---",
      "",
      ...messages.flatMap((m) => {
        const lines = [
          `## ${m.role === "user" ? "User" : "AI"} · ${formatTime(m.time)}`,
          "",
          m.content || ""
        ];

        if (m.attachments?.length) {
          lines.push("", `**Attachments:** ${m.attachments.map((a) => a.name).join(", ")}`);
        }

        lines.push("", "---", "");
        return lines;
      })
    ].join("\n");

    downloadBlob(markdown, `${slugify(title)}_chat.md`, "text/markdown");
    setShow(false);
  };

  const copyChat = async () => {
    const text = messages.map((m) => `[${m.role}] ${formatTime(m.time)} ${m.content}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) { }
    setShow(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setShow((s) => !s)} className="p-1.5 sm:p-2 rounded-lg transition-all" style={{ color: theme.textSecondary }} title="Export chat">
        <DownloadCloud size={16} className="sm:w-[18px] sm:h-[18px]" />
      </button>
      {show && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShow(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 min-w-[160px] sm:min-w-[196px] w-max max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl shadow-xl" style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}` }}>
            <div className="px-2 sm:px-3 py-1.5 sm:py-2 border-b" style={{ borderColor: theme.border }}>
              <p className="text-[10px] sm:text-xs font-semibold" style={{ color: theme.textSecondary }}>Export / Share</p>
            </div>
            {[
              { label: "Export JSON", icon: <FileJson size={12} className="sm:w-[14px] sm:h-[14px]" />, action: exportJson },
              { label: "Export Markdown", icon: <FileText size={12} className="sm:w-[14px] sm:h-[14px]" />, action: exportMarkdown },
              { label: "Export Text", icon: <File size={12} className="sm:w-[14px] sm:h-[14px]" />, action: exportText },
              { label: copied ? "Copied!" : "Copy Full Chat", icon: copied ? <Check size={12} className="sm:w-[14px] sm:h-[14px]" /> : <Link size={12} className="sm:w-[14px] sm:h-[14px]" />, action: copyChat }
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={item.action}
                className="w-full flex items-center gap-2 sm:gap-2.5 px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-left transition-colors"
                style={{ color: theme.textPrimary }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${accent}12`; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <span style={{ color: theme.textSecondary }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const SearchInChat = ({ messages, onResult, theme }) => {
  const [show, setShow] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [current, setCurrent] = useState(0);
  const inputRef = useRef(null);
  const accent = theme.accent || theme.accentSolid || "#7B5CFF";

  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        setShow(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === "Escape") {
        setShow(false);
        setTerm("");
        setResults([]);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!term.trim()) {
      setResults([]);
      return;
    }
    const matches = messages.reduce((acc, msg, idx) => {
      if ((msg.content || "").toLowerCase().includes(term.toLowerCase())) acc.push({ idx, msg });
      return acc;
    }, []);
    setResults(matches);
    setCurrent(0);
    if (matches[0]) onResult(matches[0].idx);
  }, [messages, onResult, term]);

  const navigate = (dir) => {
    if (!results.length) return;
    const nextIndex = (current + dir + results.length) % results.length;
    setCurrent(nextIndex);
    onResult(results[nextIndex].idx);
  };

  return (
    <div className="relative">
      <button onClick={() => setShow((s) => !s)} className="p-1.5 sm:p-2 rounded-lg transition-all" style={{ color: theme.textSecondary }} title="Search (Ctrl+F)">
        <Search size={16} className="sm:w-[18px] sm:h-[18px]" />
      </button>
      {show && (
        <div className="absolute right-0 top-full mt-2 rounded-xl shadow-xl z-50 w-[min(280px,calc(100vw-2rem))] sm:w-[min(320px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]" style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}` }}>
          <div className="flex gap-2 items-center p-2 sm:p-3 border-b" style={{ borderColor: theme.border }}>
            <Search size={13} className="sm:w-[15px] sm:h-[15px]" style={{ color: accent }} />
            <input ref={inputRef} autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search messages..." className="flex-1 bg-transparent outline-none text-xs sm:text-sm" style={{ color: theme.textPrimary }} />
            <button onClick={() => { setShow(false); setTerm(""); setResults([]); }}><X size={12} className="sm:w-[14px] sm:h-[14px]" style={{ color: theme.textSecondary }} /></button>
          </div>
          {term && (
            <div className="p-2">
              {results.length === 0 ? (
                <p className="text-[10px] sm:text-xs text-center py-2 sm:py-3" style={{ color: theme.textSecondary }}>No results found</p>
              ) : (
                <>
                  <div className="max-h-44 sm:max-h-52 overflow-y-auto space-y-1 mb-2">
                    {results.map((r, i) => (
                      <button key={i} onClick={() => { setCurrent(i); onResult(r.idx); }} className="w-full text-left p-1.5 sm:p-2 rounded-lg text-[10px] sm:text-xs" style={{ backgroundColor: i === current ? `${accent}18` : "transparent", border: `1px solid ${i === current ? `${accent}30` : "transparent"}` }}>
                        <div className="flex justify-between mb-0.5">
                          <span className="font-semibold text-[10px] sm:text-xs" style={{ color: i === current ? accent : theme.textPrimary }}>{r.msg.role === "user" ? "You" : "AI"}</span>
                          <span className="opacity-50 text-[8px] sm:text-[10px]" style={{ color: theme.textSecondary }}>{formatTime(r.msg.time)}</span>
                        </div>
                        <div className="truncate opacity-70 text-[9px] sm:text-xs" style={{ color: theme.textPrimary }}>{r.msg.content}</div>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between items-center px-1 pt-2 border-t" style={{ borderColor: theme.border }}>
                    <button onClick={() => navigate(-1)} className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded" style={{ color: theme.textSecondary }}>Prev</button>
                    <span className="text-[10px] sm:text-xs font-medium" style={{ color: accent }}>{current + 1} / {results.length}</span>
                    <button onClick={() => navigate(1)} className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded" style={{ color: theme.textSecondary }}>Next</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ShortcutsHelp = ({ theme }) => {
  const [show, setShow] = useState(false);
  const accent = theme.accent || theme.accentSolid || "#7B5CFF";

  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.key === "/") {
        e.preventDefault();
        setShow((s) => !s);
      }
      if (e.key === "Escape") setShow(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const shortcuts = [
    { keys: ["Ctrl", "Enter"], action: "Send message" },
    { keys: ["Shift", "Enter"], action: "New line" },
    { keys: ["Ctrl", "F"], action: "Search chat" },
    { keys: ["Ctrl", "/"], action: "Shortcuts" },
    { keys: ["Esc"], action: "Close panels" }
  ];

  return (
    <div className="relative">
      <button onClick={() => setShow((s) => !s)} className="p-1.5 sm:p-2 rounded-lg transition-all" style={{ color: theme.textSecondary }} title="Keyboard shortcuts">
        <HelpCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
      </button>
      {show && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShow(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-[min(280px,calc(100vw-2rem))] sm:w-[min(352px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-xl shadow-xl overflow-hidden" style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, minWidth: "200px" }}>
            <div className="px-3 sm:px-4 py-2 sm:py-3 border-b flex items-center justify-between" style={{ borderColor: theme.border }}>
              <span className="text-xs sm:text-sm font-semibold" style={{ color: theme.textPrimary }}>Keyboard Shortcuts</span>
              <button onClick={() => setShow(false)}><X size={12} className="sm:w-[14px] sm:h-[14px]" style={{ color: theme.textSecondary }} /></button>
            </div>
            <div className="p-1">
              {shortcuts.map((s, i) => (
                <div key={i} className="flex justify-between items-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg">
                  <span className="text-[10px] sm:text-xs" style={{ color: theme.textSecondary }}>{s.action}</span>
                  <div className="flex gap-1">
                    {s.keys.map((k) => (
                      <kbd key={k} className="px-1 py-0.5 rounded text-[8px] sm:text-[10px] font-mono" style={{ backgroundColor: theme.background, border: `1px solid ${theme.border}`, color: accent }}>{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const MsgAction = ({ message, onCopy, onShare, onSpeak, speakingText, stopSpeaking, theme, isUser }) => {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const accent = theme.accent || theme.accentSolid || "#7B5CFF";
  const isSpeaking = speakingText === message.content;

  const handleCopy = async () => {
    await onCopy(message.content);
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className="p-1 sm:p-1 rounded-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
        style={{ color: isUser ? "rgba(255,255,255,.7)" : theme.textSecondary, backgroundColor: open ? (isUser ? "rgba(255,255,255,.15)" : `${accent}15`) : "transparent" }}
      >
        <MoreVertical size={12} className="sm:w-[14px] sm:h-[14px]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute z-50 w-max min-w-[148px] max-w-[calc(100vw-2rem)] rounded-xl shadow-2xl overflow-hidden"
            style={{
              top: "100%",
              [isUser ? "right" : "left"]: 0,
              marginTop: "4px",
              backgroundColor: theme.card,
              border: `1px solid ${theme.border}`
            }}
          >
            {[
              { icon: copied ? <Check size={11} className="sm:w-[13px] sm:h-[13px]" /> : <Copy size={11} className="sm:w-[13px] sm:h-[13px]" />, label: copied ? "Copied!" : "Copy", action: handleCopy, green: copied },
              { icon: <Share2 size={11} className="sm:w-[13px] sm:h-[13px]" />, label: "Share", action: () => { onShare(); setOpen(false); } },
              isSpeaking
                ? { icon: <VolumeX size={11} className="sm:w-[13px] sm:h-[13px]" />, label: "Stop reading", action: () => { stopSpeaking(); setOpen(false); }, red: true }
                : { icon: <Volume2 size={11} className="sm:w-[13px] sm:h-[13px]" />, label: "Read aloud", action: () => { onSpeak(message.content); setOpen(false); } }
            ].map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                className="w-full whitespace-nowrap flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-left"
                style={{ color: item.red ? "#EF4444" : item.green ? "#10B981" : theme.textPrimary }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = item.red ? "#EF444412" : `${accent}12`; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <span style={{ color: item.red ? "#EF4444" : item.green ? "#10B981" : theme.textSecondary }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Update your MessageBubble component in Ask.jsx
const MessageBubble = ({ message, theme, onCopy, onShare, onSpeak, speakingText, stopSpeaking }) => {
  const isUser = message.role === "user";
  const accentColor = theme.accent || theme.accentSolid || "#7B5CFF";

  // Function to render text with clickable links
  const renderContentWithLinks = (text) => {
    if (!text) return text;

    // Enhanced URL detection regex
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(youtube\.com\/watch\?v=[^\s]+)|(youtu\.be\/[^\s]+)/g;

    // Split text by URLs
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (!part) return null;

      // Check if this part is a URL
      if (urlRegex.test(part)) {
        // Format YouTube links nicely
        let displayUrl = part;
        let finalUrl = part;

        // Ensure URL has protocol
        if (!part.startsWith('http')) {
          finalUrl = 'https://' + part;
        }

        // Shorten display URL if too long
        if (displayUrl.length > 40) {
          displayUrl = displayUrl.substring(0, 37) + '...';
        }

        // Extract video ID for YouTube
        let videoId = null;
        if (part.includes('youtube.com/watch?v=')) {
          videoId = part.split('v=')[1]?.split('&')[0];
        } else if (part.includes('youtu.be/')) {
          videoId = part.split('youtu.be/')[1]?.split('?')[0];
        }

        return (
          <span key={index}>
            {' '}
            <a
              href={finalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md hover:underline text-[10px] sm:text-xs"
              style={{
                backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : `${accentColor}15`,
                color: isUser ? '#93c5fd' : accentColor,
                textDecoration: 'none'
              }}
              title={part}
            >
              {videoId ? (
                <>
                  <span className="text-red-500 text-[10px] sm:text-xs">▶️</span>
                  <span>YouTube</span>
                </>
              ) : part.includes('google.com/books') ? (
                <>
                  <span className="text-blue-500 text-[10px] sm:text-xs">📚</span>
                  <span>Google Books</span>
                </>
              ) : (
                <>
                  <span>🔗</span>
                  <span className="max-w-[100px] sm:max-w-[200px] truncate">{displayUrl}</span>
                </>
              )}
            </a>
            {' '}
          </span>
        );
      }

      // Render normal text with markdown formatting
      return renderMarkdown(part, isUser, theme);
    });
  };

  // Simple markdown renderer
  const renderMarkdown = (text, isUser, theme) => {
    if (!text) return text;

    let rendered = text;

    // Bold text: **bold**
    rendered = rendered.replace(/\*\*(.*?)\*\*/g, (match, content) => {
      return `<strong style="font-weight: 600; color: ${isUser ? 'white' : theme.textPrimary}">${content}</strong>`;
    });

    // Italic text: *italic*
    rendered = rendered.replace(/\*(.*?)\*/g, (match, content) => {
      return `<em style="font-style: italic">${content}</em>`;
    });

    // Numbered lists
    rendered = rendered.replace(/^\d+\.\s+(.*)$/gm, (match, content) => {
      return `<div style="margin-left: 0.75rem; margin-bottom: 0.25rem">• ${content}</div>`;
    });

    return <span dangerouslySetInnerHTML={{ __html: rendered }} />;
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3 sm:mb-4`}>
      <div
        className={`group relative w-fit max-w-[90%] sm:max-w-[80%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm ${isUser ? "rounded-br-md" : "rounded-bl-md"}`}
        style={{
          background: isUser ? theme.gradientPrimary : theme.card,
          color: isUser ? 'white' : theme.textPrimary,
          border: `1px solid ${isUser ? 'transparent' : theme.border}`,
          wordBreak: 'break-word'
        }}
      >
        <div className={`absolute top-1 sm:top-2 ${isUser ? "left-1 sm:left-2" : "right-1 sm:right-2"}`}>
          <MsgAction
            message={message}
            onCopy={onCopy}
            onShare={onShare}
            onSpeak={onSpeak}
            speakingText={speakingText}
            stopSpeaking={stopSpeaking}
            theme={theme}
            isUser={isUser}
          />
        </div>
        <div className="whitespace-pre-wrap break-words text-xs sm:text-sm">
          {renderContentWithLinks(message.content)}
        </div>

        {message.attachments?.length > 0 && (
          <div className="mt-2 sm:mt-3 flex gap-2 flex-wrap">
            {message.attachments.map((att, idx) => (
              <AttachmentPreview key={idx} att={att} />
            ))}
          </div>
        )}

        {/* Show if resources were searched */}
        {message.resourcesSearched && (
          <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs flex items-center gap-1 opacity-70">
            <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-opacity-20"
              style={{
                backgroundColor: message.resourcesSearched.includes('youtube') ? '#FF000020' : '#4285F420',
                color: message.resourcesSearched.includes('youtube') ? '#FF0000' : '#4285F4'
              }}
            >
              {message.resourcesSearched.includes('youtube') && '🎥'}
              {message.resourcesSearched.includes('books') && '📚'}
              <span className="ml-0.5 sm:ml-1">
                {message.resourcesSearched === 'both' ? 'Searched videos & books' :
                  message.resourcesSearched === 'youtube' ? 'Searched videos' :
                    'Searched books'}
              </span>
            </span>
          </div>
        )}

        <div
          className="text-[10px] sm:text-xs mt-1.5 sm:mt-2 opacity-70 text-right"
          style={{ color: isUser ? 'rgba(255,255,255,0.8)' : theme.textSecondary }}
        >
          {formatTime(message.time)}
        </div>
      </div>
    </div>
  );
};

const FileUploadPreview = ({ files, onRemove, onClearAll, theme }) => {
  if (files.length === 0) return null;
  const accentColor = theme.accent || theme.accentSolid || "#7B5CFF";

  return (
    <div className="mx-2 sm:mx-3 my-2 sm:my-3 p-3 sm:p-5 rounded-2xl border backdrop-blur-md shadow-sm" style={{
      backgroundColor: `${theme.card}80`,
      borderColor: theme.border
    }}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Paperclip size={14} className="sm:w-[16px] sm:h-[16px]" style={{ color: theme.textSecondary }} />
          <span className="text-xs sm:text-sm font-medium" style={{ color: theme.textPrimary }}>
            {files.length} file{files.length > 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onClearAll}
          className="text-[11px] sm:text-sm flex items-center gap-1 hover:opacity-80"
          style={{ color: '#EF4444' }}
        >
          <X size={12} className="sm:w-[14px] sm:h-[14px]" />
          Clear all
        </button>
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4 mt-2 sm:mt-3">
        {files.map((fileWrapper, idx) => (
          <div
            key={idx}
            className="relative group rounded-xl border p-2 sm:p-3 flex flex-col justify-between transition-all hover:-translate-y-1 shadow-sm hover:shadow-md overflow-hidden bg-white/5"
            style={{
              borderColor: theme.border
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            {fileWrapper.uploading ? (
              <div className="flex flex-col h-full items-center justify-center gap-2 sm:gap-3 py-3 sm:py-4 relative z-10">
                <Loader2 className="animate-spin sm:w-[28px] sm:h-[28px]" size={22} style={{ color: accentColor }} />
                <div className="w-full text-center">
                  <p className="text-[10px] sm:text-xs truncate font-medium mb-1 sm:mb-2" style={{ color: theme.textPrimary }}>
                    {fileWrapper.file.name}
                  </p>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${fileWrapper.progress}%`,
                        background: theme.gradientPrimary
                      }}
                    />
                  </div>
                  {fileWrapper.error && (
                    <p className="text-[8px] sm:text-[10px] text-red-500 mt-1 font-bold">{fileWrapper.error}</p>
                  )}
                </div>
              </div>
            ) : fileWrapper.preview ? (
              <div className="relative z-10">
                <div className="w-full h-20 sm:h-24 mb-2 sm:mb-3 rounded-lg overflow-hidden border" style={{ borderColor: theme.border }}>
                  <img
                    src={fileWrapper.preview}
                    alt={fileWrapper.file.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <p className="text-[10px] sm:text-xs truncate font-semibold" style={{ color: theme.textPrimary }}>
                  {fileWrapper.file.name}
                </p>
                <p className="text-[8px] sm:text-[10px] mt-0.5 opacity-60" style={{ color: theme.textSecondary }}>{(fileWrapper.file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-3 sm:py-4 relative z-10">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 sm:mb-3" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                  <Paperclip size={20} className="sm:w-[24px] sm:h-[24px]" />
                </div>
                <p className="text-[10px] sm:text-xs truncate font-semibold w-full text-center" style={{ color: theme.textPrimary }}>
                  {fileWrapper.file.name}
                </p>
                <p className="text-[8px] sm:text-[10px] mt-0.5 opacity-60" style={{ color: theme.textSecondary }}>{(fileWrapper.file.size / 1024).toFixed(1)} KB</p>
              </div>
            )}

            <button
              onClick={() => onRemove(idx)}
              className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg text-white hover:scale-110 z-20"
              style={{ backgroundColor: '#EF4444' }}
            >
              <X size={10} className="sm:w-[14px] sm:h-[14px]" strokeWidth={3} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ========== CUSTOM HOOKS ==========

const useSmartTitles = () => {
  const generateChatTitle = useCallback(async (messages) => {
    if (!messages || messages.length === 0) return "New Chat";

    const userMessage = messages.find(m => m.role === 'user')?.content || "";
    if (userMessage.length < 3) return "New Chat";

    try {
      const response = await fetch(`${API_BASE}/api/chat/title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: userMessage.slice(0, 500)
        })
      });

      const data = await response.json();
      return data.title || userMessage.split(' ').slice(0, 3).join(' ') || "Chat";
    } catch (error) {
      console.error('Title generation failed:', error);
      return userMessage.split(' ').slice(0, 3).join(' ') || "New Chat";
    }
  }, []);

  return { generateChatTitle };
};

// ========== MAIN COMPONENT ==========

export default function Ask() {
  const { theme: themeColors, mode } = useTheme();
  const auth = getAuth();

  const [input, setInput] = useState("");
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("idle");
  const [scrollToResult, setScrollToResult] = useState(null);
  const [speakingText, setSpeakingText] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const abortControllerRef = useRef(null);
  const msgRefs = useRef({});
  const { generateChatTitle } = useSmartTitles();

  // Helper function to get user ID
  const getUserId = useCallback(() => {
    if (auth.currentUser?.uid) {
      return auth.currentUser.uid;
    }

    // Generate a unique ID for non-logged in users
    const storedId = localStorage.getItem('focusforge_guest_id');
    if (storedId) return storedId;

    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('focusforge_guest_id', guestId);
    return guestId;
  }, [auth.currentUser]);

  // Check if browser supports speech recognition
  useEffect(() => {
    const isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setIsSpeechSupported(isSupported);
    if (!isSupported) {
      console.warn("Speech recognition not supported in this browser");
    }
  }, []);

  // ========== AUTO-SCROLL TO BOTTOM ==========
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end'
    });
  }, [chats, loading, selectedFiles]);

  useEffect(() => {
    if (selectedChatId) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'end'
        });
      }, 100);
    }
  }, [selectedChatId]);

  useEffect(() => {
    if (scrollToResult !== null && msgRefs.current[scrollToResult]) {
      msgRefs.current[scrollToResult].scrollIntoView({ behavior: "smooth", block: "center" });
      setScrollToResult(null);
    }
  }, [scrollToResult]);

  // Load saved chats
  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "chats", userId));
        if (snap.exists()) {
          const data = snap.data().chats || [];
          setChats(data);
          if (!selectedChatId && data.length) setSelectedChatId(data[0].id);
        }
      } catch (err) {
        console.error("Load chats:", err);
      }
    })();
  }, [getUserId, selectedChatId]);

  // ========== BROWSER-BASED VOICE RECOGNITION ==========
  const startRecording = () => {
    if (!isSpeechSupported) {
      alert("Your browser doesn't support speech recognition. Please use Chrome, Edge, or Safari.");
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
        console.log("🎤 Speech recognition started...");
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("🎤 Speech recognized:", transcript);

        setInput(prev => {
          const trimmedTranscript = transcript.trim();
          if (prev.trim() === '') {
            return trimmedTranscript;
          } else {
            return `${prev} ${trimmedTranscript}`;
          }
        });

        // Auto-focus the textarea
        setTimeout(() => {
          document.querySelector('textarea')?.focus();
        }, 100);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);

        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone permissions in your browser settings.');
        } else if (event.error === 'audio-capture') {
          alert('No microphone found. Please connect a microphone.');
        } else if (event.error === 'network') {
          alert('Network error occurred. Please check your internet connection.');
        } else {
          alert(`Speech recognition error: ${event.error}. Please try again.`);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        console.log("🎤 Speech recognition ended");
      };

      // Store reference and start
      speechRecognitionRef.current = recognition;
      recognition.start();

    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      alert(`Failed to start voice recording: ${error.message}`);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    setIsRecording(false);
  };

  // File handling
  const addFiles = useCallback((fileList) => {
    const arr = Array.from(fileList || []).filter((f) => f.size <= MAX_SIZE);
    const mapped = arr.map((f) => ({
      file: f,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      uploading: false,
      progress: 0,
      uploadedMeta: null,
      error: null
    }));
    setSelectedFiles((s) => [...s, ...mapped]);
  }, []);

  const handleFileInput = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => e.preventDefault();

  const removeQueuedFile = useCallback((idx) => {
    const f = selectedFiles[idx];
    if (f?.preview) URL.revokeObjectURL(f.preview);
    setSelectedFiles((s) => s.filter((_, i) => i !== idx));
  }, [selectedFiles]);

  const clearAllFiles = useCallback(() => {
    selectedFiles.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    setSelectedFiles([]);
  }, [selectedFiles]);

  // Upload files to UploadThing
  const uploadAllQueued = useCallback(async () => {
    if (!selectedFiles.length) return [];

    console.log(`📤 Uploading ${selectedFiles.length} file(s) to UploadThing for storage...`);

    const uploadPromises = selectedFiles.map((wrapper, idx) =>
      (async () => {
        setSelectedFiles((s) => s.map((x, i) => (i === idx ? { ...x, uploading: true } : x)));

        try {
          const fd = new FormData();
          fd.append("file", wrapper.file);

          console.log(`📤 Uploading to UploadThing: ${wrapper.file.name} (${Math.round(wrapper.file.size / 1024)}KB)`);

          // Upload to UploadThing for storage
          const result = await axios.post(UPLOADTHING_ENDPOINT, fd, {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (ev) => {
              if (ev.total) {
                const progress = Math.round((ev.loaded * 100) / ev.total);
                setSelectedFiles((s) =>
                  s.map((x, i) => (i === idx ? { ...x, progress } : x))
                );
              }
            },
          });

          console.log(`✅ UploadThing response for ${wrapper.file.name}:`, {
            success: result.data.success,
            url: result.data.url,
            name: result.data.name
          });

          if (!result.data.success) {
            throw new Error(`Upload failed: ${result.data.error || 'Unknown error'}`);
          }

          // IMPORTANT: Ensure we have a valid URL
          if (!result.data.url) {
            console.error("❌ No URL in UploadThing response:", result.data);
            throw new Error("No URL returned from UploadThing");
          }

          // Create normalized file object
          const normalized = {
            url: result.data.url, // UploadThing URL for storage
            name: wrapper.file.name,
            type: wrapper.file.type,
            size: wrapper.file.size,
            meta: result.data,
            // Add these fields for Gemini analysis
            uploadThingUrl: result.data.url,
            fileName: wrapper.file.name,
            fileType: wrapper.file.type
          };

          setSelectedFiles((s) =>
            s.map((x, i) =>
              i === idx ? {
                ...x,
                uploading: false,
                uploadedMeta: normalized,
                progress: 100
              } : x
            )
          );

          // Save to Firebase for database purposes
          try {
            await addDoc(collection(db, "files"), {
              ...normalized,
              uploadedBy: getUserId(),
              uploadedAt: serverTimestamp(),
              storage: "uploadthing",
              status: "uploaded"
            });
          } catch (firebaseErr) {
            console.log("⚠️ Firebase save failed (non-critical):", firebaseErr.message);
          }

          return normalized;

        } catch (err) {
          console.error(`❌ Upload failed for ${wrapper.file.name}:`, err);
          console.error("Error details:", err.response?.data || err.message);

          setSelectedFiles((s) =>
            s.map((x, i) =>
              i === idx ? { ...x, uploading: false, progress: 0, error: err.message } : x
            )
          );

          // Return null to indicate failure
          return null;
        }
      })()
    );

    const results = await Promise.all(uploadPromises);
    const successfulUploads = results.filter(Boolean);

    console.log(`✅ ${successfulUploads.length}/${selectedFiles.length} files successfully uploaded to UploadThing`);

    if (successfulUploads.length === 0 && selectedFiles.length > 0) {
      throw new Error("All file uploads failed. Check UploadThing configuration.");
    }

    return successfulUploads;
  }, [selectedFiles, getUserId]);

  // Persist chats
  const persistChats = useCallback(async (updated) => {
    const userId = getUserId();
    if (!userId) return;
    try {
      await setDoc(doc(db, "chats", userId), { chats: updated }, { merge: true });
    } catch (err) {
      console.error("persist err", err);
    }
  }, [getUserId]);

  // New Chat
  const newChat = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return alert("Please sign in to create chats");
    const c = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      createdAt: Date.now()
    };
    const updated = [c, ...chats];
    setChats(updated);
    setSelectedChatId(c.id);
    await persistChats(updated);
  }, [chats, persistChats, getUserId]);

  // Rename & Delete Chat
  const renameChat = useCallback(async (chatId) => {
    const newTitle = prompt("Enter new chat title:");
    if (!newTitle?.trim()) return;
    const updated = chats.map(c =>
      c.id === chatId ? { ...c, title: newTitle } : c
    );
    setChats(updated);
    await persistChats(updated);
  }, [chats, persistChats]);

  const deleteChat = useCallback(async (chatId) => {
    if (!confirm("Delete this chat permanently?")) return;
    const userId = getUserId();
    const updated = chats.filter((c) => c.id !== chatId);
    setChats(updated);
    if (selectedChatId === chatId && updated.length) {
      setSelectedChatId(updated[0].id);
    } else if (updated.length === 0) {
      setSelectedChatId(null);
    }
    await setDoc(doc(db, "chats", userId), { chats: updated }, { merge: true });
  }, [chats, selectedChatId, getUserId]);

  // Group messages by date
  const groupMessagesByDate = (messages) => {
    const groups = {};
    messages?.forEach((message) => {
      const dateKey = formatDate(message.time);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });
    return groups;
  };

  // ========== FIXED STREAMING HANDLER ==========
  const handleStreamResponse = async (reader, chat, updatedChats, userId) => {
    const decoder = new TextDecoder();
    let buffer = '';
    let isStreamComplete = false;

    // Create assistant message
    const assistantMsg = {
      role: "assistant",
      content: "",
      time: Date.now(),
      attachments: []
    };
    chat.messages.push(assistantMsg);

    // Create a new array to trigger re-render
    const newChats = [...updatedChats];
    setChats(newChats);

    console.log("📨 Starting to process stream...");
    setConnectionStatus("streaming");

    try {
      while (!isStreamComplete) {
        const { done, value } = await reader.read();

        if (done) {
          console.log("✅ Stream reading completed");
          isStreamComplete = true;
          break;
        }

        // Decode chunk
        buffer += decoder.decode(value, { stream: true });

        // Split by SSE delimiter (double newline)
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const dataStr = line.substring(6).trim();
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            // Handle completion signal
            if (data.done === true) {
              console.log("🎯 Received DONE signal");
              isStreamComplete = true;
              break;
            }

            // Handle error
            if (data.error) {
              console.error("❌ Stream error:", data);
              assistantMsg.content += `\n\n⚠️ Error: ${data.message || 'Unknown error'}`;
              break;
            }

            // Handle text chunk
            if (data.text && typeof data.text === 'string') {
              assistantMsg.content += data.text;

              // Update the chat in state
              const updatedChat = newChats.find(c => c.id === selectedChatId);
              if (updatedChat) {
                const lastIndex = updatedChat.messages.length - 1;
                if (updatedChat.messages[lastIndex]?.role === 'assistant') {
                  updatedChat.messages[lastIndex].content = assistantMsg.content;
                }
              }

              // Force re-render
              setChats([...newChats]);

              // Auto-scroll
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }

            // Handle start signal (optional)
            if (data.type === 'start') {
              console.log(`📊 Stream started, expected length: ${data.length} chars`);
            }

          } catch (parseError) {
            console.log('📨 Raw SSE data:', dataStr);
            // If it's just "[DONE]" string (old format)
            if (dataStr === '[DONE]') {
              console.log("🎯 Received [DONE] string");
              isStreamComplete = true;
              break;
            }
          }
        }

        // Break if we found completion
        if (isStreamComplete) break;
      }

      console.log("✅ Stream processing complete");
      setConnectionStatus("complete");

      // Final persistence
      await persistChats(newChats);

    } catch (streamError) {
      console.error("❌ Stream processing error:", streamError);
      assistantMsg.content += `\n\n⚠️ Stream error: ${streamError.message}`;
      setConnectionStatus("error");

      // Update with error
      const errorChats = [...newChats];
      const errorChat = errorChats.find(c => c.id === selectedChatId);
      if (errorChat) {
        const lastIndex = errorChat.messages.length - 1;
        if (errorChat.messages[lastIndex]?.role === 'assistant') {
          errorChat.messages[lastIndex].content = assistantMsg.content;
        }
      }
      setChats(errorChats);
      await persistChats(errorChats);
    }
  };

  // ========== SEND MESSAGE (UPDATED FOR DIRECT GEMINI UPLOAD) ==========
  const send = async () => {
    console.group("🚀 SEND MESSAGE - Direct Gemini Upload");
    console.log("📝 Input:", input);
    console.log("📎 Files:", selectedFiles.length);

    if (!input.trim() && selectedFiles.length === 0) {
      console.log("❌ No input or files");
      return;
    }

    // Daily Limit Check
    const limitsKey = `focusforge_limits_${getUserId()}`;
    const today = new Date().toISOString().split('T')[0];
    let limits = {};
    try {
      limits = JSON.parse(localStorage.getItem(limitsKey) || '{}');
    } catch(e) {}
    
    if (limits.date !== today) {
      limits = { date: today, messages: 0, uploads: 0 };
    }
    
    // Max 20 messages, Max 5 uploads per day
    if (selectedFiles.length > 0 && limits.uploads + selectedFiles.length > 5) {
      alert(`Daily limit reached: You can only upload 5 files per day. You have ${5 - limits.uploads} left.`);
      console.groupEnd();
      return;
    } else if (limits.messages >= 20) {
      alert("Daily limit reached: You can only send 20 messages per day.");
      console.groupEnd();
      return;
    }

    // Increment limits locally
    limits.messages += 1;
    limits.uploads += selectedFiles.length;
    localStorage.setItem(limitsKey, JSON.stringify(limits));
    // End Daily Limit Check

    if (!selectedChatId) await newChat();

    const updatedChats = [...chats];
    const chat = updatedChats.find((c) => c.id === selectedChatId);
    chat.messages = chat.messages || [];
    setLoading(true);
    setConnectionStatus("connecting");

    let uploadedFiles = [];
    let userMessage = null;

    try {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Upload files to UploadThing for storage
      if (selectedFiles.length > 0) {
        console.log(`📤 Step 1: Uploading ${selectedFiles.length} file(s) to UploadThing for storage...`);

        // Show uploading message
        const uploadingMsg = {
          role: "user",
          content: `📎 Uploading ${selectedFiles.length} file(s) to storage...`,
          time: Date.now(),
          attachments: [],
          isUploading: true
        };
        chat.messages.push(uploadingMsg);
        setChats([...updatedChats]);

        try {
          // Upload files to UploadThing
          uploadedFiles = await uploadAllQueued();

          if (uploadedFiles.length === 0 && selectedFiles.length > 0) {
            throw new Error("File upload failed. Please check your UploadThing configuration.");
          }

          console.log(`✅ ${uploadedFiles.length} files uploaded to UploadThing`);

        } catch (uploadErr) {
          console.error("❌ File upload failed:", uploadErr);

          // Remove uploading message
          chat.messages.pop();

          // Show error to user
          chat.messages.push({
            role: "assistant",
            content: `⚠️ File upload failed: ${uploadErr.message}. Please try again or check your UploadThing configuration.`,
            time: Date.now()
          });

          setChats([...updatedChats]);
          setLoading(false);
          await persistChats(updatedChats);
          return;
        }

        // Remove uploading message
        chat.messages.pop();
      }

      // Create user message with UploadThing URLs
      userMessage = {
        role: "user",
        content: input.trim() || (uploadedFiles.length > 0 ? `[Sent ${uploadedFiles.length} file(s)]` : ""),
        time: Date.now(),
        attachments: uploadedFiles.map((f) => ({
          url: f.url,  // UploadThing URL - will be downloaded and sent to Gemini
          name: f.name,
          type: f.type,
          size: f.size
        })),
      };

      console.log("📨 User message attachments:", userMessage.attachments);

      // Auto-title for new chats
      if (chat.messages.length === 0 && userMessage.content) {
        const title = await generateChatTitle([userMessage]);
        chat.title = title;
      }

      // Add user message to chat
      chat.messages.push(userMessage);
      setChats([...updatedChats]);
      setInput("");

      // Persist to Firebase
      await persistChats(updatedChats);

      // Prepare payload for Gemini - files will be downloaded and sent directly
      const aiPayload = {
        message: userMessage.content,
        attachments: userMessage.attachments || [],
        userId: getUserId()
      };

      console.log("📤 Step 2: Sending to Gemini API for analysis...");
      console.log("Payload:", {
        messageLength: userMessage.content?.length || 0,
        attachments: userMessage.attachments?.length || 0,
        attachmentTypes: userMessage.attachments?.map(a => a.type) || []
      });

      // Call Gemini API endpoint
      const res = await fetch(`${API_BASE}/api/gemini-chat/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },
        body: JSON.stringify(aiPayload),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ API Error Response:", errorText);
        throw new Error(`API Error: ${res.status} - ${errorText}`);
      }

      if (!res.body) {
        throw new Error("No response body from server");
      }

      console.log("✅ Connected to Gemini stream, processing response...");
      setConnectionStatus("connected");

      // Process the stream response
      const reader = res.body.getReader();
      await handleStreamResponse(reader, chat, updatedChats, getUserId());

      console.log("✅ Message flow complete - Direct Gemini upload successful!");

    } catch (err) {
      console.error("❌ Send error:", err);

      if (err.name !== 'AbortError') {
        chat.messages.push({
          role: "assistant",
          content: `⚠️ Error: ${err.message}. Please try again.`,
          time: Date.now()
        });
        setChats([...updatedChats]);
        await persistChats(updatedChats);
      }

      setConnectionStatus("error");
    } finally {
      setLoading(false);
      clearAllFiles();
      abortControllerRef.current = null;
      console.groupEnd();
    }
  };

  // Cancel ongoing request
  const cancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setConnectionStatus("cancelled");
      console.log("Request cancelled by user");
    }
  };

  const onEnter = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) { }
  };

  const shareMessage = async (msg) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "FocusForge AI", text: msg.content });
      } else {
        await copyToClipboard(msg.content);
      }
    } catch (e) { }
  };

  const stopSpeaking = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeakingText(null);
  };

  const speakMessage = (text) => {
    if (!window.speechSynthesis) return;
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeakingText(null);
    window.speechSynthesis.speak(utterance);
    setSpeakingText(text);
  };

  const selectedChat = chats.find((c) => c.id === selectedChatId) || null;
  const groupedMessages = groupMessagesByDate(selectedChat?.messages || []);

  return (
    <div className="flex h-screen overflow-hidden relative" style={{ background: themeColors.background }}>
      {/* Mobile overlay for sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:relative z-40 h-full flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
        style={{ width: "280px", maxWidth: "85vw", flexShrink: 0 }}
      >
        <ChatSidebar
          chats={chats}
          selectedChatId={selectedChatId}
          onSelectChat={(id) => { setSelectedChatId(id); setSidebarOpen(false); }}
          onNewChat={newChat}
          onRenameChat={renameChat}
          onDeleteChat={deleteChat}
          theme={{ ...themeColors, mode }}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Chat Header */}
        {selectedChat ? (
          <div className="border-b px-3 sm:px-5 py-3 sm:py-5 relative overflow-visible" style={{
            borderColor: themeColors.border,
            backgroundColor: themeColors.card
          }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h2 className="font-medium text-sm sm:text-lg truncate" style={{ color: themeColors.textPrimary }}>
                    {selectedChat.title}
                  </h2>
                </div>
                <p className="text-[10px] sm:text-xs mt-0.5 truncate" style={{ color: themeColors.textSecondary }}>
                  {selectedChat.messages?.length || 0} messages • Created {formatDate(selectedChat.createdAt)}
                  {connectionStatus !== "idle" && (
                    <span className="ml-2 px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-xs" style={{
                      backgroundColor: connectionStatus === "streaming" ? `${themeColors.accent || themeColors.accentSolid}20` :
                        connectionStatus === "error" ? '#FEE2E2' : '#D1FAE5',
                      color: connectionStatus === "streaming" ? (themeColors.accent || themeColors.accentSolid) :
                        connectionStatus === "error" ? '#DC2626' : '#059669'
                    }}>
                      {connectionStatus}
                    </span>
                  )}
                </p>
              </div>
              <div className="relative z-20 flex items-center justify-end gap-1 flex-wrap flex-shrink-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-1.5 sm:p-2 rounded-lg flex-shrink-0"
                  style={{ color: themeColors.textSecondary }}
                  aria-label="Open chat sidebar"
                >
                  <svg width="18" height="18" className="sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12h18M3 6h18M3 18h18" />
                  </svg>
                </button>
                <SearchInChat messages={selectedChat.messages || []} onResult={setScrollToResult} theme={{ ...themeColors, mode }} />
                <ExportMenu messages={selectedChat.messages || []} title={selectedChat.title} theme={{ ...themeColors, mode }} />
                <ShortcutsHelp theme={{ ...themeColors, mode }} />
                {loading && (
                  <button
                    onClick={cancelRequest}
                    className="text-[10px] sm:text-sm px-1.5 sm:px-3 py-1 rounded-lg hover:opacity-80"
                    style={{
                      backgroundColor: '#FEE2E2',
                      color: '#DC2626'
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="border-b px-3 sm:px-5 py-3 sm:py-5" style={{
            borderColor: themeColors.border,
            backgroundColor: themeColors.card
          }}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-medium text-sm sm:text-lg" style={{ color: themeColors.textPrimary }}>
                New Chat
              </h2>
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-1.5 sm:p-2 rounded-lg flex-shrink-0"
                style={{ color: themeColors.textSecondary }}
                aria-label="Open chat sidebar"
              >
                <svg width="18" height="18" className="sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6"
          style={{ backgroundColor: themeColors.background }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {!selectedChat?.messages?.length ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 sm:p-8">
              <div className="text-4xl sm:text-5xl mb-4 sm:mb-6 opacity-20">💬</div>
              <h3 className="text-base sm:text-lg font-medium mb-1 sm:mb-2" style={{ color: themeColors.textPrimary }}>
                Start a conversation
              </h3>
              <p className="text-xs sm:text-sm max-w-md" style={{ color: themeColors.textSecondary }}>
                Ask questions, share files, or use voice input to get started with AI assistance
              </p>
              {!isSpeechSupported && (
                <div className="mt-3 sm:mt-4 p-2 sm:p-3 rounded-lg border" style={{
                  backgroundColor: `${themeColors.accent || themeColors.accentSolid}10`,
                  borderColor: themeColors.accent || themeColors.accentSolid,
                  color: themeColors.textSecondary
                }}>
                  <p className="text-[10px] sm:text-xs">
                    ⚠️ Voice input not supported in this browser. Try Chrome or Edge.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full px-1 sm:px-2">
              {Object.entries(groupedMessages).map(([date, messages]) => (
                <div key={date}>
                  <div className="flex items-center justify-center my-4 sm:my-6">
                    <div
                      className="px-3 sm:px-4 py-1 rounded-full text-[10px] sm:text-xs font-medium"
                      style={{
                        backgroundColor: `${themeColors.accent || themeColors.accentSolid}15`,
                        color: themeColors.accent || themeColors.accentSolid,
                        border: `1px solid ${themeColors.accent || themeColors.accentSolid}30`
                      }}
                    >
                      {date}
                    </div>
                  </div>

                  <div className="space-y-1">
                    {messages.map((msg, idx) => (
                      <div key={idx} ref={(el) => { msgRefs.current[msg.index ?? idx] = el; }}>
                        <MessageBubble
                          message={msg}
                          theme={themeColors}
                          onCopy={copyToClipboard}
                          onShare={() => shareMessage(msg)}
                          onSpeak={speakMessage}
                          speakingText={speakingText}
                          stopSpeaking={stopSpeaking}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {loading && <TypingDots />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* File Upload Preview */}
        <FileUploadPreview
          files={selectedFiles}
          onRemove={removeQueuedFile}
          onClearAll={clearAllFiles}
          theme={themeColors}
        />

        {/* Message Input */}
        <div className="p-2 sm:p-4 border-t" style={{
          borderColor: themeColors.border,
          backgroundColor: themeColors.card
        }}>
          <div className="max-w-3xl mx-auto w-full">
            <div className="flex items-end gap-1.5 sm:gap-2">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInput}
                accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.tif,.pdf,.txt,.md,.csv,.json,.xml,.html,.css,.js,.py,.java,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              />

              {/* Attachment Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 sm:p-3 rounded-lg border flex-shrink-0 transition-all hover:bg-opacity-20"
                style={{
                  backgroundColor: themeColors.card,
                  borderColor: themeColors.border,
                  color: themeColors.textSecondary
                }}
                title="Attach files (images, PDFs, documents)"
                disabled={isRecording}
              >
                <Paperclip size={18} className="sm:w-5 sm:h-5" />
              </button>

              {/* Text Input */}
              <div className="flex-1 relative min-w-0">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onEnter}
                  placeholder={isRecording ? "🎤 Listening... Click stop button to finish" : "Type your message or attach files for analysis..."}
                  className="w-full p-2.5 sm:p-4 pr-10 sm:pr-12 rounded-lg border focus:outline-none resize-none transition-all text-xs sm:text-base"
                  style={{
                    backgroundColor: mode === 'dark' ? '#2A2A33' : themeColors.card,
                    borderColor: themeColors.border,
                    color: themeColors.textPrimary,
                    minHeight: '52px',
                    maxHeight: '120px'
                  }}
                  rows={2}
                  disabled={isRecording}
                />

                {/* Voice/Recording Button */}
                <div className="absolute right-1.5 sm:right-2 bottom-1.5 sm:bottom-2">
                  {isRecording ? (
                    <button
                      onClick={stopRecording}
                      className="p-1.5 sm:p-2 rounded-full animate-pulse flex items-center justify-center"
                      style={{
                        backgroundColor: '#EF4444',
                        color: 'white',
                        width: '28px',
                        height: '28px'
                      }}
                      title="Stop recording"
                    >
                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full" />
                    </button>
                  ) : (
                    <button
                      onClick={startRecording}
                      disabled={!isSpeechSupported}
                      className="p-1.5 sm:p-2 rounded-full transition-all hover:bg-opacity-30 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: `${themeColors.accent || themeColors.accentSolid}15`,
                        color: isSpeechSupported ? (themeColors.accent || themeColors.accentSolid) : themeColors.textSecondary,
                        width: '28px',
                        height: '28px'
                      }}
                      title={isSpeechSupported ? "Start voice input" : "Voice input not supported"}
                    >
                      <Mic size={14} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                  )}
                </div>
              </div>

              {/* Send Button */}
              <button
                onClick={send}
                disabled={loading || selectedFiles.some(f => f.uploading) || (!input.trim() && selectedFiles.length === 0) || isRecording}
                className="p-2 sm:p-3 rounded-lg flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
                style={{
                  background: themeColors.gradientPrimary,
                  color: 'white'
                }}
                title={selectedFiles.some(f => f.uploading) ? "Uploading files..." : "Send message"}
              >
                {loading ? (
                  <Loader2 size={18} className="sm:w-5 sm:h-5 animate-spin" />
                ) : (
                  <Send size={18} className="sm:w-5 sm:h-5" />
                )}
              </button>
            </div>

            {/* Input Hints */}
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center mt-1.5 sm:mt-2">
              <span className="text-[8px] sm:text-[10px] opacity-50" style={{ color: themeColors.textSecondary }}>
                Press Enter to send • Shift+Enter for new line
              </span>
              {isRecording && (
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[8px] sm:text-xs" style={{ color: themeColors.textSecondary }}>
                    Recording... Speak now
                  </span>
                </div>
              )}
              {!isSpeechSupported && !isRecording && (
                <span className="text-[8px] sm:text-xs opacity-70" style={{ color: themeColors.textSecondary }}>
                  ⚠️ Voice input requires Chrome/Edge
                </span>
              )}
            </div>

            {/* File upload status */}
            {selectedFiles.some(f => f.uploading) && (
              <div className="mt-1.5 sm:mt-2 text-[8px] sm:text-xs" style={{ color: themeColors.textSecondary }}>
                ⏳ Uploading {selectedFiles.filter(f => f.uploading).length} file(s) to UploadThing...
              </div>
            )}

            {/* File type hint */}
            {selectedFiles.length > 0 && (
              <div className="mt-1.5 sm:mt-2 text-[8px] sm:text-xs" style={{ color: themeColors.accent || themeColors.accentSolid }}>
                📎 Files will be analyzed directly by Gemini AI
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
