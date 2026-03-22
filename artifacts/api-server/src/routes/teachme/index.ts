import { Router, type IRouter } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import {
  FindBooksBody,
  GetBookChaptersBody,
  ExplainChapterBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/teachme/books", async (req, res) => {
  const parsed = FindBooksBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { topic } = parsed.data;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a learning assistant that recommends foundational, first-principles books. 
              
Find 4-5 of the most important, widely-regarded books that cover the topic of "${topic}" from first principles. 
Focus on books that:
- Explain fundamentals clearly
- Are considered classics or highly influential in their field
- Are suitable for deep learning, not surface-level introductions

Return a JSON array with exactly this structure (no markdown, just raw JSON):
[
  {
    "id": "unique-slug-id",
    "title": "Book Title",
    "author": "Author Name",
    "year": "Publication Year",
    "summary": "2-3 sentence summary explaining what this book teaches and why it's foundational for this topic",
    "keyPrinciples": ["Principle 1", "Principle 2", "Principle 3"],
    "difficulty": "Beginner|Intermediate|Advanced"
  }
]

Only return valid JSON, no other text.`,
            },
          ],
        },
      ],
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });

    const text = response.text ?? "[]";
    let books;
    try {
      books = JSON.parse(text);
    } catch {
      books = [];
    }

    res.json(books);
  } catch (err) {
    req.log.error({ err }, "Error finding books");
    res.status(500).json({ error: "Failed to find books" });
  }
});

router.post("/teachme/books/:bookId/chapters", async (req, res) => {
  const parsed = GetBookChaptersBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { bookTitle, bookAuthor } = parsed.data;
  const { bookId } = req.params;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a learning assistant with deep knowledge of books.

For the book "${bookTitle}" by ${bookAuthor}, provide:
1. A comprehensive full summary (4-6 sentences covering the main thesis, key ideas, and why it matters)
2. A list of the actual chapters or major sections of this book

Return a JSON object with exactly this structure (no markdown, just raw JSON):
{
  "id": "${bookId}",
  "title": "${bookTitle}",
  "author": "${bookAuthor}",
  "year": "publication year",
  "fullSummary": "Comprehensive 4-6 sentence summary of the book covering its main thesis, key ideas, methodology, and significance.",
  "chapters": [
    {
      "id": "chapter-slug-1",
      "number": 1,
      "title": "Chapter Title",
      "summary": "1-2 sentence description of what this chapter covers"
    }
  ]
}

Use the actual chapter structure of the book if known. If you're unsure of exact chapters, create logical sections that accurately represent the book's content flow. Include 6-15 chapters/sections.

Only return valid JSON, no other text.`,
            },
          ],
        },
      ],
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });

    const text = response.text ?? "{}";
    let bookData;
    try {
      bookData = JSON.parse(text);
    } catch {
      bookData = {
        id: bookId,
        title: bookTitle,
        author: bookAuthor,
        year: "Unknown",
        fullSummary: "Unable to retrieve book summary.",
        chapters: [],
      };
    }

    res.json(bookData);
  } catch (err) {
    req.log.error({ err }, "Error getting book chapters");
    res.status(500).json({ error: "Failed to get book chapters" });
  }
});

router.post(
  "/teachme/books/:bookId/chapters/:chapterId/explain",
  async (req, res) => {
    const parsed = ExplainChapterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const { bookTitle, bookAuthor, chapterTitle, chapterNumber } = parsed.data;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    try {
      const stream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are an expert teacher who explains complex ideas from first principles in clear, accessible language.

Explain Chapter ${chapterNumber}: "${chapterTitle}" from the book "${bookTitle}" by ${bookAuthor}.

Your explanation should:
1. Start with the core question or problem this chapter addresses
2. Build understanding from the ground up - assume the reader is intelligent but unfamiliar with technical jargon
3. Explain every important concept in simple, everyday terms (like explaining to a curious friend)
4. Use concrete analogies and real-world examples to illustrate abstract ideas
5. Cover the key insights and mental models introduced in this chapter
6. End with the main takeaway and how this connects to the book's bigger picture

Write in flowing prose (not bullet points). Make it engaging and clear. Be thorough - this is a deep dive, aim for 600-1000 words.`,
              },
            ],
          },
        ],
        config: { maxOutputTokens: 8192 },
      });

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      req.log.error({ err }, "Error explaining chapter");
      res.write(`data: ${JSON.stringify({ error: "Failed to explain chapter" })}\n\n`);
      res.end();
    }
  }
);

export default router;
