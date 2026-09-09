// server/utils/fileTextExtractor.js
import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import Tesseract from "tesseract.js";

// Use dynamic import for pdf-parse (ES module compatible)
let pdfParse;
try {
  const pdfParseModule = await import('pdf-parse');
  pdfParse = pdfParseModule.default;
} catch (err) {
  console.error("Failed to load pdf-parse:", err);
  pdfParse = null;
}

export async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath || "").toLowerCase();

  try {
    // PDF
    if (ext === ".pdf") {
      if (!pdfParse) {
        return `[PDF file: ${path.basename(filePath)}] (pdf-parse library not available)`;
      }
      const raw = await fs.readFile(filePath);
      const data = await pdfParse(raw);
      return data?.text?.trim() || "";
    }

    // Word docs
    if (ext === ".docx" || ext === ".doc") {
      const result = await mammoth.extractRawText({ path: filePath });
      return result?.value?.trim() || "";
    }

    // Text and code files
    const textExtensions = [
      ".txt", ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cpp", ".c", ".cs",
      ".html", ".css", ".scss", ".json", ".xml", ".yml", ".yaml", ".md",
      ".sql", ".php", ".rb", ".go", ".rs", ".swift", ".kt", ".dart"
    ];
    if (textExtensions.includes(ext)) {
      return await fs.readFile(filePath, "utf8");
    }

    // CSV/Excel
    if (ext === ".csv" || ext === ".xlsx" || ext === ".xls") {
      const content = await fs.readFile(filePath, "utf8");
      return `CSV/Excel Data:\n${content}`;
    }

    // IMAGE → OCR (Optional - now we use Gemini for better analysis)
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp"];
    if (imageExtensions.includes(ext)) {
      // For images, we'll use Gemini instead of OCR
      return `[Image file: ${path.basename(filePath)}] (Will be analyzed by Gemini)`;
    }

    // Audio/video
    const mediaExtensions = [".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv"];
    if (mediaExtensions.includes(ext)) {
      return `[Media file: ${path.basename(filePath)}]`;
    }

    // Other files
    return `[File: ${path.basename(filePath)}]`;

  } catch (err) {
    console.error("extractTextFromFile error:", err);
    return `[Error extracting content from ${path.basename(filePath)}]`;
  }
}