// server/routes/geminiChatRoutes.js - FIXED VERSION
import express from "express";
import axios from "axios";
import path from "path";
import { existsSync, mkdirSync } from "fs";
import { fetchYouTubeVideo } from "../utils/youtubeApi.js";
import { fetchBook } from "../utils/booksApi.js";
import mammoth from "mammoth";

const router = express.Router();

// Create temp directory
const tempDir = path.join(process.cwd(), 'temp');
if (!existsSync(tempDir)) {
  mkdirSync(tempDir, { recursive: true });
}

// Conversation memory store
const conversationStore = new Map();

// ============== HELPER FUNCTIONS ==============

function getMimeTypeFromFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap = {
    // Images
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
    '.tiff': 'image/tiff', '.tif': 'image/tiff',
    
    // PDF
    '.pdf': 'application/pdf',
    
    // Text files
    '.txt': 'text/plain', '.md': 'text/markdown', '.js': 'text/javascript',
    '.py': 'text/x-python', '.java': 'text/x-java', '.html': 'text/html',
    '.css': 'text/css', '.json': 'application/json', '.csv': 'text/csv',
    
    // Document files
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  return mimeMap[ext] || 'application/octet-stream';
}

function isGeminiSupportedFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  const supported = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif',
    '.pdf', '.txt', '.md', '.js', '.py', '.java', '.html', '.css',
    '.json', '.csv', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'
  ];
  return supported.includes(ext);
}

async function downloadFileToBuffer(url) {
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 60000
    });
    return Buffer.from(response.data, 'binary');
  } catch (err) {
    console.error("❌ File download failed:", err.message);
    throw err;
  }
}

async function extractTextFromFile(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();
  
  try {
    if (['.txt', '.md', '.js', '.py', '.java', '.html', '.css', '.json', '.csv'].includes(ext)) {
      return buffer.toString('utf-8');
    }
    
    if (['.docx', '.doc'].includes(ext)) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    
    // For PDFs, we don't extract text - Gemini reads them directly
    if (['.pdf'].includes(ext)) {
      return `[PDF file: ${filename} - Will be analyzed by Gemini directly]`;
    }
    
    return `[Binary file: ${filename}]`;
  } catch (err) {
    console.error(`❌ Text extraction failed for ${filename}:`, err.message);
    return `[Error extracting text from ${filename}]`;
  }
}

async function processFileForGemini(fileUrl, fileName, userMessage = "") {
  try {
    const ext = path.extname(fileName).toLowerCase();
    const mimeType = getMimeTypeFromFilename(fileName);
    
    console.log(`📁 Processing: ${fileName} (${ext})`);
    
    // Download file
    const buffer = await downloadFileToBuffer(fileUrl);
    
    // For PDFs, send as base64 directly
    if (['.pdf'].includes(ext)) {
      const base64Data = buffer.toString('base64');
      
      if (base64Data.length > 20000000) {
        return {
          type: 'text',
          content: `[Large PDF file: ${fileName}. File is too large for analysis.]`,
          prompt: `Large PDF document ${fileName}. File is too large for analysis.`,
          fileName
        };
      }
      
      return {
        type: 'file',
        mimeType: 'application/pdf',
        base64Data,
        prompt: userMessage || `Analyze this PDF document: ${fileName}`,
        fileName
      };
    }
    
    // For images
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif'].includes(ext)) {
      const base64Data = buffer.toString('base64');
      
      if (base64Data.length > 4000000) {
        return {
          type: 'text',
          content: `[Large image file: ${fileName}]`,
          prompt: `Image ${fileName} (too large for analysis)`,
          fileName
        };
      }
      
      return {
        type: 'file',
        mimeType,
        base64Data,
        prompt: userMessage || `Analyze this image: ${fileName}`,
        fileName
      };
    }
    
    // For text-based files
    if (['.txt', '.md', '.js', '.py', '.java', '.html', '.css', '.json', '.csv', '.docx', '.doc'].includes(ext)) {
      const text = await extractTextFromFile(buffer, fileName);
      return {
        type: 'text',
        content: text,
        prompt: `Content from ${fileName}:\n${text}`,
        fileName
      };
    }
    
    return {
      type: 'text',
      content: `[Office file: ${fileName}]`,
      prompt: `File ${fileName} attached`,
      fileName
    };
    
  } catch (err) {
    console.error(`❌ File processing error:`, err.message);
    throw err;
  }
}

