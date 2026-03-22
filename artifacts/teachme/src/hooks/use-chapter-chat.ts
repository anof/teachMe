import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function useChapterChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);

  const sendMessage = useCallback(
    async (params: {
      bookId: string;
      chapterId: string;
      bookTitle: string;
      bookAuthor: string;
      bookSummary: string;
      chapterTitle: string;
      chapterNumber: number;
      chapterContent: string;
      question: string;
    }) => {
      const { bookId, chapterId, question, ...context } = params;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: question,
      };

      const assistantId = `assistant-${Date.now() + 1}`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      // Snapshot completed messages BEFORE adding new ones — these are the history
      const completedHistory = messagesRef.current
        .filter((m) => !m.isStreaming)
        .map((m) => ({ role: m.role, content: m.content }));

      // Now add the new messages to the ref and state
      messagesRef.current = [...messagesRef.current, userMsg, assistantMsg];
      setMessages([...messagesRef.current]);
      setIsResponding(true);

      try {
        const res = await fetch(
          `/api/teachme/books/${bookId}/chapters/${chapterId}/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...context,
              messages: completedHistory,
              question,
            }),
          }
        );

        if (!res.ok || !res.body) throw new Error("Connection failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                accumulated += data.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: accumulated } : m
                  )
                );
              }
              if (data.done) break;
            } catch {}
          }
        }

        // Mark streaming complete and persist final content
        const finalMsg = { id: assistantId, role: "assistant" as const, content: accumulated, isStreaming: false };
        messagesRef.current = messagesRef.current.map((m) =>
          m.id === assistantId ? finalMsg : m
        );
        setMessages([...messagesRef.current]);
      } catch {
        const errMsg = { id: assistantId, role: "assistant" as const, content: "Sorry, something went wrong. Please try again.", isStreaming: false };
        messagesRef.current = messagesRef.current.map((m) =>
          m.id === assistantId ? errMsg : m
        );
        setMessages([...messagesRef.current]);
      } finally {
        setIsResponding(false);
      }
    },
    []
  );

  return { messages, isResponding, sendMessage };
}
