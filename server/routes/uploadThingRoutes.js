// server/routes/uploadThingRoutes.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { uploadToUploadThing } from "../utils/uploadToUploadThing.js";

const router = express.Router();

// Create temp directory
const tempDir = path.join(process.cwd(), "server", "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uploadThingToken: !!process.env.UPLOADTHING_TOKEN ? "Configured" : "Not configured",
    tempDir: tempDir,
    uploadsDir: path.join(process.cwd(), "server", "uploads")
  });
});

// Main upload endpoint
router.post("/", upload.single("file"), async (req, res) => {
  console.log("📤 Upload request received");
  
  try {
    if (!req.file) {
      console.log("❌ No file in request");
      return res.status(400).json({ 
        success: false,
        error: "No file received" 
      });
    }

    console.log("✅ File details:", {
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    // Upload the file
    const result = await uploadToUploadThing(
      req.file.path,
      req.file.originalname,
      req.file.mimetype
    );

    // Clean up temp file
    try {
      fs.unlinkSync(req.file.path);
      console.log("🧹 Temporary file cleaned up");
    } catch (cleanupError) {
      console.warn("⚠️ Could not delete temp file:", cleanupError.message);
    }

    console.log("✅ Upload successful:", result[0]);

    // Return response
    return res.json({
      success: true,
      fileUrl: result[0].url,
      fileKey: result[0].key,
      name: result[0].name,
      type: result[0].type,
      size: result[0].size || req.file.size,
      ufsUrl: result[0].url,
      url: result[0].url
    });
    
  } catch (error) {
    console.error("❌ Upload error:", error.message);
    
    // Clean up temp file
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }
    
    return res.status(500).json({ 
      success: false,
      error: "Upload failed",
      message: error.message
    });
  }
});

export default router;