// src/pages/Summarizer.jsx

import React, { useState } from "react";
import SummarizerTab from "../components/SummarizerTab";

export default function Summarizer() {
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSummarize = async () => {
    if (!text.trim()) {
      alert("Enter text first");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/summarizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      setSummary(data.summary);
    } catch (error) {
      console.log("Error summarizing:", error);
      alert("Summarizer failed");
    }

    setLoading(false);
  };

  return (
    <div className="p-4 h-full flex flex-col">
      <h1 className="text-2xl font-semibold mb-4">AI Summarizer</h1>

      <SummarizerTab text={text} setText={setText} />

      <button
        onClick={handleSummarize}
        className="mt-4 bg-blue-600 text-white py-2 rounded-lg"
      >
        {loading ? "Summarizing..." : "Summarize"}
      </button>

      {summary && (
        <div className="mt-6 p-3 bg-gray-100 rounded-lg">
          <h2 className="font-semibold mb-2">Summary:</h2>
          <p>{summary}</p>
        </div>
      )}
    </div>
  );
}
