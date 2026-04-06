import { debug } from "../utils/debug";
import { chatWithTravelAgent } from "./gemini";

/**
 * Travel booking service - handles route detection, passenger parsing, and booking URL generation
 */

// Map Vietnamese cities to common codes and aliases
const VIETNAM_CITIES: Record<string, { code: string; aliases: string[] }> = {
  "hà nội": { code: "HAN", aliases: ["hanoi", "ha noi", "capital"] },
  "đà nẵng": { code: "DAD", aliases: ["da nang", "danang"] },
  "phú quốc": { code: "PQC", aliases: ["phu quoc", "quoc island"] },
  "đà lạt": { code: "DLI", aliases: ["da lat", "dalat"] },
  "hồ chí minh": { code: "SGN", aliases: ["ho chi minh", "hcm", "saigon", "tphcm"] },
  "huế": { code: "HUI", aliases: ["hue"] },
  "nha trang": { code: "CXR", aliases: ["nha trang", "nhatrang"] },
  "hải phòng": { code: "HPH", aliases: ["hai phong", "haiphong"] },
  "cần thơ": { code: "CAH", aliases: ["can tho", "cantho"] },
  "vinh": { code: "VII", aliases: ["vinh"] },
};

export interface RouteDetection {
  from: string | null;
  to: string | null;
  isValid: boolean;
}

export interface TravelPreferences {
  from: string;
  to: string;
  transport: "flight" | "bus" | null;
  passengers: number | null;
}

export interface BookingOption {
  provider: string;
  url: string;
  transport: "flight" | "bus";
  flightNumber?: string;
  departureDate?: string;
  departureTime?: string;
  arrivalTime?: string;
  priceFrom?: string;
  originAirport?: string;
  destinationAirport?: string;
}

export interface SearchFlightsInput {
  originCity: string;
  destinationCity: string;
  departureDate?: string;
  passengers: number;
}

export type BookingStep = "waiting_route" | "waiting_transport" | "waiting_passengers" | "complete";

export interface TravelBookingState {
  detectedRoute: {
    from: string | null;
    to: string | null;
  };
  transport: "flight" | "bus" | null;
  passengers: number | null;
  step: BookingStep;
}

interface AirportInfo {
  code: string;
  name: string;
  city: string;
}

interface FlightSchedule {
  airline: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  priceFrom: string;
}

const AIRPORTS_BY_CITY: Record<string, AirportInfo> = {
  "hà nội": { code: "HAN", name: "Nội Bài (HAN)", city: "Hà Nội" },
  "hồ chí minh": { code: "SGN", name: "Tân Sơn Nhất (SGN)", city: "Hồ Chí Minh" },
  "đà nẵng": { code: "DAD", name: "Đà Nẵng (DAD)", city: "Đà Nẵng" },
  "đà lạt": { code: "DLI", name: "Liên Khương (DLI)", city: "Đà Lạt" },
  "phú quốc": { code: "PQC", name: "Phú Quốc (PQC)", city: "Phú Quốc" },
  "huế": { code: "HUI", name: "Phú Bài (HUI)", city: "Huế" },
  "hải phòng": { code: "HPH", name: "Cát Bi (HPH)", city: "Hải Phòng" },
  "nha trang": { code: "CXR", name: "Cam Ranh (CXR)", city: "Nha Trang" },
  "cần thơ": { code: "VCA", name: "Cần Thơ (VCA)", city: "Cần Thơ" },
  "vinh": { code: "VII", name: "Vinh (VII)", city: "Vinh" },
};

