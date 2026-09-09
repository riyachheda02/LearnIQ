// server/routes/geminiRoutes.js - UPDATED FOR MULTI-FILE SUPPORT
import express from "express";
import axios from "axios";
import path from "path";

const router = express.Router();

// Helper to get MIME type from filename
function getMimeTypeFromFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    
  };
  return mimeMap[ext] || 'application/octet-stream';
}

router.post("/vision", async (req, res) => {
  try {
    const { fileUrl, prompt, fileName = "file" } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ error: "Missing file URL" });
    }

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_KEY) {
      console.error("❌ GEMINI_API_KEY not found in environment");
      return res.status(500).json({ error: "Gemini API key not configured" });
    }

    const ext = path.extname(fileName).toLowerCase();
    const mimeType = getMimeTypeFromFilename(fileName);
    
    console.log(`🤖 Processing ${ext.toUpperCase()} for Gemini: ${fileName}`);
    console.log(`📄 MIME type: ${mimeType}`);
    
    // Download file and convert to base64
    const fileResponse = await axios({
      url: fileUrl,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 60000
    });
    
    const fileBase64 = Buffer.from(fileResponse.data, 'binary').toString('base64');
    console.log(`✅ Downloaded file, size: ${fileBase64.length} chars base64`);
    
    // Prepare request
    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt || `Analyze this ${ext === '.pdf' ? 'PDF document' : 'image'} in detail.` },
            {
              inline_data: {
                mime_type: mimeType,
                data: fileBase64
              }
            }
          ]
        }
      ]
    };

    const MODEL_NAME = "gemini-3.1-flash-lite";
    console.log(`📤 Sending to Gemini model: ${MODEL_NAME}`);
    
    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_KEY}`,
      requestBody,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000
      }
    );

    const output =
      geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      `Could not analyze the ${ext === '.pdf' ? 'PDF' : 'image'}.`;

    console.log(`✅ ${ext.toUpperCase()} analysis successful (${output.length} chars)`);
    res.json({ output });
  } catch (err) {
    console.error("❌ Gemini Vision failed:", err.message);
    console.error("Full error:", err.response?.data || "No response data");
    
    res.status(500).json({ 
      error: "Gemini analysis error", 
      message: err.message
    });
  }
});

export default router;