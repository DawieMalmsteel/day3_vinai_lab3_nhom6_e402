import { debug } from '../utils/debug';
import { getCurrentDateFormatted, convertToGoogleFlightsFormat } from '../utils/dateUtils';
import { getFlightPrices, generateGoogleFlightsLink, generateAirlineBookingLinks } from './googleFlightsService';
import type { PriceComparisonResult, FlightPrice } from '../types';

/**
 * Mock flight pricing data
 */
const flightDatabase: Record<string, FlightPrice[]> = {
  'tp.hcm-hanoi': [
    { airline: 'Vietnam Airlines', price: 850000, departureTime: '06:00', arrivalTime: '07:45', duration: '1h 45m', rating: 4.8 },
    { airline: 'Vietjet', price: 450000, departureTime: '08:30', arrivalTime: '10:15', duration: '1h 45m', rating: 4.2 },
    { airline: 'Bamboo Airways', price: 650000, departureTime: '14:00', arrivalTime: '15:45', duration: '1h 45m', rating: 4.7 },
    { airline: 'AirAsia', price: 380000, departureTime: '22:00', arrivalTime: '23:45', duration: '1h 45m', rating: 3.9 },
  ],
  'tp.hcm-danang': [
    { airline: 'Vietnam Airlines', price: 750000, departureTime: '07:00', arrivalTime: '08:30', duration: '1h 30m', rating: 4.8 },
    { airline: 'Vietjet', price: 380000, departureTime: '09:45', arrivalTime: '11:15', duration: '1h 30m', rating: 4.2 },
    { airline: 'Bamboo Airways', price: 550000, departureTime: '15:30', arrivalTime: '17:00', duration: '1h 30m', rating: 4.7 },
    { airline: 'AirAsia', price: 320000, departureTime: '23:00', arrivalTime: '00:30+1', duration: '1h 30m', rating: 3.9 },
  ],
  'hanoi-danang': [
    { airline: 'Vietnam Airlines', price: 650000, departureTime: '06:30', arrivalTime: '08:00', duration: '1h 30m', rating: 4.8 },
    { airline: 'Vietjet', price: 300000, departureTime: '10:00', arrivalTime: '11:30', duration: '1h 30m', rating: 4.2 },
    { airline: 'Bamboo Airways', price: 480000, departureTime: '13:15', arrivalTime: '14:45', duration: '1h 30m', rating: 4.7 },
  ],
};

/**
 * Detect price comparison request
 */
export const detectPriceComparisonRequest = (message: string): boolean => {
  const lowerMsg = message.toLowerCase();
  // Check for explicit price comparison keywords OR flight-related keywords with "từ...đến"
  const priceKeywords = ['so sánh giá', 'giá rẻ nhất', 'vé rẻ', 'hãng nào rẻ', 'hãng nào tốt', 'so sanh'];
  const flightKeywords = ['chuyến bay', 'máy bay', 'flight', 'vé máy bay', 'vé chuyến bay', 'hãng hàng không'];
  
  const hasPrice = priceKeywords.some(kw => lowerMsg.includes(kw));
  const hasFlightKeyword = flightKeywords.some(kw => lowerMsg.includes(kw));
  
  // If it mentions flights explicitly, and has "từ...đến" pattern, it's a price comparison
  if (hasFlightKeyword && (lowerMsg.includes('từ') || lowerMsg.includes('đến'))) {
    return true;
  }
  
  return hasPrice;
};

/**
 * Extract route and date from message
 */
export const extractPriceComparisonDetails = (message: string): {
  origin?: string;
  destination?: string;
  date?: string;
} => {
  const result: { origin?: string; destination?: string; date?: string } = {};
  
  // City name mappings to normalize
  const cityMappings: Record<string, string> = {
    'tp.hcm': 'tp.hcm',
    'tpbcm': 'tp.hcm',
    'sai gon': 'tp.hcm',
    'saigon': 'tp.hcm',
    'hồ chí minh': 'tp.hcm',
    'ho chi minh': 'tp.hcm',
    'hà nội': 'hà nội',
    'ha noi': 'hà nội',
    'hanoi': 'hà nội',
    'đà nẵng': 'đà nẵng',
    'da nang': 'đà nẵng',
    'danang': 'đà nẵng',
    'đà lạt': 'đà lạt',
    'da lat': 'đà lạt',
    'dalat': 'đà lạt',
    'phú quốc': 'phú quốc',
    'phu quoc': 'phú quốc',
    'huế': 'huế',
    'hue': 'huế',
    'nha trang': 'nha trang',
  };
  
  const lowerMsg = message.toLowerCase();
  
  // First try to match "từ ... đến" pattern (match until end)
  const fromToPattern = /từ\s+(.+?)\s+đến\s+(.+?)$/i;
  const fromToMatch = message.match(fromToPattern);
  
  if (fromToMatch) {
    const originStr = fromToMatch[1].trim().toLowerCase();
    const destStr = fromToMatch[2].trim().toLowerCase();
    
    // Match cities (try longer matches first to handle multi-word cities)
    const sortedKeys = Object.keys(cityMappings).sort((a, b) => b.length - a.length);
    
    for (const key of sortedKeys) {
      if (!result.origin && originStr.includes(key)) {
        result.origin = cityMappings[key];
      }
      if (!result.destination && destStr.includes(key)) {
        result.destination = cityMappings[key];
      }
    }
  }
  
  // If "từ...đến" didn't work, find all cities in order of appearance
  if (!result.origin || !result.destination) {
    const foundCities: Array<{ city: string; index: number }> = [];
    const sortedKeys = Object.keys(cityMappings).sort((a, b) => b.length - a.length);
    
    // Find each city and its position in the message
    for (const key of sortedKeys) {
      const index = lowerMsg.indexOf(key);
      if (index !== -1) {
        const normalized = cityMappings[key];
        // Only add if we haven't found this city already
        const exists = foundCities.find(c => c.city === normalized);
        if (!exists) {
          foundCities.push({ city: normalized, index });
        }
      }
    }
    
    // Sort by position in message
    foundCities.sort((a, b) => a.index - b.index);
    
    if (foundCities.length >= 2) {
      result.origin = result.origin || foundCities[0].city;
      result.destination = result.destination || foundCities[1].city;
    }
  }

  // Extract date
  const datePattern = /(\d{1,2}[\/\-]\d{1,2})|(\d{4}-\d{2}-\d{2})/;
  const dateMatch = message.match(datePattern);
  if (dateMatch) {
    result.date = dateMatch[0];
  }

  return result;
};