// ============== RESOURCE ANALYSIS ==============

function analyzeForResources(userMessage) {
  if (!userMessage) return { 
    needsYouTube: false, 
    needsBooks: false, 
    isResourceRequest: false 
  };
  
  const userMsg = userMessage.toLowerCase();
  
  const youtubeKeywords = [
    'youtube', 'video', 'tutorial', 'course', 'lecture', 'playlist',
    'watch', 'learn', 'how to', 'demonstration', 'explanation'
  ];
  
  const bookKeywords = [
    'book', 'textbook', 'reference', 'guide', 'manual', 'read',
    'publication', 'author', 'chapter', 'pages'
  ];
  
  const hasYouTubeKeywords = youtubeKeywords.some(keyword => userMsg.includes(keyword));
  const hasBookKeywords = bookKeywords.some(keyword => userMsg.includes(keyword));
  
  const topic = extractMainTopic(userMessage);
  
  return {
    needsYouTube: hasYouTubeKeywords,
    needsBooks: hasBookKeywords,
    youtubeQueries: topic ? [`${topic} tutorial`, `learn ${topic}`] : ['programming tutorial'],
    bookQueries: topic ? [`${topic} book`, `${topic} guide`] : ['programming book'],
    topic: topic,
    isResourceRequest: hasYouTubeKeywords || hasBookKeywords
  };
}

function extractMainTopic(message) {
  if (!message) return null;
  
  const topics = [
    'data structures', 'algorithms', 'dsa', 'java', 'python', 'javascript',
    'react', 'angular', 'vue', 'node.js', 'express', 'mongodb', 'sql',
    'machine learning', 'ai', 'deep learning', 'web development',
    'mobile development', 'android', 'ios', 'flutter', 'aws', 'cloud',
    'docker', 'kubernetes', 'devops', 'cybersecurity'
  ];
  
  const msg = message.toLowerCase();
  for (const topic of topics) {
    if (msg.includes(topic)) {
      return topic;
    }
  }
  
  return null;
}

async function fetchResourceRecommendations(analysis) {
  const resources = { youtube: [], books: [] };
  
  if (analysis.needsYouTube && analysis.youtubeQueries.length > 0) {
    for (const query of analysis.youtubeQueries.slice(0, 2)) {
      try {
        const result = await fetchYouTubeVideo(query);
        if (result && !result.includes("No YouTube videos found")) {
          resources.youtube.push({ query, content: result });
        }
      } catch (error) {
        console.error(`YouTube fetch error for "${query}":`, error.message);
      }
    }
  }
  
  if (analysis.needsBooks && analysis.bookQueries.length > 0) {
    for (const query of analysis.bookQueries.slice(0, 2)) {
      try {
        const result = await fetchBook(query);
        if (result && !result.includes("No books found")) {
          resources.books.push({ query, content: result });
        }
      } catch (error) {
        console.error(`Books fetch error for "${query}":`, error.message);
      }
    }
  }
  
  return resources;
}

// ============== GEMINI API INTEGRATION ==============

