//  server/utils/youtubeApi.js
import axios from "axios";

export async function fetchYouTubeVideo(query) {
  try {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    
    if (!YOUTUBE_API_KEY) {
      console.error("❌ YOUTUBE_API_KEY not configured");
      return "YouTube API key not configured.";
    }

    console.log(`🎥 Searching YouTube for: ${query}`);
    
    // Step 1: Search for videos
    const searchResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/search`,
      {
        params: {
          part: "snippet",
          q: query,
          type: "video",
          maxResults: 5, // Get more for filtering
          key: YOUTUBE_API_KEY,
          safeSearch: "strict",
          order: "relevance"
        },
        timeout: 10000
      }
    );

    if (!searchResponse.data.items?.length) {
      return "No YouTube videos found for that search.";
    }

    // Step 2: Extract video IDs
    const videoIds = searchResponse.data.items
      .map(item => item.id?.videoId)
      .filter(id => id);

    if (videoIds.length === 0) {
      return "Found videos but couldn't extract video IDs.";
    }

    // Step 3: Check video status (CRITICAL FIX)
    const statusResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos`,
      {
        params: {
          part: "status,snippet",
          id: videoIds.join(','),
          key: YOUTUBE_API_KEY
        },
        timeout: 10000
      }
    );

    // Step 4: Filter only playable videos
    const playableVideos = [];
    
    statusResponse.data.items?.forEach(video => {
      const status = video.status;
      
      // Check if video is public and embeddable
      if (status.privacyStatus === 'public' && 
          status.embeddable !== false && 
          status.uploadStatus === 'processed') {
        
        playableVideos.push({
          title: video.snippet.title,
          videoId: video.id,
          thumbnail: video.snippet.thumbnails?.default?.url,
          channel: video.snippet.channelTitle,
          publishedAt: new Date(video.snippet.publishedAt).toLocaleDateString(),
          isPlayable: true
        });
      } else {
        console.log(`⚠️ Skipping video ${video.id}: ${status.privacyStatus}, embeddable: ${status.embeddable}`);
      }
    });

    if (playableVideos.length === 0) {
      return `Found ${videoIds.length} videos but none are publicly playable. Try a different search.`;
    }

    // Step 5: Format response
    const videoLinks = playableVideos
      .map((v, index) => 
        `**${index + 1}. [${v.title}](https://www.youtube.com/watch?v=${v.videoId})** ✅\n` +
        `   👤 **Channel:** ${v.channel}\n` +
        `   📅 **Published:** ${v.publishedAt}\n` +
        `   🔗 **Watch:** https://www.youtube.com/watch?v=${v.videoId}`
      )
      .join("\n\n");
    
    console.log(`✅ Found ${playableVideos.length}/${videoIds.length} playable YouTube videos`);
    
    return `## 🎥 **Playable YouTube Videos**\n\n${videoLinks}\n\n*Note: Only showing publicly available videos that can be embedded.*`;

  } catch (error) {
    console.error("❌ YouTube API error:", error.message);
    
    if (error.response?.status === 403) {
      return "YouTube API quota exceeded. Please try again later or check your API key limits.";
    }
    
    return `Error searching YouTube: ${error.message}`;
  }
}