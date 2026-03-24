import { Router, type IRouter, type Request } from "express";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const router: IRouter = Router();

function appBaseUrl(req: Request): string {
  return process.env.APP_BASE_URL ?? "https://teach-me.replit.app";
}

/**
 * GET /api/v1
 *
 * Returns the full API definition — endpoints, parameters, and example responses.
 */
router.get("/v1", (req, res) => {
  const base = appBaseUrl(req);
  res.json({
    name: "TeachME API",
    version: "1.0",
    baseUrl: `${base}/api/v1`,
    description: "Discover first-principles books on any topic and explore their chapters.",
    endpoints: [
      {
        method: "POST",
        path: "/api/v1/explore",
        description: "Find 5 first-principles books on a topic. Returns book details and links.",
        body: { topic: "string — the subject you want to learn (e.g. 'stoicism', 'investing')" },
        returns: {
          topic: "string",
          count: "number",
          books: [
            {
              id: "string — unique book slug",
              title: "string",
              author: "string",
              year: "string",
              difficulty: "Beginner | Intermediate | Advanced",
              summary: "string",
              keyPrinciples: ["string"],
              links: {
                webApp: "URL — open this book in TeachME (clickable)",
                chaptersApi: "URL — call this to get the book's chapters",
              },
            },
          ],
        },
        example: {
          curl: `curl -X POST ${base}/api/v1/explore -H "Content-Type: application/json" -d '{"topic":"stoicism"}'`,
        },
      },
      {
        method: "GET",
        path: "/api/v1/books/:bookId/chapters",
        description: "Get the full summary and all chapters for a book.",
        params: {
          bookId: "string — the book id from the explore response",
          title: "query param — the book title",
          author: "query param — the book author",
        },
        returns: {
          id: "string",
          title: "string",
          author: "string",
          year: "string",
          fullSummary: "string",
          chapterCount: "number",
          chapters: [
            {
              id: "string",
              number: "number",
              title: "string",
              summary: "string",
              links: {
                webApp: "URL — open this chapter in TeachME (clickable)",
              },
            },
          ],
          links: { webApp: "URL — open this book in TeachME (clickable)" },
        },
        example: {
          curl: `curl "${base}/api/v1/books/lessons-in-stoicism-2020/chapters?title=Lessons%20in%20Stoicism&author=John%20Sellars"`,
        },
      },
      {
        method: "GET",
        path: "/api/v1/open/books/:bookId",
        description: "Redirect directly to the TeachME book page. Use this as a clickable link.",
        params: {
          bookId: "string — the book id from the explore response",
          title: "query param — the book title",
          author: "query param — the book author",
          year: "query param (optional) — publication year",
          difficulty: "query param (optional) — difficulty level",
        },
        example: {
          url: `${base}/api/v1/open/books/lessons-in-stoicism-2020?title=Lessons%20in%20Stoicism&author=John%20Sellars&year=2020&difficulty=Beginner`,
        },
      },
    ],
  });
});

/**
 * GET /api/v1/open/books/:bookId
 *
 * Redirect shortcut — opens a book directly in the TeachME UI.
 * Use this URL as a clickable link in your other app.
 */
router.get("/v1/open/books/:bookId", (req, res) => {
  const { bookId } = req.params;
  const { title, author, year, difficulty } = req.query as Record<string, string>;
  const base = appBaseUrl(req);

  const params = new URLSearchParams();
  if (title) params.set("title", title);
  if (author) params.set("author", author);
  if (year) params.set("year", year);
  if (difficulty) params.set("difficulty", difficulty);

  const qs = params.toString();
  res.redirect(302, `${base}/books/${bookId}${qs ? `?${qs}` : ""}`);
});

/**
 * POST /api/v1/explore
 *
 * Body: { "topic": "investing" }
 *
 * Returns a list of 5 first-principles books on the topic,
 * each with a summary, key principles, difficulty, and deep links
 * into the TeachME web app and this API.
 */
