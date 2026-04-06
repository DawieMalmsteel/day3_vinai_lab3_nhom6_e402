import express from 'express';
import cors from 'cors';
import { scrapeGoogleFlights, closeBrowser } from './scrapers/googleFlightsScraper';
import type { FlightPrice } from './scrapers/googleFlightsScraper';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes with proper configuration
app.use(cors({
  origin: true, // Allow requests from any origin
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

/**
 * City code mapping for Google Flights
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
  'đà lạt': 'DLI',
  'da lat': 'DLI',
  'dalat': 'DLI',
  'phú quốc': 'PQC',
  'phu quoc': 'PQC',
  'huế': 'HUI',
  'hue': 'HUI',
  'nha trang': 'NHA',
};

/**
 * Get city code for Google Flights
 */
function getCityCode(cityName: string): string {
  const code = cityCodeMap[cityName.toLowerCase().trim()];
  if (!code) {
    console.warn(`[API] Unknown city: ${cityName}. Using fallback code.`);
    return cityName.toUpperCase().slice(0, 3);
  }
  return code;
}

/**
 * Base prices for different routes (in VND)
 * These are realistic Vietnamese domestic flight prices
 */
const basePriceMap: Record<string, number> = {
  'sgn-han': 850000,
  'han-sgn': 850000,
  'sgn-dad': 750000,
  'dad-sgn': 750000,
  'han-dad': 650000,
  'dad-han': 650000,
  'sgn-dli': 650000,
  'dli-sgn': 650000,
  'han-dli': 450000,
  'dli-han': 450000,
  'dad-dli': 520000,
  'dli-dad': 520000,
  'sgn-pqc': 750000,
  'pqc-sgn': 750000,
};

/**
 * Generate realistic flight data based on date and route
 * Prices vary by day of week, time of day, etc.
 */
function generateRealisticFlights(origin: string, destination: string, date: string): FlightPrice[] {
  const routeKey = `${origin.toLowerCase()}-${destination.toLowerCase()}`;
  const basePrice = basePriceMap[routeKey] || 600000;

  // Parse date to check day of week (weekend = higher prices)
  const dateObj = new Date(date + 'T00:00:00Z');
  const dayOfWeek = dateObj.getDay(); // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isPeakDay = dayOfWeek === 5 || dayOfWeek === 6; // Friday/Saturday

  // Price multiplier based on day
  const dayMultiplier = isPeakDay ? 1.3 : isWeekend ? 1.15 : 1.0;

  // Airlines with different price strategies
  const airlines = [
    {
      name: 'Vietnam Airlines',
      priceMultiplier: 1.0,
      quality: 4.8,
      times: [
        { departure: '06:00', arrival: '07:45', duration: '1h 45m' },
        { departure: '14:30', arrival: '16:15', duration: '1h 45m' },
      ],
    },
    {
      name: 'Vietjet',
      priceMultiplier: 0.55,
      quality: 4.2,
      times: [
        { departure: '08:30', arrival: '10:15', duration: '1h 45m' },
        { departure: '19:00', arrival: '20:45', duration: '1h 45m' },
      ],
    },
    {
      name: 'Bamboo Airways',
      priceMultiplier: 0.8,
      quality: 4.7,
      times: [
        { departure: '11:00', arrival: '12:45', duration: '1h 45m' },
        { departure: '16:30', arrival: '18:15', duration: '1h 45m' },
      ],
    },
    {
      name: 'AirAsia',
      priceMultiplier: 0.45,
      quality: 3.9,
      times: [
        { departure: '22:30', arrival: '00:15+1', duration: '1h 45m' },
      ],
    },
  ];

  // Generate flights with some variation
  const flights: FlightPrice[] = [];
  for (const airline of airlines) {
    const timeOption = airline.times[Math.floor(Math.random() * airline.times.length)];
    const finalPrice = Math.round(basePrice * airline.priceMultiplier * dayMultiplier);
    
    // Add some random variation (±5%)
    const variance = finalPrice * 0.05 * (Math.random() - 0.5);
    const price = Math.round(finalPrice + variance);

    flights.push({
      airline: airline.name,
      price: Math.max(price, 200000), // Minimum realistic price
      departureTime: timeOption.departure,
      arrivalTime: timeOption.arrival,
      duration: timeOption.duration,
      rating: airline.quality,
    });
  }

  // Sort by price
  flights.sort((a, b) => a.price - b.price);
  return flights;
}

/**
 * API endpoint: GET /api/flights/search
 * Query params: origin, destination, date
 * Returns: Array of FlightPrice objects
 */
app.get('/api/flights/search', async (req, res) => {
  try {
    const { origin, destination, date } = req.query;

    if (!origin || !destination || !date) {
      return res.status(400).json({
        error: 'Missing required parameters: origin, destination, date',
      });
    }

    const originStr = String(origin).toLowerCase();
    const destStr = String(destination).toLowerCase();
    const dateStr = String(date);

    console.log(`[API] Flight search request: ${originStr} → ${destStr} on ${dateStr}`);

    const originCode = getCityCode(originStr);
    const destCode = getCityCode(destStr);

    // Try to scrape real flights from Google Flights
    console.log(`[API] Attempting to scrape: ${originCode} → ${destCode}`);
    const flights = await scrapeGoogleFlights(originCode, destCode, dateStr);

    if (flights && flights.length > 0) {
      console.log(`[API] Successfully scraped ${flights.length} flights`);
      return res.json({
        success: true,
        source: 'google_flights',
        flights,
      });
    }

    // Fallback to intelligent mock data generator
    console.log('[API] Scraping failed, generating intelligent mock data');
    const mockFlights = generateRealisticFlights(originCode, destCode, dateStr);

    return res.json({
      success: true,
      source: 'mock_data',
      flights: mockFlights,
    });
  } catch (error: any) {
    console.error('[API] Error during flight search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search flights',
      message: error.message,
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Start server and handle shutdown gracefully
 */
const server = app.listen(PORT, () => {
  console.log(`[SERVER] Flight API server running on http://localhost:${PORT}`);
  console.log(`[SERVER] GET /api/flights/search?origin=SGN&destination=HAN&date=2026-04-20`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[SERVER] Shutting down gracefully...');
  await closeBrowser();
  server.close(() => {
    console.log('[SERVER] Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('[SERVER] Shutting down (SIGTERM)...');
  await closeBrowser();
  server.close(() => {
    console.log('[SERVER] Server closed');
    process.exit(0);
  });
});

export default app;
