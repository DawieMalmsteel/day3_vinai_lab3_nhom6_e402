import React, { useState, useRef, useEffect } from 'react';
import { Send, Plane, Hotel, MapPin, Compass, Loader2, User, Bot, Sparkles, ChevronRight } from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { chatWithTravelAgent, query_knowledge_base } from './services/gemini';
import { debug } from './utils/debug';
import { detectRoute, parseTransport, parsePassengerCount, parseDepartureDate, searchBookingLinks, formatBookingOptions, searchFlightsTool } from './services/bookingService';
import { detectHotelSearch, searchHotelsTool, formatHotelsOptionA, formatHotelsOptionB, formatHotelsOptionC } from './services/hotelService';
import { isValidTopic, getOutOfScopeMessage } from './services/contentFilter';
import type { TravelBookingState, HotelSearchState } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isPlanning?: boolean;
  sources?: { uri: string; title: string }[];
}

type ReActActionName = 'search_flights' | 'search_hotels' | 'finish';

interface ReActAction {
  action: ReActActionName;
  actionInput?: Record<string, unknown>;
  final?: string;
}

const REACT_CONTROLLER_SYSTEM = `Bạn là ReAct controller cho trợ lý du lịch.
Nhiệm vụ: chọn công cụ hoặc kết thúc.
Tools có sẵn:
1) search_flights: cần originCity, destinationCity, departureDate (YYYY-MM-DD, optional), passengers (number)
2) search_hotels: cần city, guests (optional), budget (budget|mid|luxury, optional), locationPreference (beach|city|quiet|budget, optional), checkinDate/checkoutDate (optional)
3) finish: khi đủ dữ liệu để trả lời user

Bạn PHẢI trả về duy nhất 1 JSON object hợp lệ, không markdown, không giải thích.
Schema:
{"action":"search_flights","actionInput":{"originCity":"...","destinationCity":"...","departureDate":"...","passengers":2}}
{"action":"search_hotels","actionInput":{"city":"...","guests":2}}
{"action":"finish","final":"..."}

Ưu tiên:
- Nếu user hỏi chuyến bay/giá vé/giờ bay => gọi search_flights trước.
- Nếu user hỏi khách sạn => gọi search_hotels trước.
- Khi đã có observation tool hoặc không cần tool, trả finish bằng tiếng Việt ngắn gọn.`;

