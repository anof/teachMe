import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, Sparkles, ArrowRight, Layers } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { Layout } from "@/components/layout";
import { useGetBookChapters } from "@workspace/api-client-react";

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  
  const { selectedBook, bookDetails, setBookDetails } = useAppStore();
  const getChapters = useGetBookChapters();

  const details = id ? bookDetails[id] : null;

  useEffect(() => {
    if (!selectedBook) {
      setLocation("/");
      return;
    }

    if (!details && id) {
      getChapters.mutate(
        { 
          bookId: id, 
          data: { 
            bookTitle: selectedBook.title, 
            bookAuthor: selectedBook.author 
          } 
        },
        {
          onSuccess: (data) => {
            setBookDetails(id, data);
          }
        }
      );
    }
  }, [id, selectedBook, details, getChapters, setBookDetails, setLocation]);

  if (!selectedBook) return null;

  const isPending = getChapters.isPending && !details;

  return (
    <Layout showBack backTo="/books">
      <div className="py-8 max-w-4xl mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-muted-foreground mb-6">
            <BookOpen className="w-4 h-4 text-primary" />
            <span>Mastering {selectedBook.title}</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-serif text-foreground mb-4">
            {selectedBook.title}
          </h1>
          <p className="text-xl text-primary font-serif italic mb-8">
            by {selectedBook.author}, {selectedBook.year}
          </p>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <h3 className="text-lg font-medium text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Core Synthesis
            </h3>
            <p className="text-lg text-foreground/80 leading-relaxed font-light">
              {details?.fullSummary || selectedBook.summary}
            </p>
          </div>
        </motion.div>

        {isPending ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-muted-foreground tracking-widest uppercase text-sm animate-pulse">
              Extracting Chapters...
            </p>
          </div>
        ) : details ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
              <h2 className="text-2xl font-serif text-foreground flex items-center gap-3">
                <Layers className="w-6 h-6 text-primary" />
                Structural Breakdown
              </h2>
              <button 
                onClick={() => setLocation(`/books/${id}/chapters/${details.chapters[0]?.id}`)}
                className="hidden md:flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Deep Dive: Full Book <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {details.chapters.map((chapter, index) => (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  key={chapter.id}
                  onClick={() => setLocation(`/books/${id}/chapters/${chapter.id}`)}
                  className="group flex gap-6 p-6 rounded-2xl bg-card border border-white/5 hover:border-primary/40 hover:bg-white/5 cursor-pointer transition-all duration-300"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-serif text-xl text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {chapter.number}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-serif text-foreground mb-2 group-hover:text-primary transition-colors">
                      {chapter.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed line-clamp-2">
                      {chapter.summary}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0 duration-300">
                    <ArrowRight className="w-6 h-6 text-primary" />
                  </div>
                </motion.div>
              ))}
            </div>
            
            <button 
              onClick={() => setLocation(`/books/${id}/chapters/${details.chapters[0]?.id}`)}
              className="md:hidden mt-8 w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Deep Dive: Full Book <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        ) : null}
      </div>
    </Layout>
  );
}
