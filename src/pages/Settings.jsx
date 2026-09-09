// src/pages/Settings.jsx
import { useTheme } from "../context/ThemeContext";
import { auth, db } from "../firebase";
import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut, updatePassword, deleteUser } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, serverTimestamp, deleteDoc } from "firebase/firestore";

export default function Settings() {
  const { theme, mode, setMode } = useTheme();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ username: "", email: "" });
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [storageUsed] = useState("0 MB of 2 GB");



  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);

      if (u) {
        const ud = await getDoc(doc(db, "users", u.uid));
        const data = ud.exists() ? ud.data() : {};

        setProfile({
          username: data.username || (u.email ? u.email.split("@")[0] : ""),
          email: u.email || "",
        });

        setNewUsername(data.username || "");
      }
    });

    return () => unsub();
  }, []);

  return (
    <div
      style={{
        background: theme.background,
        color: theme.textPrimary,
        minHeight: "calc(100vh - 80px)",
      }}
      className="p-4 lg:p-8"
    >
      {/* Page Title */}
      <h1
        className="text-2xl lg:text-3xl font-bold mb-4 lg:mb-6"
        style={{ color: theme.textPrimary }}
      >
        Settings
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Account Settings */}
        <div
          className="p-4 lg:p-6 rounded-xl"
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
          }}
        >
          <h2
            className="text-lg lg:text-xl font-bold mb-4"
            style={{ color: theme.textPrimary }}
          >
            Account Settings
          </h2>

          <div className="space-y-4">
            {/* Avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: theme.gradientPrimary,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                }}
              >
                {(profile.username || "").slice(0, 1)}
              </div>
              <div style={{ fontSize: 14 }}>{profile.username}</div>
            </div>

            {/* Email */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: theme.textSecondary }}
              >
                Email
              </label>
              <input
                type="email"
                className="w-full p-3 rounded-lg border text-sm lg:text-base"
                style={{
                  background: theme.background,
                  border: `1px solid ${theme.border}`,
                  color: theme.textPrimary,
                }}
                value={profile.email}
                readOnly
              />
            </div>

            {/* Username */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: theme.textSecondary }}
              >
                Username
              </label>
              <input
                type="text"
                className="w-full p-3 rounded-lg border text-sm lg:text-base"
                style={{
                  background: theme.background,
                  border: `1px solid ${theme.border}`,
                  color: theme.textPrimary,
                }}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>

            {/* Update Profile Button */}
            <button
              className="w-full py-3 rounded-lg font-semibold text-white text-sm lg:text-base"
              style={{ background: theme.gradientPrimary }}
              onClick={async () => {
                if (!user) return;
                const oldUsername = profile.username;
                await updateDoc(doc(db, "users", user.uid), { username: newUsername });
                setProfile((p) => ({ ...p, username: newUsername }));

                const q = query(collection(db, 'servers'), where('membersIds', 'array-contains', user.uid));
                const snap = await getDocs(q);
                for (const d of snap.docs) {
                  const data = d.data();
                  const members = (data.members || []).map((m) => m.uid === user.uid ? { ...m, username: newUsername } : m);
                  const updates = { members };
                  if (data.adminUid === user.uid) updates.adminUsername = newUsername;
                  await updateDoc(d.ref, updates);

                  const disc = await getDocs(collection(db, 'servers', d.id, 'discussionMessages'));
                  for (const msg of disc.docs) {
                    const md = msg.data();
                    if (md.userUid === user.uid || md.user === oldUsername) {
                      await updateDoc(msg.ref, { user: newUsername, userUid: user.uid });
                    }
                  }
                  const ann = await getDocs(collection(db, 'servers', d.id, 'announcementMessages'));
                  for (const msg of ann.docs) {
                    const md = msg.data();
                    if (md.userUid === user.uid || md.user === oldUsername) {
                      await updateDoc(msg.ref, { user: newUsername, userUid: user.uid });
                    }
                  }
                }
                alert('Profile updated');
              }}
            >
              Update Profile
            </button>
          </div>
        </div>

        {/* Preferences */}
        <div
          className="p-4 lg:p-6 rounded-xl"
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
          }}
        >
          <h2
            className="text-lg lg:text-xl font-bold mb-4"
            style={{ color: theme.textPrimary }}
          >
            Preferences
          </h2>

          <div className="space-y-4">
            {/* Theme Selector */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: theme.textSecondary }}
              >
                Theme
              </label>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setMode("light")}
                  style={{
                    border: `1px solid ${theme.border}`,
                    background:
                      mode === "light" ? theme.background : theme.card,
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  Light
                </button>

                <button
                  onClick={() => setMode("dark")}
                  style={{
                    border: `1px solid ${theme.border}`,
                    background:
                      mode === "dark" ? theme.background : theme.card,
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  Dark
                </button>

                <button
                  onClick={() =>
                    setMode(
                      window.matchMedia("(prefers-color-scheme: dark)").matches
                        ? "dark"
                        : "light"
                    )
                  }
                  style={{
                    border: `1px solid ${theme.border}`,
                    background: theme.card,
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  System
                </button>
              </div>
            </div>

            {/* Write a Review */}
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{
                background: theme.background,
                border: `1px solid ${theme.border}`,
              }}
            >
              <div>
                <div
                  className="font-medium text-sm lg:text-base"
                  style={{ color: theme.textPrimary }}
                >
                  Write a Review
                </div>
                <div
                  className="text-xs lg:text-sm"
                  style={{ color: theme.textSecondary }}
                >
                  Share your feedback with us
                </div>
              </div>

              <button
                onClick={() => navigate("/AboutUs")}
                style={{
                  border: `1px solid ${theme.border}`,
                  background: theme.card,
                  borderRadius: 8,
                  padding: "6px 10px",
                }}
              >
                Review
              </button>
            </div>

            {/* Invite Friend */}
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{
                background: theme.background,
                border: `1px solid ${theme.border}`,
              }}
            >
              <div>
                <div
                  className="font-medium text-sm lg:text-base"
                  style={{ color: theme.textPrimary }}
                >
                  Invite a Friend
                </div>
                <div
                  className="text-xs lg:text-sm"
                  style={{ color: theme.textSecondary }}
                >
                  Share the app with friends
                </div>
              </div>

              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: "Community",
                      text: "Join me on Community!",
                      url: window.location.origin,
                    });
                  }
                }}
                style={{
                  border: `1px solid ${theme.border}`,
                  background: theme.card,
                  borderRadius: 8,
                  padding: "6px 10px",
                }}
              >
                Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Security */}
      <div
        className="mt-6 lg:mt-8 p-4 lg:p-6 rounded-xl"
        style={{
          background: theme.card,
          border: `1px solid ${theme.border}`,
        }}
      >
        <h2
          className="text-lg lg:text-xl font-bold mb-4"
          style={{ color: theme.textPrimary }}
        >
          Security
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Change Password - Hide if Google Auth */}
          {(!user?.providerData?.some((p) => p.providerId === "google.com")) && (
            <div
              className="p-4 rounded-lg border"
              style={{
                background: theme.background,
                border: `1px solid ${theme.border}`,
                color: theme.textPrimary,
              }}
            >
              <div className="font-semibold mb-2">Change Password</div>

              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-3 rounded-lg border text-sm"
                style={{
                  background: theme.card,
                  border: `1px solid ${theme.border}`,
                  color: theme.textPrimary,
                }}
                placeholder="New password"
              />

              <button
                onClick={async () => {
                  if (!user || !newPassword) return;

                  try {
                    await updatePassword(user, newPassword);
                    alert("Password updated");
                    setNewPassword("");
                  } catch (e) {
                    alert("Failed: " + (e?.message || ""));
                  }
                }}
                className="mt-2 w-full py-2 rounded-lg font-semibold text-white text-sm"
                style={{ background: theme.gradientPrimary }}
              >
                Update Password
              </button>
            </div>
          )}

          {/* Logout & Delete */}
          <div
            className="p-4 rounded-lg border"
            style={{
              background: theme.background,
              border: `1px solid ${theme.border}`,
              color: theme.textPrimary,
            }}
          >
            <div className="font-semibold mb-2">Account</div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={async () => {
                  if (!window.confirm("Are you sure you want to logout?")) return;
                  try { await signOut(auth); navigate('/login'); } catch (e) { alert('Logout failed: ' + (e?.message || '')); }
                }}
                className="px-4 py-2 rounded-lg font-semibold text-white text-sm"
                style={{ background: theme.gradientPrimary }}
              >
                Logout
              </button>

              <button
                onClick={async () => {
                  if (!user) return;
                  if (!window.confirm("Are you sure you want to delete your account? This cannot be undone.")) return;
                  try {
                    const uid = user.uid;
                    const q = query(collection(db, 'servers'), where('membersIds', 'array-contains', uid));
                    const snap = await getDocs(q);
                    for (const d of snap.docs) {
                      const data = d.data();
                      const filtered = (data.members || []).filter((m) => m.uid !== uid);
                      const newCount = Math.max(0, (data.membersCount || 1) - 1);
                      if ((data.membersCount || 0) <= 1) {
                        await updateDoc(d.ref, { deleted: true, deletedAt: serverTimestamp(), members: [], membersIds: [], membersCount: 0, adminUid: null, adminUsername: '' });
                      } else if (data.adminUid === uid) {
                        const candidates = filtered.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
                        const next = candidates[0] || null;
                        await updateDoc(d.ref, { members: filtered, membersIds: (data.membersIds || []).filter((id) => id !== uid), membersCount: newCount, adminUid: next ? next.uid : null, adminUsername: next ? next.username : '' });
                      } else {
                        await updateDoc(d.ref, { members: filtered, membersIds: (data.membersIds || []).filter((id) => id !== uid), membersCount: newCount });
                      }
                    }
                    try { await deleteDoc(doc(db, 'users', uid)); } catch (err) { console.warn('Failed to delete user doc', err); }
                    await deleteUser(user);
                    navigate('/register');
                  } catch (e) {
                    alert('Failed: ' + (e?.message || ''));
                  }
                }}
                className="px-4 py-2 rounded-lg font-semibold text-white text-sm"
                style={{ background: "#ef4444" }}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}