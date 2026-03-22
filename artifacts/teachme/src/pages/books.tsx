import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, Calendar, SignalHigh, RefreshCw } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { Layout } from "@/components/layout";
import type { Book } from "@workspace/api-client-react";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function Books() {
  const [, setLocation] = useLocation();
  const { topic, books, setSelectedBook, appendBooks } = useAppStore();
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!topic || books.length === 0) {
      setLocation("/");
    }
  }, [topic, books, setLocation]);

  const handleSelectBook = (book: Book) => {
    setSelectedBook(book);
    setLocation(`/books/${book.id}`);
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const response = await fetch("/api/teachme/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          exclude: books.map((b) => b.title),
        }),
      });
      if (response.ok) {
        const newBooks: Book[] = await response.json();
        appendBooks(newBooks);
      }
    } catch (err) {
      console.error("Failed to load more books", err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (!topic || books.length === 0) return null;

  return (
    <Layout showBack backTo="/">
      <div className="py-8">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h2 className="text-muted-foreground tracking-widest uppercase text-sm mb-2">Curated Collection</h2>
          <h1 className="text-4xl md:text-5xl font-serif text-foreground">
            Foundational texts on <span className="text-primary italic">{topic}</span>
          </h1>
        </motion.div>

        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {books.map((book) => (
            <motion.div
              key={book.id}
              variants={item}
              onClick={() => handleSelectBook(book)}
              className="group relative bg-card border border-white/5 rounded-2xl p-6 md:p-8 cursor-pointer overflow-hidden transition-all duration-500 hover:border-primary/50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:-translate-y-1 flex flex-col h-full"
            >
              {/* Hover gradient effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-white/5 rounded-xl text-primary">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-muted-foreground">
                    <SignalHigh className="w-3 h-3" />
                    {book.difficulty}
                  </div>
                </div>

                <h3 className="text-2xl font-serif text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                  {book.title}
                </h3>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                  <span className="font-medium text-foreground/80">{book.author}</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {book.year}
                  </div>
                </div>

                <p className="text-foreground/70 leading-relaxed mb-8 flex-1 line-clamp-4">
                  {book.summary}
                </p>

                <div className="mt-auto">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Key Principles</p>
                  <div className="flex flex-wrap gap-2">
                    {book.keyPrinciples.slice(0, 3).map((principle, i) => (
                      <span 
                        key={i}
                        className="px-2.5 py-1 rounded-md bg-white/5 text-xs text-foreground/80 border border-white/5"
                      >
                        {principle}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Load more */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center mt-14"
        >
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="group flex items-center gap-3 px-7 py-3.5 rounded-full border border-white/10 bg-white/5 text-foreground/70 text-sm font-medium tracking-wide hover:border-primary/40 hover:text-foreground hover:bg-white/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw
              className={`w-4 h-4 transition-transform duration-500 ${loadingMore ? "animate-spin" : "group-hover:rotate-180"}`}
            />
            {loadingMore ? "Finding more books…" : "Show more book options"}
          </button>
        </motion.div>
      </div>
    </Layout>
  );
}