const parseReActAction = (raw: string): ReActAction | null => {
  const text = raw.trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as ReActAction;
    return parsed?.action ? parsed : null;
  } catch {
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (!objectMatch) return null;
    try {
      const parsed = JSON.parse(objectMatch[0]) as ReActAction;
      return parsed?.action ? parsed : null;
    } catch {
      return null;
    }
  }
};

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Xin chào! Tôi là trợ lý du lịch AI của bạn. Tôi có thể giúp bạn tìm chuyến bay, khách sạn và lên kế hoạch lộ trình chi tiết. Bạn muốn đi đâu hôm nay?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bookingState, setBookingState] = useState<TravelBookingState>({ step: 'idle' });
  const [hotelState, setHotelState] = useState<HotelSearchState>({ step: 'idle', searchType: null });
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

    debug.group(`Chat: ${userMessage.substring(0, 50)}...`);
    debug.log('APP', 'User message received', userMessage);

    try {
      // CHECK TOPIC VALIDITY - MUST BE ABOUT FLIGHTS, BUSES, HOTELS, OR TRAVEL GUIDES
      if (!isValidTopic(userMessage)) {
        debug.log('APP', 'Message is out of scope');
        const outOfScopeMsg = getOutOfScopeMessage();
        setMessages(prev => [...prev, { role: 'model', text: outOfScopeMsg }]);
        setIsLoading(false);
        debug.groupEnd();
        return;
      }

      // Check if we're in a booking flow
      if (bookingState.step === 'asking_transport') {
        // Ask for transport method
        debug.log('APP', 'Booking flow: asking for transport method');
        const transport = parseTransport(userMessage);
        if (transport) {
          if (transport === 'flight') {
            setBookingState(prev => ({ ...prev, transportMethod: transport, step: 'asking_date' }));
            setMessages(prev => [...prev, { 
              role: 'model', 
              text: 'Bạn muốn bay ngày nào? (ví dụ: `2026-04-20`, `20/04/2026`, `ngày mai`)' 
            }]);
          } else {
            setBookingState(prev => ({ ...prev, transportMethod: transport, step: 'asking_passengers' }));
            setMessages(prev => [...prev, { 
              role: 'model', 
              text: `Bạn chọn xe buýt. Bây giờ, bạn muốn đặt vé cho mấy người?` 
            }]);
          }
          setIsLoading(false);
          debug.groupEnd();
          return;
        }
      } else if (bookingState.step === 'asking_date') {
        debug.log('APP', 'Booking flow: asking for departure date');
        const departureDate = parseDepartureDate(userMessage);
        if (departureDate) {
          setBookingState(prev => ({ ...prev, departureDate, step: 'asking_passengers' }));
          setMessages(prev => [...prev, { 
            role: 'model', 
            text: `Đã ghi nhận ngày bay **${departureDate}**. Bạn muốn đặt vé cho mấy người?` 
          }]);
          setIsLoading(false);
          debug.groupEnd();
          return;
        }
        setMessages(prev => [...prev, {
          role: 'model',
          text: 'Mình chưa đọc được ngày bay. Bạn nhập theo dạng `YYYY-MM-DD` hoặc `DD/MM/YYYY` nhé.',
        }]);
        setIsLoading(false);
        debug.groupEnd();
        return;
      } else if (bookingState.step === 'asking_passengers') {
        // Ask for passenger count
        debug.log('APP', 'Booking flow: asking for passenger count');
        const passengerCount = parsePassengerCount(userMessage);
        if (passengerCount) {
          setBookingState(prev => ({ ...prev, passengerCount, step: 'searching' }));
          setMessages(prev => [...prev, { 
            role: 'model', 
            text: '*Đang tìm chuyến đi cho ' + passengerCount + ' hành khách...*',
            isPlanning: true 
          }]);

          // Search for booking links
          try {
            const results = await searchBookingLinks(
              bookingState.originCity!,
              bookingState.destinationCity!,
              bookingState.transportMethod!,
              passengerCount,
              bookingState.departureDate,
            );

            setMessages(prev => prev.filter(m => !m.isPlanning));
            const formattedResults = formatBookingOptions(results);
            setMessages(prev => [...prev, { 
              role: 'model', 
              text: formattedResults
            }]);
            setBookingState({ step: 'idle' });
          } catch (error) {
            debug.error('APP', 'Booking search error', error);
            setMessages(prev => prev.filter(m => !m.isPlanning));
            setMessages(prev => [...prev, { 
              role: 'model', 
              text: 'Xin lỗi, tôi gặp sự cố khi tìm chuyến đi. Vui lòng thử lại hoặc cho tôi biết thêm chi tiết.' 
            }]);
            setBookingState({ step: 'idle' });
          }
          setIsLoading(false);
          debug.groupEnd();
          return;
        }
      }

      // Check if we're in hotel search flow
      if (hotelState.step === 'asking_type') {
        // User choosing between quick/smart/detailed
        const userLower = userMessage.toLowerCase();
        let selectedType: 'quick' | 'smart' | 'detailed' | null = null;
        
        if (userLower.includes('nhanh') || userLower.includes('quick') || userLower.includes('a')) {
          selectedType = 'quick';
        } else if (userLower.includes('thông minh') || userLower.includes('smart') || userLower.includes('b')) {
          selectedType = 'smart';
        } else if (userLower.includes('chi tiết') || userLower.includes('detailed') || userLower.includes('c')) {
          selectedType = 'detailed';
        }

        if (selectedType && hotelState.city) {
          debug.log('APP', `Hotel search: selected type ${selectedType}`);
          setHotelState(prev => ({ ...prev, searchType: selectedType, step: 'searching' }));

          const hotelResults = searchHotelsTool({
            city: hotelState.city,
            guests: 2,
          });
          const hotels = hotelResults.map((h) => ({
            id: h.id,
            name: h.name,
            city: h.city,
            url: h.bookingUrl,
            pricePerNight: h.pricePerNight,
            rating: h.rating,
            location: h.location,
          }));
          let formattedResult = '';
          
          if (selectedType === 'quick') {
            formattedResult = formatHotelsOptionA(hotels);
          } else if (selectedType === 'smart') {
            formattedResult = formatHotelsOptionB(hotels);
          } else {
            formattedResult = formatHotelsOptionC(hotels);
          }

          setMessages(prev => [...prev, { role: 'model', text: formattedResult }]);
          setHotelState({ step: 'idle', searchType: null });
          setIsLoading(false);
          debug.groupEnd();
          return;
        }
      }

      // Detect hotel search
      const hotelCity = detectHotelSearch(userMessage);
      if (hotelCity && hotelCity !== 'general') {
        debug.log('APP', `Hotel search detected for: ${hotelCity}`);
        setHotelState({
          step: 'asking_type',
          city: hotelCity,
          searchType: null,
        });
        setMessages(prev => [...prev, {
          role: 'model',
          text: `Bạn muốn tìm khách sạn ở ${hotelCity}. Chọn cách tìm kiếm:\n\nA) ⚡ **Nhanh** - 2-3 khách sạn tốt nhất\nB) 🧠 **Thông minh** - Hỏi sở thích rồi gợi ý\nC) 📋 **Chi tiết** - Tìm kiếm đầy đủ theo yêu cầu`
        }]);
        setIsLoading(false);
        debug.groupEnd();
        return;
      }

      // Regular chat flow (non-booking)
      // Detect route for booking
      const route = detectRoute(userMessage);
      if (route.isValid) {
        debug.log('APP', `Route detected: ${route.from} → ${route.to}`);
        setBookingState({
          step: 'asking_transport',
          originCity: route.from!,
          destinationCity: route.to!
        });
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: `Tôi thấy bạn muốn từ ${route.from} đến ${route.to}. Bạn muốn đi bằng **chuyến bay** hay **xe buýt**?` 
        }]);
        setIsLoading(false);
        debug.groupEnd();
        return;
      }

      // Detect location keywords
      const locations = ['da lat', 'đà lạt', 'da nang', 'đà nẵng', 'phu quoc', 'phú quốc'];
      const userMessageLower = userMessage.toLowerCase();
      const detectedLocation = locations.find(loc => userMessageLower.includes(loc));

      let enhancedMessage = userMessage;
      if (detectedLocation) {
        debug.log('APP', `Location detected: ${detectedLocation}`);
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: `*Đang tải thông tin về ${detectedLocation}...*`,
          isPlanning: true 
        }]);

        try {
          const kbContent = await query_knowledge_base(detectedLocation, userMessage);
          enhancedMessage = `${userMessage}\n\n[Thông tin từ cẩm nang du lịch]\n${kbContent}`;
          debug.success('APP', `KB content loaded (${kbContent.length} chars)`);
        } catch (error) {
          debug.error('APP', 'Failed to load KB content', error);
        }

        setMessages(prev => prev.filter(m => !m.isPlanning));
      }

      // Convert messages to Gemini format
      const baseHistory = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      const toolObservations: string[] = [];
      let reactFinalText: string | null = null;

      for (let step = 0; step < 3; step += 1) {
        const controllerPrompt = [
          `USER_QUERY: ${enhancedMessage}`,
          `CONTEXT_MESSAGES: ${JSON.stringify(messages.slice(-6).map((m) => ({ role: m.role, text: m.text })))}`,
          toolObservations.length > 0
            ? `OBSERVATIONS:\n${toolObservations.join('\n')}`
            : 'OBSERVATIONS: (none)',
          'Hãy trả về quyết định JSON theo schema đã định.',
        ].join('\n\n');

        const controllerResponse = await chatWithTravelAgent(
          [{ role: 'user', parts: [{ text: controllerPrompt }] }],
          0,
          REACT_CONTROLLER_SYSTEM,
        );
        const action = parseReActAction(controllerResponse.text || '');

        if (!action) {
          debug.warn('REACT', 'Controller output is not parseable JSON, stopping tool loop');
          break;
        }

        debug.log('REACT', `Step ${step + 1} action: ${action.action}`, action.actionInput);

        if (action.action === 'finish') {
          reactFinalText = action.final || null;
          break;
        }

        if (action.action === 'search_flights') {
          const input = action.actionInput || {};
          const originCity = String(input.originCity || detectRoute(userMessage).from || '');
          const destinationCity = String(input.destinationCity || detectRoute(userMessage).to || '');
          const departureDate = String(input.departureDate || parseDepartureDate(userMessage) || '');
          const passengers = Number(input.passengers || parsePassengerCount(userMessage) || 1);

          if (originCity && destinationCity) {
            const flightResults = searchFlightsTool({
              originCity,
              destinationCity,
              departureDate: departureDate || undefined,
              passengers: Number.isFinite(passengers) && passengers > 0 ? passengers : 1,
            });
            toolObservations.push(
              `search_flights(${originCity}, ${destinationCity}, ${departureDate || 'N/A'}, ${passengers}) => ${JSON.stringify(flightResults.slice(0, 5))}`
            );
            continue;
          }

          toolObservations.push('search_flights => thiếu origin/destination, không thực thi được');
          continue;
        }

        if (action.action === 'search_hotels') {
          const input = action.actionInput || {};
          const cityFromQuery = detectHotelSearch(userMessage);
          const city = String(input.city || (cityFromQuery && cityFromQuery !== 'general' ? cityFromQuery : ''));

          if (city) {
            const hotelResults = searchHotelsTool({
              city,
              guests: Number(input.guests || 2),
              checkinDate: typeof input.checkinDate === 'string' ? input.checkinDate : undefined,
              checkoutDate: typeof input.checkoutDate === 'string' ? input.checkoutDate : undefined,
              budget: input.budget as 'budget' | 'mid' | 'luxury' | undefined,
              locationPreference: input.locationPreference as 'beach' | 'city' | 'quiet' | 'budget' | undefined,
            });
            toolObservations.push(
              `search_hotels(${city}) => ${JSON.stringify(hotelResults.slice(0, 5))}`
            );
            continue;
          }

          toolObservations.push('search_hotels => thiếu city, không thực thi được');
          continue;
        }
      }

      if (reactFinalText) {
        setMessages(prev => [...prev, { role: 'model', text: reactFinalText }]);
        debug.success('REACT', 'Final response generated directly by ReAct controller');
        return;
      }

      const finalUserPrompt = toolObservations.length > 0
        ? `${enhancedMessage}\n\n[Tool observations]\n${toolObservations.join('\n')}\n\nDựa trên observations, trả lời ngắn gọn bằng tiếng Việt và hỏi 1 câu follow-up.`
        : enhancedMessage;

      const chatHistory = [...baseHistory, { role: 'user', parts: [{ text: finalUserPrompt }] }];

      debug.log('APP', `Calling model with ${chatHistory.length} messages`);

      // Final synthesis after ReAct tool loop
      const response = await chatWithTravelAgent(chatHistory);
      const modelText = response.text || "Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn.";

      debug.success('APP', `Response received (${modelText.length} chars)`);

      // Extract grounding sources if available
      const sources: { uri: string; title: string }[] = [];
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        debug.log('APP', `Found ${groundingChunks.length} grounding chunks`);
        groundingChunks.forEach((chunk: any) => {
          if (chunk.web) {
            sources.push({ uri: chunk.web.uri, title: chunk.web.title });
          }
        });
      }

      setMessages(prev => [...prev, { role: 'model', text: modelText, sources }]);
      debug.success('APP', 'Response added to chat');
    } catch (error: any) {
      debug.error('APP', 'Chat error occurred', error);
      console.error("Chat error:", error);
      let errorMessage = "Đã có lỗi xảy ra. Vui lòng thử lại sau.";
      
      if (error?.message?.includes("400")) {
        errorMessage = "Lỗi yêu cầu. Vui lòng kiểm tra API key và thử lại.";
      } else if (error?.message?.includes("429")) {
        errorMessage = "Hệ thống đang quá tải. Vui lòng đợi 1-2 phút rồi thử lại.";
      } else if (error?.message?.includes("500")) {
        errorMessage = "Lỗi máy chủ. Vui lòng thử lại sau.";
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
          
          {/* Quick Suggestions - Dynamic based on booking state */}
          <div className="flex flex-wrap gap-2 mt-4">
            {bookingState.step === 'asking_transport' && (
              <>
                <button
                  onClick={() => setInput('Chuyến bay')}
                  className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-4 py-2 rounded-full transition-all flex items-center gap-2"
                >
                  <Plane className="w-4 h-4" />
                  Chuyến bay
                </button>
                <button
                  onClick={() => setInput('Xe buýt')}
                  className="text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-4 py-2 rounded-full transition-all flex items-center gap-2"
                >
                  🚌
                  Xe buýt
                </button>
              </>
            )}
            {bookingState.step === 'asking_passengers' && (
              <>
                {[1, 2, 3, 4, 5].map(num => (
                  <button
                    key={num}
                    onClick={() => setInput(num.toString())}
                    className="text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full transition-all"
                  >
                    {num} {num === 1 ? 'người' : 'người'}
                  </button>
                ))}
              </>
            )}
            {bookingState.step === 'asking_date' && (
              <>
                {[
                  { label: 'Hôm nay', value: 'hôm nay' },
                  { label: 'Ngày mai', value: 'ngày mai' },
                  { label: '20/04/2026', value: '20/04/2026' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setInput(item.value)}
                    className="text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full transition-all"
                  >
                    {item.label}
                  </button>
                ))}
              </>
            )}
            {bookingState.step === 'idle' && (
              <>
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
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
