import { useState, useCallback } from 'react';

export function useExplainChapterStream() {
  const [text, setText] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startStream = useCallback(async (
    bookId: string, 
    chapterId: string, 
    body: { bookTitle: string; bookAuthor: string; chapterTitle: string; chapterNumber: number }
  ) => {
    setIsWaiting(true);
    setIsStreaming(false);
    setText("");
    setIsDone(false);
    setError(null);

    try {
      const res = await fetch(`/api/teachme/books/${bookId}/chapters/${chapterId}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error("Failed to connect to the knowledge source.");
      if (!res.body) throw new Error("No response body received.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            if (dataStr === "[DONE]") {
              setIsDone(true);
              continue;
            }

            try {
              const data = JSON.parse(dataStr);
              if (data.done) {
                setIsDone(true);
              } else if (data.content) {
                // First content chunk — switch from waiting to streaming
                setIsWaiting(false);
                setIsStreaming(true);
                setText(prev => prev + data.content);
              }
            } catch (e) {
              console.error("Failed to parse stream chunk", e);
            }
          }
        }
      }
    } catch (err) {
      setIsWaiting(false);
      setError(err instanceof Error ? err.message : "An unknown error occurred during transmission.");
    } finally {
      setIsWaiting(false);
      setIsStreaming(false);
      setIsDone(true);
    }
  }, []);

  return { text, isWaiting, isStreaming, isDone, error, startStream };
}
