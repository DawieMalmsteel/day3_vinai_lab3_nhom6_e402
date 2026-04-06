import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  User,
  Bot,
  Download,
} from "lucide-react";
import Markdown from "react-markdown";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { chatWithTravelAgent, handleToolCalls } from "../services/agent";
import { debug } from "../utils/debug";
import {
  detectRoute,
  parseTransport,
  parsePassengerCount,
  searchBookingLinks,
  formatBookingOptions,
} from "../services/bookingService";
import {
  detectHotelSearch,
  searchHotels,
  formatHotelsOptionA,
  formatHotelsOptionB,
  formatHotelsOptionC,
} from "../services/hotelService";
import { query_knowledge_base } from "../services/gemini";
import { exportToJson } from "../utils/file";
import type { TravelBookingState, HotelSearchState } from "../types";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatMessage {
  role: "user" | "model";
  text: string;
  isPlanning?: boolean;
  sources?: { uri: string; title: string }[];
}

export default function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      text: "Xin chào! Tôi là Agent thông minh. Tôi có thể sử dụng công cụ để tìm kiếm thông tin chi tiết cho bạn. Bạn cần hỗ trợ gì?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [bookingState, setBookingState] = useState<TravelBookingState>({
    step: "idle",
  });
  const [hotelState, setHotelState] = useState<HotelSearchState>({
    step: "idle",
    searchType: null,
  });
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

    debug.group(`Agent Chat: ${userMessage.substring(0, 50)}...`);

    try {


      // 2. Booking State Machine
      if (bookingState.step === "asking_transport") {
        const transport = parseTransport(userMessage);
        if (transport) {
          setBookingState(prev => ({ ...prev, transportMethod: transport, step: "asking_passengers" }));
          setMessages(prev => [...prev, { role: "model", text: `Bạn chọn ${transport === 'flight' ? 'máy bay' : 'xe buýt'}. Cho mấy hành khách vậy bạn?` }]);
          setIsLoading(false);
          debug.groupEnd();
          return;
        }
      } else if (bookingState.step === "asking_passengers") {
        const count = parsePassengerCount(userMessage);
        if (count) {
          setBookingState(prev => ({ ...prev, passengerCount: count, step: "searching" }));
          setMessages(prev => [...prev, { role: "model", text: `Đang tìm ${bookingState.transportMethod} từ ${bookingState.originCity} đến ${bookingState.destinationCity} cho ${count} người...`, isPlanning: true }]);
          
          try {
            const results = await searchBookingLinks(bookingState.originCity!, bookingState.destinationCity!, bookingState.transportMethod!, count);
            setMessages(prev => prev.filter(m => !m.isPlanning));
            setMessages(prev => [...prev, { role: "model", text: formatBookingOptions(results) }]);
            setBookingState({ step: "idle" });
          } catch (err) {
            setMessages(prev => prev.filter(m => !m.isPlanning));
            setMessages(prev => [...prev, { role: "model", text: "Lỗi khi tìm vé. Thử lại sau nhé!" }]);
            setBookingState({ step: "idle" });
          }
          setIsLoading(false);
          debug.groupEnd();
          return;
        }
      }

      // 3. Hotel State Machine
      if (hotelState.step === "asking_type") {
        const lower = userMessage.toLowerCase();
        let type: "quick" | "smart" | "detailed" | null = null;
        if (lower.includes("nhanh") || lower.includes("a")) type = "quick";
        else if (lower.includes("thông minh") || lower.includes("b")) type = "smart";
        else if (lower.includes("chi tiết") || lower.includes("c")) type = "detailed";

        if (type && hotelState.city) {
          setHotelState(prev => ({ ...prev, searchType: type, step: "searching" }));
          const hotels = searchHotels(hotelState.city);
          let text = "";
          if (type === "quick") text = formatHotelsOptionA(hotels);
          else if (type === "smart") text = formatHotelsOptionB(hotels);
          else text = formatHotelsOptionC(hotels);

          setMessages(prev => [...prev, { role: "model", text }]);
          setHotelState({ step: "idle", searchType: null });
          setIsLoading(false);
          debug.groupEnd();
          return;
        }
      }

      // 4. Detection Logic (Non-blocking)
      const route = detectRoute(userMessage);
      if (route.isValid) {
         setBookingState({ step: "asking_transport", originCity: route.from!, destinationCity: route.to! });
         setMessages(prev => [...prev, { role: "model", text: `Tôi thấy bạn muốn đi từ ${route.from} đến ${route.to}. Bạn muốn đi **máy bay** hay **xe buýt**?` }]);
         setIsLoading(false);
         debug.groupEnd();
         return;
      }

      const hotelCity = detectHotelSearch(userMessage);
      if (hotelCity && hotelCity !== "general") {
         setHotelState({ step: "asking_type", city: hotelCity, searchType: null });
         setMessages(prev => [...prev, { role: "model", text: `Tìm khách sạn ở ${hotelCity}? Chọn kiểu: A) Nhanh, B) Thông minh, C) Chi tiết` }]);
         setIsLoading(false);
         debug.groupEnd();
         return;
      }

      // 5. Knowledge Base Check
      const locations = ["đà lạt", "đà nẵng", "phú quốc"];
      let enhanced = userMessage;
      const detected = locations.find(l => userMessage.toLowerCase().includes(l));
      if (detected) {
        setMessages(prev => [...prev, { role: "model", text: `*Đang nạp kiến thức về ${detected}...*`, isPlanning: true }]);
        try {
          const kb = await query_knowledge_base(detected, userMessage);
          enhanced = `${userMessage}\n\n[Cẩm nang]:\n${kb}`;
        } catch {}
        setMessages(prev => prev.filter(m => !m.isPlanning));
      }

      // 6. ReAct Loop
      let chatHistory = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      chatHistory.push({ role: "user", parts: [{ text: enhanced }] });

      let response = await chatWithTravelAgent(chatHistory);
      let toolResults = await handleToolCalls(response);

      while (toolResults) {
        const toolNames = toolResults.map(r => r.functionResponse.name).join(", ");
        setMessages(prev => [...prev, { role: "model", text: `*Đang xử lý ${toolNames}...*`, isPlanning: true }]);
        
        chatHistory.push(response.candidates![0].content as any);
        chatHistory.push({ role: "user", parts: toolResults as any });

        response = await chatWithTravelAgent(chatHistory);
        toolResults = await handleToolCalls(response);
        setMessages(prev => prev.filter(m => !m.isPlanning));
      }

      const finalContent = response.text || "Xin lỗi, tôi không thể xử lý yêu cầu.";
      setMessages(prev => [...prev, { role: "model", text: finalContent }]);

    } catch (error: any) {
      debug.error("AGENT_UI", "Process error", error);
      setMessages(prev => [...prev, { role: "model", text: "Có lỗi xảy ra trong quá trình Agent xử lý." }]);
    } finally {
      setIsLoading(false);
      debug.groupEnd();
    }
  };

  const handleDownload = () => {
    const fileName = `agent-chat-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    exportToJson(messages, fileName);
    debug.success("AGENT_UI", "Chat history exported");
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex gap-4", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
              <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0", msg.role === "user" ? "bg-slate-800" : "bg-blue-600")}>
                {msg.role === "user" ? <User className="text-white w-5" /> : <Bot className="text-white w-5" />}
              </div>
              <div className={cn("max-w-[85%] rounded-3xl px-6 py-4 shadow-sm", msg.role === "user" ? "bg-slate-800 text-white" : msg.isPlanning ? "bg-blue-50 text-blue-600 italic text-sm" : "bg-white text-slate-800")}>
                 <div className="markdown-body"><Markdown>{msg.text}</Markdown></div>
              </div>
            </div>
          ))}
          {isLoading && !messages.some(m => m.isPlanning) && (
             <div className="flex gap-4"><div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div></div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="bg-white border-t p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-2xl border">
            <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()} placeholder="Hỏi Agent (hỗ trợ ReAct tools)..." className="flex-1 bg-transparent border-none px-4 py-2" />
            <button onClick={handleSend} disabled={isLoading} className="bg-blue-600 text-white p-3 rounded-xl"><Send className="w-5" /></button>
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
             <div className="flex flex-wrap gap-2">
                {bookingState.step === "asking_transport" && (
                   <><button onClick={() => setInput("Máy bay")} className="text-xs bg-blue-50 px-3 py-1 rounded-full">✈️ Máy bay</button>
                   <button onClick={() => setInput("Xe buýt")} className="text-xs bg-slate-50 px-3 py-1 rounded-full">🚌 Xe buýt</button></>
                )}
                {bookingState.step === "idle" && ["Đà Lạt", "Đà Nẵng", "Phú Quốc"].map(c => (
                  <button key={c} onClick={() => setInput(`Kế hoạch đi ${c}`)} className="text-xs bg-slate-50 px-3 py-1 rounded-full hover:bg-white">{c}</button>
                ))}
             </div>
             
             <button
                onClick={handleDownload}
                disabled={messages.length <= 1}
                className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-slate-400 hover:text-blue-600 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed group mr-2"
              >
                <Download className="w-3.5 h-3.5 group-hover:transform group-hover:-translate-y-0.5 transition-transform" />
                <span>Lưu lịch sử (JSON)</span>
              </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
