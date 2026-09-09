  // server/routes/topicCurriculumRoute.js
// AI Topic Curriculum Generator
// Uses plain-text Gemini output (no JSON) + YouTube API + Google Books API
import express from "express";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_SCHEDULE_KEY || process.env.GEMINI_API_KEY
);

// ── Parse one level's plain-text block ──────────────────────────────────────
function parseLevelBlock(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const result = {
    duration: "",
    description: "",
    topics: [],
    youtubeQueries: [],
    referenceLinks: [],
    booksQuery: "",
  };
  let section = null;

  for (const line of lines) {
    if (line.startsWith("DURATION:")) {
      result.duration = line.replace("DURATION:", "").trim();
      continue;
    }
    if (line.startsWith("DESCRIPTION:")) {
      result.description = line.replace("DESCRIPTION:", "").trim();
      continue;
    }
    if (line.startsWith("BOOKS_QUERY:")) {
      result.booksQuery = line.replace("BOOKS_QUERY:", "").trim();
      continue;
    }
    if (line === "TOPICS:") { section = "topics"; continue; }
    if (line === "YOUTUBE:") { section = "youtube"; continue; }
    if (line === "LINKS:") { section = "links"; continue; }

    if (!line.startsWith("-")) continue;
    const item = line.replace(/^-\s*/, "").trim();
    if (!item) continue;

    if (section === "topics") {
      const [title, desc] = item.split("::").map((s) => s.trim());
      const hoursMatch = (desc || "").match(/(\d+)\s*h/i);
      result.topics.push({
        title: title || item,
        description: (desc || "").replace(/\(estimated.*?\)/i, "").trim(),
        estimatedHours: hoursMatch ? parseInt(hoursMatch[1]) : null,
      });
    } else if (section === "youtube") {
      if (item) result.youtubeQueries.push(item);
    } else if (section === "links") {
      const parts = item.split("|").map((s) => s.trim());
      if (parts.length >= 2 && parts[1].startsWith("http")) {
        result.referenceLinks.push({
          title: parts[0],
          url: parts[1],
          type: parts[2] || "resource",
        });
      }
    }
  }
  return result;
}

// ── Split raw text into per-level blocks ────────────────────────────────────
function splitIntoLevels(text) {
  const keys = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
  const out = {};
  for (let i = 0; i < keys.length; i++) {
    const marker = "##" + keys[i] + "##";
    const nextMarker = i < keys.length - 1 ? "##" + keys[i + 1] + "##" : null;
    const start = text.indexOf(marker);
    if (start === -1) continue;
    const contentStart = start + marker.length;
    const end = nextMarker ? text.indexOf(nextMarker) : text.length;
    out[keys[i]] = parseLevelBlock(text.substring(contentStart, end !== -1 ? end : text.length));
  }
  return out;
}

// ── YouTube API ─────────────────────────────────────────────────────────────
async function fetchYouTubeVideos(queries, topicName) {
  const key = process.env.YOUTUBE_API_KEY;
  // Always provide search-link fallbacks
  const fallback = queries.map((q) => ({
    title: q,
    url: "https://www.youtube.com/results?search_query=" + encodeURIComponent(q + " " + topicName),
    query: q,
    isSearch: true,
  }));

  if (!key || !queries.length) return fallback;

  try {
    const primaryQuery = queries[0];
    const r = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        part: "snippet",
        q: primaryQuery + " " + topicName,
        type: "video",
        maxResults: 3,
        key,
        safeSearch: "strict",
        order: "relevance",
      },
      timeout: 8000,
    });

    const videos = (r.data.items || []).map((item) => ({
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      url: "https://www.youtube.com/watch?v=" + item.id.videoId,
      thumbnail: item.snippet.thumbnails?.default?.url || "",
      query: primaryQuery,
      isSearch: false,
    }));

    // Append search links for extra queries
    const extras = queries.slice(1).map((q) => ({
      title: "Search: " + q,
      url: "https://www.youtube.com/results?search_query=" + encodeURIComponent(q + " " + topicName),
      query: q,
      isSearch: true,
    }));

    return videos.length ? [...videos, ...extras] : fallback;
  } catch (err) {
    console.warn("YouTube API warn:", err.message, "— using search fallback");
    return fallback;
  }
}

// ── Google Books API ─────────────────────────────────────────────────────────
async function fetchGoogleBooks(booksQuery) {
  const key = process.env.BOOKS_API_KEY;
  if (!key || !booksQuery) return [];
  try {
    const r = await axios.get("https://www.googleapis.com/books/v1/volumes", {
      params: { q: booksQuery, maxResults: 3, key, langRestrict: "en", orderBy: "relevance" },
      timeout: 8000,
    });
    return (r.data.items || []).map((item) => {
      const v = item.volumeInfo;
      return {
        title: v.title || "Untitled",
        author: (v.authors || ["Unknown"]).join(", "),
        description: (v.description || "").substring(0, 200).trim(),
        previewLink: v.previewLink || "",
        thumbnail: (v.imageLinks?.thumbnail || "").replace("http://", "https://"),
        publishedDate: v.publishedDate || "",
      };
    });
  } catch (err) {
    console.warn("Books API warn:", err.message);
    return [];
  }
}

