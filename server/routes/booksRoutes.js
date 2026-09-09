// server/routes/booksRoutes.js
import express from "express";
import { fetchBook } from "../utils/booksApi.js";

const router = express.Router();

router.post("/search", async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query?.trim()) {
      return res.status(400).json({ error: "Search query required" });
    }

    const result = await fetchBook(query);
    res.json({ success: true, result });
  } catch (error) {
    console.error("Books route error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;