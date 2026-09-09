// server/routes/chatRoutes.js - UPDATED WITH YOUTUBE/BOOKS INTEGRATION
import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import path from "path";
import mammoth from "mammoth";
import AdmZip from "adm-zip";

dotenv.config();
const router = express.Router();

// Conversation memory
const conversationStore = new Map();

/* ----------------------------------------------------------
   HELPER FUNCTIONS
---------------------------------------------------------- */
function chunkText(text, size = 180) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function rand(min = 35, max = 90) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Get MIME type from filename
function getMimeTypeFromFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap = {
    // Images
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    
    // PDF
    '.pdf': 'application/pdf',
    
    // Text files
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.py': 'text/x-python',
    '.java': 'text/x-java',
    
    // Office documents
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel'
  };
  return mimeMap[ext] || 'application/octet-stream';
}

// Check if file can be sent as inline data to Gemini
function canSendAsInlineData(filename) {
  const ext = path.extname(filename).toLowerCase();
  const inlineSupported = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif',
    '.pdf'
  ];
  return inlineSupported.includes(ext);
}

// Extract text from .docx files
async function extractTextFromDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (mammothError) {
    console.log("Mammoth extraction failed, trying alternative...");
    
    try {
      const zip = new AdmZip(buffer);
      const xmlContent = zip.readAsText("word/document.xml");
      
      const text = xmlContent
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/&[a-z]+;/g, '')
        .trim();
      
      return text || "[Could not extract text from .docx]";
    } catch (zipError) {
      console.log("ZIP extraction failed:", zipError.message);
      return "[Could not extract text from .docx file]";
    }
  }
}

// Check if user is asking for videos or books
function detectResourceRequest(message) {
  if (!message) return { type: 'none', query: '' };
  
  const lowerMessage = message.toLowerCase();
  
  // Keywords for YouTube/videos
  const videoKeywords = [
    'video', 'youtube', 'watch', 'tutorial', 'explain', 'demonstration', 
    'link', 'videos', 'tutorials', 'lecture', 'course', 'learn'
  ];
  
  // Keywords for books
  const bookKeywords = [
    'book', 'books', 'read', 'textbook', 'reference', 'guide', 'manual',
    'pdf', 'ebook', 'publication', 'author', 'chapter'
  ];
  
  // Check for specific patterns
  const videoPatterns = [
    /(can you|please|could you|give me).*(video|youtube)/i,
    /(link.*to.*video)/i,
    /(watch.*about)/i,
    /(explain.*with.*video)/i
  ];
  
  const bookPatterns = [
    /(can you|please|could you|give me).*(book|read|textbook)/i,
    /(recommend.*book)/i,
    /(book.*about)/i,
    /(read.*about)/i
  ];
  
  // Check patterns first
  for (const pattern of videoPatterns) {
    if (pattern.test(message)) {
      const query = message.replace(pattern, '').trim();
      return { type: 'youtube', query: query || message };
    }
  }
  
  for (const pattern of bookPatterns) {
    if (pattern.test(message)) {
      const query = message.replace(pattern, '').trim();
      return { type: 'books', query: query || message };
    }
  }
  
  // Check keywords
  const hasVideo = videoKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasBook = bookKeywords.some(keyword => lowerMessage.includes(keyword));
  
  if (hasVideo && hasBook) {
    return { type: 'both', query: message };
  } else if (hasVideo) {
    return { type: 'youtube', query: message };
  } else if (hasBook) {
    return { type: 'books', query: message };
  }
  
  return { type: 'none', query: '' };
}

