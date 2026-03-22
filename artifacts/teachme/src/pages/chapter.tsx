import { useEffect, useRef, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { ArrowRight, BookOpen, CheckCircle2, PlayCircle } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { Layout } from "@/components/layout";
import { useExplainChapterStream } from "@/hooks/use-stream";

export default function ChapterExplain() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const [, setLocation] = useLocation();
  const bottomRef = useRef<HTMLDivElement>(null);
  
  const { selectedBook, bookDetails } = useAppStore();
  const { text, isWaiting, isStreaming, isDone, error, startStream } = useExplainChapterStream();

  const details = bookId ? bookDetails[bookId] : null;
  
  const currentChapterIndex = useMemo(() => {
    if (!details || !chapterId) return -1;
    return details.chapters.findIndex(c => c.id === chapterId);
  }, [details, chapterId]);

  const chapter = currentChapterIndex >= 0 ? details!.chapters[currentChapterIndex] : null;
  const nextChapter = currentChapterIndex >= 0 && currentChapterIndex < details!.chapters.length - 1 
    ? details!.chapters[currentChapterIndex + 1] 
    : null;

  useEffect(() => {
    if (!selectedBook || !details || !chapter) {
      setLocation("/");
      return;
    }

    startStream(bookId!, chapterId!, {
      bookTitle: selectedBook.title,
      bookAuthor: selectedBook.author,
      chapterTitle: chapter.title,
      chapterNumber: chapter.number
    });
  }, [bookId, chapterId, selectedBook, details, chapter, startStream, setLocation]);

  // Auto-scroll while streaming
  useEffect(() => {
    if (isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [text, isStreaming]);

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

        {/* Markdown Output */}
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
              {/* Animated bars */}
              <div className="flex items-end gap-1.5 h-10">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 rounded-full bg-primary"
                    animate={{ height: ["16px", "40px", "16px"] }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm uppercase tracking-widest text-muted-foreground">
                  Preparing explanation
                </p>
                <p className="text-xs text-muted-foreground/50">
                  Chapter {chapter?.number} · {chapter?.title}
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
          <div ref={bottomRef} className="h-20" />
        </div>

        {/* Completion State / Next Button */}
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
      </div>
    </Layout>
  );
}
