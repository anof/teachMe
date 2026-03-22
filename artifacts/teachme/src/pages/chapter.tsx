import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { BookOpen, CheckCircle2, PlayCircle, Send, MessageCircle } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { Layout } from "@/components/layout";
import { useExplainChapterStream } from "@/hooks/use-stream";
import { useChapterChat } from "@/hooks/use-chapter-chat";

export default function ChapterExplain() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const [, setLocation] = useLocation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");

  const { selectedBook, bookDetails, chapterExplanations, setChapterExplanation } = useAppStore();
  const { text, isWaiting, isStreaming, isDone, error, startStream, initializeWithText } = useExplainChapterStream();
  const { messages, isResponding, sendMessage } = useChapterChat();

  const details = bookId ? bookDetails[bookId] : null;

  const currentChapterIndex = useMemo(() => {
    if (!details || !chapterId) return -1;
    return details.chapters.findIndex(c => c.id === chapterId);
  }, [details, chapterId]);

  const chapter = currentChapterIndex >= 0 ? details!.chapters[currentChapterIndex] : null;
  const nextChapter =
    currentChapterIndex >= 0 && currentChapterIndex < details!.chapters.length - 1
      ? details!.chapters[currentChapterIndex + 1]
      : null;

  // Key for persisting this chapter's explanation
  const explanationKey = bookId && chapterId ? `${bookId}/${chapterId}` : null;

  // Guard: only trigger once per bookId+chapterId, even across strict-mode double-mounts
  const streamStartedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedBook || !details || !chapter || !explanationKey) {
      setLocation("/");
      return;
    }

    // Already started for this chapter — do nothing
    if (streamStartedFor.current === explanationKey) return;
    streamStartedFor.current = explanationKey;

    const saved = chapterExplanations[explanationKey];
    if (saved) {
      // We already have this explanation — show it instantly, no API call
      initializeWithText(saved);
      return;
    }

    // Stream fresh and persist when complete
    startStream(
      bookId!,
      chapterId!,
      {
        bookTitle: selectedBook.title,
        bookAuthor: selectedBook.author,
        chapterTitle: chapter.title,
        chapterNumber: chapter.number,
      },
      (fullText) => setChapterExplanation(explanationKey, fullText)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explanationKey, selectedBook, details, chapter]);

  // Auto-scroll while explanation streams
  useEffect(() => {
    if (isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [text, isStreaming]);

  // Auto-scroll when chat messages update
  useEffect(() => {
    if (messages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // The authoritative explanation text — prefer the persisted version so Q&A
  // always has full context even if the streaming state is stale
  const explanationText = (explanationKey && chapterExplanations[explanationKey]) || text;

  const handleSend = useCallback(() => {
    const question = inputValue.trim();
    if (!question || isResponding || !selectedBook || !chapter) return;
    setInputValue("");
    sendMessage({
      bookId: bookId!,
      chapterId: chapterId!,
      bookTitle: selectedBook.title,
      bookAuthor: selectedBook.author,
      bookSummary: selectedBook.summary,
      chapterTitle: chapter.title,
      chapterNumber: chapter.number,
      chapterContent: explanationText,
      question,
    });
  }, [inputValue, isResponding, selectedBook, chapter, bookId, chapterId, explanationText, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!selectedBook || !details || !chapter) return null;

  return (
    <Layout showBack backTo={`/books/${bookId}`}>
      <div className="py-4 md:py-8 max-w-3xl mx-auto w-full">
        {/* Sticky Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-white/5 py-4 mb-8 -mx-4 px-4 md:-mx-8 md:px-8"
        >
          <div className="flex items-center gap-3 text-sm text-primary mb-1">
            <BookOpen className="w-4 h-4" />
            <span>{selectedBook.title}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif text-foreground">
            <span className="text-muted-foreground mr-3">Chapter {chapter.number}.</span>
            {chapter.title}
          </h1>
        </motion.div>

        {/* Explanation */}
        <div className="min-h-[50vh]">
          {error ? (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-6 rounded-2xl">
              <h3 className="font-bold mb-2">Failed to decode chapter</h3>
              <p>{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-destructive/20 hover:bg-destructive/30 rounded-lg text-sm transition-colors"
              >
                Retry
              </button>
            </div>
          ) : isWaiting ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-32 gap-8"
            >
              <div className="flex items-end gap-1.5 h-10">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 rounded-full bg-primary"
                    animate={{ height: ["16px", "40px", "16px"] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                  />
                ))}
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm uppercase tracking-widest text-muted-foreground">Preparing explanation</p>
                <p className="text-xs text-muted-foreground/50">
                  Chapter {chapter.number} · {chapter.title}
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="prose-teachme">
              <ReactMarkdown>{text}</ReactMarkdown>
              {isStreaming && (
                <span className="inline-flex ml-2 w-2 h-5 bg-primary animate-pulse align-middle" />
              )}
            </div>
          )}
          <div ref={bottomRef} className="h-4" />
        </div>

        {/* Completion / Next Chapter */}
        <AnimatePresence>
          {isDone && !error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6"
            >
              <div className="flex items-center gap-3 text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium text-sm">Chapter Mastered</span>
              </div>

              {nextChapter ? (
                <button
                  onClick={() => setLocation(`/books/${bookId}/chapters/${nextChapter.id}`)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:-translate-y-1"
                >
                  <PlayCircle className="w-5 h-5" />
                  Continue to Chapter {nextChapter.number}
                </button>
              ) : (
                <button
                  onClick={() => setLocation("/")}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white/10 text-foreground font-medium hover:bg-white/20 transition-all border border-white/10"
                >
                  <BookOpen className="w-5 h-5" />
                  Explore New Topic
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Q&A Chat Section */}
        <AnimatePresence>
          {isDone && !error && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-16"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="flex-1 h-px bg-white/10" />
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <MessageCircle className="w-4 h-4" />
                  <span>Ask about this chapter</span>
                </div>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Messages */}
              <div className="space-y-4 mb-6">
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mr-3 mt-1 shrink-0">
                          <BookOpen className="w-3.5 h-3.5 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-white/5 border border-white/10 text-foreground rounded-bl-sm"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose-chat">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                            {msg.isStreaming && msg.content && (
                              <span className="inline-flex ml-1 w-1.5 h-4 bg-primary/60 animate-pulse align-middle rounded-full" />
                            )}
                            {msg.isStreaming && !msg.content && (
                              <span className="flex gap-1 items-center py-1">
                                {[0, 1, 2].map(i => (
                                  <motion.span
                                    key={i}
                                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                                  />
                                ))}
                              </span>
                            )}
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={chatBottomRef} />
              </div>

              {/* Input */}
              <div className="sticky bottom-4 z-10">
                <div className="flex items-end gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-primary/40 transition-all shadow-xl shadow-black/20">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything about this chapter…"
                    rows={1}
                    disabled={isResponding}
                    className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/50 text-sm resize-none outline-none leading-relaxed disabled:opacity-50"
                    style={{ minHeight: "24px", maxHeight: "120px" }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isResponding}
                    className="shrink-0 w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-center text-xs text-muted-foreground/40 mt-2">
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="h-8" />
      </div>
    </Layout>
  );
}
