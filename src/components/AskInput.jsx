// src/components/AskInput.jsx - SIMPLIFIED VERSION
import React, { useState, useRef } from "react";
import { Paperclip, Send, Mic } from "lucide-react";

export default function AskInput({ 
  value, 
  onChange, 
  onSend, 
  onAttachClick,
  isRecording,
  onStartRecording,
  onStopRecording,
  isSpeechSupported = true,
  placeholder = "Type your message...",
  theme = {},
  loading = false
}) {
  const textareaRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleSend = () => {
    if (value.trim() || onSend) {
      onSend();
    }
  };

  return (
    <div className="flex items-end gap-2">
      {/* Attachment Button */}
      <button
        onClick={onAttachClick}
        className="p-3 rounded-lg border flex-shrink-0 transition-all hover:bg-opacity-20"
        style={{
          backgroundColor: theme.card || "#fff",
          borderColor: theme.border || "#e5e7eb",
          color: theme.textSecondary || "#6b7280"
        }}
        title="Attach files"
        disabled={isRecording}
      >
        <Paperclip size={20} />
      </button>

      {/* Text Input Area */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "🎤 Listening..." : placeholder}
          className="w-full p-4 pr-12 rounded-lg border focus:outline-none resize-none transition-all"
          style={{
            backgroundColor: theme.card || "#fff",
            borderColor: theme.border || "#e5e7eb",
            color: theme.textPrimary || "#111827",
            minHeight: '60px'
          }}
          rows={2}
          disabled={isRecording}
        />

        {/* Voice Recording Button */}
        <div className="absolute right-2 bottom-2">
          {isRecording ? (
            <button
              onClick={onStopRecording}
              className="p-2 rounded-full animate-pulse flex items-center justify-center"
              style={{
                backgroundColor: '#EF4444',
                color: 'white',
                width: '40px',
                height: '40px'
              }}
              title="Stop recording"
            >
              <div className="w-3 h-3 bg-white rounded-full" />
            </button>
          ) : (
            <button
              onClick={onStartRecording}
              disabled={!isSpeechSupported}
              className="p-2 rounded-full transition-all hover:bg-opacity-30 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: `${theme.accent || '#3b82f6'}15`,
                color: isSpeechSupported ? (theme.accent || '#3b82f6') : (theme.textSecondary || '#6b7280'),
                width: '40px',
                height: '40px'
              }}
              title={isSpeechSupported ? "Start voice input" : "Voice input not supported"}
            >
              <Mic size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={loading || (!value?.trim() && !onSend) || isRecording}
        className="p-3 rounded-lg flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
        style={{
          background: theme.gradientPrimary || 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          color: 'white'
        }}
        title="Send message"
      >
        <Send size={20} />
      </button>
    </div>
  );
}