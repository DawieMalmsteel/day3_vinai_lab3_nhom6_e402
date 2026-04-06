import React, { useState, useRef, useEffect } from 'react';
import { Send, Plane, Hotel, MapPin, Compass, Loader2, User, Bot, Sparkles, ChevronRight } from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { chatWithTravelAgent, query_knowledge_base } from './services/gemini';
import { debug } from './utils/debug';
import { detectRoute, parseTransport, parsePassengerCount, searchBookingLinks, formatBookingOptions } from './services/bookingService';
import { detectHotelSearch, searchHotels, formatHotelsOptionA, formatHotelsOptionB, formatHotelsOptionC } from './services/hotelService';

import { detectTripPlanRequest, parseTripDetails, generateItinerary, formatItinerary } from './services/tripPlannerService';
import { getCurrentDateFormatted, getDateAfterDays } from './utils/dateUtils';
import { detectPriceComparisonRequest, extractPriceComparisonDetails, comparePrices, formatPriceComparison } from './services/priceComparisonService';
import { detectRestaurantRequest, extractRestaurantDetails, getRestaurantRecommendations, formatRestaurantRecommendations } from './services/restaurantService';
import { detectLocalTransportRequest, extractTransportDetails, getTransportGuide, formatTransportGuide } from './services/localTransportService';
import { detectActivityRequest, extractActivityCity, getActivitySuggestions, formatActivitySuggestions } from './services/activityService';
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
      // Regular chat flow - let model handle all validation via system prompt
      
      // ========== NEW USE CASES (5 features) ==========
      if (bookingState.step === 'route_detected') {
        // Ask for transport method
        debug.log('APP', 'Booking flow: asking for transport method');
        const transport = parseTransport(userMessage);
        if (transport) {
          setBookingState(prev => ({ ...prev, transportMethod: transport, step: 'asking_passengers' }));
          setMessages(prev => [...prev, { 
            role: 'model', 
            text: `Bạn chọn ${transport === 'flight' ? 'chuyến bay' : 'xe buýt'}. Bây giờ, bạn muốn đặt vé cho mấy người?` 
          }]);
          setIsLoading(false);
          debug.groupEnd();
          return;
        }
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
              passengerCount
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

          const hotels = searchHotels(hotelState.city);
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
      
      // ========== NEW USE CASES (5 features) ==========
      
      // 1. TRIP PLANNER - Lên kế hoạch chuyến đi
      if (detectTripPlanRequest(userMessage)) {
        debug.log('APP', 'Trip planner request detected');
        
        // Extract trip details (simplified - ask follow-up for full details)
        const tripKeywords = ['đà nẵng', 'đà lạt', 'phú quốc', 'hà nội', 'hồ chí minh', 'huế', 'nha trang'];
        const destination = tripKeywords.find(city => userMessage.toLowerCase().includes(city));
        
        if (destination) {
          const details = parseTripDetails(userMessage, destination);
          const currentDate = getCurrentDateFormatted();
          const duration = details.duration || 3;
          const startDate = details.startDate || currentDate;
          const endDate = details.endDate || getDateAfterDays(duration - 1);
          
          const itinerary = generateItinerary(
            destination,
            startDate,
            endDate,
            details.travelers || 1,
            duration
          );
          const formattedPlan = formatItinerary(itinerary);
          setMessages(prev => [...prev, { role: 'model', text: formattedPlan }]);
          setIsLoading(false);
          debug.groupEnd();
          return;
        } else {
          setMessages(prev => [...prev, {
            role: 'model',
            text: 'Bạn muốn lên kế hoạch chuyến đi đến thành phố nào? (VD: Đà Nẵng, Đà Lạt, Phú Quốc, Hà Nội, Hồ Chí Minh...)'
          }]);
          setIsLoading(false);
          debug.groupEnd();
          return;
        }
      }

      // 2. PRICE COMPARISON - So sánh giá vé
      if (detectPriceComparisonRequest(userMessage)) {
        debug.log('APP', 'Price comparison request detected');
        const details = extractPriceComparisonDetails(userMessage);
        
        if (details.origin && details.destination) {
          try {
            const result = await comparePrices(details.origin, details.destination, details.date || 'sớm nhất');
            const formattedComparison = formatPriceComparison(result, details.origin, details.destination);
            setMessages(prev => [...prev, { role: 'model', text: formattedComparison }]);
            setIsLoading(false);
            debug.groupEnd();
            return;
          } catch (error) {
            debug.error('APP', 'Price comparison error', error);
            setMessages(prev => [...prev, { role: 'model', text: 'Xin lỗi, tôi gặp sự cố khi so sánh giá vé. Vui lòng thử lại hoặc cho tôi biết thêm chi tiết.' }]);
            setIsLoading(false);
            debug.groupEnd();
            return;
          }
        } else {
          setMessages(prev => [...prev, {
            role: 'model',
            text: 'Hãy cho tôi biết bạn muốn so sánh giá vé từ thành phố nào đến thành phố nào? (VD: TP.HCM đến Hà Nội, Đà Nẵng đến Phú Quốc...)'
          }]);
          setIsLoading(false);
          debug.groupEnd();
          return;
        }
      }

      // 3. RESTAURANT RECOMMENDATIONS - Gợi ý nhà hàng
      if (detectRestaurantRequest(userMessage)) {
        debug.log('APP', 'Restaurant recommendation request detected');
        const details = extractRestaurantDetails(userMessage);
        
        if (details.city) {
          const recommendations = getRestaurantRecommendations(details.city, details.cuisineType || 'việt nam');
          const formatted = formatRestaurantRecommendations(recommendations);
          setMessages(prev => [...prev, { role: 'model', text: formatted }]);
          setIsLoading(false);
          debug.groupEnd();
          return;
        } else {
          setMessages(prev => [...prev, {
            role: 'model',
            text: 'Bạn muốn tìm nhà hàng ở thành phố nào? (VD: Đà Nẵng, Đà Lạt, Phú Quốc, Hà Nội...)\nBạn có thể chỉ định loại ẩm thực: hải sản, Việt Nam, quốc tế, cà phê...'
          }]);
          setIsLoading(false);
          debug.groupEnd();
          return;
        }
      }

      // 4. LOCAL TRANSPORT GUIDE - Hướng dẫn di chuyển
      if (detectLocalTransportRequest(userMessage)) {
        debug.log('APP', 'Local transport request detected');
        const details = extractTransportDetails(userMessage);
        
        if (details.destination) {
          const origin = details.origin || 'Khách sạn/Trung tâm';
          const guide = getTransportGuide(origin, details.destination);
          const formatted = formatTransportGuide(guide);
          setMessages(prev => [...prev, { role: 'model', text: formatted }]);
          setIsLoading(false);
          debug.groupEnd();
          return;
        } else {
          setMessages(prev => [...prev, {
            role: 'model',
            text: 'Bạn muốn đi từ đâu đến đâu? (VD: từ khách sạn đến bãi biển, từ sân bay đến trung tâm...)'
          }]);
          setIsLoading(false);
          debug.groupEnd();
          return;
        }
      }

      // 5. ACTIVITY SUGGESTIONS - Gợi ý hoạt động
      if (detectActivityRequest(userMessage)) {
        debug.log('APP', 'Activity suggestion request detected');
        const city = extractActivityCity(userMessage);
        
        if (city) {
          const suggestions = getActivitySuggestions(city);
          const formatted = formatActivitySuggestions(suggestions);
          setMessages(prev => [...prev, { role: 'model', text: formatted }]);
          setIsLoading(false);
          debug.groupEnd();
          return;
        } else {
          setMessages(prev => [...prev, {
            role: 'model',
            text: 'Bạn muốn biết hoạt động có gì vui ở thành phố nào? (VD: Đà Nẵng, Đà Lạt, Phú Quốc, Hà Nội...)'
          }]);
          setIsLoading(false);
          debug.groupEnd();
          return;
        }
      }

      // ========== END NEW USE CASES ==========

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
      let chatHistory = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      chatHistory.push({ role: 'user', parts: [{ text: enhancedMessage }] });

      debug.log('APP', `Calling model with ${chatHistory.length} messages`);

      // Single API call - no tools, no ReAct loop
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
