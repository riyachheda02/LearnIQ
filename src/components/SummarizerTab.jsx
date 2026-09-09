// src/components/SummarizerTab.jsx
import React, { useState } from "react";
import axios from "axios";

export default function SummarizerTab({ apiMode }) {
  const [summary, setSummary] = useState("");
  const [file, setFile] = useState(null);

  const handleSummarize = async () => {
    const form = new FormData();

    if (apiMode === "user-key") {
      form.append("file", file);
    } else {
      form.append("fileId", file.fileId); // from folders
    }

    const res = await axios.post("http://localhost:5000/api/summarizer", form);
    setSummary(res.data.summary);
  };

  return (
    <div className="p-4">
      {/* File source */}
      <div className="mb-3">
        {apiMode === "user-key" ? (
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        ) : (
          <button className="btn"
            onClick={() => {/* open folders modal */}}>
            Choose From Folders
          </button>
        )}
      </div>

      <button className="btn-primary" onClick={handleSummarize}>
        Generate Summary
      </button>

      <div className="mt-4 p-3 bg-gray-100 rounded">
        {summary}
      </div>
    </div>
  );
}
