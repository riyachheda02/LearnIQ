// src/components/TypingDots.jsx
import React from "react";

export default function TypingDots() {
  return (
    <div className="flex gap-1 items-center py-2">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300"></span>
    </div>
  );
}
