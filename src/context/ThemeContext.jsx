//src/context/ThemeContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import theme from "../constant/theme";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem("theme-mode");
    if (saved) return saved;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return systemPrefersDark ? "dark" : "light";
  });

  // Apply theme to HTML body + save in localStorage
  useEffect(() => {
    document.body.style.background = theme[mode].background;
    localStorage.setItem("theme-mode", mode);
  }, [mode]);

  const toggleTheme = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setMode, theme: theme[mode] }}>
      {children}
    </ThemeContext.Provider>
  );
};

// custom hook
export const useTheme = () => useContext(ThemeContext);
