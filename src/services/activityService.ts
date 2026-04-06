import { debug } from '../utils/debug';
import type { ActivitySuggestions, Activity } from '../types';

/**
 * Mock activity database
 */
const activityDatabase: Record<string, Activity[]> = {
  'đà nẵng': [
    { id: '1', name: 'Tắm Biển Mỹ Khê', city: 'Đà Nẵng', type: 'Bãi Biển', price: 0, rating: 4.9, description: 'Bãi biển đẹp nhất Đông Nam Á. Nước sạch, cát trắng mịn.', duration: '2-3 tiếng', bookingUrl: 'https://booking.com/danang-myKhe' },
    { id: '2', name: 'Chèo Kayak Sơn Trà', city: 'Đà Nẵng', type: 'Thể Thao Nước', price: 250000, rating: 4.7, description: 'Chèo kayak quanh bán đảo Sơn Trà. Ngắm khỉ vàng quý hiếm.', duration: '2 tiếng', bookingUrl: 'https://booking.com/danang-kayak' },
    { id: '3', name: 'Viếng Chùa Linh Ứng', city: 'Đà Nẵng', type: 'Tôn Giáo', price: 0, rating: 4.6, description: 'Chùa trên núi với tượng Phật 67m. View biển tuyệt đẹp.', duration: '2 tiếng', bookingUrl: 'https://booking.com/danang-lingung' },
    { id: '4', name: 'Phố Cổ Hội An', city: 'Đà Nẵng', type: 'Văn Hóa', price: 120000, rating: 4.8, description: 'Phố cổ được UNESCO công nhận. Đèn lồng Hội An, kiến trúc cổ xưa.', duration: '3-4 tiếng', bookingUrl: 'https://booking.com/danang-hoian' },
    { id: '5', name: 'Sunset Fishing Cua Dai', city: 'Đà Nẵng', type: 'Thể Thao Nước', price: 350000, rating: 4.5, description: 'Đánh cá lúc hoàng hôn. Có bữa ăn hải sản tươi sống.', duration: '4 tiếng', bookingUrl: 'https://booking.com/danang-fishing' },
  ],
  'đà lạt': [
    { id: '6', name: 'Thác Cam Ly', city: 'Đà Lạt', type: 'Thiên Nhiên', price: 0, rating: 4.6, description: 'Thác nước đẹp trong thành phố. Có nhà hàng dân dã xung quanh.', duration: '1.5 tiếng', bookingUrl: 'https://booking.com/dalat-camly' },
    { id: '7', name: 'Hồ Tuyền Lâm', city: 'Đà Lạt', type: 'Thiên Nhiên', price: 30000, rating: 4.7, description: 'Hồ nước yên tĩnh, xung quanh là rừng thông. Có thể chèo thuyền.', duration: '2-3 tiếng', bookingUrl: 'https://booking.com/dalat-tuyen' },
    { id: '8', name: 'Thiền Viện Trúc Lâm', city: 'Đà Lạt', type: 'Tôn Giáo', price: 0, rating: 4.8, description: 'Tự viện Phật giáo trên núi. Không khí thiêng liêng, view tuyệt vời.', duration: '2 tiếng', bookingUrl: 'https://booking.com/dalat-trucLam' },
    { id: '9', name: 'Thác Voi', city: 'Đà Lạt', type: 'Thiên Nhiên', price: 50000, rating: 4.5, description: 'Thác Voi là một thác nước đẹp, có thể tắm nước.', duration: '2 tiếng', bookingUrl: 'https://booking.com/dalat-voi' },
    { id: '10', name: 'Vườn Hoa Thập Nhị', city: 'Đà Lạt', type: 'Công Viên', price: 50000, rating: 4.4, description: 'Vườn hoa với 12 loại hoa khác nhau theo mùa.', duration: '1.5 tiếng', bookingUrl: 'https://booking.com/dalat-flower' },
  ],
  'phú quốc': [
    { id: '11', name: 'Lặn Ngắm San Hô', city: 'Phú Quốc', type: 'Thể Thao Nước', price: 600000, rating: 4.8, description: 'Lặn ngắm san hô, cá đủ màu. Hướng dẫn an toàn chuyên nghiệp.', duration: '3 tiếng', bookingUrl: 'https://booking.com/phuquoc-diving' },
    { id: '12', name: 'Bãi Sao', city: 'Phú Quốc', type: 'Bãi Biển', price: 0, rating: 4.9, description: 'Bãi biển đẹp nhất Phú Quốc. Nước xanh, cát trắng mịn.', duration: '2-3 tiếng', bookingUrl: 'https://booking.com/phuquoc-saoBai' },
    { id: '13', name: 'Nhà Tù Phú Quốc', city: 'Phú Quốc', type: 'Lịch Sử', price: 150000, rating: 4.3, description: 'Bảo tàng lịch sử về chiến tranh, nhân phẩm con người.', duration: '1.5 tiếng', bookingUrl: 'https://booking.com/phuquoc-prison' },
    { id: '14', name: 'Chợ Đêm Dinh Cau', city: 'Phú Quốc', type: 'Ẩm Thực', price: 100000, rating: 4.6, description: 'Chợ đêm với hải sản tươi sống. Nặn và nướng tại chỗ.', duration: '2 tiếng', bookingUrl: 'https://booking.com/phuquoc-market' },
    { id: '15', name: 'Sunwshine Cable Car', city: 'Phú Quốc', type: 'Giải Trí', price: 250000, rating: 4.7, description: 'Cáp treo dài nhất thế giới. View toàn cảnh đảo Phú Quốc.', duration: '1 tiếng', bookingUrl: 'https://booking.com/phuquoc-cable' },
  ],
};