const FLIGHT_SCHEDULES: Record<string, FlightSchedule[]> = {
  "SGN-DAD": [
    { airline: "Vietnam Airlines", flightNumber: "VN122", departureTime: "06:00", arrivalTime: "07:25", priceFrom: "1.050.000 VNĐ" },
    { airline: "Vietjet Air", flightNumber: "VJ512", departureTime: "09:35", arrivalTime: "11:00", priceFrom: "890.000 VNĐ" },
    { airline: "Bamboo Airways", flightNumber: "QH153", departureTime: "14:20", arrivalTime: "15:45", priceFrom: "980.000 VNĐ" },
    { airline: "Vietnam Airlines", flightNumber: "VN136", departureTime: "18:10", arrivalTime: "19:35", priceFrom: "1.150.000 VNĐ" },
  ],
  "SGN-PQC": [
    { airline: "Vietnam Airlines", flightNumber: "VN1823", departureTime: "07:15", arrivalTime: "08:20", priceFrom: "1.240.000 VNĐ" },
    { airline: "Vietjet Air", flightNumber: "VJ325", departureTime: "11:00", arrivalTime: "12:05", priceFrom: "1.020.000 VNĐ" },
    { airline: "Bamboo Airways", flightNumber: "QH1921", departureTime: "16:40", arrivalTime: "17:45", priceFrom: "1.180.000 VNĐ" },
  ],
  "SGN-DLI": [
    { airline: "Vietnam Airlines", flightNumber: "VN1380", departureTime: "08:00", arrivalTime: "08:55", priceFrom: "1.090.000 VNĐ" },
    { airline: "Vietjet Air", flightNumber: "VJ365", departureTime: "13:25", arrivalTime: "14:20", priceFrom: "910.000 VNĐ" },
    { airline: "Bamboo Airways", flightNumber: "QH1120", departureTime: "19:30", arrivalTime: "20:25", priceFrom: "990.000 VNĐ" },
  ],
  "HAN-DAD": [
    { airline: "Vietnam Airlines", flightNumber: "VN171", departureTime: "06:35", arrivalTime: "07:55", priceFrom: "1.120.000 VNĐ" },
    { airline: "Vietjet Air", flightNumber: "VJ503", departureTime: "10:25", arrivalTime: "11:45", priceFrom: "920.000 VNĐ" },
    { airline: "Bamboo Airways", flightNumber: "QH103", departureTime: "15:10", arrivalTime: "16:30", priceFrom: "1.010.000 VNĐ" },
    { airline: "Vietnam Airlines", flightNumber: "VN187", departureTime: "20:05", arrivalTime: "21:25", priceFrom: "1.190.000 VNĐ" },
  ],
  "HAN-PQC": [
    { airline: "Vietnam Airlines", flightNumber: "VN1235", departureTime: "09:10", arrivalTime: "11:20", priceFrom: "1.650.000 VNĐ" },
    { airline: "Vietjet Air", flightNumber: "VJ451", departureTime: "14:45", arrivalTime: "16:55", priceFrom: "1.390.000 VNĐ" },
    { airline: "Bamboo Airways", flightNumber: "QH1615", departureTime: "18:20", arrivalTime: "20:30", priceFrom: "1.480.000 VNĐ" },
  ],
  "DAD-HAN": [
    { airline: "Vietnam Airlines", flightNumber: "VN180", departureTime: "07:00", arrivalTime: "08:20", priceFrom: "1.080.000 VNĐ" },
    { airline: "Vietjet Air", flightNumber: "VJ506", departureTime: "12:05", arrivalTime: "13:25", priceFrom: "900.000 VNĐ" },
    { airline: "Bamboo Airways", flightNumber: "QH110", departureTime: "17:55", arrivalTime: "19:15", priceFrom: "990.000 VNĐ" },
  ],
  "DAD-SGN": [
    { airline: "Vietnam Airlines", flightNumber: "VN129", departureTime: "06:50", arrivalTime: "08:15", priceFrom: "1.060.000 VNĐ" },
    { airline: "Vietjet Air", flightNumber: "VJ517", departureTime: "11:40", arrivalTime: "13:05", priceFrom: "880.000 VNĐ" },
    { airline: "Bamboo Airways", flightNumber: "QH160", departureTime: "19:00", arrivalTime: "20:25", priceFrom: "960.000 VNĐ" },
  ],
};

/**
 * Normalize city name to standard format
 */
const normalizeCityName = (city: string): string => {
  const lower = city.toLowerCase().trim();
  for (const [key, value] of Object.entries(VIETNAM_CITIES)) {
    if (key === lower || value.aliases.includes(lower)) {
      return key;
    }
  }
  return city;
};

/**
 * Detect route from message (supports patterns like "từ X đến Y", "X -> Y", "X to Y")
 */
