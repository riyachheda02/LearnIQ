import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Validate API key on startup
console.log("\n🔧 Initializing Schedule AI Routes...");
console.log("🔑 GEMINI_SCHEDULE_KEY present:", !!process.env.GEMINI_SCHEDULE_KEY);

if (process.env.GEMINI_SCHEDULE_KEY) {
  const key = process.env.GEMINI_SCHEDULE_KEY;
  console.log(`   Key length: ${key.length} characters`);
  console.log(`   Key preview: ${key.substring(0, 4)}...${key.substring(key.length - 4)}`);
} else {
  console.error("❌ ERROR: GEMINI_SCHEDULE_KEY is not set in .env file!");
  console.error("   Please add: GEMINI_SCHEDULE_KEY=your_gemini_api_key_here");
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_SCHEDULE_KEY || '');

// ========== HEALTH CHECK ==========
router.get("/health", (req, res) => {
  const hasApiKey = !!process.env.GEMINI_SCHEDULE_KEY;
  
  res.json({
    status: hasApiKey ? "healthy" : "missing_api_key",
    service: "Schedule AI",
    geminiConfigured: hasApiKey,
    keyLength: process.env.GEMINI_SCHEDULE_KEY ? process.env.GEMINI_SCHEDULE_KEY.length : 0,
    environment: process.env.NODE_ENV,
    endpoints: [
      { method: "GET", path: "/health", description: "Health check" },
      { method: "GET", path: "/test-gemini", description: "Test Gemini connection" },
      { method: "POST", path: "/generate-timetable", description: "Generate schedule" },
      { method: "POST", path: "/analyze-schedule", description: "Analyze schedule" },
      { method: "POST", path: "/study-recommendations", description: "Get study tips" },
      { method: "POST", path: "/chat", description: "Chat with AI" }
    ],
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ========== TEST GEMINI CONNECTION ==========
router.get("/test-gemini", async (req, res) => {
  try {
    console.log("\n🔍 Testing Gemini connection...");
    
    if (!process.env.GEMINI_SCHEDULE_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_SCHEDULE_KEY not found",
        solution: "Add GEMINI_SCHEDULE_KEY=your_key to your .env file"
      });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.1,
      }
    });

    console.log("📡 Making test request to Gemini API...");
    const startTime = Date.now();
    
    const result = await model.generateContent("Hello! Please respond with 'Gemini AI is working!'");
    const response = await result.response;
    const text = response.text();
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log("✅ Gemini test successful!");
    console.log(`   Response time: ${responseTime}ms`);
    console.log(`   Response: ${text}`);
    
    res.json({
      success: true,
      message: "Gemini AI is connected and working",
      response: text,
      responseTime: `${responseTime}ms`,
      model: "gemini-3.1-flash-lite",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ Gemini test error:", error.message);
    
    res.status(500).json({
      success: false,
      error: error.message,
      errorType: "gemini_connection_error",
      solution: "Check your API key and internet connection",
      timestamp: new Date().toISOString()
    });
  }
});

// ========== GENERATE TIMETABLE ==========
router.post("/generate-timetable", async (req, res) => {
  try {
    console.log("\n🤖 Generating timetable...");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    
    const { 
      subjects = [],
      constraints = {},
      preferences = {},
      userId 
    } = req.body;

    if (!subjects || subjects.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: "No subjects provided",
        suggestion: "Add at least one subject to generate a timetable"
      });
    }

    // Prepare the AI prompt
    const prompt = createTimetablePrompt(subjects, constraints, preferences);
    console.log("📝 Prompt prepared, length:", prompt.length);
    
    // Use Gemini API
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      }
    });

    console.log("📡 Sending request to Gemini...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("✅ AI response received");
    console.log("Response length:", text.length);
    
    // Parse the AI response
    const scheduleData = parseAIScheduleResponse(text, subjects, constraints);
    
    // Return the generated schedule
    res.json({
      success: true,
      schedule: scheduleData,
      rawAIResponse: text.substring(0, 500) + "...",
      timestamp: new Date().toISOString(),
      model: "gemini-2.5-flash",
      subjectsCount: subjects.length
    });

  } catch (error) {
    console.error("❌ Schedule generation error:", error.message);
    console.error("Error stack:", error.stack);
    
    res.status(500).json({
      success: false,
      error: "Failed to generate timetable",
      message: error.message,
      suggestion: "Try simplifying your request or check AI service configuration",
      fallbackSchedule: generateFallbackSchedule(req.body.subjects || [], req.body.constraints || {}),
      timestamp: new Date().toISOString()
    });
  }
});

