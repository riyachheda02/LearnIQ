import React, { useEffect, useState, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";

const STORAGE_KEY = "foldersData_v3";

export default function Folders() {
  const { theme } = useTheme();
  const accent = theme.accent || theme.accentSolid;
  const text = theme.textPrimary;
  const isDark = theme.background === "#0E0E14";

  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showPopup, setShowPopup] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createType, setCreateType] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [folderColor, setFolderColor] = useState("");

  const [items, setItems] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [viewingFile, setViewingFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredFolder, setHoveredFolder] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [showOptionsFor, setShowOptionsFor] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [undoData, setUndoData] = useState(null);
  const [deleteUndoActive, setDeleteUndoActive] = useState(false);

  const foldersRef = collection(db, "folders");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef(null);
  const synthRef = useRef(null);

  const getToday = () => {
    const d = new Date();
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  const buildTreeFromFlat = (flatDocs) => {
    const map = {};
    flatDocs.forEach((d) => {
      map[d.id] = { ...d, children: d.type === "folder" ? [] : [] };
    });
    const roots = [];
    flatDocs.forEach((d) => {
      const parentId = d.parentId ?? null;
      if (parentId && map[parentId]) {
        map[parentId].children.push(map[d.id]);
      } else {
        roots.push(map[d.id]);
      }
    });
    Object.values(map).forEach((n) => {
      if (n.type === "folder" && !Array.isArray(n.children)) n.children = [];
    });
    return roots;
  };

  const findNodeById = (nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.type === "folder" && node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const getChildrenAtPath = (nodes, path) => {
    if (!path.length) return nodes;
    let curr = nodes;
    for (const id of path) {
      const folder = curr.find((n) => n.id === id && n.type === "folder");
      if (!folder) return [];
      curr = folder.children;
    }
    return curr;
  };

  const addNodeAtPath = (nodes, path, nodeToAdd) => {
    if (!path.length) return [...nodes, nodeToAdd];
    const recurse = (list, idx) =>
      list.map((n) => {
        if (n.id !== path[idx]) return n;
        return idx === path.length - 1
          ? { ...n, children: [...(n.children || []), nodeToAdd] }
          : { ...n, children: recurse(n.children || [], idx + 1) };
      });
    return recurse(nodes, 0);
  };

  const removeNodeById = (nodes, id) => {
    let removed = null;
    const recurse = (list) => {
      const out = [];
      for (const n of list) {
        if (n.id === id) {
          removed = n;
          continue;
        }
        if (n.type === "folder") {
          const res = recurse(n.children || []);
          out.push(res !== n.children ? { ...n, children: res } : n);
        } else out.push(n);
      }
      return out;
    };
    return { newTree: recurse(nodes), removedNode: removed };
  };

  const moveNodeToPathLocal = (nodes, nodeId, destPath) => {
    const { newTree, removedNode } = removeNodeById(nodes, nodeId);
    if (!removedNode) return nodes;
    return addNodeAtPath(newTree, destPath, removedNode);
  };

  const getPathToFolder = (nodes, targetId) => {
    if (targetId == null) return [];
    const result = [];
    const dfs = (list, acc) => {
      for (const n of list) {
        if (n.type === "folder") {
          const newAcc = [...acc, n.id];
          if (n.id === targetId) {
            result.push(...newAcc);
            return true;
          }
          if (dfs(n.children || [], newAcc)) return true;
        }
      }
      return false;
    };
    dfs(nodes, []);
    return result;
  };

  const handleDownloadFile = (file) => {
    if (!file || file.type !== "file") return;
    
    const content = `${file.title}\n\nCreated: ${file.date}\n\nDescription:\n${file.description || "No description provided"}`;
    
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.title.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    synthRef.current = window.speechSynthesis;

    const handleBeforeUnload = () => {
      if (synthRef.current && synthRef.current.speaking) {
        synthRef.current.cancel();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (synthRef.current && synthRef.current.speaking) {
        synthRef.current.cancel();
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setItems([]);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }

    const load = async () => {
      try {
        const q = query(foldersRef, where("userId", "==", userId));
        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: data.type || "file",
            title: data.title || "",
            description: data.description || "",
            date: data.date || "",
            favorite: data.favorite || false,
            color: data.color || "",
            parentId: data.parentId ?? null,
          };
        });
        const tree = buildTreeFromFlat(docs);
        setItems(tree);
        localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(tree));
      } catch (e) {
        try {
          const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
          if (raw) setItems(JSON.parse(raw));
        } catch (err) {}
      }
    };
    load();
  }, [userId]);

  useEffect(() => {
    if (userId) {
      try {
        localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(items));
      } catch (e) {}
    }
  }, [items, userId]);

  const handleCreateOrEdit = async () => {
    if (!userId) {
      alert("User not logged in. Please log in to create or edit folders/files.");
      return;
    }
    if (!title.trim()) return;

    if (editingNode) {
      setItems((prev) => {
        const updateNode = (list) =>
          list.map((n) => {
            if (n.id === editingNode.id) {
              if (n.type === "file") {
                return {
                  ...n,
                  title: title.trim(),
                  description: description.trim(),
                  date: getToday(),
                };
              } else {
                return { ...n, title: title.trim(), color: folderColor || n.color };
              }
            }
            if (n.type === "folder") return { ...n, children: updateNode(n.children || []) };
            return n;
          });
        return updateNode(prev);
      });

      try {
        const ref = doc(db, "folders", editingNode.id);
        const payload = {
          title: title.trim(),
          description: description.trim(),
          date: getToday(),
          color: folderColor || editingNode.color || "",
          userId,
        };
        await updateDoc(ref, payload);
      } catch (e) {}
      setEditingNode(null);
    } else {
      const newId = Date.now().toString();
      const parentId = currentPath.length ? currentPath[currentPath.length - 1] : null;
      const newItem = {
        id: newId,
        type: createType,
        title: title.trim(),
        date: getToday(),
        favorite: false,
        parentId,
        ...(createType === "folder"
          ? { children: [], color: folderColor || "" }
          : { description: description.trim() }),
      };
      setItems((prev) => addNodeAtPath(prev, currentPath, newItem));
      try {
        const ref = doc(db, "folders", newId);
        await setDoc(ref, {
          type: createType,
          title: newItem.title,
          description: newItem.description || "",
          date: newItem.date,
          favorite: false,
          color: newItem.color || "",
          parentId: parentId,
          userId,
        });
      } catch (e) {}
    }
    setTitle("");
    setDescription("");
    setFolderColor("");
    setCreateType(null);
    setSelectedOption(null);
    setShowCreateForm(false);
    setShowPopup(false);
  };

  const handleDragStart = (e, node) => {
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e) => e.preventDefault();
  const handleDropOnFolder = async (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredFolder(null);
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === folderId) return;
    const destPath = getPathToFolder(items, folderId);
    if (destPath.includes(draggedId)) return;
    setItems((prev) => moveNodeToPathLocal(prev, draggedId, destPath));
    try {
      const ref = doc(db, "folders", draggedId);
      await updateDoc(ref, { parentId: folderId, userId });
    } catch (e) {}
  };
  const handleDropOnRoot = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId) return;
    setItems((prev) => moveNodeToPathLocal(prev, draggedId, []));
    try {
      const ref = doc(db, "folders", draggedId);
      await updateDoc(ref, { parentId: null, userId });
    } catch (e) {}
  };

  const searchAllNodes = (nodes, query, path = []) => {
    let results = [];
    for (const node of nodes) {
      const newPath = [...path];
      if (node.type === "folder") newPath.push(node.id);
      if (node.title.toLowerCase().includes(query.toLowerCase())) {
        results.push({ node, path });
      }
      if (node.type === "folder" && node.children) {
        results = results.concat(searchAllNodes(node.children, query, newPath));
      }
    }
    return results;
  };
  const searchResults = searchQuery.trim() === "" ? null : searchAllNodes(items, searchQuery);

  const toggleFavorite = async (nodeId) => {
    if (!userId) return;
    const node = findNodeById(items, nodeId);
    if (!node) return;
    if (node.type === "folder") {
      toggleFavoriteAllInFolder(node);
      return;
    }
    setItems((prev) => {
      const updateNode = (list) =>
        list.map((n) => {
          if (n.id === nodeId) {
            const newFav = !n.favorite;
            (async () => {
              try {
                const ref = doc(db, "folders", n.id);
                await updateDoc(ref, { favorite: newFav, userId });
              } catch (e) {}
            })();
            return { ...n, favorite: newFav };
          }
          if (n.type === "folder") return { ...n, children: updateNode(n.children || []) };
          return n;
        });
      return updateNode(prev);
    });
  };

  const toggleFavoriteAllInFolder = (folder) => {
    const favoriteAllRecursive = (node, makeFavorite) => {
      if (node.type === "file") return { ...node, favorite: makeFavorite };
      if (node.type === "folder") {
        return {
          ...node,
          favorite: makeFavorite,
          children: (node.children || []).map((c) => favoriteAllRecursive(c, makeFavorite)),
        };
      }
      return node;
    };
    setItems((prev) => {
      const path = getPathToFolder(prev, folder.id);
      const getNodeByPath = (list, pathArr) => {
        if (!pathArr.length) return null;
        let curr = list;
        let node = null;
        for (const id of pathArr) {
          node = curr.find((n) => n.id === id);
          if (!node) return null;
          curr = node.children || [];
        }
        return node;
      };
      const target = getNodeByPath(prev, path);
      const allFav = target ? (function checkAll(n) {
        if (n.type === "file") return !!n.favorite;
        return !!n.favorite && (n.children || []).every((c) => checkAll(c));
      })(target) : false;
      const makeFavorite = !allFav;
      const updateNodeAtPath = (list, pathArr) => {
        if (!pathArr.length) return list;
        return list.map((n) => {
          if (n.id === pathArr[0]) {
            if (pathArr.length === 1) return favoriteAllRecursive(n, makeFavorite);
            if (n.type === "folder") return { ...n, children: updateNodeAtPath(n.children || [], pathArr.slice(1)) };
          }
          return n;
        });
      };
      const newTree = updateNodeAtPath(prev, path);
      (async () => {
        try {
          const targetNode = getNodeByPath(prev, path);
          if (targetNode) {
            const idsToUpdate = [];
            const collectIds = (n, out) => {
              out.push(n.id);
              if (n.type === "folder" && n.children) {
                for (const c of n.children) collectIds(c, out);
              }
            };
            collectIds(targetNode, idsToUpdate);
            for (const id of idsToUpdate) {
              const ref = doc(db, "folders", id);
              await updateDoc(ref, { favorite: makeFavorite, userId });
            }
          }
        } catch (e) {}
      })();
      return newTree;
    });
  };

  const collectDescendants = (node) => {
    const ids = [];
    const dfs = (n) => {
      if (!n) return;
      ids.push(n.id);
      if (n.type === "folder" && n.children) {
        for (const c of n.children) dfs(c);
      }
    };
    dfs(node);
    return ids;
  };

  const handleDelete = async (item) => {
    if (!userId) return;
    const { newTree, removedNode } = removeNodeById(items, item.id);
    if (!removedNode) return;
    const toDeleteIds = collectDescendants(removedNode);
    const deletedDocs = [];
    const traverseCollect = (n, parentId) => {
      const data = {
        id: n.id,
        type: n.type,
        title: n.title,
        description: n.description || "",
        date: n.date,
        favorite: !!n.favorite,
        color: n.color || "",
        parentId: parentId,
      };
      deletedDocs.push(data);
      if (n.type === "folder" && n.children) {
        for (const c of n.children) traverseCollect(c, n.id);
      }
    };
    const origParentPath = getPathToFolder(items, item.id).slice(0, -1);
    const parentIdOfRemoved = origParentPath.length ? origParentPath[origParentPath.length - 1] : null;
    traverseCollect(removedNode, parentIdOfRemoved);
    setItems(newTree);
    setShowOptionsFor(null);
    setUndoData({ action: "delete", deletedDocs });
    setDeleteUndoActive(true);
    try {
      for (const id of toDeleteIds) {
        await deleteDoc(doc(db, "folders", id));
      }
    } catch (e) {}
  };

  const undoLastAction = async () => {
    if (!userId || !undoData || undoData.action !== "delete") return;
    const { deletedDocs } = undoData;
    const map = {};
    deletedDocs.forEach((d) => {
      map[d.id] = { ...d, children: d.type === "folder" ? [] : [] };
    });
    const rootsOfSubtree = [];
    deletedDocs.forEach((d) => {
      const p = d.parentId ?? null;
      if (p && map[p]) {
        map[p].children.push(map[d.id]);
      } else {
        rootsOfSubtree.push(map[d.id]);
      }
    });
    setItems((prev) => {
      let out = prev;
      for (const rootNode of rootsOfSubtree) {
        const parentId = rootNode.parentId ?? null;
        if (!parentId) {
          out = [...out, rootNode];
        } else {
          const path = getPathToFolder(prev, parentId);
          out = addNodeAtPath(out, path, rootNode);
        }
      }
      return out;
    });
    try {
      for (const d of deletedDocs) {
        const ref = doc(db, "folders", d.id);
        await setDoc(ref, {
          type: d.type,
          title: d.title,
          description: d.description || "",
          date: d.date,
          favorite: !!d.favorite,
          color: d.color || "",
          parentId: d.parentId ?? null,
          userId,
        });
      }
    } catch (e) {}
    setUndoData(null);
    setDeleteUndoActive(false);
  };

  useEffect(() => {
    if (deleteUndoActive) {
      const timer = setTimeout(() => {
        setUndoData(null);
        setDeleteUndoActive(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [deleteUndoActive]);

  const buildFavoritesView = (nodes) => {
    const result = [];
    const findAncestorFavorited = (nodeId) => {
      const node = findNodeById(items, nodeId);
      if (!node || !node.parentId) return false;
      const parent = findNodeById(items, node.parentId);
      if (!parent) return false;
      if (parent.favorite) return true;
      return findAncestorFavorited(parent.id);
    };
    const processNode = (node, path = []) => {
      if (node.type === "file" && node.favorite) {
        const ancestorFavorited = findAncestorFavorited(node.id);
        if (!ancestorFavorited) {
          result.push({ ...node, _path: [...path] });
        }
        return;
      }
      if (node.type === "folder") {
        const newPath = [...path, node.id];
        const isFavorited = node.favorite;
        if (isFavorited) {
          const filteredNode = {
            ...node,
            children: [],
            favorite: true,
            _originalChildren: node.children || [],
            _path: newPath,
          };
          result.push(filteredNode);
        } else {
          (node.children || []).forEach((child) => {
            processNode(child, newPath);
          });
        }
      }
    };
    nodes.forEach((node) => {
      processNode(node, []);
    });
    return result;
  };

  const getActualPathForFavoriteFolder = (folderId) => {
    const findPath = (nodes, targetId, currentPath = []) => {
      for (const node of nodes) {
        if (node.id === targetId) return [...currentPath, node.id];
        if (node.type === "folder" && node.children) {
          const found = findPath(node.children, targetId, [...currentPath, node.id]);
          if (found) return found;
        }
      }
      return null;
    };
    return findPath(items, folderId) || [];
  };

  const currentNodes = showFavorites ? buildFavoritesView(items) : getChildrenAtPath(items, currentPath);
  const currentNodesWithSort = currentNodes.sort(
    (a, b) => new Date(b.date.split("/").reverse().join("-")) - new Date(a.date.split("/").reverse().join("-"))
  );
  const currentFolderTitle = showFavorites ? "Favorites" : currentPath.length === 0 ? "Home" : findNodeById(items, currentPath[currentPath.length - 1])?.title || "Folder";
  const breadcrumbs = [{ id: null, title: "Home" }, ...currentPath.map((id) => ({ id, title: findNodeById(items, id)?.title || "Folder" }))];

  const speakText = (text) => {
    if (!synthRef.current) {
      console.error("Speech synthesis not available");
      return;
    }

    if (utteranceRef.current && synthRef.current.speaking) {
      synthRef.current.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      utteranceRef.current = null;
    };

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event);
      setIsSpeaking(false);
      setIsPaused(false);
      utteranceRef.current = null;
    };

    utterance.onpause = () => {
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPaused(false);
    };

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = synthRef.current.getVoices();
    if (voices.length > 0) {
      const englishVoice = voices.find((v) => v.lang.includes("en")) || voices[0];
      utterance.voice = englishVoice;
    }

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const toggleTts = (textToSpeak) => {
    if (!synthRef.current) {
      alert("Speech synthesis is not supported in your browser.");
      return;
    }

    if (synthRef.current.speaking && utteranceRef.current) {
      if (synthRef.current.paused) {
        synthRef.current.resume();
        setIsPaused(false);
      } else {
        synthRef.current.pause();
        setIsPaused(true);
      }
    } else {
      if (textToSpeak && textToSpeak.trim()) {
        speakText(textToSpeak);
      }
    }
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== "Space" && e.key !== " ") return;
      const tag = (e.target && e.target.tagName) || "";
      const editableTypes = ["INPUT", "TEXTAREA", "SELECT", "BUTTON"];
      if (editableTypes.includes(tag)) return;
      e.preventDefault();

      if (viewingFile) {
        const textToSpeak = `${viewingFile.title}. ${viewingFile.description}`;
        toggleTts(textToSpeak);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewingFile]);

  if (loading) {
    return null; // No UI while loading auth state
  }

  if (!userId) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center" style={{ background: theme.background, color: text }}>
        <div className="text-center" style={{ maxWidth: "400px" }}>
          <h2 className="text-2xl font-bold mb-4">Please log in</h2>
          <p className="opacity-80 mb-6">Log in to your account to view and manage your personal folders and files.</p>
        </div>
      </div>
    );
  }

  if (viewingFile) {
    return (
      <div className="p-6 min-h-screen" style={{ background: theme.background, color: text }}>
        <button onClick={() => setViewingFile(null)} className="px-3 py-1 mb-4 rounded" style={{ background: theme.card, color: text, border: `1px solid ${theme.border}` }}>
          ← Back
        </button>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-2xl font-bold">{viewingFile.title}</h2>
          <button onClick={(e) => { e.stopPropagation(); toggleTts(`${viewingFile.title}. ${viewingFile.description}`); }} className="text-xl p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="toggle-speech" title={isSpeaking ? (isPaused ? "Resume (Space)" : "Pause (Space)") : "Speak (Space)"}>
            {isSpeaking ? (isPaused ? "⏸️" : "🔊") : "🔈"}
          </button>
        </div>
        <p className="text-sm opacity-70 mb-2">Created: {viewingFile.date}</p>
        <p className="mb-4">{viewingFile.description}</p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl relative min-h-screen" style={{ background: theme.background, color: text }} onDrop={handleDropOnRoot} onDragOver={handleDragOver}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">My Folders</h1>
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search files or folders..." className="p-2 rounded-lg border" style={{ borderColor: theme.border, background: theme.background, color: text }} />
      </div>
      <div className="text-sm opacity-80 mb-4">
        Location:{" "}
        <span className="font-medium">
          {breadcrumbs.map((c, idx) => (
            <span key={idx}>
              {idx > 0 && " / "}
              {c.id ? (
                <button className="underline" onClick={() => { if (c.id === null) setCurrentPath([]); else { const index = currentPath.indexOf(c.id); setCurrentPath(currentPath.slice(0, index + 1)); } }} style={{ color: text }}>
                  {c.title}
                </button>
              ) : (
                <span>Home</span>
              )}
            </span>
          ))}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => { if (showFavorites) setShowFavorites(false); else setCurrentPath((p) => p.slice(0, p.length - 1)); }} disabled={!showFavorites && currentPath.length === 0} className="px-3 py-1 rounded-md text-sm" style={{ background: theme.card, border: `1px solid ${theme.border}`, color: text, opacity: !showFavorites && currentPath.length === 0 ? 0.5 : 1 }}>
          ← Back
        </button>
        {!showFavorites && (
          <button onClick={() => setShowFavorites(true)} className="px-3 py-1 rounded-md text-sm" style={{ background: theme.card, border: `1px solid ${theme.border}`, color: text }}>
            Favorites
          </button>
        )}
        <div className="px-3 py-1 rounded-md text-sm" style={{ background: theme.card, border: `1px solid ${theme.border}`, color: text }}>
          {currentFolderTitle}
        </div>
      </div>
      {!showFavorites && currentPath.length > 0 && (
        <button onClick={() => { const folder = findNodeById(items, currentPath[currentPath.length - 1]); if (folder) toggleFavoriteAllInFolder(folder); }} className="mb-4 text-sm flex items-center gap-2 px-3 py-1 rounded-md" style={{ background: theme.card, color: text, border: `1px solid ${theme.border}`, textDecoration: "none" }}>
          <span style={{ fontSize: 14, lineHeight: 1 }}>⭐</span>
          <span style={{ fontSize: 14 }}>Favorite / Unfavorite All in this Folder</span>
        </button>
      )}
      {searchQuery.trim() !== "" ? (
        searchResults.length === 0 ? (
          <div className="w-full p-10 rounded-xl flex flex-col items-center border" style={{ background: theme.card, border: `1px dashed ${theme.border}`, color: text }}>
            <p className="text-5xl opacity-60">🔍</p>
            <p className="text-lg opacity-80">No results found...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {searchResults.map(({ node, path }) => (
              <div key={node.id} className="p-3 rounded-xl flex justify-between items-center cursor-pointer" style={{ background: theme.card, border: `1px solid ${theme.border}` }} onClick={() => { if (node.type === "folder") setCurrentPath([...path, node.id]); else setViewingFile(node); setSearchQuery(""); }}>
                <div className="flex flex-col gap-1">
                  <div className="flex gap-2 items-center">
                    <div className="text-2xl">{node.type === "folder" ? "📁" : "📄"}</div>
                    <p className="font-semibold">{node.title}</p>
                  </div>
                  <p className="text-xs opacity-60">Path: {["Home", ...path.map((id) => findNodeById(items, id)?.title)].join(" / ")}</p>
                </div>
                <div className="flex items-center">
                  {node.type === "file" && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDownloadFile(node); }} 
                      className="text-xl mr-2" 
                      title="Download file"
                      style={{ color: text }}
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="20" 
                        height="20" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); toggleFavorite(node.id); }} className="text-xl" style={{ color: node.favorite ? "red" : "gray" }}>
                    {node.favorite ? "❤️" : "🤍"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : currentNodesWithSort.length === 0 ? (
        <div className="w-full p-10 rounded-xl flex flex-col items-center border" style={{ background: theme.card, border: `1px dashed ${theme.border}`, color: text }}>
          <p className="text-5xl opacity-60">{showFavorites ? "❤️" : "📂"}</p>
          <p className="text-lg opacity-80">{showFavorites ? "No favorites yet ⭐" : "No files or folders here..."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {currentNodesWithSort.map((item) => (
            <div key={item.id} className="p-4 rounded-xl flex justify-between items-center cursor-pointer relative" style={{ background: item.type === "folder" && item.color ? item.color : hoveredFolder === item.id ? "#9CC8FF33" : theme.card, border: `1px solid ${theme.border}` }} draggable={!showFavorites} onDragStart={!showFavorites ? (e) => handleDragStart(e, item) : undefined} onDragOver={!showFavorites ? (e) => { if (item.type === "folder") { handleDragOver(e); setHoveredFolder(item.id); } } : undefined} onDragLeave={!showFavorites ? () => setHoveredFolder(null) : undefined} onDrop={!showFavorites && item.type === "folder" ? (e) => handleDropOnFolder(e, item.id) : undefined}>
              <div className="flex gap-3 items-center flex-1" onClick={() => {
                if (item.type === 'folder') {
                  if (showFavorites) {
                    const actualPath = getActualPathForFavoriteFolder(item.id);
                    if (actualPath.length > 0) {
                      setCurrentPath(actualPath);
                      setShowFavorites(false);
                    }
                  } else {
                    setCurrentPath((p) => [...p, item.id]);
                  }
                } else {
                  setViewingFile(item);
                }
              }}>
                <div className="text-3xl">{item.type === "folder" ? "📁" : "📄"}</div>
                <div>
                  <p className="font-semibold text-lg">{item.title}</p>
                  <p className="text-sm opacity-70">Created: {item.date}</p>
                </div>
              </div>
              <div className="flex items-center">
                {item.type === "file" && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDownloadFile(item); }} 
                    className="text-xl mr-2" 
                    title="Download file"
                    style={{ color: text }}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="20" 
                      height="20" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }} className="text-xl mr-2" style={{ color: item.favorite ? "red" : "gray" }} title={item.type === "folder" ? "Favorite/unfavorite this folder and its contents" : "Favorite/unfavorite this file"}>
                  {item.favorite ? "❤️" : "🤍"}
                </button>
                <div className="relative">
                  <button className="text-xl px-2" onClick={(e) => { e.stopPropagation(); setShowOptionsFor(showOptionsFor === item.id ? null : item.id); }}>
                    ⋯
                  </button>
                  {showOptionsFor === item.id && (
                    <div className="absolute right-0 top-full mt-1 border rounded shadow z-10" style={{ minWidth: 100, background: theme.card, borderColor: theme.border, color: text }}>
                      <button className={`block w-full text-left px-3 py-1 ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-200"}`} onClick={(e) => { e.stopPropagation(); setEditingNode(item); setTitle(item.title); setDescription(item.description || ""); setFolderColor(item.color || ""); setShowCreateForm(true); setShowOptionsFor(null); }}>
                        Edit
                      </button>
                      <button className={`block w-full text-left px-3 py-1 ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-200"}`} onClick={(e) => { e.stopPropagation(); handleDelete(item); }}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => setShowPopup(true)} className="w-16 h-16 rounded-full flex items-center justify-center text-4xl fixed bottom-8 right-8 shadow-xl" style={{ background: accent, color: "#fff" }}>
        +
      </button>
      {showPopup && !showCreateForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40" onClick={() => setShowPopup(false)}>
          <div className="p-6 rounded-xl w-64" onClick={(e) => e.stopPropagation()} style={{ background: theme.card, color: text, border: `1px solid ${theme.border}` }}>
            <h2 className="text-xl font-bold mb-4">Create</h2>
            <button onClick={() => { setSelectedOption("file"); setCreateType("file"); setTimeout(() => setShowCreateForm(true), 180); }} className="w-full py-2 rounded-lg mb-3" style={{ background: selectedOption === "file" ? "#9CC8FF" : theme.card, color: selectedOption === "file" ? "#07385A" : text, border: `1px solid ${theme.border}` }}>
              Create File
            </button>
            <button onClick={() => { setSelectedOption("folder"); setCreateType("folder"); setTimeout(() => setShowCreateForm(true), 180); }} className="w-full py-2 rounded-lg" style={{ background: selectedOption === "folder" ? "#FFD9A3" : theme.card, color: selectedOption === "folder" ? "#7A3B00" : text, border: `1px solid ${theme.border}` }}>
              Create Folder
            </button>
          </div>
        </div>
      )}
      {showCreateForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40" onClick={() => { setShowCreateForm(false); setShowPopup(false); setSelectedOption(null); setCreateType(null); setEditingNode(null); setFolderColor(""); }}>
          <div className="p-6 rounded-xl w-96" onClick={(e) => e.stopPropagation()} style={{ background: theme.card, color: text, border: `1px solid ${theme.border}` }}>
            <h2 className="text-xl font-bold mb-4">{editingNode ? "Edit " : "New "}{createType === "file" || (editingNode && editingNode.type === "file") ? "File" : "Folder"}</h2>
            <label className="text-sm opacity-80">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 rounded-lg mb-4 mt-1" style={{ background: theme.background, color: text, border: `1px solid ${theme.border}` }} />
            {(createType === "file" || (editingNode && editingNode.type === "file")) && (
              <>
                <label className="text-sm opacity-80">Description</label>
                <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-2 rounded-lg mb-4 mt-1" style={{ background: theme.background, color: text, border: `1px solid ${theme.border}` }} />
              </>
            )}
            {createType === "folder" && (
              <>
                <label className="text-sm opacity-80">Folder Color (optional)</label>
                <input type="color" value={folderColor} onChange={(e) => setFolderColor(e.target.value)} className="w-full p-2 mb-4 mt-1 rounded-lg" />
              </>
            )}
            <label className="text-sm opacity-80">Date</label>
            <input disabled value={getToday()} className="w-full p-2 rounded-lg mb-4 mt-1 opacity-60" style={{ background: theme.background, color: text, border: `1px solid ${theme.border}` }} />
            <div className="flex gap-3">
              <button className="flex-1 py-2 rounded-lg" onClick={() => { setShowCreateForm(false); setShowPopup(false); setEditingNode(null); setSelectedOption(null); setCreateType(null); setFolderColor(""); }} style={{ background: theme.card, color: text, border: `1px solid ${theme.border}` }}>
                Cancel
              </button>
              <button className="flex-1 py-2 rounded-lg" onClick={handleCreateOrEdit} style={{ background: accent, color: "#fff" }}>
                {editingNode ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteUndoActive && undoData && undoData.action === "delete" && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded shadow-md flex items-center gap-4" style={{ background: theme.card, color: text, border: `1px solid ${theme.border}` }}>
          <span>Item deleted</span>
          <button className="px-2 py-1 text-sm rounded" style={{ background: accent, color: "#fff" }} onClick={undoLastAction}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}