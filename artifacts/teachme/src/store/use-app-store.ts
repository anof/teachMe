import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Book, BookWithChapters } from '@workspace/api-client-react';

interface AppState {
  topic: string;
  setTopic: (topic: string) => void;
  
  books: Book[];
  setBooks: (books: Book[]) => void;
  appendBooks: (books: Book[]) => void;
  
  selectedBook: Book | null;
  setSelectedBook: (book: Book | null) => void;
  
  bookDetails: Record<string, BookWithChapters>;
  setBookDetails: (bookId: string, details: BookWithChapters) => void;

  // Persisted chapter explanations — keyed by "bookId/chapterId"
  chapterExplanations: Record<string, string>;
  setChapterExplanation: (key: string, text: string) => void;
  
  clearSession: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      topic: '',
      setTopic: (topic) => set({ topic }),
      
      books: [],
      setBooks: (books) => set({ books }),
      appendBooks: (newBooks) =>
        set((state) => ({ books: [...state.books, ...newBooks] })),
      
      selectedBook: null,
      setSelectedBook: (selectedBook) => set({ selectedBook }),
      
      bookDetails: {},
      setBookDetails: (bookId, details) =>
        set((state) => ({
          bookDetails: { ...state.bookDetails, [bookId]: details },
        })),

      chapterExplanations: {},
      setChapterExplanation: (key, text) =>
        set((state) => ({
          chapterExplanations: { ...state.chapterExplanations, [key]: text },
        })),
        
      clearSession: () => set({
        topic: '',
        books: [],
        selectedBook: null,
        bookDetails: {},
        chapterExplanations: {},
      }),
    }),
    {
      name: 'teachme-storage',
    }
  )
);
