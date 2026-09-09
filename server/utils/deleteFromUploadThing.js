// server/utils/deleteFromUploadThing.js
// UploadThing Token API

export default async function deleteFromUploadThing(key) {
  try {
    const response = await fetch("https://api.uploadthing.com/v6/deleteFile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-uploadthing-token": process.env.UPLOADTHING_TOKEN,
      },
      body: JSON.stringify({
        fileKeys: [key],
      }),
    });

    const data = await response.json();
    return data;
  } catch (err) {
    console.error("UploadThing delete error:", err);
    return null;
  }
}