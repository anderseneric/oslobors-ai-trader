import cron from 'node-cron';
import { scrapeMultipleTickers } from '../mcp-servers/news-scraper/scraper.js';
import { getTopMovers } from '../backend/services/top-movers.js';
import { analyzeBatchSentiment } from '../backend/services/sentiment-analyzer.js';
import { saveNotification, getPortfolio } from '../backend/database.js';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env'), override: true });

const dbPath = process.env.DATABASE_PATH || join(__dirname, '../database/trading.db');

// Number of top movers to scrape (configurable)
const TOP_MOVERS_LIMIT = parseInt(process.env.TOP_MOVERS_LIMIT) || 20;

/**
 * Save news to database with sentiment
 */
async function saveNewsToDatabase(newsItems, sentiments) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
    });

    // Custom promisified run that captures lastID and changes
    const dbRun = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    };

    let insertedCount = 0;

    const insertPromises = newsItems.map(async (item, index) => {
      try {
        const sentiment = sentiments[index] || { sentiment: 'neutral', confidence: 0.0 };
        const result = await dbRun(
          `INSERT OR IGNORE INTO news (ticker, title, category, link, content, published_date, source, sentiment, ai_confidence)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.ticker, item.title, item.category, item.link, item.content, item.published_date, item.source, sentiment.sentiment, sentiment.confidence]
        );
        if (result.changes > 0) insertedCount++;
      } catch (err) {
        console.error(`[News Agent] Error inserting item:`, err);
      }
    });

    Promise.all(insertPromises)
      .then(() => {
        console.log(`[News Agent] ✓ Inserted ${insertedCount} new items (${newsItems.length - insertedCount} duplicates skipped)`);
        db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      })
      .catch(reject);
  });
}

/**
 * Create notifications for high-impact news on portfolio stocks
 */
async function createNewsNotifications(newsItems, sentiments) {
  try {
    // Get portfolio tickers to only notify for stocks we own
    const portfolio = await getPortfolio();
    const portfolioTickers = new Set(portfolio.map(p => p.ticker));

    let notificationCount = 0;

    for (let i = 0; i < newsItems.length; i++) {
      const item = newsItems[i];
      const sentiment = sentiments[i] || { sentiment: 'neutral', confidence: 0.0 };

      // Only notify for portfolio stocks with high-confidence negative or positive news
      if (!portfolioTickers.has(item.ticker)) continue;
      if (sentiment.confidence < 0.7) continue; // Only high confidence

      // Create notification for bearish news (potential sell signal)
      if (sentiment.sentiment === 'bearish') {
        await saveNotification({
          notification_type: 'news_alert',
          ticker: item.ticker,
          title: `Negative News: ${item.ticker}`,
          message: `${item.title} (${Math.round(sentiment.confidence * 100)}% confidence)`,
          severity: 'high'
        });
        notificationCount++;
      }

      // Create notification for bullish news (confirmation)
      if (sentiment.sentiment === 'bullish' && sentiment.confidence >= 0.8) {
        await saveNotification({
          notification_type: 'news_alert',
          ticker: item.ticker,
          title: `Positive News: ${item.ticker}`,
          message: `${item.title} (${Math.round(sentiment.confidence * 100)}% confidence)`,
          severity: 'info'
        });
        notificationCount++;
      }
    }

    if (notificationCount > 0) {
      console.log(`[News Agent] Created ${notificationCount} news notifications`);
    }
  } catch (error) {
    console.error('[News Agent] Error creating notifications:', error.message);
  }
}

/**
 * Run news scraper
 */
export async function runNewsScraper() {
  console.log('\n[News Agent] Starting news scraper...');

  try {
    // Default major Oslo Børs tickers to always scrape
    const defaultTickers = [
      'EQNR', 'MOWI', 'DNB', 'TEL', 'YAR', 'VAR', 'ORK',
      'SALM', 'NHY', 'AKSO', 'BAKKA', 'SUBC', 'XXL', 'KOG', 'AUTOSTR'
    ];

    let tickers = [];

    // Try to get top movers, but fallback to defaults if it fails
    try {
      const topMovers = await getTopMovers(TOP_MOVERS_LIMIT);
      tickers = topMovers.map(m => m.ticker);

      if (tickers.length === 0) {
        console.log('[News Agent] No top movers found, using default tickers');
        tickers = defaultTickers;
      } else {
        console.log(`[News Agent] Scraping ${tickers.length} top movers: ${tickers.join(', ')}`);
      }
    } catch (error) {
      console.log(`[News Agent] Top movers failed (${error.message}), using default tickers`);
      tickers = defaultTickers;
    }

    console.log(`[News Agent] Fetching news for ${tickers.length} tickers`);

    const result = await scrapeMultipleTickers(tickers, 10);

    if (result.news && result.news.length > 0) {
      // Analyze sentiment
      console.log('[News Agent] Analyzing sentiment...');
      const sentiments = await analyzeBatchSentiment(result.news);

      // Save to database with sentiment
      await saveNewsToDatabase(result.news, sentiments);

      // Create notifications for high-impact news on portfolio stocks
      await createNewsNotifications(result.news, sentiments);
    } else {
      console.log('[News Agent] No news found');
    }

    if (result.errors) {
      console.error('[News Agent] Errors:', result.errors);
    }

    console.log('[News Agent] ✓ Complete\n');

  } catch (error) {
    console.error('[News Agent] ✗ Error:', error.message);
  }
}

/**
 * Start the news scraper agent with cron schedule
 */
export function startNewsScraperAgent() {
  const schedule = process.env.NEWS_SCRAPER_SCHEDULE || '*/15 * * * *'; // Every 15 minutes

  console.log(`[News Agent] Scheduled: ${schedule}`);

  // Run immediately on start
  runNewsScraper();

  // Schedule recurring runs
  cron.schedule(schedule, () => {
    runNewsScraper();
  });
}

export default {
  runNewsScraper,
  startNewsScraperAgent,
};
