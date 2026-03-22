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

  const { topic, exclude = [] } = parsed.data;

  const excludeClause =
    exclude.length > 0
      ? `\n\nDo NOT include these books (they have already been shown):\n${exclude.map((t) => `- ${t}`).join("\n")}`
      : "";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a learning assistant that recommends books on "${topic}" from first principles.

SELECTION CRITERIA (in strict priority order):
1. RECENCY: Strongly prefer books published in 2020 or later. Books from 2015–2019 are acceptable. Only include older books if they are truly irreplaceable classics with no modern equivalent.
2. FIRST PRINCIPLES: Prioritize books that build knowledge from the ground up — deriving understanding from foundational truths rather than presenting untested opinions or speculative frameworks.
3. EVIDENCE-BASED: Prefer books grounded in empirical research, rigorous practice, or proven methodologies over purely theoretical or trend-driven content.
4. DEPTH: Choose books that reward careful reading and teach lasting mental models, not surface-level summaries or listicles.

Find exactly 5 books matching these criteria. Return them ordered from most recent to least recent.${excludeClause}

Return a JSON array with exactly this structure (no markdown, just raw JSON):
[
  {
    "id": "unique-slug-id",
    "title": "Book Title",
    "author": "Author Name",
    "year": "Publication Year",
    "summary": "2-3 sentence summary explaining what this book teaches, why it builds understanding from first principles, and what makes it exceptional",
    "keyPrinciples": ["Principle 1", "Principle 2", "Principle 3"],
    "difficulty": "Beginner|Intermediate|Advanced"
  }
]

Only return valid JSON, no other text.`,
            },
          ],
        },
      ],
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
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
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
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
        model: "gemini-3-flash-preview",
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
      res.write(
        `data: ${JSON.stringify({ error: "Failed to explain chapter" })}\n\n`
      );
      res.end();
    }
  }
);

router.post(
  "/teachme/books/:bookId/chapters/:chapterId/chat",
  async (req, res) => {
    const { bookTitle, bookAuthor, chapterTitle, chapterNumber, chapterContent, messages, question } = req.body;

    if (!bookTitle || !chapterTitle || !question) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const history = Array.isArray(messages) ? messages : [];

    const systemPrompt = `You are a knowledgeable tutor helping a student understand Chapter ${chapterNumber}: "${chapterTitle}" from the book "${bookTitle}" by ${bookAuthor}.

Here is the explanation of this chapter that the student just read:
---
${chapterContent || "No explanation available."}
---

Answer the student's questions clearly and concisely, building on first principles. Stay focused on the chapter content and the book's broader ideas. If a question goes beyond this chapter, briefly acknowledge that and redirect to what this chapter covers. Be conversational and encouraging.`;

    try {
      const contents = [
        ...history.map((m: { role: string; content: string }) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: [{ text: question }] },
      ];

      const stream = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        systemInstruction: systemPrompt,
        contents,
        config: { maxOutputTokens: 2048 },
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
      req.log.error({ err }, "Error in chapter chat");
      res.write(`data: ${JSON.stringify({ error: "Failed to respond" })}\n\n`);
      res.end();
    }
  }
);

export default router;
