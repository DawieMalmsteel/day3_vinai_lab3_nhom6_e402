import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Improved debug script to find actual flight results
 */
async function debugGoogleFlights() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
  });

  const page = await browser.newPage();
  
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  try {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Try with more explicit URL parameters
    const url = `https://www.google.com/flights?hl=en&gl=us#flt=HAN.DAD.${dateStr}/DAD.HAN.${dateStr}`;
    
    console.log(`[DEBUG] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('[DEBUG] Page loaded, waiting for results...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Look for actual flight results
    const flightResults = await page.evaluate(() => {
      const results: any = {};

      // Check for various flight result containers
      const selectors = [
        '.nrc6fd',                    // Old selector
        'div[class*="flight"]',       // Any div with "flight" in class
        'li[data-test-id]',           // Test IDs
        'div[role="listbox"]',        // Listbox pattern
        'div[role="option"]',         // Option pattern
        'div[jsname]',               // JS-bound divs
        '[data-view-index]',         // View index pattern
        '.EWp0qd',                   // Old time selector
        'div[data-test-id="sl-result"]', // Result selector
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results[selector] = {
            count: elements.length,
            sample: elements[0]?.textContent?.substring(0, 200),
          };
        }
      }

      // Check page structure
      results.bodyText = document.body.innerText.substring(0, 1000);
      
      return results;
    });

    console.log('\n🔍 FLIGHT RESULTS CHECK:');
    console.log(JSON.stringify(flightResults, null, 2));

    // Take screenshot
    const screenshotPath = path.join(__dirname, '../debug-output/screenshot-results.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Screenshot saved: ${screenshotPath}`);

    // Save HTML
    const html = await page.content();
    const htmlPath = path.join(__dirname, '../debug-output/page-results.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`✅ HTML saved: ${htmlPath}`);

    // Try clicking on departure city field and see if it opens results
    console.log('\n[DEBUG] Attempting to click search button or explore results...');
    
    // Look for explore button or search results
    await page.evaluate(() => {
      // Try to find and click any explore/search button
      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
      const exploreBtn = buttons.find((btn: any) => 
        btn.textContent.toLowerCase().includes('explore') || 
        btn.textContent.toLowerCase().includes('search') ||
        btn.textContent.toLowerCase().includes('find')
      );
      if (exploreBtn) {
        (exploreBtn as HTMLElement).click();
      }
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check again for results
    const afterClickResults = await page.evaluate(() => {
      const results: any = {};
      
      // Look for flight items more specifically
      const potentialFlightSelectors = [
        'div[role="listbox"] > div',
        'li[role="option"]',
        'div[role="option"]',
        '[data-id*="flight"]',
        '.j4NnTb',  // Card selector
        '.yNnTb',   // Flight option
        'div[data-index]',
      ];

      for (const selector of potentialFlightSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results[selector] = elements.length;
        }
      }

      // Try to find prices
      const priceElements = Array.from(document.querySelectorAll('*')).filter((el: any) =>
        /₫|VND|\$|€|£/.test(el.textContent) && el.textContent.length < 50
      );

      results.priceCount = priceElements.length;
      results.samplePrices = priceElements.slice(0, 3).map((el: any) => el.textContent);

      return results;
    });

    console.log('\n💰 AFTER CLICK RESULTS:');
    console.log(JSON.stringify(afterClickResults, null, 2));

    const screenshot2 = path.join(__dirname, '../debug-output/screenshot-after-click.png');
    await page.screenshot({ path: screenshot2, fullPage: true });
    console.log(`✅ Screenshot after click: ${screenshot2}`);

  } catch (error) {
    console.error('[ERROR]', error);
  } finally {
    await browser.close();
  }
}

const debugDir = path.join(__dirname, '../debug-output');
if (!fs.existsSync(debugDir)) {
  fs.mkdirSync(debugDir, { recursive: true });
}

debugGoogleFlights().catch(console.error);