// Search YouTube videos
async function searchYouTubeVideos(query) {
  try {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    if (!YOUTUBE_API_KEY) {
      console.error("❌ YOUTUBE_API_KEY not configured");
      return null;
    }
    
    console.log(`🎥 Searching YouTube for: ${query}`);
    
    const response = await axios.get(
      `https://www.googleapis.com/youtube/v3/search`,
      {
        params: {
          part: "snippet",
          q: query,
          type: "video",
          maxResults: 3,
          key: YOUTUBE_API_KEY,
          safeSearch: "strict",
          relevanceLanguage: "en",
          order: "relevance"
        },
        timeout: 10000
      }
    );
    
    if (!response.data.items?.length) {
      return [];
    }
    
    // Get video details
    const videoIds = response.data.items.map(item => item.id.videoId).join(',');
    const videoResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos`,
      {
        params: {
          part: "snippet,contentDetails,statistics",
          id: videoIds,
          key: YOUTUBE_API_KEY
        }
      }
    );
    
    const videos = videoResponse.data.items.map(item => ({
      title: item.snippet.title,
      videoId: item.id,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.medium?.url,
      duration: item.contentDetails?.duration,
      viewCount: item.statistics?.viewCount
    }));
    
    console.log(`✅ Found ${videos.length} YouTube videos`);
    return videos;
    
  } catch (error) {
    console.error("❌ YouTube API error:", error.message);
    return null;
  }
}

// Search books
async function searchBooks(query) {
  try {
    const BOOKS_API_KEY = process.env.BOOKS_API_KEY;
    if (!BOOKS_API_KEY) {
      console.error("❌ BOOKS_API_KEY not configured");
      return null;
    }
    
    console.log(`📚 Searching books for: ${query}`);
    
    const response = await axios.get(
      `https://www.googleapis.com/books/v1/volumes`,
      {
        params: {
          q: query,
          maxResults: 3,
          key: BOOKS_API_KEY,
          langRestrict: "en",
          printType: "books"
        },
        timeout: 10000
      }
    );
    
    if (!response.data.items?.length) {
      return [];
    }
    
    const books = response.data.items.map(item => ({
      title: item.volumeInfo.title,
      authors: item.volumeInfo.authors?.join(', ') || 'Unknown',
      description: item.volumeInfo.description?.substring(0, 150) + '...' || 'No description',
      previewLink: item.volumeInfo.previewLink || '#',
      thumbnail: item.volumeInfo.imageLinks?.thumbnail,
      pageCount: item.volumeInfo.pageCount
    }));
    
    console.log(`✅ Found ${books.length} books`);
    return books;
    
  } catch (error) {
    console.error("❌ Books API error:", error.message);
    return null;
  }
}

// Format YouTube results for Gemini
function formatYouTubeResults(videos) {
  if (!videos || videos.length === 0) return '';
  
  let result = "\n\n🎥 **Recommended YouTube Videos:**\n";
  videos.forEach((video, index) => {
    result += `${index + 1}. **${video.title}**\n`;
    result += `   👤 ${video.channel}\n`;
    result += `   🔗 ${video.url}\n\n`;
  });
  return result;
}

// Format book results for Gemini
function formatBookResults(books) {
  if (!books || books.length === 0) return '';
  
  let result = "\n\n📚 **Recommended Books:**\n";
  books.forEach((book, index) => {
    result += `${index + 1}. **${book.title}**\n`;
    result += `   👤 ${book.authors}\n`;
    result += `   📖 ${book.description}\n`;
    result += `   🔗 ${book.previewLink}\n\n`;
  });
  return result;
}

