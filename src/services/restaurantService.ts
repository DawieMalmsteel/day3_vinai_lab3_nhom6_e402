import { debug } from '../utils/debug';
import type { RestaurantRecommendation, Restaurant } from '../types';

/**
 * Mock restaurant database
 */
const restaurantDatabase: Record<string, Record<string, Restaurant[]>> = {
  'đà nẵng': {
    'hải sản': [
      { id: '1', name: 'Nhà Hàng Nước Ngoài', city: 'Đà Nẵng', cuisine: 'Hải Sản', price: '$$$', rating: 4.8, address: 'Mỹ Khê Beach', bookingUrl: 'https://booking.com/danang-seafood-1' },
      { id: '2', name: 'Crab House', city: 'Đà Nẵng', cuisine: 'Hải Sản', price: '$$', rating: 4.5, address: 'Tây Sơn', bookingUrl: 'https://booking.com/danang-crab' },
      { id: '3', name: 'Seafood Saigon', city: 'Đà Nẵng', cuisine: 'Hải Sản', price: '$$', rating: 4.3, address: 'Hàn Mặc Tử', bookingUrl: 'https://booking.com/danang-seafood-sg' },
    ],
    'việt nam': [
      { id: '4', name: 'Quán Ơi', city: 'Đà Nẵng', cuisine: 'Việt Nam', price: '$', rating: 4.6, address: 'Bạch Đằng', bookingUrl: 'https://booking.com/danang-quanoi' },
      { id: '5', name: 'Mỳ Quảng Bà Ngoại', city: 'Đà Nẵng', cuisine: 'Việt Nam', price: '$', rating: 4.4, address: 'Phố Cổ Hội An', bookingUrl: 'https://booking.com/danang-miquang' },
      { id: '6', name: 'Cơm Lốc Hoàng Kim', city: 'Đà Nẵng', cuisine: 'Việt Nam', price: '$', rating: 4.2, address: 'Nguyễn Huệ', bookingUrl: 'https://booking.com/danang-comloc' },
    ],
    'quốc tế': [
      { id: '7', name: 'Italian Casa', city: 'Đà Nẵng', cuisine: 'Quốc Tế', price: '$$$', rating: 4.7, address: 'Mỹ Khê', bookingUrl: 'https://booking.com/danang-italian' },
      { id: '8', name: 'Chez Tran', city: 'Đà Nẵng', cuisine: 'Pháp', price: '$$$', rating: 4.6, address: 'Hoàng Diệu', bookingUrl: 'https://booking.com/danang-cheztran' },
    ],
  },
  'đà lạt': {
    'hải sản': [
      { id: '9', name: 'Hải Sản Bình Tân', city: 'Đà Lạt', cuisine: 'Hải Sản', price: '$$', rating: 4.4, address: 'Pasteur', bookingUrl: 'https://booking.com/dalat-seafood' },
    ],
    'việt nam': [
      { id: '10', name: 'Cơm Lốc Đà Lạt', city: 'Đà Lạt', cuisine: 'Việt Nam', price: '$', rating: 4.7, address: 'Quang Trung', bookingUrl: 'https://booking.com/dalat-comloc' },
      { id: '11', name: 'Thịt Nướng Ngoại Ô', city: 'Đà Lạt', cuisine: 'Việt Nam', price: '$', rating: 4.5, address: 'Hùng Vương', bookingUrl: 'https://booking.com/dalat-thit' },
    ],
    'quốc tế': [
      { id: '12', name: 'Café Tháp', city: 'Đà Lạt', cuisine: 'Cà Phê', price: '$', rating: 4.8, address: 'Trần Phú', bookingUrl: 'https://booking.com/dalat-cafe' },
    ],
  },
  'phú quốc': {
    'hải sản': [
      { id: '13', name: 'Nhà Hàng Bắp Nướng', city: 'Phú Quốc', cuisine: 'Hải Sản', price: '$$', rating: 4.6, address: 'Bãi Sao', bookingUrl: 'https://booking.com/phuquoc-seafood' },
      { id: '14', name: 'Mực Nướng Tươi', city: 'Phú Quốc', cuisine: 'Hải Sản', price: '$$', rating: 4.5, address: 'Ông Lang', bookingUrl: 'https://booking.com/phuquoc-squid' },
    ],
    'việt nam': [
      { id: '15', name: 'Bánh Hoai Phú Quốc', city: 'Phú Quốc', cuisine: 'Việt Nam', price: '$', rating: 4.7, address: 'Dinh Cau', bookingUrl: 'https://booking.com/phuquoc-banhhoai' },
    ],
    'quốc tế': [
      { id: '16', name: 'Beach Bar & Grill', city: 'Phú Quốc', cuisine: 'Quốc Tế', price: '$$$', rating: 4.8, address: 'Ông Lang Beach', bookingUrl: 'https://booking.com/phuquoc-beach' },
    ],
  },
};

