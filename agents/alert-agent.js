import cron from 'node-cron';
import { checkAllAlerts } from '../mcp-servers/alerts/alerts.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Process alerts (log, send notifications, etc.)
 */
function processAlerts(alertsData) {
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
    highSeverity.forEach(alert => {
      console.log(`  ${alert.message}`);
    });
  }

  if (mediumSeverity.length > 0) {
    console.log('\n[Alert Agent] 📊 MEDIUM PRIORITY:');
    mediumSeverity.forEach(alert => {
      console.log(`  ${alert.message}`);
    });
  }

}

/**
 * Run alert checker
 */
export async function runAlertChecker() {
  console.log('\n[Alert Agent] Checking alerts...');

  try {
    const alertsData = await checkAllAlerts();
    processAlerts(alertsData);
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
