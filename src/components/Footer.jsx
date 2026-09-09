import React from "react";
import { useTheme } from "../context/ThemeContext";

export default function Footer() {
  const { theme } = useTheme();
  return (
    <div style={{ marginTop: 24, padding: 16, borderTop: `1px solid ${theme.border}`, color: theme.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>© {new Date().getFullYear()} FocusForge</div>
      <div style={{ display: 'flex', gap: 12 }}>
        <a href="#" style={{ color: theme.textSecondary, textDecoration: 'none' }}>Privacy</a>
        <a href="#" style={{ color: theme.textSecondary, textDecoration: 'none' }}>Terms</a>
        <a href="#" style={{ color: theme.textSecondary, textDecoration: 'none' }}>Support</a>
      </div>
    </div>
  );
}