// ========== ANALYZE SCHEDULE ==========
router.post("/analyze-schedule", async (req, res) => {
  try {
    console.log("\n🔍 Analyzing schedule...");
    
    const { 
      schedule = {},
      subjects = [],
      userPreferences = {},
      userId 
    } = req.body;

    // Prepare analysis prompt
    const prompt = createAnalysisPrompt(schedule, subjects, userPreferences);
    
    // Use Gemini API
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.5,
        topP: 0.8,
      }
    });

    console.log("📡 Sending analysis request to Gemini...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("✅ Analysis received");
    
    // Parse the analysis
    const analysis = parseAIAnalysisResponse(text);
    
    // Calculate some metrics
    const productivityScore = calculateProductivityScore(schedule, subjects);
    const balanceScore = calculateScheduleBalance(schedule, subjects);
    
    res.json({
      success: true,
      analysis: {
        ...analysis,
        scores: {
          productivity: productivityScore,
          balance: balanceScore,
          overall: Math.round((productivityScore + balanceScore) / 2)
        }
      },
      recommendations: analysis.recommendations || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Schedule analysis error:", error);
    
    res.status(500).json({
      success: false,
      error: "Failed to analyze schedule",
      message: error.message,
      fallback: {
        productivityScore: 75,
        recommendations: [
          "Schedule difficult subjects during peak focus hours",
          "Include regular breaks for better retention",
          "Balance study load across all days"
        ]
      },
      timestamp: new Date().toISOString()
    });
  }
});

// ========== STUDY RECOMMENDATIONS ==========
router.post("/study-recommendations", async (req, res) => {
  try {
    console.log("\n💡 Getting study recommendations...");
    
    const { 
      subjects = [],
      studyStyle = "balanced",
      timeAvailable = 4,
      userId 
    } = req.body;

    const prompt = createRecommendationsPrompt(subjects, studyStyle, timeAvailable);
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 3000,
        temperature: 0.6,
      }
    });

    console.log("📡 Sending recommendations request...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("✅ Recommendations received");
    
    // Parse recommendations
    const recommendations = parseAIRecommendations(text);
    
    res.json({
      success: true,
      recommendations,
      studyStyle,
      subjectCount: subjects.length,
      timeAvailable,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Recommendations error:", error);
    
    res.status(500).json({
      success: false,
      error: "Failed to generate recommendations",
      message: error.message,
      fallback: {
        recommendations: [
          "Use Pomodoro technique: 25 min study, 5 min break",
          "Review material within 24 hours for better retention",
          "Focus on one subject at a time for deeper understanding",
          "Create summaries after each study session",
          "Practice with past papers if available"
        ]
      },
      timestamp: new Date().toISOString()
    });
  }
});

