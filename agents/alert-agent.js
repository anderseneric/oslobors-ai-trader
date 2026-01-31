import cron from 'node-cron';
import { checkAllAlerts } from '../mcp-servers/alerts/alerts.js';
import { getWatchlistItemsWithAlerts, saveNotification, getPortfolio } from '../backend/database.js';
import * as priceService from '../backend/services/price-service.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env'), override: true });

/**
 * Process alerts and save to notifications
 */
async function processAlerts(alertsData) {
  const { alerts, by_type } = alertsData;

  if (alerts.length === 0) {
    console.log('[Alert Agent] No alerts');
    return;
  }

  console.log(`\n[Alert Agent] 🔔 ${alerts.length} ALERTS:`);
  console.log(`  - Price changes: ${by_type.price_change}`);
  console.log(`  - Volume spikes: ${by_type.volume_spike}`);
  console.log(`  - News events: ${by_type.news_event}`);

  // Group by severity
  const highSeverity = alerts.filter(a => a.severity === 'high');
  const mediumSeverity = alerts.filter(a => a.severity === 'medium');

  if (highSeverity.length > 0) {
    console.log('\n[Alert Agent] ⚠️  HIGH PRIORITY:');
    for (const alert of highSeverity) {
      console.log(`  ${alert.message}`);
      // Save high priority alerts as notifications
      await saveNotification({
        notification_type: alert.type || 'price_alert',
        ticker: alert.ticker,
        title: `Alert: ${alert.ticker}`,
        message: alert.message,
        severity: 'high'
      });
    }
  }

  if (mediumSeverity.length > 0) {
    console.log('\n[Alert Agent] 📊 MEDIUM PRIORITY:');
    for (const alert of mediumSeverity) {
      console.log(`  ${alert.message}`);
      // Save medium priority alerts as notifications
      await saveNotification({
        notification_type: alert.type || 'price_alert',
        ticker: alert.ticker,
        title: `Alert: ${alert.ticker}`,
        message: alert.message,
        severity: 'medium'
      });
    }
  }
}

/**
 * Check watchlist items for price alerts
 */
async function checkWatchlistAlerts() {
  try {
    const watchlistItems = await getWatchlistItemsWithAlerts();

    if (watchlistItems.length === 0) {
      return [];
    }

    console.log(`[Alert Agent] Checking ${watchlistItems.length} watchlist alerts...`);

    const tickers = [...new Set(watchlistItems.map(item => item.ticker))];
    const { quotes } = await priceService.getBatchQuotes(tickers);

    const alerts = [];

    for (const item of watchlistItems) {
      const quote = quotes.find(q => q.ticker === item.ticker);
      if (!quote || !quote.price) continue;

      const currentPrice = quote.price;

      // Check if price hit alert_price (below threshold - buy signal)
      if (item.alert_price && currentPrice <= item.alert_price) {
        const alert = {
          type: 'watchlist_alert',
          ticker: item.ticker,
          message: `${item.ticker} hit alert price! Current: ${currentPrice.toFixed(2)} NOK (Alert: ${item.alert_price} NOK)`,
          severity: 'high'
        };
        alerts.push(alert);

        await saveNotification({
          notification_type: 'watchlist_alert',
          ticker: item.ticker,
          title: `Watchlist Alert: ${item.ticker}`,
          message: alert.message,
          severity: 'high'
        });
      }

      // Check if price hit target_entry (at or below entry point)
      if (item.target_entry && currentPrice <= item.target_entry) {
        const alert = {
          type: 'watchlist_entry',
          ticker: item.ticker,
          message: `${item.ticker} reached target entry! Current: ${currentPrice.toFixed(2)} NOK (Target: ${item.target_entry} NOK)`,
          severity: 'high'
        };
        alerts.push(alert);

        await saveNotification({
          notification_type: 'watchlist_entry',
          ticker: item.ticker,
          title: `Entry Target: ${item.ticker}`,
          message: alert.message,
          severity: 'high'
        });
      }
    }

    if (alerts.length > 0) {
      console.log(`[Alert Agent] 🎯 ${alerts.length} watchlist alerts triggered!`);
    }

    return alerts;
  } catch (error) {
    console.error('[Alert Agent] Error checking watchlist alerts:', error.message);
    return [];
  }
}

/**
 * Check portfolio positions for significant price moves
 */
async function checkPortfolioAlerts() {
  try {
    const portfolio = await getPortfolio();
    if (portfolio.length === 0) return [];

    const tickers = portfolio.map(p => p.ticker);
    const { quotes } = await priceService.getBatchQuotes(tickers);

    const alerts = [];
    const PRICE_CHANGE_THRESHOLD = parseFloat(process.env.PRICE_CHANGE_THRESHOLD) || 5;

    for (const position of portfolio) {
      const quote = quotes.find(q => q.ticker === position.ticker);
      if (!quote || !quote.changePercent) continue;

      const changePercent = Math.abs(quote.changePercent);

      if (changePercent >= PRICE_CHANGE_THRESHOLD) {
        const direction = quote.changePercent > 0 ? 'up' : 'down';
        const severity = changePercent >= 10 ? 'high' : 'medium';

        const alert = {
          type: 'price_alert',
          ticker: position.ticker,
          message: `${position.ticker} is ${direction} ${changePercent.toFixed(1)}% today (${quote.price.toFixed(2)} NOK)`,
          severity
        };
        alerts.push(alert);

        await saveNotification({
          notification_type: 'price_alert',
          ticker: position.ticker,
          title: `Price Move: ${position.ticker}`,
          message: alert.message,
          severity
        });
      }
    }

    if (alerts.length > 0) {
      console.log(`[Alert Agent] 📈 ${alerts.length} portfolio price alerts!`);
    }

    return alerts;
  } catch (error) {
    console.error('[Alert Agent] Error checking portfolio alerts:', error.message);
    return [];
  }
}

/**
 * Run alert checker
 */
export async function runAlertChecker() {
  console.log('\n[Alert Agent] Checking alerts...');

  try {
    // Check MCP alerts (existing)
    const alertsData = await checkAllAlerts();
    await processAlerts(alertsData);

    // Check watchlist alerts (new)
    await checkWatchlistAlerts();

    // Check portfolio price alerts (new)
    await checkPortfolioAlerts();

    console.log('[Alert Agent] ✓ Complete\n');

  } catch (error) {
    console.error('[Alert Agent] ✗ Error:', error.message);
  }
}

/**
 * Start the alert agent with cron schedule
 */
export function startAlertAgent() {
  const schedule = process.env.ALERT_SCHEDULE || '*/5 * * * *'; // Every 5 minutes

  console.log(`[Alert Agent] Scheduled: ${schedule} (Every 5 minutes)`);

  // Run immediately on start
  runAlertChecker();

  // Schedule recurring runs
  cron.schedule(schedule, () => {
    runAlertChecker();
  });
}

export default {
  runAlertChecker,
  startAlertAgent,
};
