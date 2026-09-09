import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { mode, toggleTheme, theme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="px-4 py-2 rounded-lg text-sm font-semibold transition"
      style={{
        background: theme.gradientPrimary,
        color: theme.textPrimary,
      }}
    >
      {mode === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
    </button>
  );
}