/**
 * Compare flight prices using Google Flights scraper
 */
export const comparePrices = async (origin: string, destination: string, date?: string): Promise<PriceComparisonResult> => {
  // Convert date to YYYY-MM-DD format for Google Flights API
  const finalDate = convertToGoogleFlightsFormat(date);
  debug.log('PRICE_COMPARISON', `Comparing prices for ${origin} → ${destination}`, finalDate);

  try {
    // Try to get real prices from Google Flights
    const flights = await getFlightPrices(origin, destination, finalDate);

    // Find cheapest and best value
    const sortedByPrice = [...flights].sort((a, b) => a.price - b.price);
    const cheapest = sortedByPrice[0];
    
    const sortedByValue = [...flights].sort((a, b) => (b.rating / b.price) - (a.rating / a.price));
    const bestValue = sortedByValue[0];

    return {
      route: `${origin} → ${destination}`,
      date: finalDate,
      flights,
      cheapest,
      bestValue,
    };
  } catch (error) {
    debug.error('PRICE_COMPARISON', 'Error comparing prices', error);
    
    // Fallback to mock data
    const routeKey = `${origin}-${destination}`.toLowerCase();
    const fallbackFlights = flightDatabase[routeKey] || [
      { airline: 'Vietnam Airlines', price: 850000, departureTime: '07:00', arrivalTime: '09:00', duration: '2h', rating: 4.8 },
      { airline: 'Vietjet', price: 480000, departureTime: '10:00', arrivalTime: '12:00', duration: '2h', rating: 4.2 },
      { airline: 'Bamboo Airways', price: 680000, departureTime: '14:00', arrivalTime: '16:00', duration: '2h', rating: 4.7 },
    ];

    const sortedByPrice = [...fallbackFlights].sort((a, b) => a.price - b.price);
    const cheapest = sortedByPrice[0];
    
    const sortedByValue = [...fallbackFlights].sort((a, b) => (b.rating / b.price) - (a.rating / a.price));
    const bestValue = sortedByValue[0];

    return {
      route: `${origin} → ${destination}`,
      date: finalDate,
      flights: fallbackFlights,
      cheapest,
      bestValue,
    };
  }
};

/**
 * Format price comparison for display
 */
export const formatPriceComparison = (result: PriceComparisonResult, origin?: string, destination?: string): string => {
  debug.log('PRICE_COMPARISON', 'Formatting comparison result', result);

  let output = `## 💰 So Sánh Giá Vé Máy Bay\n\n`;
  output += `**Tuyến:** ${result.route} | **Ngày:** ${result.date}\n\n`;
  output += `---\n\n`;

  output += `### 🏆 Top Hãng Hàng Không\n\n`;
  output += `| Hãng | Giá | Cất Cánh | Hạ Cánh | Thời Gian | Rating |\n`;
  output += `|------|-----|---------|---------|----------|--------|\n`;

  for (const flight of result.flights) {
    const priceStr = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(flight.price);
    output += `| ${flight.airline} | ${priceStr} | ${flight.departureTime} | ${flight.arrivalTime} | ${flight.duration} | ⭐ ${flight.rating} |\n`;
  }

  output += `\n---\n\n`;

  output += `### 💎 Khuyến Nghị\n\n`;
  
  const cheapestPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(result.cheapest.price);
  output += `**🎯 Rẻ Nhất:** ${result.cheapest.airline} - ${cheapestPrice}\n`;
  output += `- Cất cánh: ${result.cheapest.departureTime}, Hạ cánh: ${result.cheapest.arrivalTime}\n`;
  output += `- Rating: ⭐ ${result.cheapest.rating}/5\n`;
  if (origin && destination) {
    const bookingLink = generateAirlineBookingLinks(result.cheapest.airline, origin, destination);
    output += `- [Đặt vé](${bookingLink})\n\n`;
  } else {
    output += `\n`;
  }

  const bestValuePrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(result.bestValue.price);
  output += `**✨ Tốt Nhất:** ${result.bestValue.airline} - ${bestValuePrice}\n`;
  output += `- Cất cánh: ${result.bestValue.departureTime}, Hạ cánh: ${result.bestValue.arrivalTime}\n`;
  output += `- Rating: ⭐ ${result.bestValue.rating}/5 (giá tốt + chất lượng)\n`;
  if (origin && destination) {
    const bookingLink = generateAirlineBookingLinks(result.bestValue.airline, origin, destination);
    output += `- [Đặt vé](${bookingLink})\n\n`;
  } else {
    output += `\n`;
  }

  output += `---\n\n`;
  if (origin && destination) {
    const googleFlightsLink = generateGoogleFlightsLink(origin, destination, result.date);
    output += `🔗 [Xem trên Google Flights](${googleFlightsLink})\n\n`;
  }
  output += `💡 **Mẹo:** Đặt vé vào thứ Tư hoặc thứ Năm để có giá tốt nhất!\n`;

  return output;
};