// ========== CHAT WITH AI ==========
router.post("/chat", async (req, res) => {
  try {
    const { 
      message,
      context = {},
      userId 
    } = req.body;

    if (!message) {
      return res.status(400).json({ 
        success: false,
        error: "Message is required" 
      });
    }

    console.log("\n💬 Chat request:", message.substring(0, 100));
    
    // Set up response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    
    const prompt = createChatPrompt(message, context);
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.7,
      }
    });

    // Generate response
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("✅ Chat response generated");
    
    res.json({
      success: true,
      response: text,
      timestamp: new Date().toISOString(),
      model: "gemini-2.5-flash"
    });

  } catch (error) {
    console.error("❌ Chat error:", error);
    
    res.status(500).json({
      success: false,
      error: "Failed to generate chat response",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ========== PROMPT CREATION FUNCTIONS ==========

function createTimetablePrompt(subjects, constraints, preferences) {
  const { 
    dailyStudyHours = 4,
    sessionDuration = 50,
    breakMinutes = 15,
    blockedHours = [],
    studyStyle = "balanced",
    daysToGenerate = 7
  } = constraints;

  return `You are an expert study planner AI. Create an optimized ${daysToGenerate}-day study timetable.

SUBJECTS:
${subjects.map((subject, index) => `
${index + 1}. ${subject.name}
   • Difficulty: ${subject.difficulty || 'medium'}
   • Priority: ${subject.priority || 3}/5`).join('')}

CONSTRAINTS:
• Daily Study Hours: ${dailyStudyHours} hours
• Session Duration: ${sessionDuration} minutes  
• Break Between Sessions: ${breakMinutes} minutes
• Study Style: ${studyStyle}

${blockedHours.length > 0 ? `BLOCKED TIMES (Avoid these hours):
${blockedHours.map(slot => `  • ${slot.label || 'Block'}: ${slot.start} - ${slot.end}`).join('\n')}` : ''}

IMPORTANT INSTRUCTIONS:
1. Create exactly ${daysToGenerate} days of schedule
2. Start from tomorrow's date
3. Use 24-hour time format (HH:MM)
4. Each session should be ${sessionDuration} minutes
5. Include ${breakMinutes}-minute breaks between sessions
6. Distribute subjects evenly
7. Place difficult subjects in the morning

CRITICAL: You MUST return ONLY valid JSON. No explanations, no additional text.

RETURN FORMAT (VALID JSON ONLY):
{
  "days": [
    {
      "date": "2024-01-15",
      "dayOfWeek": "Monday",
      "slots": [
        {
          "subject": "Mathematics",
          "start": "09:00",
          "end": "09:50",
          "duration": 50,
          "difficulty": "medium",
          "type": "study"
        }
      ],
      "totalStudyTime": 240,
      "focusSubject": "Mathematics",
      "energyLevel": "high"
    }
  ],
  "summary": {
    "totalStudyHours": 28,
    "subjectDistribution": {"Mathematics": 10, "Science": 8, "English": 10},
    "dailyAverage": 4,
    "aiRecommendations": ["Recommendation 1", "Recommendation 2"]
  }
}

REMEMBER: Return ONLY the JSON object. No markdown, no code blocks, no additional text.`;
}

function createAnalysisPrompt(schedule, subjects, preferences) {
  return `Analyze this study schedule:

SCHEDULE: ${JSON.stringify(schedule, null, 2)}

SUBJECTS: ${subjects.map(s => `${s.name} (${s.difficulty}, priority: ${s.priority})`).join(', ')}

Provide analysis in this JSON format:
{
  "productivityScore": 85,
  "strengths": ["Strength 1", "Strength 2"],
  "improvements": ["Improvement 1", "Improvement 2"],
  "recommendations": ["Rec 1", "Rec 2", "Rec 3"],
  "dailyFocus": {
    "Monday": "Focus area",
    "Tuesday": "Focus area"
  }
}

Be constructive and specific.`;
}

function createRecommendationsPrompt(subjects, studyStyle, timeAvailable) {
  return `Provide study recommendations for:
Subjects: ${subjects.map(s => s.name).join(', ')}
Study Style: ${studyStyle}
Time Available: ${timeAvailable} hours per day

Give practical, actionable advice.`;
}

function createChatPrompt(message, context) {
  const { schedule, subjects, studyStyle } = context;
  
  let contextString = "You are a helpful study planning assistant.";
  
  if (subjects?.length > 0) {
    contextString += `\nThe user is studying: ${subjects.map(s => s.name).join(', ')}`;
  }
  
  if (schedule) {
    contextString += `\nThey have a study schedule planned.`;
  }
  
  if (studyStyle) {
    contextString += `\nTheir study style: ${studyStyle}`;
  }
  
  return `${contextString}

User: ${message}

Assistant:`;
}

// ========== RESPONSE PARSING FUNCTIONS ==========

function parseAIScheduleResponse(aiText, subjects, constraints) {
  try {
    console.log("📝 Parsing AI response...");
    console.log("AI Response preview:", aiText.substring(0, 500));
    
    // Clean the response first
    let cleanedText = aiText.trim();
    
    // Remove any markdown code blocks
    cleanedText = cleanedText.replace(/```json\s*/g, '');
    cleanedText = cleanedText.replace(/```\s*/g, '');
    
    // Remove any text before the first {
    const firstBraceIndex = cleanedText.indexOf('{');
    if (firstBraceIndex > 0) {
      cleanedText = cleanedText.substring(firstBraceIndex);
    }
    
    // Remove any text after the last }
    const lastBraceIndex = cleanedText.lastIndexOf('}');
    if (lastBraceIndex !== -1 && lastBraceIndex < cleanedText.length - 1) {
      cleanedText = cleanedText.substring(0, lastBraceIndex + 1);
    }
    
    // Fix common JSON formatting issues
    cleanedText = cleanedText
      .replace(/'/g, '"')  // Replace single quotes with double quotes
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/,\s*}/g, '}')  // Remove trailing commas in objects
      .replace(/(\w+):/g, '"$1":')  // Add quotes to unquoted keys
      .replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*[,}])/g, ': "$1"')  // Quote unquoted string values
      .replace(/:\s*true(?=\s*[,}])/g, ': true')
      .replace(/:\s*false(?=\s*[,}])/g, ': false')
      .replace(/:\s*null(?=\s*[,}])/g, ': null')
      .replace(/:\s*(\d+)(?=\s*[,}])/g, ': $1');
    
    console.log("🧹 Cleaned JSON:", cleanedText.substring(0, 300) + "...");
    
    // Try to parse
    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("First parse attempt failed:", parseError.message);
      
      // Try to extract JSON with regex
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
          console.log("✅ Extracted JSON with regex");
        } catch (e) {
          console.error("Regex extraction failed:", e.message);
          throw parseError;
        }
      } else {
        throw parseError;
      }
    }
    
    // Validate structure
    if (!parsed.days || !Array.isArray(parsed.days)) {
      console.error("Invalid schedule format: missing days array");
      throw new Error("Invalid schedule format from AI");
    }
    
    // Add missing fields
    const now = new Date();
    const enhancedDays = parsed.days.map((day, index) => {
      if (!day.date) {
        const date = new Date(now);
        date.setDate(now.getDate() + index + 1);
        day.date = date.toISOString().split('T')[0];
      }
      
      if (!day.dayOfWeek) {
        const date = new Date(day.date);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        day.dayOfWeek = days[date.getDay()];
      }
      
      if (!day.slots || !Array.isArray(day.slots)) {
        day.slots = [];
      }
      
      // Ensure slots have required fields
      day.slots = day.slots.map(slot => ({
        subject: slot.subject || "Unknown",
        start: slot.start || "09:00",
        end: slot.end || "10:00",
        duration: slot.duration || 60,
        difficulty: slot.difficulty || "medium",
        type: slot.type || "study",
        topic: slot.topic || ""
      }));
      
      // Calculate total study time
      if (!day.totalStudyTime) {
        day.totalStudyTime = day.slots.reduce((sum, slot) => sum + (slot.duration || 0), 0);
      }
      
      if (!day.focusSubject && day.slots.length > 0) {
        // Find most studied subject for the day
        const subjectTimes = {};
        day.slots.forEach(slot => {
          if (slot.subject) {
            subjectTimes[slot.subject] = (subjectTimes[slot.subject] || 0) + (slot.duration || 0);
          }
        });
        
        const focusSubject = Object.entries(subjectTimes)
          .sort((a, b) => b[1] - a[1])[0]?.[0];
        
        day.focusSubject = focusSubject || subjects[0]?.name || "General Study";
      }
      
      if (!day.energyLevel) {
        const totalStudy = day.totalStudyTime || 0;
        if (totalStudy > 300) day.energyLevel = 'high';
        else if (totalStudy > 180) day.energyLevel = 'medium';
        else day.energyLevel = 'low';
      }
      
      return day;
    });
    
    // Create summary if not present
    if (!parsed.summary) {
      const totalStudyHours = enhancedDays.reduce((sum, day) => sum + (day.totalStudyTime || 0), 0) / 60;
      
      // Calculate subject distribution
      const subjectDistribution = {};
      enhancedDays.forEach(day => {
        day.slots.forEach(slot => {
          if (slot.subject) {
            subjectDistribution[slot.subject] = 
              (subjectDistribution[slot.subject] || 0) + (slot.duration || 0) / 60;
          }
        });
      });
      
      parsed.summary = {
        totalStudyHours: Math.round(totalStudyHours * 10) / 10,
        subjectDistribution,
        dailyAverage: Math.round((totalStudyHours / enhancedDays.length) * 10) / 10,
        aiRecommendations: [
          "Review your progress weekly",
          "Adjust schedule based on energy levels",
          "Take regular breaks to maintain focus"
        ]
      };
    }
    
    console.log("✅ Successfully parsed schedule with", enhancedDays.length, "days");
    
    return {
      ...parsed,
      days: enhancedDays,
      generatedAt: new Date().toISOString(),
      parsedSuccessfully: true
    };
    
  } catch (error) {
    console.error("❌ Failed to parse AI schedule:", error.message);
    console.log("Raw AI response (first 1000 chars):", aiText.substring(0, 1000));
    
    // Log the problematic JSON for debugging
    if (aiText.includes('{')) {
      const start = Math.max(0, aiText.indexOf('{') - 50);
      const end = Math.min(aiText.length, aiText.lastIndexOf('}') + 51);
      console.log("Problematic JSON section:", aiText.substring(start, end));
    }
    
    // Fallback: Generate a basic schedule
    return generateFallbackSchedule(subjects, constraints);
  }
}

