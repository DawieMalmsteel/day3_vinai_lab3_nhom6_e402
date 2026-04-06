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

/**
 * Search booking links using Gemini
 */
export const searchBookingLinks = async (
  from: string,
  to: string,
  transport: "flight" | "bus",
  passengers: number
): Promise<BookingOption[]> => {
  debug.group(`Searching booking links`);
  debug.log("BOOKING", `Route: ${from} → ${to}, Transport: ${transport}, Passengers: ${passengers}`);

  try {
    const fromCode = VIETNAM_CITIES[from.toLowerCase()]?.code || from;
    const toCode = VIETNAM_CITIES[to.toLowerCase()]?.code || to;

    const prompt = `Generate ${passengers} passenger ${transport} booking links for travel from ${from} to ${to}.
    Return ONLY a JSON array with this format (no markdown, no extra text):
    [{"provider":"Airline/Bus Company Name","url":"https://booking.url?from=${fromCode}&to=${toCode}&passengers=${passengers}","transport":"${transport}"}]
    
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
    ...options.map(
      (opt, idx) =>
        `${idx + 1}. **${opt.provider}** - [Đặt vé ngay](${opt.url})`
    ),
    "\nNhấp vào liên kết để hoàn tất đặt chỗ. Chúc bạn có chuyến đi vui vẻ!",
  ];

  return lines.join("\n");
};