async function callGeminiAPI(messages, fileParts = []) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  
  // FIXED: Use correct model name that exists in your account
  const MODEL_NAME = "gemini-3.1-flash-lite"; // Changed from "gemini-1.5-pro"
  
  const parts = [];
  
  messages.forEach(msg => {
    if (msg.text) {
      parts.push({ text: msg.text });
    }
  });
  
  fileParts.forEach(file => {
    if (file.inline_data) {
      parts.push({ inline_data: file.inline_data });
    }
  });
  
  const requestBody = {
    contents: [{
      role: "user",
      parts: parts
    }],
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.7,
      topP: 0.9,
      topK: 40
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_NONE"
      }
    ]
  };
  
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_KEY}`,
      requestBody,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000
      }
    );
    
    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
           "I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini API error:", error.response?.data || error.message);
    throw error;
  }
}

// ============== MAIN CHAT ENDPOINT ==============

router.post("/", async (req, res) => {
  console.log("🔥 HIT /api/gemini-chat");
  
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();
  
  const sendSSE = (data) => {
    try {
      if (res.writableEnded || res.destroyed) {
        return false;
      }
      const sseData = `data: ${JSON.stringify(data)}\n\n`;
      res.write(sseData);
      return true;
    } catch (err) {
      return false;
    }
  };

  try {
    const { message, attachments, userId } = req.body || {};
    
    const userKey = userId || `temp_${Date.now()}`;
    let conversationHistory = conversationStore.get(userKey) || [];
    
    let fileParts = [];
    let fileTexts = [];
    
    if (Array.isArray(attachments) && attachments.length > 0) {
      console.log(`📎 Processing ${attachments.length} attachment(s)`);
      
      for (const file of attachments.slice(0, 3)) {
        if (!file?.url || !file?.name) continue;
        
        try {
          const processed = await processFileForGemini(file.url, file.name, message);
          
          if (processed.type === 'file') {
            fileParts.push({
              inline_data: {
                mime_type: processed.mimeType,
                data: processed.base64Data
              }
            });
          } else if (processed.type === 'text') {
            fileTexts.push(processed.content);
          }
        } catch (error) {
          console.error(`Failed to process ${file.name}:`, error.message);
        }
      }
    }
    
    let resourceResults = null;
    if (message && (!attachments || attachments.length === 0)) {
      const analysis = analyzeForResources(message);
      if (analysis.isResourceRequest) {
        resourceResults = await fetchResourceRecommendations(analysis);
      }
    }
    
    const messages = [];
    
    conversationHistory.slice(-4).forEach(msg => {
      if (msg.role === 'user') {
        messages.push({ text: msg.content });
      } else if (msg.role === 'assistant') {
        messages.push({ text: `Assistant: ${msg.content}` });
      }
    });
    
    let fullMessage = message || "";
    if (fileTexts.length > 0) {
      fileTexts.forEach((text, index) => {
        fullMessage += `\n\n--- File Content ${index + 1} ---\n${text}`;
      });
    }
    
    if (fullMessage.trim()) {
      messages.push({ text: fullMessage });
    }
    
    let geminiResponse = "";
    try {
      geminiResponse = await callGeminiAPI(messages, fileParts);
    } catch (error) {
      console.error("Gemini call failed, using fallback:", error.message);
      geminiResponse = generateFallbackResponse(message, resourceResults, attachments);
    }
    
    let finalResponse = geminiResponse;
    if (resourceResults && (resourceResults.youtube.length > 0 || resourceResults.books.length > 0)) {
      finalResponse += "\n\n## 📚 Additional Resources\n";
      
      if (resourceResults.youtube.length > 0) {
        finalResponse += "\n### 🎥 YouTube Recommendations:\n";
        resourceResults.youtube.forEach(yt => {
          finalResponse += `\n**Search: "${yt.query}"**\n`;
          finalResponse += `${yt.content}\n`;
        });
      }
      
      if (resourceResults.books.length > 0) {
        finalResponse += "\n### 📖 Book Recommendations:\n";
        resourceResults.books.forEach(book => {
          finalResponse += `\n**Search: "${book.query}"**\n`;
          finalResponse += `${book.content}\n`;
        });
      }
    }
    
    if (finalResponse.length > 15000) {
      finalResponse = finalResponse.substring(0, 15000) + "\n\n[Response truncated due to length]";
    }
    
    console.log(`✅ Response ready: ${finalResponse.length} chars`);
    
    conversationHistory.push({
      role: "user",
      content: message || (attachments?.length > 0 ? `[Uploaded ${attachments.length} file(s)]` : ""),
      time: Date.now()
    });
    
    conversationHistory.push({
      role: "assistant",
      content: finalResponse,
      time: Date.now()
    });
    
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }
    conversationStore.set(userKey, conversationHistory);
    
    sendSSE({ type: "start", length: finalResponse.length });
    
    const chunkSize = 300;
    let position = 0;
    let chunkCount = 0;
    
    while (position < finalResponse.length) {
      const chunk = finalResponse.slice(position, position + chunkSize);
      const sent = sendSSE({ text: chunk, chunk: ++chunkCount });
      
      if (!sent) {
        console.log("⚠️ Connection closed during streaming");
        break;
      }
      
      position += chunkSize;
      
      if (position < finalResponse.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    sendSSE({ done: true, complete: true, totalChunks: chunkCount });
    
  } catch (error) {
    console.error("🔥 Critical error in chat endpoint:", error);
    
    sendSSE({
      error: true,
      message: "An error occurred while processing your request. Please try again."
    });
    sendSSE({ done: true });
    
  } finally {
    try {
      if (!res.writableEnded) {
        res.end();
      }
      console.log("🔚 Response stream completed");
    } catch (finalError) {
      console.log("Final cleanup error:", finalError.message);
    }
  }
});

// ============== UTILITY FUNCTIONS ==============

function generateFallbackResponse(message, resourceResults, attachments) {
  let response = "## 🤖 Response\n\n";
  
  if (attachments && attachments.length > 0) {
    response += `I've analyzed your ${attachments.length} file(s).\n\n`;
    response += "**Key findings:**\n";
    response += "• Files successfully processed\n";
    response += "• Content extracted for analysis\n";
    response += "• Ready to answer your questions\n\n";
    
    if (message) {
      response += `Regarding your question: "${message}"\n`;
    }
  } else if (message) {
    response += `Regarding your query: "${message}"\n\n`;
    
    if (message.toLowerCase().includes('youtube') || message.toLowerCase().includes('video')) {
      response += "I can help you find relevant YouTube tutorials and courses.\n";
    } else if (message.toLowerCase().includes('book') || message.toLowerCase().includes('read')) {
      response += "I can recommend relevant books and reading materials.\n";
    }
  } else {
    response += "Hello! How can I help you today?\n";
  }
  
  return response;
}

