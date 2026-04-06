import { debug } from '../utils/debug';
import type { LocalTransportGuide, TransportOption } from '../types';

/**
 * Mock transport data for common routes
 */
const transportDatabase: Record<string, TransportOption[]> = {
  'mỹ khê-hội an': [
    { type: 'taxi', estimatedPrice: 150000, estimatedTime: 45, description: 'Taxi từ bãi biển Mỹ Khê đến phố cổ Hội An. Tài xế sẽ mất khoảng 45 phút.' },
    { type: 'grab', estimatedPrice: 120000, estimatedTime: 50, description: 'Grab (Uber) rẻ hơn taxi. Thời gian tương tự nhưng có thể chậm hơn nếu kẹt xe.' },
    { type: 'bus', estimatedPrice: 20000, estimatedTime: 90, description: 'Xe buýt công cộng là lựa chọn rẻ nhất. Mất khoảng 1h 30m nhưng yên tĩnh.' },
    { type: 'motorbike', estimatedPrice: 50000, estimatedTime: 40, description: 'Thuê xe máy: 50k/ngày. Lái tự do nhưng cần bằng quốc tế.' },
  ],
  'sân bay-trung tâm': [
    { type: 'taxi', estimatedPrice: 200000, estimatedTime: 30, description: 'Taxi từ sân bay vào trung tâm thành phố. Giá cố định 200k.' },
    { type: 'grab', estimatedPrice: 180000, estimatedTime: 35, description: 'Grab từ sân bay vào thành phố. Rẻ hơn taxi thường.' },
    { type: 'bus', estimatedPrice: 30000, estimatedTime: 60, description: 'Xe buýt sân bay: số 17. Mất 1 tiếng nhưng rẻ.' },
    { type: 'bicycle', estimatedPrice: 50000, estimatedTime: 120, description: 'Thuê xe đạp: 50k/ngày. Chỉ phù hợp nếu không quá gần.' },
  ],
  'hồ hoàn kiếm-old quarter': [
    { type: 'taxi', estimatedPrice: 30000, estimatedTime: 10, description: 'Taxi rất gần. Khoảng 10 phút.' },
    { type: 'grab', estimatedPrice: 25000, estimatedTime: 12, description: 'Grab rẻ và nhanh chóng.' },
    { type: 'bus', estimatedPrice: 5000, estimatedTime: 20, description: 'Xe buýt công cộng. Giá rẻ nhất.' },
    { type: 'bicycle', estimatedPrice: 0, estimatedTime: 15, description: 'Đi bộ hoặc thuê xe đạp. Cách gần và vui hơn.' },
  ],
  'đà lạt-thác cam ly': [
    { type: 'taxi', estimatedPrice: 80000, estimatedTime: 20, description: 'Taxi từ trung tâm thành phố đến thác Cam Ly.' },
    { type: 'grab', estimatedPrice: 60000, estimatedTime: 25, description: 'Grab rẻ hơn và dễ dàng.' },
    { type: 'bus', estimatedPrice: 15000, estimatedTime: 40, description: 'Xe buýt công cộng. Tuyến 2 đi đến thác.' },
    { type: 'motorbike', estimatedPrice: 40000, estimatedTime: 15, description: 'Thuê xe máy lái tự do.' },
  ],
};

/**
 * Detect local transport request
 */
export const detectLocalTransportRequest = (message: string): boolean => {
  const lowerMsg = message.toLowerCase();
  const transportKeywords = ['di chuyển', 'từ', 'đến', 'mất bao lâu', 'taxi', 'grab', 'xe buýt', 'transport', 'bao xa', 'giao thông'];
  return transportKeywords.some(kw => lowerMsg.includes(kw));
};

/**
 * Extract origin and destination
 */