/**
 * Detect restaurant recommendation request
 */
export const detectRestaurantRequest = (message: string): boolean => {
  const lowerMsg = message.toLowerCase();
  const restaurantKeywords = ['nhà hàng', 'quán ăn', 'restaurant', 'ăn gì', 'ăn uống', 'quán', 'ẩm thực'];
  return restaurantKeywords.some(kw => lowerMsg.includes(kw));
};

/**
 * Extract city and cuisine type
 */
export const extractRestaurantDetails = (message: string): {
  city?: string;
  cuisineType?: string;
} => {
  const result: { city?: string; cuisineType?: string } = {};
  
  const cities = ['đà nẵng', 'đà lạt', 'phú quốc', 'hà nội', 'hồ chí minh', 'huế'];
  const cuisines = ['hải sản', 'việt nam', 'quốc tế', 'pháp', 'ý', 'thái', 'trung', 'nhật'];
  
  const lowerMsg = message.toLowerCase();
  
  const foundCity = cities.find(city => lowerMsg.includes(city));
  if (foundCity) {
    result.city = foundCity;
  }

  const foundCuisine = cuisines.find(cuisine => lowerMsg.includes(cuisine));
  if (foundCuisine) {
    result.cuisineType = foundCuisine;
  }

  return result;
};

/**
 * Get restaurant recommendations
 */
export const getRestaurantRecommendations = (city: string, cuisineType: string = 'việt nam'): RestaurantRecommendation => {
  debug.log('RESTAURANT', `Getting recommendations for ${city}, cuisine: ${cuisineType}`);

  const cityKey = city.toLowerCase();
  const cuisineKey = cuisineType.toLowerCase();
  
  const cityRestaurants = restaurantDatabase[cityKey] || restaurantDatabase['đà nẵng'];
  const restaurants = cityRestaurants[cuisineKey] || Object.values(cityRestaurants)[0];

  return {
    city,
    cuisineType,
    restaurants,
  };
};

/**
 * Format restaurant recommendations for display
 */
export const formatRestaurantRecommendations = (rec: RestaurantRecommendation): string => {
  debug.log('RESTAURANT', 'Formatting recommendations', rec);

  let output = `## 🍽️ Gợi Ý Nhà Hàng\n\n`;
  output += `**Thành phố:** ${rec.city} | **Loại ẩm thực:** ${rec.cuisineType}\n\n`;
  output += `---\n\n`;

  for (let i = 0; i < rec.restaurants.length; i++) {
    const r = rec.restaurants[i];
    output += `### ${i + 1}. ${r.name}\n\n`;
    output += `**⭐ Rating:** ${r.rating}/5\n`;
    output += `**💰 Giá:** ${r.price}\n`;
    output += `**📍 Địa chỉ:** ${r.address}\n`;
    output += `**🍴 Loại:** ${r.cuisine}\n`;
    output += `**🔗 Đặt bàn:** [Booking](${r.bookingUrl})\n\n`;
  }

  output += `---\n\n`;
  output += `💡 **Mẹo:** Hãy gọi trước để đặt bàn trong giờ cao điểm!\n`;

  return output;
};