router.post("/v1/explore", async (req, res) => {
  const { topic } = req.body ?? {};

  if (!topic || typeof topic !== "string" || !topic.trim()) {
    res.status(400).json({
      error: "Missing required field: topic",
      example: { topic: "investing" },
    });
    return;
  }

  const base = appBaseUrl(req);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are a learning assistant that recommends books from first principles.

SELECTION CRITERIA:
1. RECENCY: Prefer books from 2020 or later. Only include older books if they are irreplaceable classics.
2. FIRST PRINCIPLES: Books that build knowledge from foundational truths, not opinions.
3. EVIDENCE-BASED: Grounded in research, rigorous practice, or proven methodologies.
4. DEPTH: Teach lasting mental models, not surface-level summaries.

Return a JSON object with a "books" key containing exactly 5 books, ordered most recent first.`,
        },
        {
          role: "user",
          content: `Find 5 first-principles books on: ${topic.trim()}

Return this JSON structure:
{
  "books": [
    {
      "id": "unique-slug-id",
      "title": "Book Title",
      "author": "Author Name",
      "year": "Publication Year",
      "difficulty": "Beginner|Intermediate|Advanced",
      "summary": "2-3 sentence summary explaining what this book teaches and why it matters",
      "keyPrinciples": ["Principle 1", "Principle 2", "Principle 3"]
    }
  ]
}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '{"books":[]}';
    let rawBooks: Array<{
      id: string;
      title: string;
      author: string;
      year: string;
      difficulty: string;
      summary: string;
      keyPrinciples: string[];
    }>;

    try {
      const parsed = JSON.parse(text);
      rawBooks = Array.isArray(parsed) ? parsed : (parsed.books ?? []);
    } catch {
      rawBooks = [];
    }

    const books = rawBooks.map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      year: book.year,
      difficulty: book.difficulty,
      summary: book.summary,
      keyPrinciples: book.keyPrinciples ?? [],
      links: {
        webApp: `${base}/books/${book.id}?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}&year=${encodeURIComponent(book.year)}&difficulty=${encodeURIComponent(book.difficulty)}`,
        chaptersApi: `${base}/api/v1/books/${book.id}/chapters?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}`,
      },
    }));

    res.json({
      topic: topic.trim(),
      count: books.length,
      books,
    });
  } catch (err) {
    req.log.error({ err }, "v1 explore error");
    res.status(500).json({ error: "Failed to find books for this topic" });
  }
});

/**
 * GET /api/v1/books/:bookId/chapters
 *
 * Query params: title, author (required)
 *
 * Returns the book's full summary and all chapters,
 * each with a deep link into the TeachME web app.
 */
router.get("/v1/books/:bookId/chapters", async (req, res) => {
  const { bookId } = req.params;
  const { title, author } = req.query as { title?: string; author?: string };

  if (!title || !author) {
    res.status(400).json({
      error: "Missing required query params: title, author",
      example: `/api/v1/books/the-psychology-of-money/chapters?title=The+Psychology+of+Money&author=Morgan+Housel`,
    });
    return;
  }

  const base = appBaseUrl(req);

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
          content: `For the book "${title}" by ${author} (id: "${bookId}"), provide:
1. A comprehensive full summary (4-6 sentences)
2. The actual chapters or major sections

Return this JSON structure:
{
  "id": "${bookId}",
  "title": "${title}",
  "author": "${author}",
  "year": "publication year",
  "fullSummary": "4-6 sentence comprehensive summary",
  "chapters": [
    {
      "id": "chapter-slug",
      "number": 1,
      "title": "Chapter Title",
      "summary": "1-2 sentence description of what this chapter covers"
    }
  ]
}

Use the real chapter structure if known. Include 6-15 chapters.`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    let bookData: {
      id: string;
      title: string;
      author: string;
      year: string;
      fullSummary: string;
      chapters: Array<{ id: string; number: number; title: string; summary: string }>;
    };

    try {
      bookData = JSON.parse(text);
    } catch {
      bookData = {
        id: bookId,
        title: title as string,
        author: author as string,
        year: "Unknown",
        fullSummary: "Unable to retrieve book summary.",
        chapters: [],
      };
    }

    const chapters = (bookData.chapters ?? []).map((ch) => ({
      id: ch.id,
      number: ch.number,
      title: ch.title,
      summary: ch.summary,
      links: {
        webApp: `${base}/books/${bookId}/chapters/${ch.id}`,
      },
    }));

    res.json({
      id: bookData.id ?? bookId,
      title: bookData.title ?? title,
      author: bookData.author ?? author,
      year: bookData.year,
      fullSummary: bookData.fullSummary,
      chapterCount: chapters.length,
      chapters,
      links: {
        webApp: `${base}/books/${bookId}`,
      },
    });
  } catch (err) {
    req.log.error({ err }, "v1 chapters error");
    res.status(500).json({ error: "Failed to get chapters for this book" });
  }
});

export default router;
