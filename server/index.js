// server/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import chatTitleRoutes from "./routes/chatTitleRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import uploadThingRoutes from "./routes/uploadThingRoutes.js";
import geminiRoutes from "./routes/geminiRoutes.js";
import geminiChatRoutes from "./routes/geminiChatRoutes.js";
import scheduleAIRoutes from "./routes/scheduleAIRoutes.js";
import quizGenerateRoutes from "./routes/quizGenerateRoutes.js";
import topicCurriculumRoute from "./routes/topicCurriculumRoute.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

console.log("🔥 Server starting with Schedule AI...");

app.use(express.json());

// CORS
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Static uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Routes
app.use("/api/gemini", geminiRoutes);   
app.use("/api/gemini-chat", geminiChatRoutes);
app.use("/api/chat", chatRoutes);          
app.use("/api/chat/title", chatTitleRoutes);
app.use("/api/upload", uploadRoutes);       
app.use("/api/upload-thing", uploadThingRoutes);
app.use("/api/schedule-ai", scheduleAIRoutes);
app.use("/api/schedule-ai", topicCurriculumRoute);
app.use("/api/quiz", quizGenerateRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "🚀 FocusForge API Running!",
    services: {
      chat: "/api/gemini-chat",
      schedule: "/api/schedule-ai",
      uploads: "/api/upload-thing",
      vision: "/api/gemini/vision"
    },
    status: "operational"
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
