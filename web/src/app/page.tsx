"use client";

import { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

type Message = {
  role: Role;
  content: string;
};

const SUGGESTIONS = [
  "How much is 100 SGD in JPY?",
  "What's the weather in Tokyo today?",
  "Tell me about Angkor Wat.",
  "Plan a 3-day trip to Kyoto.",
];

function makeSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function readSse(
  response: Response,
  onEvent: (event: string, data: unknown) => void
): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separator: number;
    while ((separator = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);

      let eventName = "message";
      const dataLines: string[] = [];
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }
      if (dataLines.length > 0) {
        try {
          onEvent(eventName, JSON.parse(dataLines.join("\n")));
        } catch {
          onEvent(eventName, dataLines.join("\n"));
        }
      }
    }
  }
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [sessionId] = useState(makeSessionId);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isStreaming, activeTool]);

  async function handleSend(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || isStreaming) return;

    setInput("");
    setError(null);
    setActiveTool(null);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.error ??
            `Request failed with status ${response.status}. Please try again.`
        );
      }

      let assistantText = "";
      await readSse(response, (event, data) => {
        if (event === "text") {
          const chunk = (data as { text?: string })?.text ?? "";
          if (chunk) {
            assistantText += chunk;
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = {
                role: "assistant",
                content: assistantText,
              };
              return next;
            });
          }
        } else if (event === "tool") {
          const name = (data as { name?: string })?.name ?? "tool";
          setActiveTool(name);
        } else if (event === "done") {
          setActiveTool(null);
        } else if (event === "error") {
          throw new Error(
            (data as { message?: string })?.message ??
              "The agent failed to respond."
          );
        }
      });

      if (!assistantText) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: "I did not produce a response. Please try rephrasing.",
          };
          return next;
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant" && last.content === "") {
          next[next.length - 1] = { role: "assistant", content: message };
        } else {
          next.push({ role: "assistant", content: message });
        }
        return next;
      });
    } finally {
      setIsStreaming(false);
      setActiveTool(null);
      textareaRef.current?.focus();
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-sky-50 via-white to-emerald-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      <header className="border-b border-black/5 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Travel Agent
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Currency, weather &amp; news, history and culture — all in one trip.
            </p>
          </div>
          <span className="hidden rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 sm:inline-block dark:bg-emerald-900/40 dark:text-emerald-300">
            Powered by Gemini
          </span>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-6 py-12 text-center">
              <div className="text-5xl">🌍</div>
              <div>
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  Where to next?
                </h2>
                <p className="mt-2 max-w-md text-zinc-500 dark:text-zinc-400">
                  Ask about live exchange rates, weather and local news, or dive
                  into the history of a landmark.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950 dark:hover:text-emerald-300"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${
                  message.role === "user"
                    ? "rounded-br-md bg-indigo-600 text-white"
                    : "rounded-bl-md bg-white text-zinc-800 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-white/10"
                }`}
              >
                {message.content}
                {message.role === "assistant" &&
                  index === messages.length - 1 &&
                  isStreaming && (
                    <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-zinc-400 align-middle dark:bg-zinc-500" />
                  )}
              </div>
            </div>
          ))}

          {isStreaming && activeTool && (
            <div className="flex items-center gap-2 px-1 text-xs text-zinc-400 dark:text-zinc-500">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
              Using tool: <code className="font-mono">{activeTool}</code>
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-black/5 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
          {error && (
            <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              rows={1}
              placeholder={
                isStreaming
                  ? "The agent is thinking…"
                  : "Ask about currency, weather, or landmarks…"
              }
              className="max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isStreaming}
              className="flex h-[44px] shrink-0 items-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