function parseAIAnalysisResponse(aiText) {
  try {
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback
    return {
      productivityScore: 75,
      strengths: ["Well-structured schedule", "Good time distribution"],
      improvements: ["Could add more breaks", "Consider energy levels"],
      recommendations: ["Schedule reviews weekly", "Adjust based on progress"],
      dailyFocus: {}
    };
    
  } catch (error) {
    console.error("Analysis parse error:", error);
    return {
      productivityScore: 70,
      strengths: ["Schedule exists", "Subjects are included"],
      improvements: ["Optimize timing", "Balance workload"],
      recommendations: ["Take regular breaks", "Review weekly"],
      dailyFocus: {}
    };
  }
}

function parseAIRecommendations(aiText) {
  try {
    const lines = aiText.split('\n').filter(line => line.trim().length > 20);
    return lines.slice(0, 10);
  } catch (error) {
    return [
      "Study in focused 25-minute sessions with 5-minute breaks",
      "Review material within 24 hours of learning",
      "Create flashcards for key concepts",
      "Practice with past exam papers",
      "Form study groups for difficult topics"
    ];
  }
}

// ========== HELPER FUNCTIONS ==========

function calculateProductivityScore(schedule, subjects) {
  if (!schedule?.days?.length) return 50;
  
  let score = 50;
  const totalStudyTime = schedule.days.reduce((sum, day) => sum + (day.totalStudyTime || 0), 0);
  const totalPossibleTime = schedule.days.length * 8 * 60;
  const timeUtilization = Math.min(100, (totalStudyTime / totalPossibleTime) * 100);
  score += timeUtilization * 0.3;
  
  return Math.min(100, Math.round(score));
}

