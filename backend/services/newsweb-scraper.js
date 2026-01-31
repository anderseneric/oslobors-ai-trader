import puppeteer from 'puppeteer';

let browser = null;

/**
 * Get or create browser instance
 */
async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

/**
 * Scrape content from a Newsweb article page
 */
export async function scrapeNewswebArticle(url) {
  try {
    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage();

    // Set timeout and navigate
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for content to load
    await page.waitForSelector('.article-content, .message-content, .content, p', { timeout: 10000 });

    // Extract text content from the page
    const content = await page.evaluate(() => {
      // Try different selectors for Newsweb content
      const selectors = [
        '.article-content',
        '.message-content',
        '.content',
        'article',
        'main',
        '[role="main"]'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          return element.innerText.trim();
        }
      }

      // Fallback: get all paragraph text
      const paragraphs = Array.from(document.querySelectorAll('p'));
      return paragraphs.map(p => p.innerText).join('\n').trim();
    });

    await page.close();

    return content || '';
  } catch (error) {
    console.error(`[Newsweb Scraper] Error scraping ${url}:`, error.message);
    return '';
  }
}

/**
 * Scrape multiple Newsweb articles (with rate limiting)
 */
export async function scrapeMultipleArticles(urls, delayMs = 2000) {
  const results = [];

  for (const url of urls) {
    const content = await scrapeNewswebArticle(url);
    results.push({ url, content });

    // Delay between requests to be respectful
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Close browser when done
 */
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export default {
  scrapeNewswebArticle,
  scrapeMultipleArticles,
  closeBrowser
};
