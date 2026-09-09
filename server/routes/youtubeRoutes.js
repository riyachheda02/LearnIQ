// server/routes/youtubeRoutes.js
import express from "express";
import { fetchYouTubeVideo } from "../utils/youtubeApi.js";

const router = express.Router();

router.post("/search", async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query?.trim()) {
      return res.status(400).json({ error: "Search query required" });
    }

    const result = await fetchYouTubeVideo(query);
    res.json({ success: true, result });
  } catch (error) {
    console.error("YouTube route error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;