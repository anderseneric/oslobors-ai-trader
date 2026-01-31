import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { startNewsScraperAgent } from './news-scraper-agent.js';
import { startScreenerAgent } from './screener-agent.js';
import { startAlertAgent } from './alert-agent.js';
import { startTipsInsightsAgent } from './tips-insights-agent.js';
import { startRecommendationAgent } from './recommendation-agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env'), override: true });

/**
 * Start all agents (can be called from server.js or standalone)
 */
export function startAllAgents() {
  console.log('\n🤖 Starting all agents...\n');

  // News Scraper: Every 15 minutes
  startNewsScraperAgent();

  // Stock Screener: Daily at 18:00
  startScreenerAgent();

  // Alert Monitor: Every 5 minutes
  startAlertAgent();

  // Tips & Insights: Daily at 08:00
  startTipsInsightsAgent();

  // Recommendations: Daily at 18:00
  startRecommendationAgent();

  console.log('\n✓ All agents started successfully!\n');
}

// Only run standalone if this is the main module
const isMainModule = process.argv[1]?.endsWith('index.js') || process.argv[1]?.endsWith('agents');

if (isMainModule) {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       Swing Trading Agents - Oslo Børs                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    startAllAgents();
    console.log('Press Ctrl+C to stop all agents\n');
  } catch (error) {
    console.error('Failed to start agents:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down agents...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nShutting down agents...');
  process.exit(0);
});

// Keep process alive
process.stdin.resume();
