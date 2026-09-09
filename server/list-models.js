import dotenv from "dotenv";

dotenv.config();

const key = process.env.GEMINI_SCHEDULE_KEY;

const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
);

const data = await response.json();

if (!response.ok) {
  console.error("❌ Error:", JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log("\n✅ Models available to your API key:\n");

for (const model of data.models || []) {
  console.log(
    model.name,
    "→",
    model.supportedGenerationMethods?.join(", ")
  );
}