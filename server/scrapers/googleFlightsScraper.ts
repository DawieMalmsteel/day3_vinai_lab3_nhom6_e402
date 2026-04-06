import puppeteer, { Browser, Page } from 'puppeteer';

export interface FlightPrice {
  airline: string;
  price: number;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  rating: number;
}

interface FlightCard {
  airline?: string;
  price?: number;
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  stops?: number;
}

let browser: Browser | null = null;

/**
 * Get or launch browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (browser) {
    return browser;
  }

  console.log('[PUPPETEER] Launching browser...');
  browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  console.log('[PUPPETEER] Browser launched');
  return browser;
}

/**
 * Parse flight price from text (e.g., "C$1,234" or "$123")
 */
function parsePrice(priceText: string): number {
  const cleaned = priceText.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  
  // If price looks too small (< 100), might be in different currency
  // Default to 1000-5000 range for demo
  if (parsed < 100) {
    return Math.floor(Math.random() * 400000) + 250000; // 250k-650k VND
  }
  
  return Math.round(parsed);
}

/**
 * Parse time from text (e.g., "2:00 AM" or "14:00")
 */
function parseTime(timeText: string): string {
  return timeText.trim();
}

/**
 * Parse duration from text (e.g., "1h 45m" or "2h 30m")
 */
function parseDuration(durationText: string): string {
  return durationText.trim();
}

/**
 * Scrape flights from Google Flights
 */
export async function scrapeGoogleFlights(
  originCode: string,
  destCode: string,
  date: string,
  retryCount = 0
): Promise<FlightPrice[] | null> {
  const MAX_RETRIES = 2;

  try {
    console.log(`[GOOGLE_FLIGHTS] Scraping: ${originCode} → ${destCode} on ${date}`);

    const browser = await getBrowser();
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Format date for Google Flights (YYYY-MM-DD)
    const googleDate = date.split('/').reverse().join('-'); // Convert DD/MM/YYYY to YYYY-MM-DD

    const flightUrl = `https://www.google.com/flights?hl=en#flt=${originCode}.${destCode}.${googleDate}`;
    console.log(`[GOOGLE_FLIGHTS] Navigating to: ${flightUrl}`);

    // Navigate with timeout
    await Promise.race([
      page.goto(flightUrl, { waitUntil: 'networkidle2' }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Navigation timeout')), 30000)
      ),
    ]);

    console.log('[GOOGLE_FLIGHTS] Page loaded, waiting for flight cards...');

    // Wait for flight cards to appear (with timeout)
    try {
      await Promise.race([
        page.waitForSelector('div[role="option"][data-view-index]', { timeout: 15000 }),
        page.waitForSelector('.nrc6fd', { timeout: 15000 }),
      ]);
    } catch (e) {
      console.warn('[GOOGLE_FLIGHTS] Flight cards not found, trying alternative selectors...');
    }

    // Extract flight information
    const flights = await page.evaluate(() => {
      const flightCards = document.querySelectorAll('div[role="option"][data-view-index], .nrc6fd');
      const results: FlightCard[] = [];

      flightCards.forEach((card: any) => {
        try {
          // Try to extract price
          const priceEl = card.querySelector('[data-is-price]') || card.querySelector('.gvkl[role="heading"]');
          const priceText = priceEl?.textContent || '';

          // Try to extract times
          const timesEl = card.querySelector('.EWp0qd');
          const timesText = timesEl?.textContent || '';
          const [depTime, arrTime] = timesText.split('–').map((t: string) => t.trim());

          // Try to extract airline
          const airlineEl = card.querySelector('.sSHqwe');
          const airlineText = airlineEl?.textContent || 'Unknown Airline';

          // Try to extract duration
          const durationEl = card.querySelector('.fB3sNe');
          const durationText = durationEl?.textContent || '2h 0m';

          if (priceText && depTime && arrTime) {
            results.push({
              price: parseInt(priceText.replace(/[^\d]/g, ''), 10) || 0,
              departureTime: depTime,
              arrivalTime: arrTime,
              airline: airlineText,
              duration: durationText,
              stops: 0,
            });
          }
        } catch (e) {
          // Skip cards that fail to parse
        }
      });

      return results;
    });

    await page.close();

    console.log(`[GOOGLE_FLIGHTS] Scraped ${flights.length} flights`);

    if (flights.length === 0) {
      console.warn('[GOOGLE_FLIGHTS] No flights found on page');
      return null;
    }

    // Transform and validate flights
    const transformedFlights: FlightPrice[] = flights
      .filter((f) => f.price && f.price > 0)
      .map((f) => ({
        airline: f.airline || 'Unknown',
        price: f.price,
        departureTime: f.departureTime || '00:00',
        arrivalTime: f.arrivalTime || '00:00',
        duration: f.duration || '2h 0m',
        rating: 4.0 + Math.random() * 0.8, // 4.0-4.8 rating
      }))
      .slice(0, 10); // Top 10 flights

    return transformedFlights;
  } catch (error: any) {
    console.error(`[GOOGLE_FLIGHTS] Scrape attempt ${retryCount + 1} failed:`, error.message);

    // Retry with backoff
    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 500;
      console.log(`[GOOGLE_FLIGHTS] Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return scrapeGoogleFlights(originCode, destCode, date, retryCount + 1);
    }

    console.error('[GOOGLE_FLIGHTS] Max retries exceeded');
    return null;
  }
}

/**
 * Close browser
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    console.log('[PUPPETEER] Closing browser...');
    await browser.close();
    browser = null;
  }
}
