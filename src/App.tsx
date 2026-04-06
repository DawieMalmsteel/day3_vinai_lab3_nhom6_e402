import React, { useState, useRef, useEffect } from 'react';
import {
  BarChart3,
  Bot,
  ChevronRight,
  Compass,
  Download,
  FileText,
  Hotel,
  Loader2,
  MapPin,
  Plane,
  Send,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  User,
  X,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  chatWithTravelAgent,
  getStepCount,
  handleToolCalls,
  MODEL,
  PROVIDER,
  query_knowledge_base,
  resetStepCounter,
} from './services/gemini';
import { debug } from './utils/debug';
import { detectRoute, parseTransport, parsePassengerCount, searchBookingLinks, formatBookingOptions } from './services/bookingService';
import { detectHotelSearch, searchHotels, formatHotelsOptionA, formatHotelsOptionB, formatHotelsOptionC } from './services/hotelService';

import { detectTripPlanRequest, parseTripDetails, generateItinerary, formatItinerary } from './services/tripPlannerService';
import { getCurrentDateFormatted, getDateAfterDays } from './utils/dateUtils';
import { detectPriceComparisonRequest, extractPriceComparisonDetails, comparePrices, formatPriceComparison } from './services/priceComparisonService';
import { detectRestaurantRequest, extractRestaurantDetails, getRestaurantRecommendations, formatRestaurantRecommendations } from './services/restaurantService';
import { detectLocalTransportRequest, extractTransportDetails, getTransportGuide, formatTransportGuide } from './services/localTransportService';
import { detectActivityRequest, extractActivityCity, getActivitySuggestions, formatActivitySuggestions } from './services/activityService';
import {
  buildComparisonSummary,
  downloadComparisonJson,
  downloadComparisonMd,
  exportComparisonMarkdown,
  finalizeRunSummary,
  type ComparisonSummary,
  type RunSummary,
} from './utils/comparison';
import {
  endSession,
  exportSessionLogJsonl,
  getCompletedSessions,
  getCurrentSession,
  getSessionJsonl,
  logEvent,
  logError,
  saveComparisonToServer,
  startSessionLog,
} from './utils/telemetry';
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
  const [mode, setMode] = useState<'agent' | 'chatbot'>('agent');
  const [showPanel, setShowPanel] = useState(false);
  const [panelTab, setPanelTab] = useState<'log' | 'compare'>('log');
  const [chatbotSummary, setChatbotSummary] = useState<RunSummary | null>(null);
  const [agentSummary, setAgentSummary] = useState<RunSummary | null>(null);
  const [comparison, setComparison] = useState<ComparisonSummary | null>(null);
  const [liveLog, setLiveLog] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!showPanel || panelTab !== 'log') {
      return;
    }

    setLiveLog(getSessionJsonl() || '(chưa có session)');
    const intervalId = window.setInterval(() => {
      setLiveLog(getSessionJsonl() || '(chưa có session)');
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [panelTab, showPanel]);

  useEffect(() => {
    if (!chatbotSummary || !agentSummary) {
      setComparison(null);
      return;
    }

    if (chatbotSummary.query !== agentSummary.query) {
      setComparison(null);
      return;
    }

    const nextComparison = buildComparisonSummary(chatbotSummary, agentSummary);
    setComparison(nextComparison);
    saveComparisonToServer(nextComparison, exportComparisonMarkdown(nextComparison));
  }, [agentSummary, chatbotSummary]);

  /**
   * Helper: track latency cho feature xử lý local (không gọi Gemini API).
   * Tạo session + ghi LLM_METRIC giả với latency thực → để comparison dashboard hoạt động.
   */
  const trackLocalFeature = (
    featureName: string,
    query: string,
    responseText: string,
    startMs: number,
  ) => {
    const latencyMs = Date.now() - startMs;

    // Tạo session cho feature local
    const session = startSessionLog(mode, query, PROVIDER, MODEL);

    // Ghi LLM_METRIC với latency thực, tokens = 0, cost = 0 (local, không gọi API)
    logEvent('LLM_METRIC', {
      label: mode,
      provider: PROVIDER,
      model: MODEL,
      step: 1,
      prompt_tokens: 0,
      completion_tokens: 0,
      thinking_tokens: 0,
      tool_use_prompt_tokens: 0,
      total_tokens: 0,
      latency_ms: latencyMs,
      estimated_cost_usd: 0,
      cost_breakdown: { input_cost: 0, output_cost: 0, thinking_cost: 0 },
      feature: featureName,
      is_local: true,
    });

    endSession(responseText.slice(0, 200), {
      feature: featureName,
      is_local: true,
      latency_ms: latencyMs,
    });

    // Finalize summary → set vào state để comparison dashboard hoạt động
    const sessions = getCompletedSessions();
    const lastSession = sessions[sessions.length - 1];
    if (lastSession) {
      const summary = finalizeRunSummary(lastSession);
      if (mode === 'chatbot') {
        setChatbotSummary(summary);
      } else {
        setAgentSummary(summary);
      }
      debug.success('APP', `${mode} local feature summary`, { feature: featureName, latencyMs });
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    debug.group(`Chat Cycle [${mode}]: ${userMessage.substring(0, 50)}...`);
    debug.log('APP', `User message received (mode=${mode})`, userMessage);

    try {
      // Regular chat flow - let model handle all validation via system prompt

      // ========== NEW USE CASES (5 features) ==========
      if (bookingState.step === 'asking_transport') {
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

      // ========== AGENT-ONLY: Local feature handlers ==========
      // Chỉ agent mode mới dùng local handlers (xử lý nhanh, không gọi API)
      // Chatbot mode luôn gọi Gemini API trực tiếp → kết quả khác agent
      if (mode === 'agent') {
        // Detect hotel search
        const hotelCity = detectHotelSearch(userMessage);
        if (hotelCity && hotelCity !== 'general') {
          const hotelStart = Date.now();
          debug.log('APP', `Hotel search detected for: ${hotelCity}`);
          setHotelState({
            step: 'asking_type',
            city: hotelCity,
            searchType: null,
          });
          const hotelText = `Bạn muốn tìm khách sạn ở ${hotelCity}. Chọn cách tìm kiếm:\n\nA) ⚡ **Nhanh** - 2-3 khách sạn tốt nhất\nB) 🧠 **Thông minh** - Hỏi sở thích rồi gợi ý\nC) 📋 **Chi tiết** - Tìm kiếm đầy đủ theo yêu cầu`;
          setMessages(prev => [...prev, { role: 'model', text: hotelText }]);
          trackLocalFeature('HOTEL_SEARCH', userMessage, hotelText, hotelStart);
          setIsLoading(false);
          debug.groupEnd();
          return;
        }

        // 1. TRIP PLANNER - Lên kế hoạch chuyến đi
        if (detectTripPlanRequest(userMessage)) {
          const tripStart = Date.now();
          debug.log('APP', 'Trip planner request detected');

          const tripKeywords = ['đà nẵng', 'đà lạt', 'phú quốc', 'hà nội', 'hồ chí minh', 'huế', 'nha trang'];
          const destination = tripKeywords.find(city => userMessage.toLowerCase().includes(city));

          if (destination) {
            const details = parseTripDetails(userMessage, destination);
            const currentDate = getCurrentDateFormatted();
            const duration = details.duration || 3;
            const startDate = details.startDate || currentDate;
            const endDate = details.endDate || getDateAfterDays(duration - 1);

            const itinerary = generateItinerary(
              destination, startDate, endDate, details.travelers || 1, duration
            );
            const formattedPlan = formatItinerary(itinerary);
            setMessages(prev => [...prev, { role: 'model', text: formattedPlan }]);
            trackLocalFeature('TRIP_PLANNER', userMessage, formattedPlan, tripStart);
            setIsLoading(false);
            debug.groupEnd();
            return;
          } else {
            const fallbackText = 'Bạn muốn lên kế hoạch chuyến đi đến thành phố nào? (VD: Đà Nẵng, Đà Lạt, Phú Quốc, Hà Nội, Hồ Chí Minh...)';
            setMessages(prev => [...prev, { role: 'model', text: fallbackText }]);
            trackLocalFeature('TRIP_PLANNER', userMessage, fallbackText, tripStart);
            setIsLoading(false);
            debug.groupEnd();
            return;
          }
        }

        // 2. PRICE COMPARISON - So sánh giá vé
        if (detectPriceComparisonRequest(userMessage)) {
          const priceStart = Date.now();
          debug.log('APP', 'Price comparison request detected');
          const details = extractPriceComparisonDetails(userMessage);

          if (details.origin && details.destination) {
            try {
              const result = await comparePrices(details.origin, details.destination, details.date || 'sớm nhất');
              const formattedComparison = formatPriceComparison(result, details.origin, details.destination);
              setMessages(prev => [...prev, { role: 'model', text: formattedComparison }]);
              trackLocalFeature('PRICE_COMPARISON', userMessage, formattedComparison, priceStart);
              setIsLoading(false);
              debug.groupEnd();
              return;
            } catch (error) {
              debug.error('APP', 'Price comparison error', error);
              const errText = 'Xin lỗi, tôi gặp sự cố khi so sánh giá vé. Vui lòng thử lại hoặc cho tôi biết thêm chi tiết.';
              setMessages(prev => [...prev, { role: 'model', text: errText }]);
              trackLocalFeature('PRICE_COMPARISON', userMessage, errText, priceStart);
              setIsLoading(false);
              debug.groupEnd();
              return;
            }
          } else {
            const fallbackText = 'Hãy cho tôi biết bạn muốn so sánh giá vé từ thành phố nào đến thành phố nào? (VD: TP.HCM đến Hà Nội, Đà Nẵng đến Phú Quốc...)';
            setMessages(prev => [...prev, { role: 'model', text: fallbackText }]);
            trackLocalFeature('PRICE_COMPARISON', userMessage, fallbackText, priceStart);
            setIsLoading(false);
            debug.groupEnd();
            return;
          }
        }

        // 3. RESTAURANT RECOMMENDATIONS - Gợi ý nhà hàng
        if (detectRestaurantRequest(userMessage)) {
          const resStart = Date.now();
          debug.log('APP', 'Restaurant recommendation request detected');
          const details = extractRestaurantDetails(userMessage);

          if (details.city) {
            const recommendations = getRestaurantRecommendations(details.city, details.cuisineType || 'việt nam');
            const formatted = formatRestaurantRecommendations(recommendations);
            setMessages(prev => [...prev, { role: 'model', text: formatted }]);
            trackLocalFeature('RESTAURANT', userMessage, formatted, resStart);
            setIsLoading(false);
            debug.groupEnd();
            return;
          } else {
            const fallbackText = 'Bạn muốn tìm nhà hàng ở thành phố nào? (VD: Đà Nẵng, Đà Lạt, Phú Quốc, Hà Nội...)\nBạn có thể chỉ định loại ẩm thực: hải sản, Việt Nam, quốc tế, cà phê...';
            setMessages(prev => [...prev, { role: 'model', text: fallbackText }]);
            trackLocalFeature('RESTAURANT', userMessage, fallbackText, resStart);
            setIsLoading(false);
            debug.groupEnd();
            return;
          }
        }

        // 4. LOCAL TRANSPORT GUIDE - Hướng dẫn di chuyển
        if (detectLocalTransportRequest(userMessage)) {
          const transStart = Date.now();
          debug.log('APP', 'Local transport request detected');
          const details = extractTransportDetails(userMessage);

          if (details.destination) {
            const origin = details.origin || 'Khách sạn/Trung tâm';
            const guide = getTransportGuide(origin, details.destination);
            const formatted = formatTransportGuide(guide);
            setMessages(prev => [...prev, { role: 'model', text: formatted }]);
            trackLocalFeature('LOCAL_TRANSPORT', userMessage, formatted, transStart);
            setIsLoading(false);
            debug.groupEnd();
            return;
          } else {
            const fallbackText = 'Bạn muốn đi từ đâu đến đâu? (VD: từ khách sạn đến bãi biển, từ sân bay đến trung tâm...)';
            setMessages(prev => [...prev, { role: 'model', text: fallbackText }]);
            trackLocalFeature('LOCAL_TRANSPORT', userMessage, fallbackText, transStart);
            setIsLoading(false);
            debug.groupEnd();
            return;
          }
        }

        // 5. ACTIVITY SUGGESTIONS - Gợi ý hoạt động
        if (detectActivityRequest(userMessage)) {
          const actStart = Date.now();
          debug.log('APP', 'Activity suggestion request detected');
          const city = extractActivityCity(userMessage);

          if (city) {
            const suggestions = getActivitySuggestions(city);
            const formatted = formatActivitySuggestions(suggestions);
            setMessages(prev => [...prev, { role: 'model', text: formatted }]);
            trackLocalFeature('ACTIVITY', userMessage, formatted, actStart);
            setIsLoading(false);
            debug.groupEnd();
            return;
          } else {
            const fallbackText = 'Bạn muốn biết hoạt động có gì vui ở thành phố nào? (VD: Đà Nẵng, Đà Lạt, Phú Quốc, Hà Nội...)';
            setMessages(prev => [...prev, { role: 'model', text: fallbackText }]);
            trackLocalFeature('ACTIVITY', userMessage, fallbackText, actStart);
            setIsLoading(false);
            debug.groupEnd();
            return;
          }
        }
      } // end if (mode === 'agent')

      // ========== END AGENT-ONLY LOCAL FEATURES ==========

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

      const locations = ['da lat', 'đà lạt', 'da nang', 'đà nẵng', 'phu quoc', 'phú quốc'];
      const detectedLocation = locations.find((location) =>
        userMessage.toLowerCase().includes(location),
      );

      let enhancedMessage = userMessage;
      if (mode === 'chatbot' && detectedLocation) {
        debug.log('APP', `Location detected for chatbot mode: ${detectedLocation}`);
        setMessages((prev) => [
          ...prev,
          {
            role: 'model',
            text: `*Đang tải thông tin về ${detectedLocation}...*`,
            isPlanning: true,
          },
        ]);

        try {
          const kbContent = await query_knowledge_base(detectedLocation, userMessage);
          enhancedMessage = `${userMessage}\n\n[Thông tin từ cẩm nang du lịch]\n${kbContent}`;
          debug.success('APP', `KB content loaded (${kbContent.length} chars)`);
        } catch (error) {
          debug.error('APP', 'Failed to load KB content', error);
        }

        setMessages((prev) => prev.filter((message) => !message.isPlanning));
      }

      let chatHistory: { role: string; parts: any[] }[] = messages.map((message) => ({
        role: message.role,
        parts: [{ text: message.text }],
      }));
      chatHistory.push({ role: 'user', parts: [{ text: enhancedMessage }] });

      resetStepCounter();
      const session = startSessionLog(mode, userMessage, PROVIDER, MODEL);
      debug.log('APP', `Session started: ${session.session_id}`);
      debug.log('APP', `Calling model with ${chatHistory.length} messages`);

      let response = await chatWithTravelAgent(chatHistory, mode);

      if (mode === 'agent') {
        let toolResults = await handleToolCalls(response);
        let cycleCount = 0;
        let usedTools = false;

        while (toolResults) {
          usedTools = true;
          cycleCount += 1;

          const toolNames = toolResults
            .map((result) => result.functionResponse.name)
            .join(', ');

          setMessages((prev) => [
            ...prev,
            {
              role: 'model',
              text: `*Đang truy xuất thông tin từ công cụ (${toolNames})...*`,
              isPlanning: true,
            },
          ]);

          const modelContent = response.candidates?.[0]?.content as
            | { role: string; parts: any[] }
            | undefined;

          if (modelContent) {
            chatHistory.push(modelContent);
          }

          chatHistory.push({
            role: 'user',
            parts: toolResults as any,
          });

          debug.log('APP', `ReAct cycle ${cycleCount}: calling model with tool results`, {
            toolCount: toolResults.length,
            tools: toolResults.map((result) => result.functionResponse.name),
          });

          response = await chatWithTravelAgent(chatHistory, mode);
          toolResults = await handleToolCalls(response);
          setMessages((prev) => prev.filter((message) => !message.isPlanning));
        }

        if (usedTools) {
          debug.success('APP', `ReAct loop completed after ${cycleCount} cycle(s)`);
        }
      }

      const modelText = response.text || 'Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn.';
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

      setMessages((prev) => [...prev, { role: 'model', text: modelText, sources }]);
      debug.success('APP', `Response received (${modelText.length} chars)`);

      const currentSession = getCurrentSession();
      if (currentSession) {
        endSession(modelText, {
          total_tokens: 0,
          total_cost_usd: 0,
          steps: getStepCount(),
          tool_call_count: currentSession.events.filter((event) => event.event === 'TOOL_CALL').length,
        });

        const sessions = getCompletedSessions();
        const lastSession = sessions[sessions.length - 1];
        if (lastSession) {
          const summary = finalizeRunSummary(lastSession);
          if (mode === 'chatbot') {
            setChatbotSummary(summary);
          } else {
            setAgentSummary(summary);
          }
          debug.success('APP', `${mode} summary finalized`, summary);
        }
      }
    } catch (error: any) {
      debug.error('APP', 'Chat error occurred', error);
      if (getCurrentSession()) {
        logError(mode, getStepCount(), 'PROVIDER_ERROR', error?.message ?? 'Unknown error');
      }

      let errorMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại sau.';
      const errMsg = error?.message ?? '';

      if (errMsg.includes('API key') || errMsg.includes('401') || errMsg.includes('403')) {
        errorMessage = 'API key không hợp lệ hoặc hết hạn. Vui lòng kiểm tra lại.';
      } else if (errMsg.includes('400')) {
        errorMessage = 'Lỗi yêu cầu. Vui lòng kiểm tra API key và thử lại.';
      } else if (errMsg.includes('429') || error?.status === 'RESOURCE_EXHAUSTED') {
        errorMessage = 'Hệ thống đang quá tải. Vui lòng đợi 1-2 phút rồi thử lại.';
      } else if (errMsg.includes('500') || errMsg.includes('503') || errMsg.includes('xhr error')) {
        errorMessage = 'Lỗi máy chủ. Vui lòng thử lại sau.';
      } else if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
        errorMessage = 'Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại.';
      }

      console.error('[APP] Chi tiết lỗi:', errMsg, error);

      setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
    } finally {
      setIsLoading(false);
      debug.groupEnd();
    }
  };

  const hasMismatchedRuns =
    chatbotSummary &&
    agentSummary &&
    chatbotSummary.query !== agentSummary.query &&
    !comparison;

  return (
    <div className="flex h-screen max-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600 p-2">
            <Compass className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
              AI Travel Agent
            </h1>
            <p className="flex items-center gap-1 text-xs font-medium text-slate-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
              {mode === 'agent' ? 'Agent Mode (Tool Loop)' : 'Chatbot Mode (No Tools)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setMode(mode === 'agent' ? 'chatbot' : 'agent')}
            className={cn(
              'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all',
              mode === 'agent'
                ? 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'
                : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
            )}
            disabled={isLoading}
          >
            {mode === 'agent' ? (
              <ToggleRight className="h-4 w-4" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
            {mode === 'agent' ? 'Agent' : 'Chatbot'}
          </button>

          <button
            onClick={() => setShowPanel((prev) => !prev)}
            className={cn(
              'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all',
              showPanel
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            <BarChart3 className="h-4 w-4" />
            Telemetry
          </button>

          <div className="hidden items-center gap-4 text-sm font-medium text-slate-600 md:flex">
            <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
              <Plane className="h-4 w-4" />
              <span>Vé máy bay</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
              <Hotel className="h-4 w-4" />
              <span>Khách sạn</span>
            </div>
          </div>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-4xl space-y-6">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  'group flex gap-4 animate-in slide-in-from-bottom-2 fade-in duration-300',
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm',
                    msg.role === 'user' ? 'bg-slate-800' : 'bg-blue-600',
                  )}
                >
                  {msg.role === 'user' ? (
                    <User className="h-5 w-5 text-white" />
                  ) : (
                    <Bot className="h-5 w-5 text-white" />
                  )}
                </div>
                <div
                  className={cn(
                    'max-w-[85%] rounded-3xl px-6 py-4 shadow-sm md:max-w-[70%]',
                    msg.role === 'user'
                      ? 'rounded-tr-none bg-slate-800 text-white'
                      : msg.isPlanning
                        ? 'rounded-tl-none border border-blue-100 bg-blue-50 text-sm italic text-blue-600'
                        : 'rounded-tl-none border border-slate-200 bg-white text-slate-800',
                  )}
                >
                  <div className="markdown-body">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Nguồn tham khảo:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((source, sourceIndex) => (
                          <a
                            key={sourceIndex}
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[11px] text-blue-600 transition-colors hover:bg-blue-100 hover:underline"
                          >
                            <MapPin className="h-2.5 w-2.5" />
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
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100">
                  <Sparkles className="h-5 w-5 animate-spin text-blue-400" />
                </div>
                <div className="flex w-48 items-center gap-2 rounded-3xl rounded-tl-none border border-slate-200 bg-white px-6 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-slate-500">Đang tính toán...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>

        {showPanel && (
          <aside className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-white md:static md:w-[520px] md:border-l md:border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex gap-1">
                <button
                  onClick={() => setPanelTab('log')}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                    panelTab === 'log'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:bg-slate-200',
                  )}
                >
                  Raw Log (JSONL)
                </button>
                <button
                  onClick={() => setPanelTab('compare')}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                    panelTab === 'compare'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:bg-slate-200',
                  )}
                >
                  So sánh
                </button>
              </div>
              <button
                onClick={() => setShowPanel(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {panelTab === 'log' && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700">Structured Log</h3>
                    <button
                      onClick={() => {
                        const sessions = getCompletedSessions();
                        if (sessions.length > 0) {
                          exportSessionLogJsonl(sessions[sessions.length - 1]);
                        }
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      <Download className="h-3 w-3" />
                      Download .jsonl
                    </button>
                  </div>
                  <pre className="max-h-[calc(100vh-250px)] overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-900 p-4 font-mono text-[11px] leading-relaxed text-green-400">
                    {liveLog || '(chưa có session)'}
                  </pre>
                </div>
              )}

              {panelTab === 'compare' && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700">Bảng so sánh Chatbot vs Agent</h3>
                    {comparison && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => downloadComparisonMd(comparison)}
                          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          <FileText className="h-3 w-3" />
                          .md
                        </button>
                        <button
                          onClick={() => downloadComparisonJson(comparison)}
                          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          <Download className="h-3 w-3" />
                          .json
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mb-4 flex gap-2">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-medium',
                        chatbotSummary ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400',
                      )}
                    >
                      Chatbot: {chatbotSummary ? 'Done' : 'Chưa chạy'}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-medium',
                        agentSummary ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400',
                      )}
                    >
                      Agent: {agentSummary ? 'Done' : 'Chưa chạy'}
                    </span>
                  </div>

                  {(!chatbotSummary || !agentSummary) && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">
                      <p className="mb-1 font-semibold">Hướng dẫn so sánh công bằng:</p>
                      <ol className="ml-4 list-decimal space-y-1">
                        <li>Chuyển sang <strong>Chatbot</strong> mode, gửi 1 câu hỏi</li>
                        <li>Chuyển sang <strong>Agent</strong> mode, gửi đúng cùng câu hỏi đó</li>
                        <li>Bảng so sánh sẽ tự động hiện ở đây</li>
                      </ol>
                    </div>
                  )}

                  {hasMismatchedRuns && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">
                      Hai lần chạy gần nhất đang khác câu hỏi. Hãy chạy lại cùng một prompt ở cả 2 mode để tạo bảng so sánh.
                    </div>
                  )}

                  {comparison && (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                        <span className="font-semibold">Query:</span> {comparison.query}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-slate-200">
                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                                Metric
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-amber-600">
                                Chatbot
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-purple-600">
                                Agent
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            <CompareRow
                              label="Total Tokens"
                              a={comparison.chatbot.total_tokens.toLocaleString()}
                              b={comparison.agent.total_tokens.toLocaleString()}
                              highlight
                            />
                            <CompareRow
                              label="Prompt Tokens"
                              a={comparison.chatbot.prompt_tokens.toLocaleString()}
                              b={comparison.agent.prompt_tokens.toLocaleString()}
                            />
                            <CompareRow
                              label="Completion Tokens"
                              a={comparison.chatbot.completion_tokens.toLocaleString()}
                              b={comparison.agent.completion_tokens.toLocaleString()}
                            />
                            <CompareRow
                              label="Total Cost (USD)"
                              a={`$${comparison.chatbot.total_cost_usd.toFixed(6)}`}
                              b={`$${comparison.agent.total_cost_usd.toFixed(6)}`}
                              highlight
                            />
                            <CompareRow
                              label="Avg Latency (ms)"
                              a={comparison.chatbot.avg_latency_ms.toLocaleString()}
                              b={comparison.agent.avg_latency_ms.toLocaleString()}
                              highlight
                            />
                            <CompareRow
                              label="Total Duration (ms)"
                              a={comparison.chatbot.total_duration_ms.toLocaleString()}
                              b={comparison.agent.total_duration_ms.toLocaleString()}
                            />
                            <CompareRow
                              label="LLM Calls"
                              a={String(comparison.chatbot.llm_call_count)}
                              b={String(comparison.agent.llm_call_count)}
                            />
                            <CompareRow
                              label="Loop Count"
                              a={String(comparison.chatbot.loop_count)}
                              b={String(comparison.agent.loop_count)}
                              highlight
                            />
                            <CompareRow
                              label="Tool Call Count"
                              a={String(comparison.chatbot.tool_call_count)}
                              b={String(comparison.agent.tool_call_count)}
                              highlight
                            />
                            <CompareRow
                              label="Error Count"
                              a={String(comparison.chatbot.error_count)}
                              b={String(comparison.agent.error_count)}
                            />
                          </tbody>
                        </table>
                      </div>

                      <div className="space-y-1.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-800">
                        <p className="mb-2 text-sm font-bold">Nhận xét</p>
                        <p>- {comparison.diff.token_ratio}</p>
                        <p>- {comparison.diff.cost_ratio}</p>
                        <p>
                          - Chênh lệch latency: {comparison.diff.latency_diff_ms > 0 ? '+' : ''}
                          {comparison.diff.latency_diff_ms}ms
                        </p>
                        <p>
                          - Agent dùng thêm {comparison.diff.extra_tool_calls} tool calls, {comparison.diff.extra_loops} vòng lặp
                        </p>
                      </div>
                    </div>
                  )}

                  {!comparison && (chatbotSummary || agentSummary) && (
                    <div className="space-y-4">
                      {chatbotSummary && <SummaryCard summary={chatbotSummary} />}
                      {agentSummary && <SummaryCard summary={agentSummary} />}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <footer className="border-t border-slate-200 bg-white p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-100 p-2 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
            <div
              className={cn(
                'shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                mode === 'agent' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700',
              )}
            >
              {mode}
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Nhập yêu cầu du lịch của bạn (VD: Lên kế hoạch đi Đà Nẵng 3 ngày...)"
              className="flex-1 border-none bg-transparent px-4 py-2 text-slate-800 placeholder:text-slate-400 focus:ring-0"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="rounded-xl bg-blue-600 p-3 text-white shadow-md shadow-blue-200 transition-colors hover:bg-blue-700 disabled:bg-slate-300"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {bookingState.step === 'asking_transport' && (
              <>
                <button
                  onClick={() => setInput('Chuyến bay')}
                  className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-600 transition-all hover:bg-blue-100"
                >
                  <Plane className="h-4 w-4" />
                  Chuyến bay
                </button>
                <button
                  onClick={() => setInput('Xe buýt')}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600 transition-all hover:bg-slate-100"
                >
                  🚌
                  Xe buýt
                </button>
              </>
            )}
            {bookingState.step === 'asking_passengers' && (
              <>
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    onClick={() => setInput(num.toString())}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:bg-slate-100"
                  >
                    {num} người
                  </button>
                ))}
              </>
            )}
            {bookingState.step === 'idle' && (
              <>
                {[
                  'Gợi ý địa điểm ở Đà Lạt',
                  'Kế hoạch Đà Nẵng 3 ngày 10tr',
                  'Tìm khách sạn tại Phú Quốc',
                  'Lịch trình trekking Sapa',
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(suggestion)}
                    className="group flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 transition-all hover:bg-white hover:text-blue-600"
                  >
                    {suggestion}
                    <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
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

function CompareRow({
  label,
  a,
  b,
  highlight,
}: {
  label: string;
  a: string;
  b: string;
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? 'bg-slate-50' : ''}>
      <td className={cn('px-3 py-2 text-xs', highlight ? 'font-bold text-slate-800' : 'text-slate-600')}>
        {label}
      </td>
      <td className="px-3 py-2 text-right font-mono text-xs text-amber-700">{a}</td>
      <td className="px-3 py-2 text-right font-mono text-xs text-purple-700">{b}</td>
    </tr>
  );
}

function SummaryCard({ summary }: { summary: RunSummary }) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        summary.label === 'chatbot'
          ? 'border-amber-200 bg-amber-50'
          : 'border-purple-200 bg-purple-50',
      )}
    >
      <h4
        className={cn(
          'mb-3 text-sm font-bold uppercase',
          summary.label === 'chatbot' ? 'text-amber-700' : 'text-purple-700',
        )}
      >
        {summary.label} Summary
      </h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          Total Tokens: <span className="font-mono font-bold">{summary.total_tokens.toLocaleString()}</span>
        </div>
        <div>
          Cost: <span className="font-mono font-bold">${summary.total_cost_usd.toFixed(6)}</span>
        </div>
        <div>
          Avg Latency: <span className="font-mono font-bold">{summary.avg_latency_ms}ms</span>
        </div>
        <div>
          Duration: <span className="font-mono font-bold">{summary.total_duration_ms}ms</span>
        </div>
        <div>
          LLM Calls: <span className="font-mono font-bold">{summary.llm_call_count}</span>
        </div>
        <div>
          Tool Calls: <span className="font-mono font-bold">{summary.tool_call_count}</span>
        </div>
        <div>
          Loops: <span className="font-mono font-bold">{summary.loop_count}</span>
        </div>
        <div>
          Errors: <span className="font-mono font-bold">{summary.error_count}</span>
        </div>
      </div>
    </div>
  );
}
