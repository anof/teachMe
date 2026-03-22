import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Book, BookWithChapters } from '@workspace/api-client-react';

interface AppState {
  topic: string;
  setTopic: (topic: string) => void;
  
  books: Book[];
  setBooks: (books: Book[]) => void;
  
  selectedBook: Book | null;
  setSelectedBook: (book: Book | null) => void;
  
  bookDetails: Record<string, BookWithChapters>;
  setBookDetails: (bookId: string, details: BookWithChapters) => void;
  
  clearSession: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      topic: '',
      setTopic: (topic) => set({ topic }),
      
      books: [],
      setBooks: (books) => set({ books }),
      
      selectedBook: null,
      setSelectedBook: (selectedBook) => set({ selectedBook }),
      
      bookDetails: {},
      setBookDetails: (bookId, details) => 
        set((state) => ({ 
          bookDetails: { ...state.bookDetails, [bookId]: details } 
        })),
        
      clearSession: () => set({ topic: '', books: [], selectedBook: null, bookDetails: {} }),
    }),
    {
      name: 'teachme-storage',
    }
  )
);
