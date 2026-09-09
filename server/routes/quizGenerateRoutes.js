// server/routes/quizGenerateRoutes.js
// Dedicated quiz question generation endpoint - uses Gemini JSON mode for reliable output
import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// Validate and clean a single question object
function validateQuestion(q) {
  if (!q || typeof q !== "object") return null;
  if (!q.question || typeof q.question !== "string" || q.question.trim().length < 5) return null;
  if (!Array.isArray(q.options) || q.options.length < 2) return null;
  if (typeof q.correctIndex !== "number") return null;

  // Normalise to exactly 4 options
  const options = q.options.map((o) => String(o).trim()).filter(Boolean);
  while (options.length < 4) options.push(`Option ${options.length + 1}`);
  const finalOptions = options.slice(0, 4);

  const correctIndex = Math.max(0, Math.min(3, Math.floor(q.correctIndex)));

  return {
    question: q.question.trim(),
    options: finalOptions,
    correctIndex,
    explanation: q.explanation ? String(q.explanation).trim() : `The correct answer is "${finalOptions[correctIndex]}".`,
    type: "mcq",
  };
}

// Try to parse questions from any text/JSON response
function parseQuestions(raw) {
  if (typeof raw !== "string") return null;

  // First: try direct JSON.parse
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions;
  } catch (_) {}

  // Second: extract JSON array from markdown / prose
  const arrayMatch = raw.match(/\[[\s\S]*?\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }

  return null;
}

// POST /api/quiz/generate
router.post("/generate", async (req, res) => {
  const { topic, difficulty = "medium", questionCount = 5 } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: "Topic is required" });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: "AI service not configured" });
  }

  const count = Math.min(Math.max(parseInt(questionCount) || 5, 1), 20);
  const safeTopic = topic.trim();

  const prompt = `Generate exactly ${count} multiple choice quiz questions about "${safeTopic}".

Difficulty: ${difficulty}
- easy: basic recall and simple facts
- medium: understanding and applying concepts
- hard: analysis, synthesis, and deep knowledge

Rules:
- EVERY question must specifically be about "${safeTopic}"
- Each question must have EXACTLY 4 answer options labelled in the options array
- Only ONE option is correct; set correctIndex to 0, 1, 2, or 3 (zero-based)
- Questions should cover DIFFERENT aspects of the topic
- Keep questions clear and unambiguous
- Provide a brief explanation (1-2 sentences) of why the correct answer is right

Return ONLY a valid JSON array. Example format:
[
  {
    "question": "What is ...?",
    "options": ["A", "B", "C", "D"],
    "correctIndex": 2,
    "explanation": "C is correct because...",
    "type": "mcq"
  }
]`;

  const requestBody = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            question: { type: "STRING" },
            options: { type: "ARRAY", items: { type: "STRING" } },
            correctIndex: { type: "INTEGER" },
            explanation: { type: "STRING" },
            type: { type: "STRING" },
          },
          required: ["question", "options", "correctIndex", "explanation", "type"],
        },
      },
    },
  };

  // Try models in order — prefer 2.0-flash (best structured output support)
  const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash","gemini-3.1-flash-lite"];

  for (const model of models) {
    try {
      console.log(`🎯 Quiz Gen [${model}] — topic: "${safeTopic}", count: ${count}`);

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        requestBody,
        { timeout: 60000, headers: { "Content-Type": "application/json" } }
      );

      const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error("Empty response from model");

      const parsed = parseQuestions(rawText);
      if (!parsed) throw new Error("Could not parse JSON from model response");

      const valid = parsed
        .map(validateQuestion)
        .filter(Boolean)
        .slice(0, count);

      if (valid.length === 0) throw new Error("No valid questions in response");

      console.log(`✅ Quiz Gen success — ${valid.length} questions via ${model}`);
      return res.json({ success: true, questions: valid, model });

    } catch (err) {
      console.error(`❌ Quiz Gen [${model}] failed: ${err.message}`);
      if (err.response?.data) {
        console.error("API error:", JSON.stringify(err.response.data).slice(0, 400));
      }
      // Continue to next model
    }
  }

  // All models failed
  return res.status(500).json({
    error: `Could not generate quiz questions for "${safeTopic}". Please check your API key or try again.`,
  });
});

export default router;