export const detectRoute = (message: string): RouteDetection => {
  debug.log("BOOKING", `Detecting route from: "${message.substring(0, 50)}..."`);

  const lower = message.toLowerCase();

  // Pattern 1: "từ X đến Y"
  const pattern1 = /từ\s+([^đ]+)\s+đến\s+(.+?)(?:\s*[?!.]|$)/i;
  let match = message.match(pattern1);
  if (match) {
    const from = normalizeCityName(match[1].trim());
    const to = normalizeCityName(match[2].trim());
    debug.success("BOOKING", `Route detected (từ...đến): ${from} → ${to}`);
    return { from, to, isValid: true };
  }

  // Pattern 2: "X -> Y" or "X to Y"
  const pattern2 = /(.+?)\s*(?:->|to|đến)\s+(.+?)(?:\s*[?!.]|$)/i;
  match = message.match(pattern2);
  if (match) {
    const from = normalizeCityName(match[1].trim());
    const to = normalizeCityName(match[2].trim());
    if (from !== match[1].trim() || to !== match[2].trim()) {
      // Only consider valid if at least one city was recognized
      debug.success("BOOKING", `Route detected (->): ${from} → ${to}`);
      return { from, to, isValid: true };
    }
  }

  debug.warn("BOOKING", "No route pattern detected");
  return { from: null, to: null, isValid: false };
};

/**
 * Parse passenger count from message (e.g., "2 người", "2 people", "ba người")
 */
export const parsePassengerCount = (message: string): number | null => {
  debug.log("BOOKING", `Parsing passenger count from: "${message}"`);

  // Number words mapping
  const numberWords: Record<string, number> = {
    một: 1,
    hai: 2,
    ba: 3,
    bốn: 4,
    năm: 5,
    sáu: 6,
    bảy: 7,
    tám: 8,
    chín: 9,
    mười: 10,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
  };

  const lower = message.toLowerCase();

  // Pattern: number + people/người
  const pattern = /(\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\s*(người|people|person|adults?|travelers?|passengers?)/i;
  const match = message.match(pattern);

  if (match) {
    let count = 0;
    const numPart = match[1].toLowerCase();

    if (/^\d+$/.test(numPart)) {
      count = parseInt(numPart);
    } else if (numberWords[numPart]) {
      count = numberWords[numPart];
    }

    if (count > 0 && count <= 10) {
      debug.success("BOOKING", `Passenger count detected: ${count}`);
      return count;
    }
  }

  debug.warn("BOOKING", "No valid passenger count found");
  return null;
};

/**
 * Parse transport preference from message (flight or bus)
 */
export const parseTransport = (message: string): "flight" | "bus" | null => {
  debug.log("BOOKING", `Parsing transport from: "${message}"`);

  const lower = message.toLowerCase();

  // Flight patterns
  if (
    /máy bay|flight|bay|air|airplane|vé bay|đặt máy bay/i.test(lower)
  ) {
    debug.success("BOOKING", "Transport detected: flight");
    return "flight";
  }

  // Bus patterns
  if (/xe khách|bus|coach|xe|coach|đặt xe|vé xe/i.test(lower)) {
    debug.success("BOOKING", "Transport detected: bus");
    return "bus";
  }

  debug.warn("BOOKING", "No transport preference detected");
  return null;
};

/**
 * Generate prompt based on current booking state
 */
export const generateBookingPrompt = (state: TravelBookingState): string | null => {
  if (!state.detectedRoute.from || !state.detectedRoute.to) {
    return "Để giúp bạn đặt vé, bạn muốn đi từ đâu đến đâu?";
  }

  if (!state.transport) {
    return `Bạn muốn đi từ ${state.detectedRoute.from} đến ${state.detectedRoute.to} bằng **máy bay** hay **xe khách**?`;
  }

  if (!state.passengers) {
    return `Bao nhiêu người sẽ đi? (Vui lòng cho biết số người, ví dụ: "2 người" hoặc "3 người")`;
  }

  return null; // Ready to search
};

/**
 * Parse user response and update booking state
 */
export const parseBookingResponse = (
  message: string,
  currentState: TravelBookingState
): Partial<TravelBookingState> => {
  debug.group(`Parsing booking response at step: ${currentState.step}`);

  const update: Partial<TravelBookingState> = {};

  if (currentState.step === "waiting_route") {
    const route = detectRoute(message);
    if (route.isValid) {
      update.detectedRoute = { from: route.from, to: route.to };
      update.step = "waiting_transport";
    }
  } else if (currentState.step === "waiting_transport") {
    const transport = parseTransport(message);
    if (transport) {
      update.transport = transport;
      update.step = "waiting_passengers";
    }
  } else if (currentState.step === "waiting_passengers") {
    const passengers = parsePassengerCount(message);
    if (passengers) {
      update.passengers = passengers;
      update.step = "complete";
    }
  }

  debug.log("BOOKING", "State update:", update);
  debug.groupEnd();

  return update;
};

const toolGetAirportByCity = (city: string): AirportInfo | null => {
  const normalized = normalizeCityName(city).toLowerCase();
  return AIRPORTS_BY_CITY[normalized] || null;
};

const toolGetFlightSchedulesByRoute = (
  from: string,
  to: string,
): FlightSchedule[] => {
  const fromAirport = toolGetAirportByCity(from);
  const toAirport = toolGetAirportByCity(to);

  if (!fromAirport || !toAirport) {
    return [];
  }

  const routeKey = `${fromAirport.code}-${toAirport.code}`;
  return FLIGHT_SCHEDULES[routeKey] || [];
};

const toolSearchFlightOptions = (
  from: string,
  to: string,
  passengers: number,
  departureDate?: string,
): BookingOption[] => {
  const fromAirport = toolGetAirportByCity(from);
  const toAirport = toolGetAirportByCity(to);
  const schedules = toolGetFlightSchedulesByRoute(from, to);

  if (!fromAirport || !toAirport || schedules.length === 0) {
    return [];
  }

  return schedules.map((flight) => {
    const provider = flight.airline;
    const baseUrl =
      provider === "Vietnam Airlines"
        ? "https://www.vietnamairlines.com/en/book"
        : provider === "Vietjet Air"
          ? "https://www.vietjetair.com/"
          : "https://www.bambooairways.com/booking";

    return {
      provider,
      transport: "flight",
      flightNumber: flight.flightNumber,
      departureDate,
      departureTime: flight.departureTime,
      arrivalTime: flight.arrivalTime,
      priceFrom: flight.priceFrom,
      originAirport: fromAirport.name,
      destinationAirport: toAirport.name,
      url: `${baseUrl}?from=${fromAirport.code}&to=${toAirport.code}&passengers=${passengers}${
        departureDate ? `&date=${departureDate}` : ""
      }`,
    };
  });
};

export const searchFlightsTool = (input: SearchFlightsInput): BookingOption[] => {
  debug.log("BOOKING_TOOL", "search_flights called", input);
  return toolSearchFlightOptions(
    input.originCity,
    input.destinationCity,
    input.passengers,
    input.departureDate,
  );
};

/**
 * Parse departure date from message.
 * Supports:
 * - YYYY-MM-DD (2026-04-20)
 * - DD/MM/YYYY or DD-MM-YYYY
 * - Relative Vietnamese words: hôm nay, ngày mai, mốt
 */
export const parseDepartureDate = (message: string): string | null => {
  const lower = message.toLowerCase().trim();

  if (lower.includes("hôm nay")) {
    return new Date().toISOString().slice(0, 10);
  }

  if (lower.includes("ngày mai")) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  if (lower.includes("ngày mốt") || lower.includes("mốt")) {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  }

  const isoMatch = lower.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (year >= 2024 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year.toString().padStart(4, "0")}-${month
        .toString()
        .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }

  const vnMatch = lower.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](20\d{2}))?\b/);
  if (vnMatch) {
    const now = new Date();
    const day = Number(vnMatch[1]);
    const month = Number(vnMatch[2]);
    const year = vnMatch[3] ? Number(vnMatch[3]) : now.getFullYear();
    if (year >= 2024 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year.toString().padStart(4, "0")}-${month
        .toString()
        .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }

  return null;
};

