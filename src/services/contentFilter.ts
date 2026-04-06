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

/**
 * Check if message is about allowed topics
 */
export const isValidTopic = (message: string): boolean => {
  const lowerMsg = message.toLowerCase();

  // Check if any blocked topic appears
  for (const blocked of BLOCKED_TOPICS) {
    if (lowerMsg.includes(blocked)) {
      debug.warn('FILTER', `Blocked topic detected: ${blocked}`);
      return false;
    }
  }

  // Check if any allowed topic appears
  for (const category of Object.values(ALLOWED_TOPICS)) {
    for (const keyword of category) {
      if (lowerMsg.includes(keyword)) {
        debug.log('FILTER', `Valid topic detected: ${keyword}`);
        return true;
      }
    }
  }

  // If no keywords matched, consider as invalid
  debug.warn('FILTER', 'No valid topic keywords found');
  return false;
};

/**
 * Get out-of-scope response message
 */
export const getOutOfScopeMessage = (): string => {
  return `Xin lỗi! Tôi chỉ hỗ trợ về các chủ đề sau:

✈️ **Chuyến bay** - Tìm vé, so sánh giá, đặt chuyến
🚌 **Xe bus** - Các tuyến xe, giá vé, đặt vé
🏨 **Khách sạn** - Tìm phòng, so sánh, đặt phòng
📍 **Địa điểm du lịch** - Cẩm nang, lịch trình, địa điểm tham quan

Bạn muốn tìm chuyến bay, xe bus, khách sạn hoặc thông tin du lịch nào?`;
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
