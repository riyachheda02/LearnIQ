import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import lightLogo from "../assets/ff_light_logo.png";
import darkLogo from "../assets/ff_dark_logo.png";

export default function Sidebar() {
  const location = useLocation();
  const { theme, mode, toggleTheme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userInfo, setUserInfo] = useState({ username: "", email: "" });

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(false); // Close sidebar when resizing to desktop
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setUserInfo({ username: "", email: "" }); return; }
      const snap = await getDoc(doc(db, 'users', u.uid));
      const data = snap.exists() ? snap.data() : {};
      setUserInfo({ 
        username: data.username || (u.email ? u.email.split('@')[0] : ''), 
        email: u.email || '' 
      });
    });
    return () => unsub();
  }, []);

  const menuItems = [
    { id: "home", label: "Home", icon: "🏠", path: "/DashBoard" },
    { id: "ask", label: "Ask Anything", icon: "💬", path: "/Ask" },
    { id: "quiz", label: "Quiz", icon: "🧠", path: "/Quiz" },
    { id: "community", label: "Community", icon: "👥", path: "/Community" },
    { id: "folder", label: "My Folders", icon: "📁", path: "/Folders" },
    { id: "schedule", label: "Schedule", icon: "🗓️", path: "/Schedule" },
    { id: "settings", label: "Settings", icon: "⚙️", path: "/Settings" },
    { id: "about", label: "About Us", icon: "ℹ️", path: "/AboutUs" }
  ];

  const activeItem = menuItems.find(item => item.path === location.pathname)?.id;

  const handleItemClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Mobile sidebar overlay and toggle button 🧠
  if (isMobile) {
    return (
      <>
        {/* Hamburger Menu Button */}
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: "fixed",
            top: "15px",
            left: "15px",
            zIndex: 100,
            background: theme.gradientPrimary,
            color: "white",
            border: "none",
            borderRadius: "8px",
            width: "40px",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            cursor: "pointer",
          }}
        >
          ☰
        </button>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.5)",
              zIndex: 998,
            }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar for Mobile */}
        <div
          style={{
            width: "280px",
            height: "100vh",
            background: theme.sidebar,
            display: "flex",
            flexDirection: "column",
            padding: "20px 0",
            gap: "4px",
            color: theme.textPrimary,
            fontFamily: "'Inter', sans-serif",
            borderRight: `1px solid ${theme.border}`,
            position: "fixed",
            top: 0,
            left: sidebarOpen ? "0" : "-280px",
            zIndex: 999,
            overflow: "hidden",
            transition: "left 0.3s ease",
          }}
        >
          {/* Close Button for Mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "absolute",
              top: "15px",
              right: "15px",
              background: theme.card,
              border: `1px solid ${theme.border}`,
              color: theme.textPrimary,
              borderRadius: "8px",
              width: "30px",
              height: "30px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              cursor: "pointer",
              zIndex: 1000,
            }}
          >
            ✕
          </button>

          {/* Left Accent */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "3px",
              height: "100%",
              background: theme.gradientPrimary
            }}
          />

          {/* Logo - Mobile Version */}
          <div
            style={{
              width: "100%",
              height: "160px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0",
              marginBottom: "10px",
              borderBottom: `1px solid ${theme.border}`,
            }}
          >
            <img 
              src={mode === 'dark' ? darkLogo : lightLogo} 
              alt="logo" 
              style={{ 
                height: "160px", 
                width: "100%",
                objectFit: "contain",
                padding: "20px"
              }} 
            />
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", flexDirection: "column", padding: "0 12px", gap: "2px" }}>
            {menuItems.map(item => (
              <Link 
                to={item.path} 
                key={item.id} 
                style={{ textDecoration: "none" }}
                onClick={handleItemClick}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    background: activeItem === item.id ? theme.activeItem : "transparent",
                    border: activeItem === item.id ? `1px solid ${theme.activeBorder}` : "1px solid transparent",
                    position: "relative",
                    cursor: "pointer",
                  }}
                >
                  {/* Active Line */}
                  {activeItem === item.id && (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "3px",
                        height: "18px",
                        background: theme.gradientPrimary,
                      }}
                    />
                  )}

                  <span style={{ fontSize: "17px" }}>{item.icon}</span>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: activeItem === item.id ? "600" : "500",
                      color: activeItem === item.id ? theme.textPrimary : theme.textSoft,
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Theme Toggle */}
          <div
            style={{
              margin: "10px 12px 0 12px",
              padding: "10px",
              background: theme.cardSoft,
              borderRadius: "10px",
              border: `1px solid ${theme.border}`,
            }}
          >
            <button
              onClick={toggleTheme}
              style={{
                width: "100%",
                padding: "8px 10px",
                background: theme.gradientPrimary,
                borderRadius: "8px",
                border: "none",
                color: "#fff",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              {mode === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
            </button>
          </div>

          {/* Upgrade Card */}
          <div
            style={{
              margin: "10px 12px 0 12px",
              padding: "14px",
              background: theme.cardSoft,
              borderRadius: "12px",
              border: `1px solid ${theme.border}`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: "600",
                marginBottom: "5px",
                background: theme.textGradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Upgrade to Pro
            </div>

            <div style={{ fontSize: "11px", color: theme.textSoft, marginBottom: "10px" }}>
              Unlock all premium features.
            </div>

            <button
              style={{
                width: "100%",
                background: theme.gradientPrimary,
                padding: "8px",
                borderRadius: "20px",
                border: "none",
                color: "#fff",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Upgrade Now
            </button>
          </div>

          {/* User Profile */}
          <div
            style={{
              marginTop: "auto",
              padding: "12px 18px",
              borderTop: `1px solid ${theme.border}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  background: theme.gradientPrimary,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: "bold",
                }}
              >
                {userInfo.username ? userInfo.username.substring(0, 2).toUpperCase() : "JD"}
              </div>

              <div>
                <div style={{ fontSize: "13px", fontWeight: "600" }}>
                  {userInfo.username || "John Doe"}
                </div>
                <div style={{ fontSize: "11px", color: theme.textSoft }}>
                  {userInfo.email ? "Premium User" : "Guest User"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Desktop Sidebar
  return (
    <div
      style={{
        width: "250px",
        height: "100vh",
        background: theme.sidebar,
        display: "flex",
        flexDirection: "column",
        padding: "20px 0",
        gap: "4px",
        color: theme.textPrimary,
        fontFamily: "'Inter', sans-serif",
        borderRight: `1px solid ${theme.border}`,
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 10,
        overflow: "hidden",
      }}
    >
      {/* Left Accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "3px",
          height: "100%",
          background: theme.gradientPrimary
        }}
      />

      {/* Logo - Desktop Version */}
      <div
        style={{
          width: "100%",
          height: "160px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0",
          marginBottom: "10px",
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <img 
          src={mode === 'dark' ? darkLogo : lightLogo} 
          alt="logo" 
          style={{ 
            height: "160px", 
            width: "100%",
            objectFit: "contain",
            padding: "20px"
          }} 
        />
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", flexDirection: "column", padding: "0 12px", gap: "2px" }}>
        {menuItems.map(item => (
          <Link to={item.path} key={item.id} style={{ textDecoration: "none" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                borderRadius: "10px",
                background: activeItem === item.id ? theme.activeItem : "transparent",
                border: activeItem === item.id ? `1px solid ${theme.activeBorder}` : "1px solid transparent",
                position: "relative",
                cursor: "pointer",
              }}
            >
              {/* Active Line */}
              {activeItem === item.id && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "3px",
                    height: "18px",
                    background: theme.gradientPrimary,
                  }}
                />
              )}

              <span style={{ fontSize: "17px" }}>{item.icon}</span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: activeItem === item.id ? "600" : "500",
                  color: activeItem === item.id ? theme.textPrimary : theme.textSoft,
                }}
              >
                {item.label}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Theme Toggle */}
      <div
        style={{
          margin: "10px 12px 0 12px",
          padding: "10px",
          background: theme.cardSoft,
          borderRadius: "10px",
          border: `1px solid ${theme.border}`,
        }}
      >
        <button
          onClick={toggleTheme}
          style={{
            width: "100%",
            padding: "8px 10px",
            background: theme.gradientPrimary,
            borderRadius: "8px",
            border: "none",
            color: "#fff",
            fontSize: "12px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          {mode === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
        </button>
      </div>

      {/* Upgrade Card */}
      <div
        style={{
          margin: "10px 12px 0 12px",
          padding: "14px",
          background: theme.cardSoft,
          borderRadius: "12px",
          border: `1px solid ${theme.border}`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: "600",
            marginBottom: "5px",
            background: theme.textGradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Upgrade to Pro
        </div>

        <div style={{ fontSize: "11px", color: theme.textSoft, marginBottom: "10px" }}>
          Unlock all premium features.
        </div>

        <button
          style={{
            width: "100%",
            background: theme.gradientPrimary,
            padding: "8px",
            borderRadius: "20px",
            border: "none",
            color: "#fff",
            fontSize: "11px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Upgrade Now
        </button>
      </div>

      {/* User Profile */}
      <div
        style={{
          marginTop: "auto",
          padding: "12px 18px",
          borderTop: `1px solid ${theme.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "34px",
              height: "34px",
              background: theme.gradientPrimary,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "13px",
              fontWeight: "bold",
            }}
          >
            {userInfo.username ? userInfo.username.substring(0, 2).toUpperCase() : "JD"}
          </div>

          <div>
            <div style={{ fontSize: "13px", fontWeight: "600" }}>
              {userInfo.username || "John Doe"}
            </div>
            <div style={{ fontSize: "11px", color: theme.textSoft }}>
              {userInfo.email || "Guest User"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
///deepseak