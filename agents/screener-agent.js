import cron from 'node-cron';
import { runScreener, DEFAULT_TICKERS, DEFAULT_CRITERIA } from '../mcp-servers/screener/screener.js';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promisify } from 'util';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env'), override: true });

const dbPath = process.env.DATABASE_PATH || join(__dirname, '../database/trading.db');

/**
 * Save screener results to database
 */
async function saveScreenerResults(results) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
    });

    const dbRun = promisify(db.run.bind(db));

    (async () => {
      try {
        // Create screener_results table if it doesn't exist
        await dbRun(`
          CREATE TABLE IF NOT EXISTS screener_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            price REAL,
            rsi REAL,
            volume_spike REAL,
            score REAL,
            screened_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Clear old results (keep last 7 days)
        await dbRun(`
          DELETE FROM screener_results
          WHERE screened_at < datetime('now', '-7 days')
        `);

        // Insert new results
        for (const result of results) {
          await dbRun(
            `INSERT INTO screener_results (ticker, price, rsi, volume_spike, score)
             VALUES (?, ?, ?, ?, ?)`,
            [result.ticker, result.price, result.rsi, result.volume_spike, result.score]
          );
        }

        console.log(`[Screener Agent] ✓ Saved ${results.length} results to database`);

        db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } catch (err) {
        db.close(() => {
          reject(err);
        });
      }
    })();
  });
}

/**
 * Run stock screener
 */
export async function runStockScreener() {
  console.log('\n[Screener Agent] Starting stock screener...');

  try {
    const results = await runScreener(DEFAULT_TICKERS, DEFAULT_CRITERIA);

    console.log(`[Screener Agent] Results: ${results.matches} matches from ${results.total_scanned} stocks`);

    if (results.results && results.results.length > 0) {
      console.log('\n[Screener Agent] Top 10 Results:');
      results.results.slice(0, 10).forEach((stock, index) => {
        console.log(`  ${index + 1}. ${stock.ticker}: RSI=${stock.rsi.toFixed(1)}, Vol Spike=${stock.volume_spike.toFixed(2)}x, Score=${stock.score.toFixed(1)}`);
      });

      await saveScreenerResults(results.results);
    }

    console.log('[Screener Agent] ✓ Complete\n');

  } catch (error) {
    console.error('[Screener Agent] ✗ Error:', error.message);
  }
}

/**
 * Start the screener agent with cron schedule
 */
export function startScreenerAgent() {
  const schedule = process.env.SCREENER_SCHEDULE || '0 18 * * *'; // Daily at 18:00

  console.log(`[Screener Agent] Scheduled: ${schedule} (Daily at 18:00 after market close)`);

  // Schedule recurring runs
  cron.schedule(schedule, () => {
    runStockScreener();
  });

}

export default {
  runStockScreener,
  startScreenerAgent,
};
