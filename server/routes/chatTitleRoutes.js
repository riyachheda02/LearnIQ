// server/routes/chatTitleRoutes.js
import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/chat/title
 * Body: { userMessage: string, assistantText: string }
 * Returns: { title: "Short Title..." }
 */
router.post("/", async (req, res) => {
  try {
    const { userMessage = "", assistantText = "" } = req.body || {};

    if (!userMessage && !assistantText) {
      return res.status(400).json({ error: "Provide userMessage or assistantText" });
    }

    // Prompt instructs the model to output a concise 3-6 word title
    const prompt = `
You are a helpful assistant that generates a concise chat title (3-6 words) summarizing the user's request and the assistant response.
Output ONLY the short title (no punctuation at the end).
User message: "${userMessage}"
Assistant response (short excerpt): "${assistantText.slice(0, 800)}"
Return a crisp title suitable for a chat sidebar.
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "You create short chat titles (3-6 words)." },
        { role: "user", content: prompt },
      ],
      temperature: 0.0,
      max_tokens: 12,
    });

    let title = completion?.choices?.[0]?.message?.content || "";
    title = title.replace(/[\r\n]+/g, " ").trim();
    // Safety fallback
    if (!title) title = userMessage.slice(0, 30) || "New Chat";

    return res.json({ title });
  } catch (err) {
    console.error("Title generation error:", err);
    return res.status(500).json({ error: err.message || "Title generation failed" });
  }
});

export default router;