/**
 * Search booking links using Gemini
 */
export const searchBookingLinks = async (
  from: string,
  to: string,
  transport: "flight" | "bus",
  passengers: number
  ,
  departureDate?: string,
): Promise<BookingOption[]> => {
  debug.group(`Searching booking links`);
  debug.log("BOOKING", `Route: ${from} → ${to}, Transport: ${transport}, Passengers: ${passengers}`);

  if (transport === "flight") {
    const toolFlightOptions = searchFlightsTool({
      originCity: from,
      destinationCity: to,
      departureDate,
      passengers,
    });
    if (toolFlightOptions.length > 0) {
      debug.success("BOOKING", `Tool flight search found ${toolFlightOptions.length} options`);
      debug.groupEnd();
      return toolFlightOptions;
    }
    debug.warn("BOOKING", "Tool flight search found no route data, falling back to model");
  }

  try {
    const fromCode = VIETNAM_CITIES[from.toLowerCase()]?.code || from;
    const toCode = VIETNAM_CITIES[to.toLowerCase()]?.code || to;

    const prompt = `Generate ${passengers} passenger ${transport} booking links for travel from ${from} to ${to}.
    Return ONLY a JSON array with this format (no markdown, no extra text):
    [{"provider":"Airline/Bus Company Name","url":"https://booking.url?from=${fromCode}&to=${toCode}&passengers=${passengers}${
      departureDate ? `&date=${departureDate}` : ""
    }","transport":"${transport}"}]
    
    For flights: Include Vietnam Airlines, Vietjet, Bamboo Airways, AirAsia
    For buses: Include Futa, SaiGon Coach, Vietnam Coach, Camel Bus
    
    Generate realistic booking URLs with proper parameters.`;

    const messages = [
      {
        role: "user" as const,
        parts: [{ text: prompt }],
      },
    ];

    const response = await chatWithTravelAgent(messages);
    const responseText = response.text || "";

    debug.log("BOOKING", `Gemini response: ${responseText.substring(0, 100)}...`);

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      debug.warn("BOOKING", "No JSON found in response");
      return generateDefaultBookingLinks(from, to, transport, passengers);
    }

    const options: BookingOption[] = JSON.parse(jsonMatch[0]);
    debug.success("BOOKING", `Found ${options.length} booking options`);
    debug.groupEnd();

    return options;
  } catch (error) {
    debug.error("BOOKING", "Error searching booking links", error);
    return generateDefaultBookingLinks(from, to, transport, passengers);
  }
};

