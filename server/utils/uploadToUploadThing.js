// server/utils/uploadToUploadThing.js
import { UTApi } from "uploadthing/server";
import fs from "fs";
import path from "path";

// Fallback local upload function
async function uploadLocal(filePath, fileName, mimeType) {
  const uploadsDir = path.join(process.cwd(), "server", "uploads");
  
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  const uniqueId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  const ext = path.extname(fileName) || '.bin';
  const newFileName = `${uniqueId}${ext}`;
  const newFilePath = path.join(uploadsDir, newFileName);
  
  // Copy file to uploads directory
  fs.copyFileSync(filePath, newFilePath);
  
  const fileUrl = `/uploads/${newFileName}`;
  
  return [{
    url: fileUrl,
    key: uniqueId,
    name: fileName,
    size: fs.statSync(newFilePath).size,
    type: mimeType
  }];
}

export async function uploadToUploadThing(filePath, fileName, mimeType) {
  console.log("🔧 Starting upload process...");
  console.log("📁 File:", fileName, "Type:", mimeType);
  console.log("🔑 UploadThing token exists:", !!process.env.UPLOADTHING_TOKEN);
  
  // If no UploadThing token, use local upload
  if (!process.env.UPLOADTHING_TOKEN) {
    console.log("⚠️ No UploadThing token found, using local upload");
    return uploadLocal(filePath, fileName, mimeType);
  }

  try {
    // Initialize UTApi with token
    const utapi = new UTApi({
      token: process.env.UPLOADTHING_TOKEN,
    });

    console.log("📤 Reading file buffer...");
    
    // Read file buffer
    const buffer = fs.readFileSync(filePath);
    
    console.log("📦 Creating File object...");
    
    // Create File object
    let file;
    if (globalThis.File) {
      file = new globalThis.File([buffer], fileName, { type: mimeType });
    } else {
      const { File: FileClass } = await import('buffer');
      file = new FileClass([buffer], fileName, { type: mimeType });
    }

    console.log("🚀 Uploading to UploadThing...");
    
    // Upload to UploadThing
    const uploaded = await utapi.uploadFiles([file]);
    
    console.log("✅ UploadThing response:", JSON.stringify(uploaded, null, 2));
    
    if (!uploaded || uploaded.length === 0 || uploaded[0].error) {
      console.error("❌ UploadThing returned error:", uploaded?.[0]?.error);
      throw new Error(uploaded?.[0]?.error || "Upload failed");
    }
    
    // IMPORTANT FIX: Extract the URL correctly from UploadThing response
    const uploadData = uploaded[0].data;
    const fileUrl = uploadData.ufsUrl || uploadData.url; // Use ufsUrl first
    
    console.log("📝 Extracted URL:", fileUrl);
    
    // Map UploadThing response to our expected format
    const result = [{
      url: fileUrl, // THIS WAS UNDEFINED - NOW FIXED
      key: uploadData.key,
      name: fileName,
      type: mimeType,
      size: uploadData.size || buffer.length
    }];
    
    return result;
    
  } catch (error) {
    console.error("❌ UploadThing Upload Error:", error.message);
    console.log("🔄 Falling back to local upload...");
    
    // Fallback to local upload
    return uploadLocal(filePath, fileName, mimeType);
  }
}