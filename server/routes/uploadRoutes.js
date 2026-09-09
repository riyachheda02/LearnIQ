// server/routes/uploadRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// base uploads directory
const UPLOAD_BASE = path.join(process.cwd(), "uploads");

// ensure base exists
if (!fs.existsSync(UPLOAD_BASE)) fs.mkdirSync(UPLOAD_BASE, { recursive: true });

// choose folder by mimetype
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = path.join(UPLOAD_BASE, "files");
    const mimetype = file.mimetype || "";

    if (mimetype.startsWith("image/")) folder = path.join(UPLOAD_BASE, "images");
    else if (mimetype.includes("pdf") || mimetype.includes("msword") || mimetype.includes("officedocument")) folder = path.join(UPLOAD_BASE, "docs");
    else if (mimetype.startsWith("audio/")) folder = path.join(UPLOAD_BASE, "audio");

    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// POST /api/upload
// form field: 'file'
router.post("/", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // return a public URL that points to /uploads/<...>
    // req.file.path is absolute or relative depending on multer; we derive URL path from "uploads/..."
    const filePath = path.relative(process.cwd(), req.file.path).split(path.sep).join("/");
    const fileUrl = `${req.protocol}://${req.get("host")}/${filePath}`;

    return res.json({
      success: true,
      fileUrl,
      originalName: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

export default router;
