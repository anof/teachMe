import { Router, type IRouter } from "express";
import OpenAI from "openai";
import {
  FindBooksBody,
  GetBookChaptersBody,
  ExplainChapterBody,
} from "@workspace/api-zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a learning assistant that recommends books on "${topic}" from first principles.

SELECTION CRITERIA (in strict priority order):
1. RECENCY: Strongly prefer books published in 2020 or later. Books from 2015–2019 are acceptable. Only include older books if they are truly irreplaceable classics with no modern equivalent.
2. FIRST PRINCIPLES: Prioritize books that build knowledge from the ground up — deriving understanding from foundational truths rather than presenting untested opinions or speculative frameworks.
3. EVIDENCE-BASED: Prefer books grounded in empirical research, rigorous practice, or proven methodologies over purely theoretical or trend-driven content.
4. DEPTH: Choose books that reward careful reading and teach lasting mental models, not surface-level summaries or listicles.

Find exactly 5 books matching these criteria. Return them ordered from most recent to least recent.${excludeClause}

Return a JSON object with a "books" key containing an array with exactly this structure:
{
  "books": [
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
}

Only return valid JSON.`,
        },
        {
          role: "user",
          content: `Find 5 first-principles books on: ${topic}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '{"books":[]}';
    let books;
    try {
      const parsed = JSON.parse(text);
      books = Array.isArray(parsed) ? parsed : (parsed.books ?? []);
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
    const response = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a learning assistant with deep knowledge of books. Return only valid JSON.`,
        },
        {
          role: "user",
          content: `For the book "${bookTitle}" by ${bookAuthor}, provide:
1. A comprehensive full summary (4-6 sentences covering the main thesis, key ideas, and why it matters)
2. A list of the actual chapters or major sections of this book

Return a JSON object with exactly this structure:
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

Use the actual chapter structure of the book if known. If you're unsure of exact chapters, create logical sections that accurately represent the book's content flow. Include 6-15 chapters/sections.`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "{}";
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
      const stream = await openai.chat.completions.create({
        model: "gpt-5.4-mini",
        max_completion_tokens: 8192,
        stream: true,
        messages: [
          {
            role: "system",
            content: `You are a sharp, concise teacher who explains ideas from first principles. No padding, no filler.`,
          },
          {
            role: "user",
            content: `Explain Chapter ${chapterNumber}: "${chapterTitle}" from "${bookTitle}" by ${bookAuthor}.

Rules:
- Open directly with the core problem or insight — no preamble
- Build from first principles: assume smart reader, zero jargon
- Use one or two concrete analogies where they sharpen understanding
- Cover only the chapter's essential ideas — cut everything else
- Close with the single most important takeaway in one sentence

Write in tight prose. Target 300-400 words. Every sentence must earn its place.`,
          },
        ],
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
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
    const { bookTitle, bookAuthor, bookSummary, chapterTitle, chapterNumber, chapterContent, messages, question } = req.body;

    if (!bookTitle || !chapterTitle || !question) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    req.log.info({ bookTitle, chapterTitle, chapterContentLength: (chapterContent || "").length }, "Chapter chat request");

    const history = Array.isArray(messages) ? messages : [];

    const systemPrompt = `You are a focused tutor. Answer questions strictly based on the book and chapter context below.

BOOK: "${bookTitle}" by ${bookAuthor}
BOOK SUMMARY: ${bookSummary || "(not available)"}

CHAPTER ${chapterNumber}: "${chapterTitle}"
CHAPTER EXPLANATION:
---
${chapterContent || "(not available)"}
---

RULES:
1. Answer only questions about this book and chapter.
2. Ground every answer in the context above — the book summary and chapter explanation.
3. Be concise and direct. No fluff.
4. If asked anything completely unrelated, say: "I can only help with questions about this chapter."
5. Never talk about yourself or your capabilities.`;

    try {
      const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...history.map((m: { role: string; content: string }) => ({
          role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: question },
      ];

      const stream = await openai.chat.completions.create({
        model: "gpt-5.4-mini",
        max_completion_tokens: 2048,
        stream: true,
        messages: chatMessages,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
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