function calculateScheduleBalance(schedule, subjects) {
  if (!subjects?.length) return 100;
  
  const subjectHours = {};
  
  schedule.days?.forEach(day => {
    day.slots?.forEach(slot => {
      if (slot.subject && slot.duration) {
        subjectHours[slot.subject] = (subjectHours[slot.subject] || 0) + (slot.duration / 60);
      }
    });
  });
  
  const hours = Object.values(subjectHours);
  if (hours.length === 0) return 50;
  
  const total = hours.reduce((a, b) => a + b, 0);
  const average = total / hours.length;
  const variance = hours.reduce((sum, h) => sum + Math.pow(h - average, 2), 0) / hours.length;
  
  const balanceScore = Math.max(0, 100 - (variance * 10));
  return Math.round(balanceScore);
}

function generateFallbackSchedule(subjects, constraints) {
  const { 
    dailyStudyHours = 4,
    sessionDuration = 50,
    breakMinutes = 15,
    daysToGenerate = 7
  } = constraints;
  
  const days = [];
  const now = new Date();
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  for (let i = 0; i < daysToGenerate; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i + 1);
    const dateStr = date.toISOString().split('T')[0];
    
    const slots = [];
    let currentTime = 9 * 60;
    let remainingMins = dailyStudyHours * 60;
    
    while (remainingMins > 0 && currentTime < 18 * 60) {
      const subjectIndex = slots.length % subjects.length;
      const subject = subjects[subjectIndex];
      const duration = Math.min(sessionDuration, remainingMins);
      
      if (duration < 30) break;
      
      const startStr = `${Math.floor(currentTime / 60).toString().padStart(2, '0')}:${(currentTime % 60).toString().padStart(2, '0')}`;
      const endTime = currentTime + duration;
      const endStr = `${Math.floor(endTime / 60).toString().padStart(2, '0')}:${(endTime % 60).toString().padStart(2, '0')}`;
      
      slots.push({
        subject: subject.name,
        start: startStr,
        end: endStr,
        duration,
        difficulty: subject.difficulty || 'medium',
        type: 'study'
      });
      
      currentTime = endTime + breakMinutes;
      remainingMins -= duration;
      
      // Add break
      if (remainingMins > 0 && slots.length > 0) {
        slots.push({
          subject: "Break",
          start: endStr,
          end: `${Math.floor(currentTime / 60).toString().padStart(2, '0')}:${(currentTime % 60).toString().padStart(2, '0')}`,
          duration: breakMinutes,
          difficulty: 'easy',
          type: 'break'
        });
      }
    }
    
    days.push({
      date: dateStr,
      dayOfWeek: daysOfWeek[date.getDay()],
      slots,
      totalStudyTime: (dailyStudyHours * 60) - remainingMins,
      focusSubject: subjects[i % subjects.length]?.name || 'General Study',
      energyLevel: 'medium',
      notes: 'AI-generated schedule'
    });
  }
  
  return {
    days,
    summary: {
      totalStudyHours: dailyStudyHours * daysToGenerate,
      subjectDistribution: subjects.reduce((acc, subject) => {
        acc[subject.name] = dailyStudyHours * daysToGenerate / subjects.length;
        return acc;
      }, {}),
      dailyAverage: dailyStudyHours,
      aiRecommendations: [
        "This is a basic schedule. For better optimization, ensure AI is properly configured.",
        "Adjust based on your energy levels",
        "Take regular breaks to maintain focus"
      ]
    },
    generatedAt: new Date().toISOString(),
    isFallback: true
  };
}

// Removed redundant generate-topic-schedule route.
// It is now handled cleanly by topicCurriculumRoute.js.

export default router;