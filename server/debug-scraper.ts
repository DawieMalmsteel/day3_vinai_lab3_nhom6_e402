import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function debugGoogleFlights() {
  const browser = await puppeteer.launch({
    headless: false, // Can see the browser
    args: [
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await browser.newPage();
  
  // Set realistic user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  try {
    // Example search: Hanoi to Da Nang, today
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const url = `https://www.google.com/flights?hl=en#flt=HAN.DAD.${dateStr}`;
    
    console.log(`[DEBUG] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('[DEBUG] Page loaded, waiting 5 seconds for React to render...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take screenshot
    const screenshotPath = path.join(__dirname, '../debug-output/screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Screenshot saved to: ${screenshotPath}`);

    // Save full HTML
    const html = await page.content();
    const htmlPath = path.join(__dirname, '../debug-output/page.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`✅ HTML saved to: ${htmlPath}`);

    // Inspect selectors that exist
    const selectorAnalysis = await page.evaluate(() => {
      const analysis: Record<string, any> = {};

      // Check common flight card selectors
      const selectors = [
        'div[role="option"]',
        'div[role="option"][data-view-index]',
        '.nrc6fd',
        '[data-is-price]',
        '.gvkl',
        '.EWp0qd',
        '.sSHqwe',
        '.fB3sNe',
        'div[jsaction*="flights"]',
        '[data-flight-index]',
        '.Qs8ij',
        '.mKpF2e',
        'li[role="option"]',
        'div[data-test-id]',
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          analysis[selector] = {
            count: elements.length,
            sample: elements[0]?.outerHTML?.substring(0, 300) || 'N/A',
          };
        }
      }

      return analysis;
    });

    console.log('\n📊 SELECTOR ANALYSIS:');
    console.log(JSON.stringify(selectorAnalysis, null, 2));

    // Deep inspect flight cards
    const flightCardInfo = await page.evaluate(() => {
      const cards: any[] = [];

      // Try different potential card selectors
      const potentialCards = Array.from(document.querySelectorAll('[role="option"], li[role="option"], div.Qs8ij, div.mKpF2e'));

      potentialCards.slice(0, 3).forEach((card, idx) => {
        const cardInfo: any = {
          index: idx,
          tagName: card.tagName,
          className: (card as HTMLElement).className,
          attributes: {},
          children: [],
          textContent: (card as HTMLElement).textContent?.substring(0, 200),
        };

        // Get attributes
        if (card.attributes) {
          Array.from(card.attributes).forEach(attr => {
            (cardInfo.attributes as any)[attr.name] = attr.value;
          });
        }

        // Get first 5 children info
        Array.from(card.children).slice(0, 5).forEach((child: any, cidx: number) => {
          cardInfo.children.push({
            index: cidx,
            tag: child.tagName,
            class: child.className,
            text: child.textContent?.substring(0, 100),
          });
        });

        cards.push(cardInfo);
      });

      return cards;
    });

    console.log('\n🎫 FLIGHT CARD STRUCTURE:');
    console.log(JSON.stringify(flightCardInfo, null, 2));

    // Get all visible text on page (first 3000 chars)
    const pageText = await page.evaluate(() => {
      return document.body.innerText.substring(0, 3000);
    });
    console.log('\n📄 PAGE TEXT (first 3000 chars):');
    console.log(pageText);

  } catch (error) {
    console.error('[ERROR]', error);
  } finally {
    await browser.close();
  }
}

// Create debug output directory
const debugDir = path.join(__dirname, '../debug-output');
if (!fs.existsSync(debugDir)) {
  fs.mkdirSync(debugDir, { recursive: true });
}

debugGoogleFlights().catch(console.error);
