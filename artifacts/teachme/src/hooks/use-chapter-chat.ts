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
      chapterTitle: string;
      chapterNumber: number;
      chapterContent: string;
      question: string;
    }) => {
      const { bookId, chapterId, question, chapterContent, ...context } = params;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: question,
      };

      const assistantId = `assistant-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      const updatedMessages = [...messagesRef.current, userMsg, assistantMsg];
      messagesRef.current = updatedMessages;
      setMessages([...updatedMessages]);
      setIsResponding(true);

      try {
        const history = messagesRef.current
          .filter((m) => !m.isStreaming && m.id !== assistantId)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch(
          `/api/teachme/books/${bookId}/chapters/${chapterId}/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...context,
              chapterContent,
              messages: history,
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
                    m.id === assistantId
                      ? { ...m, content: accumulated }
                      : m
                  )
                );
              }
              if (data.done) break;
            } catch {}
          }
        }

        // Mark streaming complete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        );
        messagesRef.current = messagesRef.current.map((m) =>
          m.id === assistantId
            ? { ...m, content: accumulated, isStreaming: false }
            : m
        );
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "Sorry, something went wrong. Please try again.",
                  isStreaming: false,
                }
              : m
          )
        );
      } finally {
        setIsResponding(false);
      }
    },
    []
  );

  return { messages, isResponding, sendMessage };
}
