import { debug } from '../utils/debug';
import type { TripPlan, ItineraryDay } from '../types';

/**
 * Detect trip planning request and extract dates
 */
export const detectTripPlanRequest = (message: string): boolean => {
  const lowerMsg = message.toLowerCase();
  const tripKeywords = ['lên kế hoạch', 'kế hoạch chuyến đi', 'itinerary', 'lịch trình', 'lên plan', 'planning'];
  return tripKeywords.some(kw => lowerMsg.includes(kw));
};

/**
 * Parse trip details from message
 */
export const parseTripDetails = (message: string, destination: string): {
  startDate?: string;
  endDate?: string;
  travelers?: number;
} => {
  const result: { startDate?: string; endDate?: string; travelers?: number } = {};
  
  // Extract dates (simplified pattern)
  const datePattern = /(\d{1,2}[\/\-]\d{1,2})|(\d{4}-\d{2}-\d{2})/g;
  const dates = message.match(datePattern);
  if (dates && dates.length >= 2) {
    result.startDate = dates[0];
    result.endDate = dates[1];
  }

  // Extract number of travelers
  const travelerPattern = /(\d+)\s*(người|traveler|human)/i;
  const travelerMatch = message.match(travelerPattern);
  if (travelerMatch) {
    result.travelers = parseInt(travelerMatch[1], 10);
  }

  return result;
};

/**
 * Generate detailed itinerary for a trip
 */
export const generateItinerary = (
  destination: string,
  startDate: string,
  endDate: string,
  travelers: number = 1
): TripPlan => {
  debug.log('TRIP_PLANNER', `Generating itinerary for ${destination}`, { startDate, endDate, travelers });

  // Mock itinerary based on popular destinations
  const itineraries: Record<string, ItineraryDay[]> = {
    'đà nẵng': [
      {
        day: 1,
        date: startDate,
        activities: ['Khám phá phố cố kính Hội An', 'Thưởng thức cơm lam', 'Dạo phố đêm'],
        meals: ['Cơm lam Hội An', 'Mì Quảng', 'Bánh vạc'],
        accommodation: 'Khách sạn 4 sao tại Mỹ Khê',
        notes: 'Đoàn tàu từ sân bay mất 30 phút',
      },
      {
        day: 2,
        date: startDate,
        activities: ['Tắm biển Mỹ Khê', 'Chèo thuyền kayak', 'Picnic bãi biển'],
        meals: ['Hải sản tươi sống', 'Bánh tráng nướng', 'Cà phê vỉa hè'],
        accommodation: 'Khách sạn 4 sao tại Mỹ Khê',
        notes: 'Mang kem chống nắng và nón',
      },
      {
        day: 3,
        date: endDate,
        activities: ['Viếng Chùa Linh Ứng', 'Leo núi Sơn Trà', 'Shopping tại CMN'],
        meals: ['Lẩu Mắc Cú', 'Bánh căn Nha Trang style', 'Ăn tối lần cuối'],
        accommodation: 'Chuẩn bị về',
        notes: 'Về sân bay 3 tiếng trước giờ cất cánh',
      },
    ],
    'đà lạt': [
      {
        day: 1,
        date: startDate,
        activities: ['Đến Đà Lạt', 'Thăm Phủ Thái Nhân', 'Dạo phố cổ'],
        meals: ['Cơm lốc', 'Bánh mì Pâtê', 'Cà phê trứng'],
        accommodation: 'Khách sạn tại trung tâm thành phố',
        notes: 'Thời tiết mát mẻ, mang áo khoác',
      },
      {
        day: 2,
        date: startDate,
        activities: ['Thác Cam Ly', 'Hồ Tuyền Lâm', 'Vườn hoa thập nhị'],
        meals: ['Thịt nướng', 'Rau cải xào', 'Sữa chua nước cốt dừa'],
        accommodation: 'Khách sạn tại trung tâm thành phố',
        notes: 'Mang camera để chụp ảnh thiên nhiên',
      },
      {
        day: 3,
        date: endDate,
        activities: ['Thác Voi', 'Thiền viện Trúc Lâm', 'Mua quà lưu niệm'],
        meals: ['Cháo cua', 'Canh chua cá', 'Ăn tối lần cuối'],
        accommodation: 'Chuẩn bị về',
        notes: 'Về sân bay với thời gian rộng rãi',
      },
    ],
    'phú quốc': [
      {
        day: 1,
        date: startDate,
        activities: ['Bay đến Phú Quốc', 'Check-in resort', 'Tắm biển Ông Lang'],
        meals: ['Hải sản BBQ', 'Cơm chiên Thái', 'Sinh tố trái cây'],
        accommodation: 'Resort 5 sao bãi Ông Lang',
        notes: 'Mang đồ tắm, kính râm',
      },
      {
        day: 2,
        date: startDate,
        activities: ['Lặn ngắm san hô', 'Chèo kayak gần rạn san hô', 'Sunset fishing'],
        meals: ['Hàu nướng', 'Mực nướng', 'Salad cua'],
        accommodation: 'Resort 5 sao bãi Ông Lang',
        notes: 'Mang bảo hiểm du lịch, tuân thủ an toàn',
      },
      {
        day: 3,
        date: startDate,
        activities: ['Nhà tù Phú Quốc', 'Chợ đêm', 'Chia tay đất Phú Quốc'],
        meals: ['Bánh hoai', 'Lẩu cá', 'Ăn tối lần cuối'],
        accommodation: 'Bay về',
        notes: 'Để thời gian đủ cho chuyến bay về',
      },
    ],
  };

  const destKey = destination.toLowerCase();
  const defaultItinerary = itineraries[destKey] || itineraries['đà nẵng'];

  const totalDays = 3; // Default 3 days
  const estimatedBudget = travelers * 2000000; // 2M per person (VND)

  return {
    destination,
    startDate,
    endDate,
    travelers,
    itinerary: defaultItinerary,
    estimatedBudget,
  };
};

/**
 * Format itinerary for display
 */
export const formatItinerary = (tripPlan: TripPlan): string => {
  debug.log('TRIP_PLANNER', 'Formatting itinerary', tripPlan);

  let result = `## 📅 Kế Hoạch Chuyến Đi Đến ${tripPlan.destination}\n\n`;
  result += `**Từ:** ${tripPlan.startDate} | **Đến:** ${tripPlan.endDate}\n`;
  result += `**Số người:** ${tripPlan.travelers} | **Ngân sách dự kiến:** ${(tripPlan.estimatedBudget / 1000000).toFixed(1)}M VND\n\n`;
  result += `---\n\n`;

  for (const day of tripPlan.itinerary) {
    result += `### Ngày ${day.day}\n\n`;
    result += `**📍 Chỗ ở:** ${day.accommodation}\n\n`;
    
    result += `**🎯 Hoạt động:**\n`;
    for (const activity of day.activities) {
      result += `- ${activity}\n`;
    }
    
    result += `\n**🍽️ Ăn uống:**\n`;
    for (const meal of day.meals) {
      result += `- ${meal}\n`;
    }
    
    result += `\n**📝 Ghi chú:** ${day.notes}\n\n`;
    result += `---\n\n`;
  }

  result += `**💡 Mẹo:**\n`;
  result += `- Đặt vé máy bay sớm để có giá tốt\n`;
  result += `- Đặt khách sạn với chính sách hủy miễn phí\n`;
  result += `- Mua bảo hiểm du lịch\n`;
  result += `- Kiểm tra thời tiết trước khi đi\n`;

  return result;
};
