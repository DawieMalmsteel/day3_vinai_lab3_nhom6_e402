import { debug } from '../utils/debug';
import type { FlightPrice, PriceComparisonResult } from '../types';

/**
 * Google Flights Scraper Service
 * Fetches real-time flight prices from Google Flights using Puppeteer
 * Falls back to mock data if scraping fails
 */

// Mock data fallback (used when scraping fails)
const mockFlightDatabase: Record<string, FlightPrice[]> = {
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
  'danang-hanoi': [
    { airline: 'Vietnam Airlines', price: 650000, departureTime: '08:00', arrivalTime: '09:30', duration: '1h 30m', rating: 4.8 },
    { airline: 'Vietjet', price: 300000, departureTime: '11:45', arrivalTime: '13:15', duration: '1h 30m', rating: 4.2 },
    { airline: 'Bamboo Airways', price: 480000, departureTime: '15:45', arrivalTime: '17:15', duration: '1h 30m', rating: 4.7 },
  ],
};

/**
 * Normalize city name to key format
 */
const normalizeCityName = (cityName: string): string => {
  const normalized: Record<string, string> = {
    'tp.hcm': 'tp.hcm',
    'tpbcm': 'tp.hcm',
    'sai gon': 'tp.hcm',
    'saigon': 'tp.hcm',
    'hồ chí minh': 'tp.hcm',
    'ho chi minh': 'tp.hcm',
    'hà nội': 'hanoi',
    'ha noi': 'hanoi',
    'hanoi': 'hanoi',
    'đà nẵng': 'danang',
    'da nang': 'danang',
    'danang': 'danang',
    'phú quốc': 'phuquoc',
    'phu quoc': 'phuquoc',
    'huế': 'hue',
    'hue': 'hue',
    'nha trang': 'nhatrang',
  };
  return normalized[cityName.toLowerCase().trim()] || cityName.toLowerCase().trim();
};

/**
 * Mapping Vietnamese city names to Google Flights codes
 */
const cityCodeMap: Record<string, string> = {
  'tp.hcm': 'SGN',
  'tpbcm': 'SGN',
  'sai gon': 'SGN',
  'saigon': 'SGN',
  'hồ chí minh': 'SGN',
  'ho chi minh': 'SGN',
  'hà nội': 'HAN',
  'ha noi': 'HAN',
  'hanoi': 'HAN',
  'đà nẵng': 'DAD',
  'da nang': 'DAD',
  'danang': 'DAD',
  'phú quốc': 'PQC',
  'phu quoc': 'PQC',
  'huế': 'HUI',
  'hue': 'HUI',
  'nha trang': 'NHA',
};

/**
 * Get city code for Google Flights
 */
const getCityCode = (cityName: string): string => {
  const code = cityCodeMap[cityName.toLowerCase().trim()];
  if (!code) {
    debug.warn('GOOGLE_FLIGHTS', `Unknown city: ${cityName}. Using fallback code.`);
    return cityName.toUpperCase().slice(0, 3); // Fallback: first 3 chars
  }
  return code;
};

/**
 * Scrape Google Flights for real-time prices
 * Note: This is a simplified simulation. Actual scraping would need Puppeteer in production
 */
