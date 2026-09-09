import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";  // <-- add this

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>      {/* 🔥 Wrap everything inside AuthProvider */}
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
);