/**
 * Detect activity suggestion request
 */
export const detectActivityRequest = (message: string): boolean => {
  const lowerMsg = message.toLowerCase();
  const activityKeywords = ['hoạt động', 'chuyện gì vui', 'có gì hay', 'activity', 'attractions', 'điểm tham quan', 'giải trí', 'thú vui', 'trải nghiệm'];
  return activityKeywords.some(kw => lowerMsg.includes(kw));
};

/**
 * Extract city from message
 */
export const extractActivityCity = (message: string): string | null => {
  const cities = ['đà nẵng', 'đà lạt', 'phú quốc', 'hà nội', 'hồ chí minh', 'huế', 'nha trang'];
  const lowerMsg = message.toLowerCase();
  
  return cities.find(city => lowerMsg.includes(city)) || null;
};

/**
 * Get activity suggestions for a city
 */
export const getActivitySuggestions = (city: string): ActivitySuggestions => {
  debug.log('ACTIVITIES', `Getting suggestions for ${city}`);

  const cityKey = city.toLowerCase();
  const activities = activityDatabase[cityKey] || activityDatabase['đà nẵng'];

  return {
    city,
    activities,
    totalActivities: activities.length,
  };
};

/**
 * Format activity suggestions for display
 */
export const formatActivitySuggestions = (suggestions: ActivitySuggestions): string => {
  debug.log('ACTIVITIES', 'Formatting activity suggestions', suggestions);

  let output = `## 📸 Gợi Ý Hoạt Động & Attractions\n\n`;
  output += `**Thành phố:** ${suggestions.city} | **Tổng:** ${suggestions.totalActivities} hoạt động\n\n`;
  output += `---\n\n`;

  for (let i = 0; i < suggestions.activities.length; i++) {
    const a = suggestions.activities[i];
    const priceStr = a.price > 0 
      ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(a.price)
      : 'Miễn phí';
    
    output += `### ${i + 1}. ${a.name}\n\n`;
    output += `**⭐ Rating:** ${a.rating}/5\n`;
    output += `**💰 Giá vé:** ${priceStr}\n`;
    output += `**🏷️ Loại:** ${a.type}\n`;
    output += `**⏱️ Thời gian:** ${a.duration}\n`;
    output += `**📝 Mô tả:** ${a.description}\n`;
    output += `**🔗 Đặt vé:** [Chi tiết](${a.bookingUrl})\n\n`;
  }

  output += `---\n\n`;
  output += `### 💡 Gợi Ý Lịch Trình\n\n`;
  output += `**Sáng:** Khám phá địa điểm lịch sử & văn hóa\n`;
  output += `**Chiều:** Hoạt động ngoài trời, bãi biển\n`;
  output += `**Tối:** Ẩm thực địa phương, chợ đêm\n\n`;
  output += `Hãy liên hệ với tôi để lên kế hoạch chi tiết! 🗺️\n`;

  return output;
};

/**
 * Get activities by type
 */
export const getActivitiesByType = (city: string, type: string): Activity[] => {
  const suggestions = getActivitySuggestions(city);
  return suggestions.activities.filter(a => a.type.toLowerCase().includes(type.toLowerCase()));
};
