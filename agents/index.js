import dotenv from 'dotenv';
import { startNewsScraperAgent } from './news-scraper-agent.js';
import { startScreenerAgent } from './screener-agent.js';
import { startAlertAgent } from './alert-agent.js';
import { startTipsInsightsAgent } from './tips-insights-agent.js';
import { startRecommendationAgent } from './recommendation-agent.js';

dotenv.config();

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       Swing Trading Agents - Oslo Børs                  ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log('Starting all agents...\n');

// Start all agents
try {
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

  console.log('\n✓ All agents started successfully!');
  console.log('\nPress Ctrl+C to stop all agents\n');

} catch (error) {
  console.error('Failed to start agents:', error);
  process.exit(1);
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
