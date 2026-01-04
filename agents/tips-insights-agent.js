import cron from 'node-cron';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promisify } from 'util';
import sqlite3 from 'sqlite3';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DATABASE_PATH || join(__dirname, '../database/trading.db');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Python Flask endpoint for technical indicators
const PYTHON_API_BASE = process.env.PYTHON_API_BASE || 'http://localhost:5000';

/**
 * Get portfolio from database
 */
async function getPortfolio() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
    });

    db.all('SELECT * FROM portfolio ORDER BY ticker', [], (err, rows) => {
      db.close();
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * Get recent news for ticker
 */
async function getTickerNews(db, ticker, limit = 5) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM news WHERE ticker = ? ORDER BY published_date DESC LIMIT ?',
      [ticker, limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

/**
 * Save tip to database
 */
async function saveTipToDatabase(tip, cacheHours = 2) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
    });

    const cachedUntil = new Date(Date.now() + cacheHours * 60 * 60 * 1000).toISOString();

    db.run(
      `INSERT OR REPLACE INTO tips_insights (
        tip_type, ticker, title, description, severity, confidence,
        action_required, metadata, cached_until
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tip.tip_type,
        tip.ticker || null,
        tip.title,
        tip.description,
        tip.severity,
        tip.confidence,
        tip.action_required ? 1 : 0,
        tip.metadata ? JSON.stringify(tip.metadata) : null,
        cachedUntil
      ],
      function(err) {
        db.close();
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
}

/**
 * Get technical indicators from Python Flask
 */
async function getTechnicalIndicators(ticker) {
  try {
    const response = await axios.get(`${PYTHON_API_BASE}/indicators/${ticker}`, {
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    console.error(`[Tips Agent] Error fetching indicators for ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Generate actionable insights for a single position
 */
async function generatePositionInsights(db, position) {
  try {
    console.log(`[Tips Agent] Analyzing ${position.ticker}...`);

    // Get technical indicators
    const indicators = await getTechnicalIndicators(position.ticker);

    if (!indicators) {
      console.log(`[Tips Agent] Skipping ${position.ticker} - no technical data available`);
      return [];
    }

    // Get recent news
    const news = await getTickerNews(db, position.ticker, 5);
    const newsContext = news.map(n => `- ${n.title} (${new Date(n.published_date).toLocaleDateString('no-NO')})`).join('\n');

    // Calculate P/L
    const pl = position.current_price
      ? ((position.current_price - position.avg_buy_price) / position.avg_buy_price * 100).toFixed(2)
      : 'N/A';

    // Construct Claude prompt
    const prompt = `Analyze portfolio position for swing trading insights:

Stock: ${position.ticker} (${position.company_name})
Position: ${position.shares} shares @ ${position.avg_buy_price} NOK
Current Price: ${position.current_price || 'N/A'} NOK
P/L: ${pl}%

Technical Indicators:
- RSI: ${indicators.rsi?.toFixed(2) || 'N/A'}
- MACD: ${indicators.macd?.macd?.toFixed(2) || 'N/A'}
- Volume Spike: ${indicators.volume?.spike_ratio?.toFixed(2) || 'N/A'}x

Recent News (5 days):
${newsContext || 'No recent news'}

Generate 1-3 specific, actionable insights as JSON:
{
  "insights": [
    {
      "title": "Specific observation (e.g., RSI oversold at 28 - potential bounce)",
      "description": "What this means and what action to consider (max 50 words)",
      "tip_type": "daily_insight|smart_alert|risk_warning|entry_exit",
      "severity": "high|medium|low",
      "confidence": 65-95,
      "action_required": true|false
    }
  ]
}

Rules:
- Only include insights with confidence > 60
- Focus on actionable signals (entry/exit, risk warnings, technical alerts)
- Be specific with price levels when relevant
- Keep descriptions concise and practical
- Use Norwegian stock market context (Oslo Børs)`;

    const message = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.insights && Array.isArray(data.insights)) {
          // Add ticker and metadata to each insight
          return data.insights.map(insight => ({
            ...insight,
            ticker: position.ticker,
            metadata: {
              rsi: indicators.rsi,
              volume_spike: indicators.volume?.spike_ratio,
              current_price: position.current_price,
              pl_percent: pl
            }
          }));
        }
      }
    } catch (parseError) {
      console.error(`[Tips Agent] JSON parse error for ${position.ticker}:`, parseError.message);
    }

    return [];

  } catch (error) {
    console.error(`[Tips Agent] Error analyzing ${position.ticker}:`, error.message);
    return [];
  }
}

