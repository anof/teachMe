import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Search, ArrowRight, Sparkles, BookOpen, Brain, Compass } from "lucide-react";
import { useFindBooks } from "@workspace/api-client-react";
import { useAppStore } from "@/store/use-app-store";
import { Layout } from "@/components/layout";

const SUGGESTIONS = [
  { icon: <Compass className="w-4 h-4" />, text: "Stoicism & Resilience" },
  { icon: <Brain className="w-4 h-4" />, text: "Neural Networks" },
  { icon: <BookOpen className="w-4 h-4" />, text: "Macroeconomics" }
];

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [, setLocation] = useLocation();
  const { setTopic, setBooks } = useAppStore();
  
  const findBooks = useFindBooks();

  const handleSearch = (topic: string) => {
    if (!topic.trim() || findBooks.isPending) return;
    
    setTopic(topic);
    findBooks.mutate(
      { data: { topic } },
      {
        onSuccess: (data) => {
          setBooks(data);
          setLocation("/books");
        },
      }
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(inputValue);
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center -mt-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center w-full max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm mb-8">
            <Sparkles className="w-4 h-4" />
            <span>First-principles learning</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-serif text-foreground mb-6 leading-tight">
            Master any subject.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/50">
              Deeply & simply.
            </span>
          </h1>
          
          <p className="text-lg text-muted-foreground mb-12 max-w-xl mx-auto font-light tracking-wide">
            Tell me what you want to learn. I'll find the foundational texts and distill them into simple, understandable concepts.
          </p>

          <form onSubmit={onSubmit} className="relative w-full max-w-2xl mx-auto group">
            <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl transition-all duration-500 group-hover:bg-primary/30 group-focus-within:bg-primary/40 opacity-50" />
            <div className="relative flex items-center bg-card border-2 border-white/10 rounded-2xl shadow-2xl transition-all duration-300 focus-within:border-primary/50 overflow-hidden">
              <Search className="w-6 h-6 text-muted-foreground ml-6" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="e.g. Quantum Mechanics, Philosophy, Value Investing..."
                className="w-full bg-transparent border-none text-lg px-4 py-6 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0"
                disabled={findBooks.isPending}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || findBooks.isPending}
                className="mr-3 p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary transition-all duration-200"
              >
                {findBooks.isPending ? (
                  <div className="w-6 h-6 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <ArrowRight className="w-6 h-6" />
                )}
              </button>
            </div>
          </form>

          {findBooks.isPending && (
            <motion.p 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="mt-6 text-primary tracking-wider animate-pulse"
            >
              Curating the library...
            </motion.p>
          )}

          {!findBooks.isPending && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="mt-12 flex flex-wrap justify-center gap-3"
            >
              <span className="text-muted-foreground text-sm w-full mb-2">Or explore topics:</span>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInputValue(s.text);
                    handleSearch(s.text);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/30 transition-all text-sm text-foreground/80 hover:text-primary"
                >
                  {s.icon}
                  {s.text}
                </button>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
