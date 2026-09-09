// src/components/AttachmentPreview.jsx
import React from "react";

export default function AttachmentPreview({ att, removeAttachment }) {
  if (!att) return null;

  const isImage =
    att.type?.startsWith("image") ||
    /\.(png|jpe?g|gif|webp)$/i.test(att.ufsUrl || att.url || "");
  const isAudio =
    att.type?.startsWith("audio") ||
    /\.(mp3|wav|webm|ogg)$/i.test(att.ufsUrl || att.url || "");
  const isDoc =
    /\.(pdf|docx|doc)$/i.test(att.ufsUrl || att.url || "") ||
    att.type === "application/pdf" ||
    att.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const fileUrl = att.ufsUrl || att.url;

  return (
    <div className="relative w-28 h-28 border rounded-lg overflow-hidden bg-white flex items-center justify-center p-1">
      {isImage && (
        <img src={fileUrl} alt={att.name} className="w-full h-full object-cover" />
      )}

      {isAudio && (
        <audio
          src={fileUrl}
          controls
          className="w-full h-10"
        />
      )}

      {isDoc && (
        <div className="flex flex-col items-center justify-center text-xs p-2 cursor-pointer hover:bg-gray-100 rounded">
          <div className="text-2xl mb-1">📄</div>
          <div className="truncate text-center w-full">{att.name || "Document"}</div>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0"
          />
        </div>
      )}

      {!isImage && !isAudio && !isDoc && (
        <div className="text-xs">{att.name || "file"}</div>
      )}

      {removeAttachment && (
        <button
          onClick={() => removeAttachment(att)}
          className="absolute top-1 right-1 bg-red-500 text-white text-xs px-1 rounded hover:bg-red-600"
        >
          ✕
        </button>
      )}
    </div>
  );
}
