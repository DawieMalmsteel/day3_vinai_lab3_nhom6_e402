import { debug } from '../utils/debug';
import type { HotelOption, HotelLocation } from '../types';

/**
 * Hotel search service - handles hotel search with 3 different flow options
 */

// Mocked hotel database for demo
const HOTEL_DATABASE: Record<string, HotelOption[]> = {
  'đà nẵng': [
    {
      id: '1',
      name: 'Sala Danang Beach Hotel',
      city: 'Đà Nẵng',
      url: 'https://www.booking.com/hotel/vn/sala-danang-beach.html',
      pricePerNight: '800K-1.2M VNĐ',
      rating: 4,
      location: 'beach',
    },
    {
      id: '2',
      name: 'A La Carte Da Nang Beach',
      city: 'Đà Nẵng',
      url: 'https://www.agoda.com/a-la-carte-da-nang-beach',
      pricePerNight: '900K-1.5M VNĐ',
      rating: 4,
      location: 'beach',
    },
    {
      id: '3',
      name: 'Danang Golden Bay Hotel',
      city: 'Đà Nẵng',
      url: 'https://www.booking.com/hotel/vn/danang-golden-bay.html',
      pricePerNight: '1M-1.8M VNĐ',
      rating: 5,
      location: 'city',
    },
    {
      id: '4',
      name: 'Minh House',
      city: 'Đà Nẵng',
      url: 'https://www.booking.com/hotel/vn/minh-house-danang.html',
      pricePerNight: '600K-900K VNĐ',
      rating: 3.5,
      location: 'quiet',
    },
  ],
  'đà lạt': [
    {
      id: '5',
      name: 'Dalat Palace Heritage Hotel',
      city: 'Đà Lạt',
      url: 'https://www.booking.com/hotel/vn/dalat-palace-heritage.html',
      pricePerNight: '1.5M-2.5M VNĐ',
      rating: 5,
      location: 'city',
    },
    {
      id: '6',
      name: 'Duy Tan Hotel',
      city: 'Đà Lạt',
      url: 'https://www.agoda.com/duy-tan-hotel-dalat',
      pricePerNight: '500K-800K VNĐ',
      rating: 3.5,
      location: 'budget',
    },
    {
      id: '7',
      name: 'Hang Nga Guest House',
      city: 'Đà Lạt',
      url: 'https://www.booking.com/hotel/vn/hang-nga-guest-house.html',
      pricePerNight: '400K-700K VNĐ',
      rating: 4,
      location: 'quiet',
    },
  ],
  'phú quốc': [
    {
      id: '8',
      name: 'Vinpearl Resort Phu Quoc',
      city: 'Phú Quốc',
      url: 'https://www.booking.com/hotel/vn/vinpearl-resort-phu-quoc.html',
      pricePerNight: '2M-4M VNĐ',
      rating: 5,
      location: 'beach',
    },
    {
      id: '9',
      name: 'Phu Quoc Island Beach',
      city: 'Phú Quốc',
      url: 'https://www.agoda.com/phu-quoc-island-beach',
      pricePerNight: '1M-1.5M VNĐ',
      rating: 4,
      location: 'beach',
    },
    {
      id: '10',
      name: 'Sea Star Resort',
      city: 'Phú Quốc',
      url: 'https://www.booking.com/hotel/vn/sea-star-resort.html',
      pricePerNight: '700K-1.2M VNĐ',
      rating: 3.5,
      location: 'budget',
    },
  ],
};

export interface SearchHotelsInput {
  city: string;
  checkinDate?: string;
  checkoutDate?: string;
  guests?: number;
  budget?: 'budget' | 'mid' | 'luxury';
  locationPreference?: HotelLocation;
}

export interface HotelSearchToolResult {
  id: string;
  name: string;
  city: string;
  location: HotelLocation;
  pricePerNight: string;
  rating: number;
  amenities: string[];
  bookingUrl: string;
  checkinDate?: string;
  checkoutDate?: string;
  guests?: number;
}

const getAmenitiesByLocation = (location: HotelLocation): string[] => {
  switch (location) {
    case 'beach':
      return ['Gần biển', 'Hồ bơi', 'Ăn sáng'];
    case 'city':
      return ['Gần trung tâm', 'Wifi', 'Bãi đậu xe'];
    case 'quiet':
      return ['Yên tĩnh', 'Vườn', 'Phù hợp nghỉ dưỡng'];
    case 'budget':
      return ['Giá tốt', 'Cơ bản đầy đủ', 'Phòng sạch'];
    default:
      return ['Tiện nghi cơ bản'];
  }
};

/**
 * OPTION A: Quick search - just 2-3 hotels with link + price
 */
export const formatHotelsOptionA = (hotels: HotelOption[]): string => {
  if (hotels.length === 0) {
    return 'Xin lỗi, không tìm thấy khách sạn phù hợp.';
  }

  const topHotels = hotels.slice(0, 3);
  const lines = [
    '🏨 **Khách sạn ở ' + (hotels[0]?.city || 'địa điểm') + ':**\n',
    ...topHotels.map(
      (h, idx) =>
        `${idx + 1}. [${h.name}](${h.url}) - ${'⭐'.repeat(Math.floor(h.rating))} - ${h.pricePerNight}/đêm`
    ),
    '\n❓ Bạn muốn tìm theo giá hay vị trí khác?',
  ];

  return lines.join('\n');
};

