import { Link, useLocation } from "wouter";
import { Sparkles, ArrowLeft } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
  showBack?: boolean;
  backTo?: string;
  onBack?: () => void;
}

export function Layout({ children, showBack, backTo, onBack }: LayoutProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      setLocation(backTo);
    } else {
      window.history.back();
    }
  };

  return (
    <div className="min-h-screen bg-mesh w-full flex flex-col relative overflow-hidden">
      {/* Subtle ambient light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <header className="w-full px-6 py-8 md:px-12 flex items-center justify-between z-10">
        <div className="flex items-center gap-6">
          {showBack && (
            <button 
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-full hover:bg-white/5"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <Sparkles className="w-5 h-5 text-primary group-hover:text-primary/80 transition-colors" />
            <span className="font-serif text-xl tracking-wide text-foreground">TeachME</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full max-w-5xl mx-auto px-6 pb-24 z-10 relative">
        {children}
      </main>
    </div>
  );
}
