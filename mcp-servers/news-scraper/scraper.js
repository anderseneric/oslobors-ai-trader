import puppeteer from 'puppeteer';

const NEWSWEB_BASE_URL = 'https://newsweb.oslobors.no/search?issuer=';

// Singleton browser instance for performance
let browser = null;
let pageCount = 0;
const MAX_PAGES = 10; // Restart browser after 10 pages to prevent memory leaks

/**
 * Get or create browser instance
 */
async function getBrowser() {
  if (!browser || pageCount >= MAX_PAGES) {
    if (browser) {
      console.log('[Newsweb] Restarting browser (memory cleanup)');
      await browser.close().catch(() => {});
    }

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions'
      ]
    });
    pageCount = 0;
  }
  return browser;
}

/**
 * Scrape news from Newsweb for a specific ticker using Puppeteer
 * @param {string} ticker - Stock ticker symbol (e.g., 'MOWI', 'VAR')
 * @param {number} limit - Maximum number of news items to return
 * @returns {Promise<Array>} Array of news items
 */
export async function scrapeNewsweb(ticker, limit = 20) {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();
  pageCount++;

  try {
    const url = `${NEWSWEB_BASE_URL}${ticker.toUpperCase()}`;
    console.log(`[Newsweb] Fetching: ${url}`);

    // Set a reasonable viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for content to load
    try {
      await page.waitForSelector('.message-table tbody tr, .news-item, table tbody tr', {
        timeout: 10000
      });
    } catch (e) {
      console.log(`[Newsweb] No news items found for ${ticker} (page loaded but no content)`);
      await page.close();
      return [];
    }

    // Extract news items from the page
    const newsItems = await page.evaluate((ticker, limit) => {
      const items = [];

      // Try multiple selectors to find news rows
      const selectors = [
        '.message-table tbody tr',
        'table.messages tbody tr',
        '.table-messages tbody tr',
        'table tbody tr'
      ];

      let rows = [];
      for (const selector of selectors) {
        rows = Array.from(document.querySelectorAll(selector));
        if (rows.length > 0) break;
      }

      rows.forEach((row, index) => {
        if (index >= limit) return;

        // Try to extract data from table cells
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) return;

        // Typical structure: [Date, Title/Link, Category]
        let dateElem, titleElem, categoryElem;

        // Find the link element (usually contains the title)
        const link = row.querySelector('a[href*="/message/"], a.message-link, a');
        if (!link) return;

        titleElem = link;
        const title = titleElem.textContent.trim();
        if (!title || title.length < 10) return;

        // Extract link
        const href = link.getAttribute('href');
        const fullLink = href ? (href.startsWith('http') ? href : `https://newsweb.oslobors.no${href}`) : '';

        // Find date (usually first or second cell)
        dateElem = cells[0];
        let dateText = dateElem ? dateElem.textContent.trim() : '';

        // Parse Norwegian date format (DD.MM.YYYY HH:MM or DD.MM.YYYY)
        let publishedDate = new Date().toISOString();
        if (dateText.match(/\d{2}\.\d{2}\.\d{4}/)) {
          const [datePart, timePart = '00:00'] = dateText.split(' ');
          const [day, month, year] = datePart.split('.');
          publishedDate = new Date(`${year}-${month}-${day}T${timePart}:00`).toISOString();
        }

        // Find category (usually last cell or specific class)
        categoryElem = cells.length >= 3 ? cells[2] : cells[cells.length - 1];
        const category = categoryElem && categoryElem !== titleElem.closest('td')
          ? categoryElem.textContent.trim()
          : 'General';

        items.push({
          ticker: ticker.toUpperCase(),
          title,
          category: category || 'General',
          link: fullLink,
          content: '', // Will be empty, can fetch separately if needed
          published_date: publishedDate,
          source: 'newsweb'
        });
      });

      return items;
    }, ticker, limit);

    console.log(`[Newsweb] ✓ Scraped ${newsItems.length} items for ${ticker}`);
    await page.close();
    return newsItems;

  } catch (error) {
    console.error(`[Newsweb] ✗ Error scraping ${ticker}:`, error.message);
    await page.close().catch(() => {});
    return [];
  }
}

/**
 * Scrape news for multiple tickers in parallel (with concurrency limit)
 * @param {Array<string>} tickers - Array of ticker symbols
 * @param {number} limitPerTicker - Max items per ticker
 * @param {number} concurrency - Max concurrent scrapes
 * @returns {Promise<Object>} Results object with all news and any errors
 */
export async function scrapeMultipleTickers(tickers, limitPerTicker = 10, concurrency = 5) {
  console.log(`[Newsweb] Scraping ${tickers.length} tickers...`);

  const allNews = [];
  const errors = [];

  // Process in batches to limit concurrency
  for (let i = 0; i < tickers.length; i += concurrency) {
    const batch = tickers.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map(ticker => scrapeNewsweb(ticker, limitPerTicker))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allNews.push(...result.value);
      } else {
        errors.push({
          ticker: batch[index],
          error: result.reason.message,
        });
      }
    });
  }

  console.log(`[Newsweb] ✓ Total: ${allNews.length} news items`);

  return {
    success: true,
    total_tickers: tickers.length,
    total_news: allNews.length,
    news: allNews,
    errors: errors.length > 0 ? errors : null,
  };
}

/**
 * Cleanup: Close browser on process exit
 */
process.on('exit', async () => {
  if (browser) {
    await browser.close().catch(() => {});
  }
});

process.on('SIGINT', async () => {
  if (browser) {
    await browser.close().catch(() => {});
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (browser) {
    await browser.close().catch(() => {});
  }
  process.exit(0);
});

/**
 * Test the scraper with a sample ticker
 */
export async function testScraper() {
  console.log('\n=== Testing Newsweb Scraper with Puppeteer ===\n');

  const testTickers = ['MOWI', 'VAR', 'EQNR'];

  for (const ticker of testTickers) {
    try {
      const news = await scrapeNewsweb(ticker, 5);
      console.log(`\n${ticker}: ${news.length} items`);
      if (news.length > 0) {
        console.log('Sample:', news[0].title);
        console.log('Link:', news[0].link);
      }
    } catch (error) {
      console.error(`Error testing ${ticker}:`, error.message);
    }
  }

  // Cleanup
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testScraper()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}