/**
 * OPTION B: Smart search - ask location first, then show matching hotels
 */
export const formatHotelsOptionB = (hotels: HotelOption[]): string => {
  if (hotels.length === 0) {
    return 'Xin lỗi, không tìm thấy khách sạn với tiêu chí của bạn.';
  }

  const topHotels = hotels.slice(0, 2);
  const city = hotels[0]?.city || 'địa điểm';
  const lines = [
    `🏨 **Khách sạn ${city} - Tối ưu cho bạn:**\n`,
    ...topHotels.map(
      (h, idx) =>
        `${idx + 1}. [${h.name}](${h.url})\n   ${h.pricePerNight}/đêm • ${'⭐'.repeat(Math.floor(h.rating))}`
    ),
    `\n➜ Muốn xem thêm hoặc thay đổi tiêu chí?`,
  ];

  return lines.join('\n');
};

/**
 * OPTION C: Detailed search - full info with description
 */
export const formatHotelsOptionC = (hotels: HotelOption[]): string => {
  if (hotels.length === 0) {
    return 'Xin lỗi, không tìm thấy khách sạn phù hợp.';
  }

  const topHotels = hotels.slice(0, 3);
  const city = hotels[0]?.city || 'địa điểm';
  const locationLabels: Record<string, string> = {
    beach: '🏖️ Gần biển',
    city: '🏙️ Giữa thành phố',
    quiet: '🌳 Yên tĩnh',
    budget: '💰 Budget',
  };

  const lines = [
    `🏨 **Khách sạn ${city} - Tìm kiếm chi tiết:**\n`,
    ...topHotels.map((h) => {
      const locationLabel = locationLabels[h.location] || '📍 Vị trí đa dạng';
      return `**[${h.name}](${h.url})**\n${locationLabel} • ${h.pricePerNight}/đêm • ${'⭐'.repeat(Math.floor(h.rating))}`;
    }),
    `\n📌 Bạn muốn đặt phòng hoặc tìm thêm?`,
  ];

  return lines.join('\n');
};

/**
 * Detect hotel search in message
 */
export const detectHotelSearch = (message: string): string | null => {
  const lowerMsg = message.toLowerCase();
  const keywords = [
    'khách sạn',
    'hotel',
    'đặt phòng',
    'room',
    'homestay',
    'airbnb',
    'nơi ở',
  ];

  for (const keyword of keywords) {
    if (lowerMsg.includes(keyword)) {
      // Extract city name if mentioned
      const cities = ['đà nẵng', 'da nang', 'đà lạt', 'da lat', 'phú quốc', 'phu quoc'];
      for (const city of cities) {
        if (lowerMsg.includes(city)) {
          return city === 'da nang' ? 'đà nẵng' : city === 'da lat' ? 'đà lạt' : city === 'phu quoc' ? 'phú quốc' : city;
        }
      }
      return 'general'; // Generic hotel search without specific city
    }
  }
  return null;
};

/**
 * Search hotels by city and filters
 */
export const searchHotels = (
  city: string,
  location?: HotelLocation,
  priceRange?: string
): HotelOption[] => {
  debug.log('HOTEL', `Searching hotels: city=${city}, location=${location}, price=${priceRange}`);

  const normalizedCity = city.toLowerCase().trim();
  let results = HOTEL_DATABASE[normalizedCity] || [];

  // Filter by location preference
  if (location) {
    results = results.filter((h) => h.location === location);
  }

  // Filter by price range
  if (priceRange) {
    if (priceRange === 'budget') {
      results = results.filter((h) => h.rating <= 3.5);
    } else if (priceRange === 'mid') {
      results = results.filter((h) => h.rating > 3.5 && h.rating < 5);
    } else if (priceRange === 'luxury') {
      results = results.filter((h) => h.rating === 5);
    }
  }

  debug.success('HOTEL', `Found ${results.length} hotels`);
  return results;
};

export const searchHotelsTool = (input: SearchHotelsInput): HotelSearchToolResult[] => {
  debug.log('HOTEL_TOOL', 'search_hotels called', input);

  const hotels = searchHotels(
    input.city,
    input.locationPreference,
    input.budget,
  );

  return hotels.map((hotel) => ({
    id: hotel.id,
    name: hotel.name,
    city: hotel.city,
    location: hotel.location,
    pricePerNight: hotel.pricePerNight,
    rating: hotel.rating,
    amenities: getAmenitiesByLocation(hotel.location),
    bookingUrl: hotel.url,
    checkinDate: input.checkinDate,
    checkoutDate: input.checkoutDate,
    guests: input.guests,
  }));
};

/**
 * Generate quick suggestion text based on search type
 */
export const generateHotelPrompt = (
  searchType: 'quick' | 'smart' | 'detailed',
  city: string
): string => {
  if (searchType === 'quick') {
    return `Show me 2-3 best hotels in ${city} with links in markdown format [Name](URL).`;
  } else if (searchType === 'smart') {
    return `What type of accommodation do you prefer in ${city}?
- 🏖️ Beach resort
- 🏙️ City center
- 🌳 Quiet area
- 💰 Budget friendly`;
  } else {
    return `Let me help you find hotels in ${city}. Please tell me:
- Budget per night?
- Preferred location?
- Room type needed?`;
  }
};
