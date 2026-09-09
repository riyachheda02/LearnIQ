// server/utils/booksApi.js
import axios from "axios";

export async function fetchBook(query) {
  try {
    const BOOKS_API_KEY = process.env.BOOKS_API_KEY;
    
    if (!BOOKS_API_KEY) {
      console.error("❌ BOOKS_API_KEY not configured");
      return "Books API key not configured.";
    }

    console.log(`📚 Searching books for: ${query}`);
    
    const response = await axios.get(
      `https://www.googleapis.com/books/v1/volumes`,
      {
        params: {
          q: query,
          maxResults: 3, // Get 3 results
          key: BOOKS_API_KEY,
          langRestrict: "en", // English books
        },
        timeout: 10000
      }
    );

    if (response.data.items?.length > 0) {
      const books = response.data.items.map((item) => {
        const volume = item.volumeInfo;
        return {
          title: volume.title || "Untitled",
          authors: volume.authors?.join(", ") || "Unknown Author",
          previewLink: volume.previewLink || "No preview available",
          thumbnail: volume.imageLinks?.thumbnail || "",
          description: volume.description?.substring(0, 200) + "..." || "No description",
        };
      });

      // Format the response
      const bookLinks = books
        .map(b => `📘 **${b.title}** by ${b.authors}\n${b.previewLink}`)
        .join("\n\n");
      
      console.log(`✅ Found ${books.length} books`);
      return `📚 **Recommended Books:**\n${bookLinks}`;
    } else {
      return "No books found for that search.";
    }
  } catch (error) {
    console.error("❌ Books API error:", error.message);
    return "Error searching books. Please try again later.";
  }
}