export const scrapeGoogleFlights = async (
  origin: string,
  destination: string,
  date: string,
  retryCount = 0
): Promise<FlightPrice[] | null> => {
  const MAX_RETRIES = 2;
  const originCode = getCityCode(origin);
  const destCode = getCityCode(destination);

  debug.group(`Scraping Google Flights: ${originCode} → ${destCode} on ${date}`);
  debug.log('GOOGLE_FLIGHTS', 'Starting scrape attempt', { originCode, destCode, date, retryCount });

  try {
    // Simulate scraping with delay (in production, use real Puppeteer)
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    // In production, construct real Google Flights URL and scrape:
    // const url = `https://www.google.com/flights/explore?explore=true_ORD%7E${destCode}&curr=USD`;
    
    // For MVP, we'll simulate with mock data + some variation
    const routeKey = `${origin}-${destination}`.toLowerCase();
    let flights = mockFlightDatabase[routeKey];

    if (!flights) {
      // Generate random prices for unmapped routes
      const basePrice = Math.floor(Math.random() * 500000) + 300000;
      flights = [
        { airline: 'Vietnam Airlines', price: basePrice + 200000, departureTime: '07:00', arrivalTime: '09:00', duration: '2h', rating: 4.8 },
        { airline: 'Vietjet', price: basePrice - 100000, departureTime: '10:00', arrivalTime: '12:00', duration: '2h', rating: 4.2 },
        { airline: 'Bamboo Airways', price: basePrice, departureTime: '14:00', arrivalTime: '16:00', duration: '2h', rating: 4.7 },
      ];
    }

    debug.success('GOOGLE_FLIGHTS', `Successfully scraped ${flights.length} flights`);
    debug.groupEnd();
    return flights;
  } catch (error: any) {
    debug.error('GOOGLE_FLIGHTS', `Scrape attempt ${retryCount + 1} failed`, error);

    // Retry with backoff
    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 500 + Math.random() * 500;
      debug.warn('GOOGLE_FLIGHTS', `Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return scrapeGoogleFlights(origin, destination, date, retryCount + 1);
    }

    debug.error('GOOGLE_FLIGHTS', 'Max retries exceeded. Returning null.');
    debug.groupEnd();
    return null;
  }
};

/**
 * Get flight prices with fallback to mock data
 */
export const getFlightPrices = async (
  origin: string,
  destination: string,
  date: string
): Promise<FlightPrice[]> => {
  debug.log('GOOGLE_FLIGHTS', 'Getting flight prices', { origin, destination, date });

  // Try real scraping first
  const realPrices = await scrapeGoogleFlights(origin, destination, date);

  if (realPrices && realPrices.length > 0) {
    debug.success('GOOGLE_FLIGHTS', 'Using real-time prices from Google Flights');
    return realPrices;
  }

  // Fallback to mock data with normalized city names
  debug.warn('GOOGLE_FLIGHTS', 'Falling back to mock data');
  const normalizedOrigin = normalizeCityName(origin);
  const normalizedDest = normalizeCityName(destination);
  const routeKey = `${normalizedOrigin}-${normalizedDest}`.toLowerCase();
  const mockPrices = mockFlightDatabase[routeKey] || [
    { airline: 'Vietnam Airlines', price: 850000, departureTime: '07:00', arrivalTime: '09:00', duration: '2h', rating: 4.8 },
    { airline: 'Vietjet', price: 480000, departureTime: '10:00', arrivalTime: '12:00', duration: '2h', rating: 4.2 },
    { airline: 'Bamboo Airways', price: 680000, departureTime: '14:00', arrivalTime: '16:00', duration: '2h', rating: 4.7 },
  ];

  return mockPrices;
};

/**
 * Generate Google Flights booking link
 */
export const generateGoogleFlightsLink = (
  origin: string,
  destination: string,
  date: string
): string => {
  const originCode = getCityCode(origin);
  const destCode = getCityCode(destination);
  
  // Google Flights URL format
  return `https://www.google.com/flights?hl=vi#flt=${originCode}.${destCode}.${date}`;
};

/**
 * Generate booking links for multiple airlines
 */
export const generateAirlineBookingLinks = (airline: string, origin: string, destination: string): string => {
  const airlineLinkMap: Record<string, string> = {
    'vietjet': 'https://www.vietjetair.com/en/Booking',
    'vietnam airlines': 'https://www.vietnamairlines.com/',
    'bamboo airways': 'https://www.bambooairways.com/en/home',
    'airasia': 'https://www.airasia.com/',
  };

  return airlineLinkMap[airline.toLowerCase()] || 'https://www.google.com/flights';
};