export const extractTransportDetails = (message: string): {
  origin?: string;
  destination?: string;
} => {
  const result: { origin?: string; destination?: string } = {};

  // Simple parsing for "từ X đến Y" pattern
  const pattern = /từ\s+(.+?)\s+đến\s+(.+?)(?:\s|$)/i;
  const match = message.match(pattern);
  
  if (match) {
    result.origin = match[1].trim();
    result.destination = match[2].trim();
  } else {
    // Try alternative format
    const locations = ['mỹ khê', 'hội an', 'sân bay', 'trung tâm', 'hồ hoàn kiếm', 'old quarter', 'thác cam ly', 'đà lạt'];
    const lowerMsg = message.toLowerCase();
    const foundLocations = locations.filter(loc => lowerMsg.includes(loc));
    
    if (foundLocations.length >= 2) {
      result.origin = foundLocations[0];
      result.destination = foundLocations[1];
    } else if (foundLocations.length === 1) {
      result.destination = foundLocations[0];
    }
  }

  return result;
};

/**
 * Get transport options
 */
export const getTransportGuide = (origin: string, destination: string): LocalTransportGuide => {
  debug.log('LOCAL_TRANSPORT', `Getting transport for ${origin} → ${destination}`);

  const routeKey = `${origin}-${destination}`.toLowerCase();
  const options = transportDatabase[routeKey] || [
    { type: 'taxi', estimatedPrice: 100000, estimatedTime: 30, description: 'Taxi từ điểm A đến điểm B. Hãy thương lượng giá trước khi lên xe.' },
    { type: 'grab', estimatedPrice: 80000, estimatedTime: 35, description: 'Grab an toàn và giá cố định.' },
    { type: 'bus', estimatedPrice: 20000, estimatedTime: 60, description: 'Xe buýt công cộng rẻ nhất.' },
  ];

  return {
    origin,
    destination,
    distanceKm: Math.random() * 20 + 5,
    options,
  };
};

/**
 * Format transport guide for display
 */
export const formatTransportGuide = (guide: LocalTransportGuide): string => {
  debug.log('LOCAL_TRANSPORT', 'Formatting transport guide', guide);

  let output = `## 🚕 Hướng Dẫn Di Chuyển Cục Bộ\n\n`;
  output += `**Từ:** ${guide.origin} | **Đến:** ${guide.destination}\n`;
  output += `**Khoảng cách:** ~${guide.distanceKm.toFixed(1)} km\n\n`;
  output += `---\n\n`;

  output += `### 🚗 Các Phương Tiện\n\n`;

  for (const option of guide.options) {
    const icon = getTransportIcon(option.type);
    const priceStr = option.estimatedPrice > 0 
      ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(option.estimatedPrice)
      : 'Miễn phí';
    
    output += `#### ${icon} ${getTransportName(option.type)}\n\n`;
    output += `**💰 Giá:** ${priceStr}\n`;
    output += `**⏱️ Thời gian:** ${option.estimatedTime} phút\n`;
    output += `**📝 Mô tả:** ${option.description}\n\n`;
  }

  output += `---\n\n`;
  output += `### 💡 Mẹo\n\n`;
  output += `- **Grab/Uber:** Tải ứng dụng và đặt trước để được giá tốt\n`;
  output += `- **Taxi:** Luôn thương lượng giá với tài xế trước khi lên\n`;
  output += `- **Xe buýt:** Hỏi người địa phương hoặc nhân viên khách sạn để biết tuyến đúng\n`;
  output += `- **Xe máy:** Cần bằng quốc tế. Kiểm tra bảo hiểm trước khi thuê\n`;

  return output;
};

/**
 * Helper: Get transport emoji
 */
const getTransportIcon = (type: string): string => {
  const icons: Record<string, string> = {
    taxi: '🚕',
    grab: '🚗',
    bus: '🚌',
    motorbike: '🏍️',
    bicycle: '🚲',
  };
  return icons[type] || '🚗';
};

/**
 * Helper: Get transport name in Vietnamese
 */
const getTransportName = (type: string): string => {
  const names: Record<string, string> = {
    taxi: 'Taxi',
    grab: 'Grab / Uber',
    bus: 'Xe Buýt Công Cộng',
    motorbike: 'Xe Máy Thuê',
    bicycle: 'Xe Đạp Thuê',
  };
  return names[type] || 'Chưa xác định';
};