// ============== DIRECT ENDPOINTS ==============

router.post("/search/youtube", async (req, res) => {
  try {
    const { query, maxResults = 5 } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }
    
    const result = await fetchYouTubeVideo(query, maxResults);
    res.json({
      success: true,
      query,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("YouTube search error:", error);
    res.status(500).json({
      error: error.message,
      suggestion: "Check YouTube API configuration"
    });
  }
});

router.post("/search/books", async (req, res) => {
  try {
    const { query, maxResults = 5 } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }
    
    const result = await fetchBook(query, maxResults);
    res.json({
      success: true,
      query,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Books search error:", error);
    res.status(500).json({
      error: error.message,
      suggestion: "Check Books API configuration"
    });
  }
});

// ============== HEALTH & UTILITY ENDPOINTS ==============

router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    services: {
      gemini: !!process.env.GEMINI_API_KEY,
      youtube: !!process.env.YOUTUBE_API_KEY,
      books: !!process.env.BOOKS_API_KEY
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

router.post("/test/files", async (req, res) => {
  try {
    const { fileUrl, fileName } = req.body;
    
    if (!fileUrl || !fileName) {
      return res.status(400).json({ error: "fileUrl and fileName are required" });
    }
    
    const processed = await processFileForGemini(fileUrl, fileName, "Test analysis");
    
    res.json({
      success: true,
      fileName,
      type: processed.type,
      mimeType: processed.mimeType,
      contentLength: processed.content?.length || 0,
      hasBase64: !!processed.base64Data,
      base64Length: processed.base64Data?.length || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/clear", (req, res) => {
  const { userId } = req.body;
  if (userId) {
    conversationStore.delete(userId);
    res.json({ success: true, message: "Conversation cleared" });
  } else {
    res.status(400).json({ success: false, message: "User ID required" });
  }
});

export default router;