// ── Main Route ───────────────────────────────────────────────────────────────
router.post("/generate-topic-schedule", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic || !topic.trim()) {
      return res.status(400).json({ success: false, error: "Topic is required" });
    }
    const topicName = topic.trim();
    console.log("\n📚 Generating topic schedule for:", topicName);

    // 1. Build a PLAIN TEXT prompt (no JSON — eliminates all emoji/parse errors)
    const prompt =
      "You are an expert educational curriculum designer.\n" +
      "Create a detailed learning curriculum for: " + topicName + "\n\n" +
      "Use EXACTLY this format. Do not deviate. Do not add markdown, bold text, or emoji.\n\n" +
      "##BEGINNER##\n" +
      "DURATION: X-Y weeks\n" +
      "DESCRIPTION: One sentence about what the learner achieves.\n" +
      "TOPICS:\n" +
      "- Topic Title :: Brief description (estimated Xh)\n" +
      "- Topic Title :: Brief description (estimated Xh)\n" +
      "(List 6-8 topics specific to " + topicName + ")\n" +
      "YOUTUBE:\n" +
      "- " + topicName + " beginner tutorial full course 2024\n" +
      "- Learn " + topicName + " from scratch for beginners\n" +
      "- " + topicName + " crash course beginners\n" +
      "LINKS:\n" +
      "- Site Name | https://real-url.com | documentation\n" +
      "- Site Name | https://real-url.com | tutorial\n" +
      "- Site Name | https://real-url.com | course\n" +
      "BOOKS_QUERY: " + topicName + " beginners introduction programming\n" +
      "##INTERMEDIATE##\n" +
      "DURATION: X-Y weeks\n" +
      "DESCRIPTION: One sentence.\n" +
      "TOPICS:\n" +
      "- Topic Title :: Brief description (estimated Xh)\n" +
      "(6-8 topics)\n" +
      "YOUTUBE:\n" +
      "- " + topicName + " intermediate tutorial 2024\n" +
      "- " + topicName + " advanced concepts explained\n" +
      "- " + topicName + " project tutorial intermediate\n" +
      "LINKS:\n" +
      "- Site Name | https://real-url.com | documentation\n" +
      "- Site Name | https://real-url.com | tutorial\n" +
      "- Site Name | https://real-url.com | course\n" +
      "BOOKS_QUERY: " + topicName + " intermediate practical guide\n" +
      "##ADVANCED##\n" +
      "DURATION: X-Y weeks\n" +
      "DESCRIPTION: One sentence.\n" +
      "TOPICS:\n" +
      "- Topic Title :: Brief description (estimated Xh)\n" +
      "(6-8 topics)\n" +
      "YOUTUBE:\n" +
      "- " + topicName + " advanced tutorial expert 2024\n" +
      "- " + topicName + " system design architecture\n" +
      "- " + topicName + " advanced projects real world\n" +
      "LINKS:\n" +
      "- Site Name | https://real-url.com | documentation\n" +
      "- Site Name | https://real-url.com | tutorial\n" +
      "- Site Name | https://real-url.com | course\n" +
      "BOOKS_QUERY: " + topicName + " advanced expert mastery\n\n" +
      "IMPORTANT:\n" +
      "1. Use REAL well-known URLs only (docs.python.org, developer.mozilla.org, reactjs.org, w3schools.com, geeksforgeeks.org, freecodecamp.org, etc.)\n" +
      "2. Make topics HIGHLY SPECIFIC to " + topicName + " — not generic\n" +
      "3. NO emoji, NO special symbols, NO markdown formatting\n" +
      "4. Follow the template structure EXACTLY";

    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: { maxOutputTokens: 4000, temperature: 0.35 },
    });

    console.log("📡 Calling Gemini (plain-text mode)...");
    const geminiResult = await model.generateContent(prompt);
    const rawText = geminiResult.response.text();
    console.log("✅ Gemini response received, length:", rawText.length);

    // 2. Parse plain text — no JSON parsing at all
    const parsedLevels = splitIntoLevels(rawText);
    const levelKeys = Object.keys(parsedLevels);
    console.log("✅ Parsed levels:", levelKeys);

    if (levelKeys.length === 0) {
      throw new Error("Could not parse any levels from AI response. Please try again.");
    }

    // 3. Fetch YouTube + Books for each level in parallel
    const levelConfig = [
      { key: "BEGINNER",     label: "Beginner",     emoji: "\uD83C\uDF31", color: "#10B981", defaultDuration: "4-6 weeks" },
      { key: "INTERMEDIATE", label: "Intermediate",  emoji: "\u26A1",       color: "#F59E0B", defaultDuration: "6-8 weeks" },
      { key: "ADVANCED",     label: "Advanced",      emoji: "\uD83D\uDE80", color: "#8B5CF6", defaultDuration: "8-12 weeks" },
    ];

    const levels = await Promise.all(
      levelConfig.map(async (cfg) => {
        const data = parsedLevels[cfg.key] || {
          duration: cfg.defaultDuration, description: "",
          topics: [], youtubeQueries: [], referenceLinks: [], booksQuery: "",
        };

        const ytQueries = data.youtubeQueries.length
          ? data.youtubeQueries
          : [topicName + " " + cfg.label.toLowerCase() + " tutorial 2024"];

        const bq = data.booksQuery || topicName + " " + cfg.label.toLowerCase();

        const [youtubeLinks, books] = await Promise.all([
          fetchYouTubeVideos(ytQueries, topicName),
          fetchGoogleBooks(bq),
        ]);

        return {
          level: cfg.label,
          emoji: cfg.emoji,
          color: cfg.color,
          duration: data.duration || cfg.defaultDuration,
          description: data.description || "Master " + cfg.label.toLowerCase() + " concepts in " + topicName + ".",
          topics: data.topics,
          youtubeLinks,
          referenceLinks: data.referenceLinks,
          books,
        };
      })
    );

    const curriculum = {
      topic: topicName,
      description:
        "A complete learning roadmap for " + topicName + " from beginner to advanced, with real resources.",
      totalDuration: "3-6 months",
      levels,
    };

    console.log("✅ Curriculum complete. Sending response.");
    res.json({ success: true, curriculum, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("❌ /generate-topic-schedule error:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to generate curriculum",
      message: error.message,
    });
  }
});

export default router;
