import { debug } from '../utils/debug';

/**
 * Content filter to ensure AI only responds about flights, buses, hotels, and travel guides
 */

// Keywords for allowed topics
const ALLOWED_TOPICS = {
  flights: [
    'chuyến bay',
    'flight',
    'bay',
    'vietjet',
    'bamboo',
    'vietnam airlines',
    'airasia',
    'hãng hàng không',
    'vé máy bay',
    'đặt vé bay',
  ],
  buses: [
    'xe bus',
    'bus',
    'coach',
    'xe khách',
    'futa',
    'saigon coach',
    'việt nam coach',
    'camel',
    'xe đò',
    'đặt vé bus',
  ],
  hotels: [
    'khách sạn',
    'hotel',
    'room',
    'đặt phòng',
    'homestay',
    'airbnb',
    'resort',
    'nơi ở',
  ],
  travelGuides: [
    'địa điểm',
    'du lịch',
    'travel',
    'sight',
    'attraction',
    'trekking',
    'hiking',
    'tour',
    'khám phá',
    'cẩm nang',
    'hướng dẫn',
    'lịch trình',
    'itinerary',
    'đà lạt',
    'đà nẵng',
    'phú quốc',
    'hà nội',
    'hồ chí minh',
    'huế',
    'nha trang',
  ],
};

const GREETING_KEYWORDS = [
  'xin chao',
  'xin chào',
  'chao',
  'chào',
  'hello',
  'hi',
  'hey',
  'alo',
];

const TRAVEL_INTENT_KEYWORDS = [
  'du lịch',
  'đi chơi',
  'kỳ nghỉ',
  'nghỉ dưỡng',
  'trip',
  'vacation',
  'tour',
  'booking',
  'book',
  'đặt',
  'lịch trình',
  'itinerary',
  'từ',
  'đến',
  'from',
  'to',
  'khởi hành',
  'đi đâu',
  'đi như nào',
  'di chuyển',
  'tham quan',
  'khám phá',
  'check-in',
  'resort',
  'sân bay',
  'ga',
  'bến xe',
  'đà lạt',
  'da lat',
  'đà nẵng',
  'da nang',
  'phú quốc',
  'phu quoc',
  'hà nội',
  'ha noi',
  'hồ chí minh',
  'ho chi minh',
  'sài gòn',
  'saigon',
  'nha trang',
  'huế',
  'hue',
  'sapa',
];

// Out-of-scope topic examples
const BLOCKED_TOPICS = [
  'nhà hàng',
  'quán ăn',
  'ăn uống',
  'restaurant',
  'thời tiết',
  'weather',
  'phim',
  'movie',
  'nhạc',
  'music',
  'bóng đá',
  'football',
  'thể thao',
  'sports',
  'công việc',
  'work',
  'học tập',
  'study',
  'tình yêu',
  'love',
  'mối quan hệ',
  'relationship',
];

const normalizeText = (text: string): string => text.toLowerCase().trim();

const countKeywordMatches = (message: string, keywords: string[]): number => {
  let count = 0;
  for (const keyword of keywords) {
    if (message.includes(keyword)) {
      count += 1;
    }
  }
  return count;
};

/**
 * Check if message is about allowed topics
 */
export const isValidTopic = (message: string): boolean => {
  const lowerMsg = normalizeText(message);
  if (!lowerMsg) return false;

  const blockedMatches = BLOCKED_TOPICS.filter((blocked) => lowerMsg.includes(blocked));
  let allowedMatches = 0;
  for (const category of Object.values(ALLOWED_TOPICS)) {
    allowedMatches += countKeywordMatches(lowerMsg, category);
  }
  const travelIntentMatches = countKeywordMatches(lowerMsg, TRAVEL_INTENT_KEYWORDS);
  const greetingMatches = countKeywordMatches(lowerMsg, GREETING_KEYWORDS);

  const hasAllowedSignal = allowedMatches > 0;
  const hasTravelSignal = travelIntentMatches > 0;
  const hasGreetingSignal = greetingMatches > 0;
  const hasBlockedSignal = blockedMatches.length > 0;

  // Less strict: greeting is allowed unless it is clearly about blocked topics.
  if (hasGreetingSignal && !hasBlockedSignal) {
    debug.log('FILTER', 'Greeting detected and accepted');
    return true;
  }

  // Primary rule: if there is any travel/allowed signal, allow it.
  if (hasAllowedSignal || hasTravelSignal) {
    if (hasBlockedSignal) {
      debug.warn('FILTER', 'Mixed topic detected, but travel signal exists. Allowing message.', {
        blockedMatches,
        allowedMatches,
        travelIntentMatches,
      });
    } else {
      debug.log('FILTER', 'Travel signal detected and accepted', {
        allowedMatches,
        travelIntentMatches,
      });
    }
    return true;
  }

  // Out-of-scope only when blocked signal is clear and no travel signal.
  if (hasBlockedSignal) {
    debug.warn('FILTER', `Blocked topic detected: ${blockedMatches.join(', ')}`);
    return false;
  }

  // Less strict fallback: allow neutral/ambiguous prompts to let systemInstruction handle intent.
  debug.log('FILTER', 'No explicit keyword matched. Allowing neutral message to reduce strictness.');
  return true;
};

/**
 * Get out-of-scope response message
 */
export const getOutOfScopeMessage = (): string => {
  return `Mình chưa hỗ trợ sâu chủ đề này, nhưng rất sẵn sàng giúp bạn phần du lịch nhé 😊

Mình hỗ trợ tốt nhất ở:
✈️ **Chuyến bay** - Tìm vé, so sánh, link đặt
🚌 **Xe bus/Xe khách** - Tuyến đi, giá vé, link đặt
🏨 **Khách sạn** - Gợi ý nơi ở theo ngân sách/vị trí
📍 **Cẩm nang du lịch** - Lịch trình, điểm tham quan, mẹo di chuyển

Bạn muốn bắt đầu từ điểm đến nào để mình gợi ý nhanh cho bạn?`;
};

/**
 * Detect main topic category
 */
export const detectTopicCategory = (
  message: string
): 'flights' | 'buses' | 'hotels' | 'travelGuides' | null => {
  const lowerMsg = message.toLowerCase();

  if (ALLOWED_TOPICS.flights.some(kw => lowerMsg.includes(kw))) {
    return 'flights';
  }
  if (ALLOWED_TOPICS.buses.some(kw => lowerMsg.includes(kw))) {
    return 'buses';
  }
  if (ALLOWED_TOPICS.hotels.some(kw => lowerMsg.includes(kw))) {
    return 'hotels';
  }
  if (ALLOWED_TOPICS.travelGuides.some(kw => lowerMsg.includes(kw))) {
    return 'travelGuides';
  }

  return null;
};