/**
 * Generate portfolio-wide risk analysis
 */
async function generatePortfolioRiskAnalysis(portfolio) {
  try {
    console.log('[Tips Agent] Analyzing portfolio risk...');

    // Calculate sector breakdown
    const sectorMap = {};
    let totalValue = 0;

    portfolio.forEach(pos => {
      const value = (pos.current_price || pos.avg_buy_price) * pos.shares;
      totalValue += value;

      // For now, use a simple mapping (in production, fetch from tickers JSON)
      const sector = 'Unknown';
      sectorMap[sector] = (sectorMap[sector] || 0) + value;
    });

    const sectorBreakdown = Object.entries(sectorMap)
      .map(([sector, value]) => `- ${sector}: ${(value / totalValue * 100).toFixed(1)}%`)
      .join('\n');

    const portfolioSummary = portfolio.map(p =>
      `- ${p.ticker}: ${((p.current_price || p.avg_buy_price) * p.shares / totalValue * 100).toFixed(1)}%`
    ).join('\n');

    const prompt = `Analyze portfolio for concentration risk and diversification:

Total Portfolio Value: ${totalValue.toFixed(0)} NOK
Position Count: ${portfolio.length}

Holdings by Weight:
${portfolioSummary}

Sector Breakdown:
${sectorBreakdown}

Generate risk warnings and diversification tips as JSON:
{
  "warnings": [
    {
      "title": "Specific risk identified",
      "description": "Why this is a risk and what to do (max 50 words)",
      "tip_type": "risk_warning",
      "severity": "high|medium|low",
      "confidence": 70-95,
      "action_required": true|false
    }
  ]
}

Focus on:
- Concentration risk (single position > 20% of portfolio)
- Sector concentration
- Correlation risks
- Position sizing recommendations

Only include if confidence > 65.`;

    const message = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.warnings && Array.isArray(data.warnings)) {
          return data.warnings.map(w => ({ ...w, ticker: null }));
        }
      }
    } catch (parseError) {
      console.error('[Tips Agent] JSON parse error for portfolio analysis:', parseError.message);
    }

    return [];

  } catch (error) {
    console.error('[Tips Agent] Error in portfolio risk analysis:', error.message);
    return [];
  }
}

/**
 * Run tips generation
 */
export async function runTipsInsightsGeneration() {
  console.log('\n[Tips Agent] Starting tips & insights generation...');

  const db = new sqlite3.Database(dbPath);

  try {
    // Get all portfolio positions
    const portfolio = await getPortfolio();

    if (portfolio.length === 0) {
      console.log('[Tips Agent] No portfolio positions found');
      db.close();
      return;
    }

    console.log(`[Tips Agent] Analyzing ${portfolio.length} positions...`);

    const allInsights = [];

    // Generate insights for each position
    for (const position of portfolio) {
      const positionInsights = await generatePositionInsights(db, position);
      allInsights.push(...positionInsights);

      // Rate limiting: wait 1 second between API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Generate portfolio-wide risk analysis
    const riskWarnings = await generatePortfolioRiskAnalysis(portfolio);
    allInsights.push(...riskWarnings);

    db.close();

    // Save all insights to database
    console.log(`[Tips Agent] Saving ${allInsights.length} insights...`);

    let savedCount = 0;
    for (const insight of allInsights) {
      try {
        await saveTipToDatabase(insight, 2); // Cache for 2 hours
        savedCount++;
      } catch (error) {
        console.error('[Tips Agent] Error saving insight:', error.message);
      }
    }

    console.log(`[Tips Agent] ✓ Complete: Generated and saved ${savedCount} insights\n`);

  } catch (error) {
    db.close();
    console.error('[Tips Agent] ✗ Error:', error.message);
  }
}

/**
 * Start the tips-insights agent with cron schedule
 */
export function startTipsInsightsAgent() {
  const schedule = process.env.TIPS_INSIGHTS_SCHEDULE || '0 8 * * *'; // Daily at 8:00 AM

  console.log(`[Tips Agent] Scheduled: ${schedule} (Daily at 08:00 before market open)`);

  // Schedule recurring runs
  cron.schedule(schedule, () => {
    runTipsInsightsGeneration();
  });

  // Optional: Run on startup (comment out for production)
  // runTipsInsightsGeneration();
}

export default {
  runTipsInsightsGeneration,
  startTipsInsightsAgent,
};
