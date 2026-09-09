// src/components/Layout.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import { Outlet } from "react-router-dom";

const SIDEBAR_WIDTH = 250; // adjust to match your design

export default function Layout() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return (
    <div style={{ display: "flex" }}>
      {/* FIXED SIDEBAR: spans full viewport (top:0 bottom:0) and is fully visible */}
      <div
        style={{
          width: isMobile ? 0 : SIDEBAR_WIDTH,
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          // no overflow on sidebar so it stays fully visible
          overflow: "visible",
          zIndex: 50, // above page content if needed
          boxSizing: "border-box",
        }}
      >
        <Sidebar />
      </div>

      {/* PAGE CONTENT: leaves room for sidebar and is the only scrollable area */}
      <main
        style={{
          marginLeft: isMobile ? 0 : SIDEBAR_WIDTH,
          flex: 1,
          minHeight: "100vh",
          overflowY: "auto", // only the content scrolls
          WebkitOverflowScrolling: "touch",
          padding: 24,
        }}
      >
        <Outlet />
        <Footer />
      </main>
    </div>
  );
}