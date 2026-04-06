## Contributors

- Nguyễn Anh Quân - UI/UX and system prompt optimization
- Trần Sơn - Hotel search system prompt
- Phạm Đăng Phong - Debug logging for AI
- Anh Sơn - Gemini provider integration
- Phạm Minh Khang - Openrouter provider & Brave search integration
- Phan Dương Định - Project init, UI, Gemini integration, system prompt, web search, conversation context, content filtering

## Features

- 🤖 **AI-Powered Travel Chatbot** - Built with Gemini 2.0 Flash API
- ✈️ **Real-time Flight Prices** - Puppeteer-based scraping from Google Flights
- 🚌 **Bus & Hotel Search** - Multi-step conversational booking flows
- 📍 **Travel Guides** - Integrated guides for popular Vietnam destinations
- 🌐 **Web Search** - Access to external travel information
- 🛡️ **Content Filtering** - Smart topic validation to keep conversations focused

## Architecture

### Frontend (React + TypeScript)
```
src/
  App.tsx                    # Main chat UI component
  services/
    gemini.ts               # Gemini API integration & chat logic
    googleFlightsService.ts # Flight search with backend API calls
    bookingService.ts       # Booking flow logic
    hotelService.ts         # Hotel search service
    contentFilter.ts        # Topic validation
  types.ts                  # TypeScript interfaces
  utils/debug.ts            # Color-coded logging
```

### Backend (Express + Node.js)
```
server/
  server.ts                 # Express API server (port 3001)
  scrapers/
    googleFlightsScraper.ts # Puppeteer-based Google Flights scraper
```

## Run Locally

### Prerequisites
- [Node.js](https://nodejs.org/en/download) (v18+)
- Environment variable: `GEMINI_API_KEY` (get from [Google AI Studio](https://aistudio.google.com))

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
# Create .env.local and add:
GEMINI_API_KEY=your_gemini_api_key_here
VITE_API_BASE_URL=http://localhost:3001
```

### Running the Project

**Option 1: Run both frontend and backend (in separate terminals)**

```bash
# Terminal 1 - Start the backend API server (port 3001)
npm run dev:server

# Terminal 2 - Start the frontend dev server (port 3000)
npm run dev
```

Open http://localhost:3000 in your browser.

**Option 2: Frontend only (with mock data fallback)**

```bash
npm run dev
```

This will still work, but flight searches will use mock data instead of real-time Google Flights prices.

### Available Commands

```bash
npm run dev          # Start React dev server (Vite, HMR enabled)
npm run dev:server   # Start Express backend server
npm run build        # Build production bundle
npm run preview      # Preview production build
npm run lint         # TypeScript type checking
npm run clean        # Remove build artifacts
```

## API Endpoints

### GET `/api/flights/search`

Search for flights with real-time pricing.

**Query Parameters:**
- `origin` (string) - Departure city (e.g., "tp.hcm", "hanoi", "da nang")
- `destination` (string) - Arrival city
- `date` (string) - Travel date (format: YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "source": "google_flights|mock_data|fallback",
  "flights": [
    {
      "airline": "Vietnam Airlines",
      "price": 850000,
      "departureTime": "06:00",
      "arrivalTime": "07:45",
      "duration": "1h 45m",
      "rating": 4.8
    }
  ]
}
```

**Example:**
```bash
curl "http://localhost:3001/api/flights/search?origin=tp.hcm&destination=hanoi&date=2026-04-20"
```

## How It Works

### Flight Price Search Flow

1. **User asks about flight prices** (e.g., "Giá vé máy bay từ TP.HCM đến Hà Nội bao nhiêu?")
2. **Gemini analyzes intent** - `isFlightPriceQuestion()` validates if it's a flight price query
3. **City extraction** - Parse origin and destination cities from the message
4. **API call** - Frontend calls `GET /api/flights/search` endpoint
5. **Real-time scraping** - Backend uses Puppeteer to scrape Google Flights
6. **Fallback mechanism** - If scraping fails, returns mock data
7. **Display results** - Chat shows formatted flight comparison table

### Scraping Strategy

- Uses Puppeteer with headless Chrome for real-time scraping
- Implements exponential backoff retry logic for resilience
- Falls back to mock data if scraping fails
- Supports all major Vietnamese cities (TP.HCM, Hà Nội, Đà Nẵng, Đà Lạt, Phú Quốc)

## Environment Variables

```env
# Required
GEMINI_API_KEY=your_api_key_here

# Optional
VITE_API_BASE_URL=http://localhost:3001  # Backend API base URL (default: localhost:3001)
APP_URL=http://localhost:3000             # Frontend URL (for production)
```

## Troubleshooting

### Backend server won't start
```bash
# Check if port 3001 is already in use
lsof -i :3001

# Kill the process and try again
kill -9 <PID>
npm run dev:server
```

### Flight searches showing mock data instead of real prices
1. Ensure `npm run dev:server` is running
2. Check that `VITE_API_BASE_URL` points to the correct backend URL
3. Check browser console for API errors (F12 → Network tab)
4. Verify Puppeteer/Chrome can access Google Flights

### TypeScript errors
```bash
npm run lint  # Run type checker
```

## Performance Notes

- **Puppeteer scraping** takes 10-30 seconds per search (depends on network)
- **Retries** implement exponential backoff: 500ms, 1s, 2s
- **Mock data** provides instant fallback if scraping fails
- **Browser instance** is reused to improve performance

## Next Steps (Future Improvements)

- [ ] Add response caching to reduce scraping load
- [ ] Implement real database for user preferences & search history
- [ ] Add more booking integrations (Agoda, Booking.com)
- [ ] Support more currencies and languages
- [ ] Add price tracking and notifications
- [ ] Deploy to production (Cloud Run, Vercel, etc.)
