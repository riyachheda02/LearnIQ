// import dotenv from 'dotenv';
// import { GoogleGenerativeAI } from '@google/generative-ai';

// dotenv.config();

// console.log("🔧 Testing Gemini AI Connection...");
// console.log("=".repeat(50));

// // Check environment variables
// console.log("\n📁 Environment Variables:");
// console.log("GEMINI_SCHEDULE_KEY:", process.env.GEMINI_SCHEDULE_KEY ? `✓ (${process.env.GEMINI_SCHEDULE_KEY.length} chars)` : "✗ NOT FOUND");
// console.log("NODE_ENV:", process.env.NODE_ENV || "not set");
// console.log("PORT:", process.env.PORT || "5000 (default)");

// if (!process.env.GEMINI_SCHEDULE_KEY) {
//   console.error("\n❌ ERROR: GEMINI_SCHEDULE_KEY is not set!");
//   console.log("\n💡 Solution:");
//   console.log("1. Create a .env file in the server folder");
//   console.log("2. Add this line:");
//   console.log("   GEMINI_SCHEDULE_KEY=your_actual_gemini_api_key");
//   console.log("3. Get your key from: https://makersuite.google.com/app/apikey");
//   process.exit(1);
// }

// // Test Gemini API
// console.log("\n🤖 Testing Gemini API Connection...");
// try {
//   const genAI = new GoogleGenerativeAI(process.env.GEMINI_SCHEDULE_KEY);
//   const model = genAI.getGenerativeModel({ 
//     model: "gemini-1.5-flash",
//     generationConfig: {
//       maxOutputTokens: 50,
//       temperature: 0.1,
//     }
//   });

//   console.log("📡 Sending test request...");
//   const startTime = Date.now();
//   const result = await model.generateContent("Say 'Gemini is working!'");
//   const response = await result.response;
//   const text = response.text();
//   const endTime = Date.now();

//   console.log("✅ SUCCESS!");
//   console.log("Response:", text);
//   console.log("Response time:", endTime - startTime, "ms");
//   console.log("\n🎉 Gemini AI is properly configured!");
  
// } catch (error) {
//   console.error("❌ Gemini API Error:", error.message);
  
//   if (error.message.includes("API key not valid")) {
//     console.log("\n💡 Your API key might be invalid or expired.");
//     console.log("Get a new key from: https://makersuite.google.com/app/apikey");
//   } else if (error.message.includes("429")) {
//     console.log("\n💡 Rate limit exceeded. Try again later.");
//   } else {
//     console.log("\n💡 Check your internet connection and API key.");
//   }
  
//   process.exit(1);
// }



import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

console.log("🔧 Testing Gemini AI Connection...");
console.log("=".repeat(50));

const apiKey = process.env.GEMINI_SCHEDULE_KEY;

if (!apiKey) {
  console.error("❌ GEMINI_SCHEDULE_KEY not found!");
  process.exit(1);
}

console.log(`🔑 API key found (${apiKey.length} chars)`);

try {
  const ai = new GoogleGenAI({
    apiKey: apiKey
  });

  console.log("\n📡 Sending request to Gemini...");

  const result = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: "Say 'Gemini is working!'"
  });

  console.log("\n✅ SUCCESS!");
  console.log("Response:", result.text);

  console.log("\n🎉 Gemini 2.5 Flash is working correctly!");

} catch (error) {
  console.error("\n❌ Gemini API Error:");
  console.error(error);
}