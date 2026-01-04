import cron from 'node-cron';
import { scrapeMultipleTickers } from '../mcp-servers/news-scraper/scraper.js';
import { getTopMovers } from '../backend/services/top-movers.js';
import { analyzeBatchSentiment } from '../backend/services/sentiment-analyzer.js';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 * Run news scraper
 */
export async function runNewsScraper() {
  console.log('\n[News Agent] Starting news scraper...');

  try {
    // Get top movers instead of fixed tickers
    const topMovers = await getTopMovers(TOP_MOVERS_LIMIT);
    const tickers = topMovers.map(m => m.ticker);

    if (tickers.length === 0) {
      console.log('[News Agent] No significant market movers found');
      console.log('[News Agent] ✓ Complete\n');
      return;
    }

    console.log(`[News Agent] Scraping ${tickers.length} top movers: ${tickers.join(', ')}`);

    const result = await scrapeMultipleTickers(tickers, 10);

    if (result.news && result.news.length > 0) {
      // Analyze sentiment
      console.log('[News Agent] Analyzing sentiment...');
      const sentiments = await analyzeBatchSentiment(result.news);

      // Save to database with sentiment
      await saveNewsToDatabase(result.news, sentiments);
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
