import express from 'express';
import { scrapeGoogleFlights, closeBrowser } from './scrapers/googleFlightsScraper';
import type { FlightPrice } from './scrapers/googleFlightsScraper';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

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
 * Mock flight database fallback
 */
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
  'danang-dalat': [
    { airline: 'Vietnam Airlines', price: 520000, departureTime: '07:30', arrivalTime: '08:45', duration: '1h 15m', rating: 4.8 },
    { airline: 'Vietjet', price: 280000, departureTime: '10:15', arrivalTime: '11:30', duration: '1h 15m', rating: 4.2 },
    { airline: 'Bamboo Airways', price: 420000, departureTime: '14:00', arrivalTime: '15:15', duration: '1h 15m', rating: 4.7 },
  ],
  'dalat-danang': [
    { airline: 'Vietnam Airlines', price: 520000, departureTime: '09:00', arrivalTime: '10:15', duration: '1h 15m', rating: 4.8 },
    { airline: 'Vietjet', price: 280000, departureTime: '12:30', arrivalTime: '13:45', duration: '1h 15m', rating: 4.2 },
    { airline: 'Bamboo Airways', price: 420000, departureTime: '16:00', arrivalTime: '17:15', duration: '1h 15m', rating: 4.7 },
  ],
  'tp.hcm-dalat': [
    { airline: 'Vietnam Airlines', price: 650000, departureTime: '08:00', arrivalTime: '09:30', duration: '1h 30m', rating: 4.8 },
    { airline: 'Vietjet', price: 380000, departureTime: '11:00', arrivalTime: '12:30', duration: '1h 30m', rating: 4.2 },
    { airline: 'Bamboo Airways', price: 520000, departureTime: '15:00', arrivalTime: '16:30', duration: '1h 30m', rating: 4.7 },
  ],
  'dalat-tp.hcm': [
    { airline: 'Vietnam Airlines', price: 650000, departureTime: '10:00', arrivalTime: '11:30', duration: '1h 30m', rating: 4.8 },
    { airline: 'Vietjet', price: 380000, departureTime: '13:15', arrivalTime: '14:45', duration: '1h 30m', rating: 4.2 },
    { airline: 'Bamboo Airways', price: 520000, departureTime: '17:00', arrivalTime: '18:30', duration: '1h 30m', rating: 4.7 },
  ],
};

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

    // Fallback to mock data
    console.log('[API] Scraping failed, falling back to mock data');
    const routeKey = `${originStr}-${destStr}`.toLowerCase();
    const mockFlights = mockFlightDatabase[routeKey];

    if (mockFlights && mockFlights.length > 0) {
      console.log(`[API] Returning ${mockFlights.length} mock flights`);
      return res.json({
        success: true,
        source: 'mock_data',
        flights: mockFlights,
      });
    }

    // Generate generic fallback flights
    console.log('[API] No mock data found, generating generic flights');
    const genericFlights: FlightPrice[] = [
      { airline: 'Vietnam Airlines', price: 850000, departureTime: '07:00', arrivalTime: '09:00', duration: '2h', rating: 4.8 },
      { airline: 'Vietjet', price: 480000, departureTime: '10:00', arrivalTime: '12:00', duration: '2h', rating: 4.2 },
      { airline: 'Bamboo Airways', price: 680000, departureTime: '14:00', arrivalTime: '16:00', duration: '2h', rating: 4.7 },
    ];

    res.json({
      success: true,
      source: 'fallback',
      flights: genericFlights,
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
