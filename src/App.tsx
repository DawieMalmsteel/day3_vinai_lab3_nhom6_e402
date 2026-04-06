import React, { useState, useRef, useEffect } from 'react';
import { Send, Plane, Hotel, MapPin, Compass, Loader2, User, Bot, Sparkles, ChevronRight } from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { chatWithTravelAgent, handleToolCalls } from './services/gemini';
import { debug } from './utils/debug';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isPlanning?: boolean;
  sources?: { uri: string; title: string }[];
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Xin chào! Tôi là trợ lý du lịch AI của bạn. Tôi có thể giúp bạn tìm chuyến bay, khách sạn và lên kế hoạch lộ trình chi tiết. Bạn muốn đi đâu hôm nay?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    debug.group(`Chat Cycle: ${userMessage.substring(0, 50)}...`);
    debug.log('APP', 'User message received', userMessage);

    try {
      // Convert messages to Gemini format
      let chatHistory = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });

      debug.log('APP', `Chat history prepared`, { messageCount: chatHistory.length });

      let response = await chatWithTravelAgent(chatHistory);
      debug.log('APP', 'Initial response received from model');
      
      // Handle potential tool calls (ReAct loop) - Smart Hybrid Mode
      let toolResults = await handleToolCalls(response);
      let cycleCount = 0;
      let usedTools = false;
      
      while (toolResults) {
        usedTools = true;
        cycleCount++;
        debug.log('APP', `ReAct cycle ${cycleCount}: Tool calls detected`, {
          toolCount: toolResults.length,
          tools: toolResults.map(r => r.functionResponse.name),
        });

        // Show what the agent is doing in the UI
        const toolNames = toolResults.map(r => r.functionResponse.name).join(', ');
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: `*Đang truy xuất thông tin từ cẩm nang (${toolNames})...*`,
          isPlanning: true 
        }]);

        // Add tool results to history
        chatHistory.push(response.candidates![0].content as any);
        chatHistory.push({
          role: 'user',
          parts: toolResults as any
        });

        debug.log('APP', `Calling model again with tool results (cycle ${cycleCount})`);

        // Call model again with tool results
        response = await chatWithTravelAgent(chatHistory);
        toolResults = await handleToolCalls(response);
        
        // Remove the "planning" message before adding the final response or next planning step
        setMessages(prev => prev.filter(m => !m.isPlanning));
      }

      if (usedTools) {
        debug.success('APP', `ReAct loop completed after ${cycleCount} cycle(s)`);
      } else {
        debug.warn('APP', 'Model did not call any tools - using direct response (Hybrid Fallback Mode)');
      }

      const modelText = response.text || "Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn.";
      
      // Extract grounding sources
      const sources: { uri: string; title: string }[] = [];
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        debug.log('APP', `Found ${groundingChunks.length} grounding chunks`);
        groundingChunks.forEach((chunk: any) => {
          if (chunk.web) {
            sources.push({ uri: chunk.web.uri, title: chunk.web.title });
          }
        });
        debug.success('APP', `Extracted ${sources.length} reference sources`);
      }

      setMessages(prev => [...prev, { role: 'model', text: modelText, sources }]);
      debug.success('APP', 'Final response added to chat');
    } catch (error: any) {
      debug.error('APP', 'Chat error occurred', error);
      console.error("Chat error:", error);
      let errorMessage = "Đã có lỗi xảy ra. Vui lòng thử lại sau.";
      
      if (error?.message?.includes("429") || error?.status === "RESOURCE_EXHAUSTED") {
        errorMessage = "Hệ thống đang quá tải (vượt quá hạn mức). Vui lòng đợi 1-2 phút rồi thử lại.";
      } else if (error?.message?.includes("500") || error?.message?.includes("xhr error")) {
        errorMessage = "Lỗi kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.";
      }

      setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
    } finally {
      setIsLoading(false);
      debug.groupEnd();
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <Compass className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 tracking-tight">AI Travel Agent</h1>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Sẵn sàng lên kế hoạch cho bạn
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-600">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full">
            <Plane className="w-4 h-4" />
            <span>Vé máy bay</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full">
            <Hotel className="w-4 h-4" />
            <span>Khách sạn</span>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                msg.role === 'user' ? "bg-slate-800" : "bg-blue-600"
              )}>
                {msg.role === 'user' ? <User className="text-white w-5 h-5" /> : <Bot className="text-white w-5 h-5" />}
              </div>
              <div className={cn(
                "max-w-[85%] md:max-w-[70%] rounded-3xl px-6 py-4 shadow-sm",
                msg.role === 'user' 
                  ? "bg-slate-800 text-white rounded-tr-none" 
                  : msg.isPlanning 
                    ? "bg-blue-50 border border-blue-100 text-blue-600 italic text-sm rounded-tl-none"
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
              )}>
                <div className="markdown-body">
                  <Markdown>{msg.text}</Markdown>
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Nguồn tham khảo:</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((source, sIdx) => (
                        <a
                          key={sIdx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded flex items-center gap-1 transition-colors hover:bg-blue-100"
                        >
                          <MapPin className="w-2.5 h-2.5" />
                          {source.title || 'Xem nguồn'}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
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
                <span className="text-sm text-slate-500 font-medium">Đang tính toán...</span>
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
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Nhập yêu cầu du lịch của bạn (VD: Lên kế hoạch đi Đà Nẵng 3 ngày...)"
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
          
          {/* Quick Suggestions */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              "Gợi ý địa điểm ở Đà Lạt",
              "Kế hoạch Đà Nẵng 3 ngày 10tr",
              "Tìm khách sạn tại Phú Quốc",
              "Lịch trình trekking Sapa"
            ].map((suggestion, i) => (
              <button
                key={i}
                onClick={() => setInput(suggestion)}
                className="text-xs font-medium text-slate-500 bg-slate-50 hover:bg-white hover:text-blue-600 border border-slate-200 px-3 py-1.5 rounded-full transition-all flex items-center gap-1 group"
              >
                {suggestion}
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