/* ----------------------------------------------------------
   MAIN CHAT ENDPOINT - UPDATED WITH RESOURCE SEARCH
---------------------------------------------------------- */
router.post("/", async (req, res) => {
  console.log("🔥 HIT /api/chat - Enhanced with YouTube/Books");
  
  // Set SSE headers immediately
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");
  
  // Function to send SSE data
  const sendSSE = (data) => {
    try {
      if (res.writableEnded || res.destroyed) return false;
      const sseData = `data: ${JSON.stringify(data)}\n\n`;
      res.write(sseData);
      return true;
    } catch (err) {
      console.log("❌ Failed to write SSE:", err.message);
      return false;
    }
  };

  try {
    const { message, attachments, userId } = req.body || {};
    
    // Get conversation history
    const userKey = userId || `temp_${Date.now()}`;
    let conversationHistory = conversationStore.get(userKey) || [];
    
    let finalResponse = "";
    
    // Check if user wants videos or books
    let resourceEnhancement = "";
    const resourceRequest = detectResourceRequest(message);
    
    if (resourceRequest.type !== 'none') {
      console.log(`🔍 Detected ${resourceRequest.type} request: "${resourceRequest.query}"`);
      
      if (resourceRequest.type === 'youtube' || resourceRequest.type === 'both') {
        const videos = await searchYouTubeVideos(resourceRequest.query);
        if (videos) {
          resourceEnhancement += formatYouTubeResults(videos);
        }
      }
      
      if (resourceRequest.type === 'books' || resourceRequest.type === 'both') {
        const books = await searchBooks(resourceRequest.query);
        if (books) {
          resourceEnhancement += formatBookResults(books);
        }
      }
    }
    
    // Create enhanced message with resources
    let enhancedMessage = message || "";
    if (resourceEnhancement) {
      enhancedMessage += resourceEnhancement;
    }
    
    // Create parts array for Gemini
    const parts = [];
    
    // Add text message (enhanced with resources)
    if (enhancedMessage?.trim()) {
      parts.push({ text: enhancedMessage });
    }
    
    // Process attachments (files are already uploaded to UploadThing)
    if (Array.isArray(attachments) && attachments.length > 0) {
      console.log(`📎 Processing ${attachments.length} attachment(s) for Gemini analysis`);
      
      const filesToProcess = attachments.slice(0, 3);
      
      for (const file of filesToProcess) {
        if (!file?.url || !file?.name) continue;
        
        const ext = path.extname(file.name).toLowerCase();
        
        try {
          console.log(`📥 Downloading ${ext.toUpperCase()}: ${file.name}`);
          const fileResponse = await axios({
            url: file.url,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 60000
          });
          
          const fileBuffer = fileResponse.data;
          
          if (ext === '.docx' || ext === '.doc') {
            console.log(`📄 Extracting text from ${ext.toUpperCase()}: ${file.name}`);
            const extractedText = await extractTextFromDocx(fileBuffer);
            console.log(`✅ Extracted ${extractedText.length} characters`);
            parts.push({ 
              text: `\n--- Content from ${file.name} ---\n${extractedText}\n--- End of ${file.name} ---\n` 
            });
            
          } else if (canSendAsInlineData(file.name)) {
            const mimeType = getMimeTypeFromFilename(file.name);
            console.log(`📤 Sending ${ext.toUpperCase()} directly to Gemini`);
            const fileBase64 = Buffer.from(fileBuffer, 'binary').toString('base64');
            
            if (fileBase64.length > 4000000) {
              parts.push({ 
                text: `\n[File attached: ${file.name} (file too large for direct analysis)]\n` 
              });
            } else {
              parts.push({
                inline_data: {
                  mime_type: mimeType,
                  data: fileBase64
                }
              });
              console.log(`✅ Added ${ext.toUpperCase()} to Gemini request`);
            }
            
          } else if (['.txt', '.md', '.csv', '.json', '.xml', '.html', '.css', '.js', '.py', '.java'].includes(ext)) {
            const text = Buffer.from(fileBuffer, 'binary').toString('utf-8');
            parts.push({ 
              text: `\n--- Content from ${file.name} ---\n${text}\n--- End of ${file.name} ---\n` 
            });
            console.log(`✅ Added text from ${ext.toUpperCase()}: ${text.length} chars`);
            
          } else {
            console.log(`⚠️ ${ext.toUpperCase()} format cannot be analyzed directly`);
            parts.push({ 
              text: `\n[File attached: ${file.name} (${ext} format cannot be analyzed directly)]\n` 
            });
          }
          
        } catch (err) {
          console.error(`❌ Failed to process ${file.name}:`, err.message);
          parts.push({ 
            text: `\n[Note: Could not process file ${file.name}: ${err.message}]\n` 
          });
        }
      }
    }
    
    // If no parts, add default message
    if (parts.length === 0) {
      parts.push({ text: "Hello" });
    }
    
    // Prepare conversation history for Gemini
    const geminiMessages = [];
    
    // Add conversation history (last 3 exchanges)
    if (conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-6)) {
        const role = msg.role === "assistant" ? "model" : "user";
        geminiMessages.push({
          role: role,
          parts: [{ text: msg.content }]
        });
      }
    }
    
    // Add current message with files
    geminiMessages.push({
      role: "user",
      parts: parts
    });
    
    // Call Gemini API
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }
    
    const MODEL_NAME = "gemini-3.1-flash-lite";
    console.log(`🤖 Calling Gemini ${MODEL_NAME} with ${parts.length} parts`);
    
    const requestBody = {
      contents: geminiMessages,
      generationConfig: {
        maxOutputTokens: 4000, // INCREASED from 2000 to prevent truncation
        temperature: 0.2,
        topP: 0.8,
        topK: 40
      }
    };
    
    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_KEY}`,
      requestBody,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 180000 // 3 minutes for complex responses
      }
    );
    
    finalResponse = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
                    "I couldn't generate a response.";
    
    // Check if response was truncated
    if (finalResponse.length > 3900) {
      console.log(`⚠️ Response may be truncated: ${finalResponse.length} chars`);
      // Add a note if response is very long
      finalResponse += "\n\n*(Response may have been truncated. If you need more information, please ask for specific details.)*";
    }
    
    console.log(`✅ Gemini response length: ${finalResponse.length} chars`);
    
    // Update conversation history
    conversationHistory.push({
      role: "user",
      content: message || (attachments?.length > 0 ? `[Sent ${attachments.length} file(s)]` : ""),
      time: Date.now(),
      resourcesSearched: resourceRequest.type !== 'none' ? resourceRequest.type : undefined
    });
    
    conversationHistory.push({
      role: "assistant",
      content: finalResponse,
      time: Date.now()
    });
    
    // Keep last 10 messages
    if (conversationHistory.length > 10) {
      conversationHistory = conversationHistory.slice(-10);
    }
    conversationStore.set(userKey, conversationHistory);
    
    // Stream the response
    sendSSE({ type: "start", length: finalResponse.length });
    
    const rawChunks = chunkText(finalResponse, 140);
    console.log(`📦 Streaming ${rawChunks.length} chunks...`);
    
    for (let i = 0; i < rawChunks.length; i++) {
      const piece = rawChunks[i];
      
      const sent = sendSSE({ text: piece });
      if (!sent) {
        console.log("⚠️ Connection closed during streaming");
        break;
      }
      
      const endsSentence = /[.?!]\s*$/.test(piece);
      const delay = endsSentence ? rand(80, 160) : rand(35, 90);
      
      await new Promise((resolve) => setTimeout(resolve, delay));
      
      if (res.writableEnded || res.destroyed) break;
    }
    
    sendSSE({ done: true });
    
  } catch (err) {
    console.error("🔥 Chat Route Error:", err.message);
    
    if (err.response?.data) {
      console.error("Gemini API Error:", JSON.stringify(err.response.data, null, 2));
    }
    
    sendSSE({ 
      error: true, 
      message: err.message || "An error occurred" 
    });
    sendSSE({ done: true });
    
  } finally {
    try {
      if (!res.writableEnded) {
        res.end();
      }
      console.log("🔚 Response stream closed");
    } catch (finalErr) {
      console.log("🔚 Final cleanup error:", finalErr.message);
    }
  }
});

// Health check
router.get("/health", (req, res) => {
  res.json({ 
    status: "ok",
    gemini: process.env.GEMINI_API_KEY ? "configured" : "missing",
    youtube: process.env.YOUTUBE_API_KEY ? "configured" : "missing",
    books: process.env.BOOKS_API_KEY ? "configured" : "missing",
    timestamp: new Date().toISOString(),
    conversationStoreSize: conversationStore.size
  });
});

export default router;