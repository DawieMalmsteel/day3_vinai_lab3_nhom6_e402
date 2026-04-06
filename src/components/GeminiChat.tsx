import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  User,
  Bot,
  Sparkles,
} from "lucide-react";
import Markdown from "react-markdown";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { chatWithTravelAgent } from "../services/gemini";
import { debug } from "../utils/debug";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export default function GeminiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      text: "Xin chào! Tôi là trợ lý du lịch Gemini. Tôi có thể giúp bạn tìm thông tin chuyến bay, khách sạn và cẩm nang du lịch. Bạn muốn khám phá đâu hôm nay?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);

    debug.group(`Gemini Chat: ${userMessage.substring(0, 50)}...`);

    try {
      const chatHistory = messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));
      chatHistory.push({ role: "user", parts: [{ text: userMessage }] });

      const response = await chatWithTravelAgent(chatHistory);
      const modelText = response.text || "Xin lỗi, tôi gặp sự cố khi kết nối với Gemini.";

      setMessages((prev) => [
        ...prev,
        { role: "model", text: modelText },
      ]);
      debug.success("GEMINI_UI", "Response added to chat");
    } catch (error: any) {
      debug.error("GEMINI_UI", "Chat error", error);
      setMessages((prev) => [
        ...prev,
        { role: "model", text: "Đã có lỗi xảy ra. Vui lòng thử lại sau." },
      ]);
    } finally {
      setIsLoading(false);
      debug.groupEnd();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                msg.role === "user" ? "flex-row-reverse" : "flex-row",
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                  msg.role === "user" ? "bg-slate-800" : "bg-blue-600",
                )}
              >
                {msg.role === "user" ? (
                  <User className="text-white w-5 h-5" />
                ) : (
                  <Bot className="text-white w-5 h-5" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[85%] md:max-w-[70%] rounded-3xl px-6 py-4 shadow-sm",
                  msg.role === "user"
                    ? "bg-slate-800 text-white rounded-tr-none"
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-none",
                )}
              >
                <div className="markdown-body">
                  <Markdown>{msg.text}</Markdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
                <Sparkles className="text-blue-400 w-5 h-5 animate-spin" />
              </div>
              <div className="bg-white border border-slate-200 rounded-3xl rounded-tl-none px-6 py-4 w-48 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm text-slate-500 font-medium">
                  Gemini đang trả lời...
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-slate-200 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-2xl border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Hỏi Gemini về du lịch..."
              className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-2 text-slate-800 placeholder:text-slate-400"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white p-3 rounded-xl transition-colors shadow-md shadow-blue-200"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