/**
 * Generate default booking links as fallback
 */
const generateDefaultBookingLinks = (
  from: string,
  to: string,
  transport: "flight" | "bus",
  passengers: number
): BookingOption[] => {
  debug.log("BOOKING", "Generating default booking links as fallback");

  const fromCode = VIETNAM_CITIES[from.toLowerCase()]?.code || from;
  const toCode = VIETNAM_CITIES[to.toLowerCase()]?.code || to;

  if (transport === "flight") {
    return [
      {
        provider: "Vietnam Airlines",
        url: `https://www.vietnamairlines.com/en/book?from=${fromCode}&to=${toCode}&passengers=${passengers}`,
        transport: "flight",
      },
      {
        provider: "Vietjet",
        url: `https://www.vietjetair.com/?from=${fromCode}&to=${toCode}&passengers=${passengers}`,
        transport: "flight",
      },
      {
        provider: "Bamboo Airways",
        url: `https://www.bambooairways.com/booking?from=${fromCode}&to=${toCode}&passengers=${passengers}`,
        transport: "flight",
      },
      {
        provider: "AirAsia",
        url: `https://www.airasia.com/en/book?origin=${fromCode}&destination=${toCode}&adult=${passengers}`,
        transport: "flight",
      },
    ];
  } else {
    return [
      {
        provider: "Futa Bus Lines",
        url: `https://www.futabus.vn/?from=${fromCode}&to=${toCode}&passengers=${passengers}`,
        transport: "bus",
      },
      {
        provider: "SaiGon Coach",
        url: `https://www.saigoncoach.com/?from=${fromCode}&to=${toCode}&passengers=${passengers}`,
        transport: "bus",
      },
      {
        provider: "Limousine Mien Dong",
        url: `https://www.busbooking.vn/?from=${fromCode}&to=${toCode}&passengers=${passengers}`,
        transport: "bus",
      },
    ];
  }
};

/**
 * Format booking options for display
 */
export const formatBookingOptions = (options: BookingOption[]): string => {
  if (options.length === 0) {
    return "Xin lỗi, không tìm thấy các tùy chọn đặt vé. Vui lòng thử lại.";
  }

  const lines = [
    "🎫 **Các tùy chọn đặt vé cho bạn:**\n",
    ...options.map((opt, idx) => {
      if (
        opt.transport === "flight" &&
        opt.flightNumber &&
        opt.departureDate &&
        opt.departureTime &&
        opt.originAirport &&
        opt.destinationAirport
      ) {
        return `${idx + 1}. **${opt.provider}** (${opt.flightNumber}) - [Đặt vé ngay](${opt.url})
   - Ngày bay: **${opt.departureDate}**
   - Khởi hành: **${opt.departureTime}**
   - Hạ cánh dự kiến: **${opt.arrivalTime || 'Đang cập nhật'}**
   - Chặng bay: **${opt.originAirport} → ${opt.destinationAirport}**
   - Giá tham khảo: **${opt.priceFrom || 'Liên hệ hãng'}**`;
      }

      return `${idx + 1}. **${opt.provider}** - [Đặt vé ngay](${opt.url})`;
    }),
    "\nNhấp vào liên kết để hoàn tất đặt chỗ. Chúc bạn có chuyến đi vui vẻ!",
  ];

  return lines.join("\n");
};
