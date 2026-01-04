import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Connect to main database
const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../database/trading.db');

/**
 * Alert types
 */
export const ALERT_TYPES = {
  PRICE_CHANGE: 'price_change',
  VOLUME_SPIKE: 'volume_spike',
  NEWS_EVENT: 'news_event',
  RSI_EXTREME: 'rsi_extreme',
};

/**
 * Helper to create a promisified database connection
 */
function createDbConnection() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

/**
 * Promisify database methods
 */
function promisifyDb(db) {
  return {
    all: promisify(db.all.bind(db)),
    get: promisify(db.get.bind(db)),
    close: promisify(db.close.bind(db)),
  };
}

/**
 * Check portfolio for price change alerts
 * @param {number} threshold - Price change threshold (e.g., 0.05 for 5%)
 * @returns {Promise<Array>} Array of alerts
 */
export async function checkPriceChangeAlerts(threshold = 0.05) {
  const db = await createDbConnection();
  const dbAsync = promisifyDb(db);

  try {
    const portfolio = await dbAsync.all('SELECT * FROM portfolio');
    const alerts = [];

    for (const position of portfolio) {
      if (!position.current_price || !position.avg_buy_price) continue;

      const changePercent = (position.current_price - position.avg_buy_price) / position.avg_buy_price;

      if (Math.abs(changePercent) >= threshold) {
        alerts.push({
          type: ALERT_TYPES.PRICE_CHANGE,
          ticker: position.ticker,
          message: `${position.ticker}: ${changePercent > 0 ? '↑' : '↓'} ${(changePercent * 100).toFixed(2)}%`,
          severity: Math.abs(changePercent) >= 0.1 ? 'high' : 'medium',
          data: {
            ticker: position.ticker,
            current_price: position.current_price,
            avg_buy_price: position.avg_buy_price,
            change_percent: changePercent,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    console.log(`[Alerts] Found ${alerts.length} price change alerts`);
    return alerts;

  } finally {
    await dbAsync.close();
  }
}

/**
 * Check for volume spike alerts
 * @param {number} spikeThreshold - Volume spike threshold (e.g., 2.0 for 2x average)
 * @returns {Promise<Array>} Array of alerts
 */
export async function checkVolumeSpikes(spikeThreshold = 2.0) {
  const db = await createDbConnection();
  const dbAsync = promisifyDb(db);

  try {
    const portfolio = await dbAsync.all('SELECT DISTINCT ticker FROM portfolio');
    const alerts = [];

    for (const { ticker } of portfolio) {
      // Get recent price history
      const history = await dbAsync.all(
        `SELECT volume FROM price_history
         WHERE ticker = ?
         ORDER BY date DESC
         LIMIT 20`,
        [ticker]
      );

      if (history.length < 2) continue;

      const latestVolume = history[0].volume;
      const avgVolume = history.slice(1).reduce((sum, h) => sum + h.volume, 0) / (history.length - 1);

      if (latestVolume > avgVolume * spikeThreshold) {
        const spikeRatio = latestVolume / avgVolume;

        alerts.push({
          type: ALERT_TYPES.VOLUME_SPIKE,
          ticker,
          message: `${ticker}: Volume spike ${spikeRatio.toFixed(2)}x average`,
          severity: spikeRatio >= 3 ? 'high' : 'medium',
          data: {
            ticker,
            current_volume: latestVolume,
            average_volume: avgVolume,
            spike_ratio: spikeRatio,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    console.log(`[Alerts] Found ${alerts.length} volume spike alerts`);
    return alerts;

  } finally {
    await dbAsync.close();
  }
}

/**
 * Check for new news events
 * @param {number} hoursBack - Check news from last N hours
 * @returns {Promise<Array>} Array of alerts
 */
export async function checkNewsAlerts(hoursBack = 1) {
  const db = await createDbConnection();
  const dbAsync = promisifyDb(db);

  try {
    const portfolioTickers = (await dbAsync.all('SELECT DISTINCT ticker FROM portfolio')).map(r => r.ticker);

    if (portfolioTickers.length === 0) {
      return [];
    }

    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    const placeholders = portfolioTickers.map(() => '?').join(',');
    const recentNews = await dbAsync.all(
      `SELECT * FROM news
       WHERE ticker IN (${placeholders})
       AND published_date > ?
       ORDER BY published_date DESC`,
      [...portfolioTickers, since]
    );

    const alerts = recentNews.map(news => ({
      type: ALERT_TYPES.NEWS_EVENT,
      ticker: news.ticker,
      message: `${news.ticker}: ${news.title}`,
      severity: 'medium',
      data: {
        ticker: news.ticker,
        title: news.title,
        category: news.category,
        link: news.link,
        published_date: news.published_date,
      },
      timestamp: new Date().toISOString(),
    }));

    console.log(`[Alerts] Found ${alerts.length} news alerts`);
    return alerts;

  } finally {
    await dbAsync.close();
  }
}

/**
 * Check all alert types
 * @returns {Promise<Object>} All alerts grouped by type
 */
export async function checkAllAlerts() {
  console.log('[Alerts] Running all alert checks...');

  const [priceAlerts, volumeAlerts, newsAlerts] = await Promise.all([
    checkPriceChangeAlerts(),
    checkVolumeSpikes(),
    checkNewsAlerts(),
  ]);

  const allAlerts = [...priceAlerts, ...volumeAlerts, ...newsAlerts];

  console.log(`[Alerts] ✓ Total: ${allAlerts.length} alerts`);

  return {
    success: true,
    timestamp: new Date().toISOString(),
    total: allAlerts.length,
    alerts: allAlerts,
    by_type: {
      price_change: priceAlerts.length,
      volume_spike: volumeAlerts.length,
      news_event: newsAlerts.length,
    },
  };
}

export default {
  checkPriceChangeAlerts,
  checkVolumeSpikes,
  checkNewsAlerts,
  checkAllAlerts,
  ALERT_TYPES,
};
