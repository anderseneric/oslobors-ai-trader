// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env'), override: true });

import express from 'express';
import cors from 'cors';
import yahooFinance from 'yahoo-finance2';
import Anthropic from '@anthropic-ai/sdk';
import cron from 'node-cron';
import { readFileSync } from 'fs';
import { getTopMovers } from './services/top-movers.js';
import { analyzeBatchSentiment } from './services/sentiment-analyzer.js';
import { scrapeNewsweb } from '../mcp-servers/news-scraper/scraper.js';
import * as priceService from './services/price-service.js';
import * as finnhub from './services/finnhub-client.js';
import * as insiderParser from './services/insider-parser.js';
import * as insiderScoring from './services/insider-scoring.js';
import * as newswebScraper from './services/newsweb-scraper.js';
import { startAllAgents } from '../agents/index.js';

// Load Oslo Børs tickers
const tickersData = JSON.parse(
  readFileSync(join(__dirname, '../oslo-bors-tickers.json'), 'utf-8')
);
import db, {
  getPortfolio,
  addToPortfolio,
  updatePortfolioPrice,
  deleteFromPortfolio,
  getPriceHistory,
  savePriceHistory,
  getCachedAnalysis,
  saveAnalysis,
  getNews,
  getLatestNews,
  saveNews,
  saveRecommendation,
  getCachedRecommendations,
  clearOldRecommendations,
  savePortfolioSnapshot,
  getPortfolioHistory,
  clearOldHistory,
  saveTipInsight,
  getCachedTips,
  clearOldTips,
  calculateWinRate,
  calculateAvgHoldTime,
  calculateSectorPerformance,
  calculateMonthlyPL,
  calculateSharpeRatio,
  getCachedAnalytics,
  saveAnalyticsCache,
  saveTradeHistory,
  saveNotification,
  getUnreadNotifications,
  getAllNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications,
  getNotificationPreferences,
  saveNotificationPreference,
  updateNotificationPreference,
  deleteNotificationPreference,
  saveInsiderTransaction,
  getInsiderTransactions,
  getInsiderSummary,
  getTopInsiderBuys,
  getWatchlists,
  createWatchlist,
  deleteWatchlist,
  getWatchlistItems,
  addWatchlistItem,
  updateWatchlistItem,
  deleteWatchlistItem
} from './database.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Portfolio Routes

app.get('/api/portfolio', async (req, res) => {
  try {
    const portfolio = await getPortfolio();
    res.json({ success: true, data: portfolio });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/portfolio', async (req, res) => {
  try {
    const { ticker, shares, avg_buy_price, purchase_date, notes, transaction_fees } = req.body;

    // Validate required fields
    if (!ticker || !shares || !avg_buy_price || !purchase_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: ticker, shares, avg_buy_price, purchase_date'
      });
    }

    // Input validation
    const sharesNum = parseInt(shares);
    const priceNum = parseFloat(avg_buy_price);
    const feesNum = transaction_fees ? parseFloat(transaction_fees) : 0;

    if (!ticker || typeof ticker !== 'string' || ticker.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid ticker: must be a non-empty string' });
    }

    if (isNaN(sharesNum) || sharesNum <= 0 || !Number.isInteger(sharesNum)) {
      return res.status(400).json({ success: false, error: 'Invalid shares: must be a positive integer' });
    }

    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid avg_buy_price: must be a positive number' });
    }

    if (isNaN(feesNum) || feesNum < 0) {
      return res.status(400).json({ success: false, error: 'Invalid transaction_fees: must be a non-negative number' });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(purchase_date) || isNaN(Date.parse(purchase_date))) {
      return res.status(400).json({ success: false, error: 'Invalid purchase_date: must be in YYYY-MM-DD format' });
    }

    // Fetch current price using new price service (Finnhub primary, Yahoo fallback)
    const quote = await priceService.getStockQuote(ticker);

    // Get company name (fallback to ticker if not available)
    let companyName = ticker;
    if (finnhub.isFinnhubConfigured()) {
      try {
        const profile = await finnhub.getCompanyProfile(`${ticker}.OL`);
        companyName = profile.name || ticker;
      } catch (error) {
        console.log(`Could not fetch company name for ${ticker}, using ticker`);
      }
    }

    const tickerUpper = ticker.toUpperCase();
    const sharesInt = parseInt(shares);
    const buyPrice = parseFloat(avg_buy_price);
    const fees = transaction_fees ? parseFloat(transaction_fees) : 0;

    const result = await addToPortfolio({
      ticker: tickerUpper,
      company_name: companyName,
      shares: sharesInt,
      avg_buy_price: buyPrice,
      current_price: quote.price,
      purchase_date,
      notes: notes || null,
      transaction_fees: fees
    });

    // Log BUY trade to trade_history for analytics
    await saveTradeHistory({
      ticker: tickerUpper,
      action: 'BUY',
      shares: sharesInt,
      price: buyPrice,
      fees: fees,
      total_value: sharesInt * buyPrice,
      trade_date: purchase_date,
      notes: notes || null
    });

    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (error) {
    console.error('Error adding to portfolio:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/portfolio/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch position before deleting to log SELL trade
    const portfolio = await getPortfolio();
    const position = portfolio.find(p => p.id === parseInt(id));

    if (!position) {
      return res.status(404).json({ success: false, error: 'Position not found' });
    }

    // Get current price for the SELL trade
    let sellPrice = position.current_price;
    try {
      const quote = await priceService.getStockQuote(position.ticker);
      sellPrice = quote.price || position.current_price;
    } catch (priceError) {
      console.log(`Could not fetch current price for ${position.ticker}, using last known price`);
    }

    // Log SELL trade to trade_history for analytics
    await saveTradeHistory({
      ticker: position.ticker,
      action: 'SELL',
      shares: position.shares,
      price: sellPrice,
      fees: 0, // Could add sell fees if needed
      total_value: position.shares * sellPrice,
      trade_date: new Date().toISOString().split('T')[0],
      notes: `Closed position (bought at ${position.avg_buy_price})`
    });

    await deleteFromPortfolio(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting from portfolio:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/portfolio/refresh-prices', async (req, res) => {
  try {
    const portfolio = await getPortfolio();
    const updates = [];
    const errors = [];

    // Use batch quotes for efficiency
    const tickers = portfolio.map(p => p.ticker);
    const { quotes, errors: quoteErrors } = await priceService.getBatchQuotes(tickers);

    // Update prices from successful quotes
    for (const quote of quotes) {
      try {
        const position = portfolio.find(p => p.ticker === quote.ticker);
        if (position && quote.price) {
          await updatePortfolioPrice(quote.ticker, quote.price);
          updates.push({
            ticker: quote.ticker,
            price: quote.price,
            previousPrice: position.current_price,
            source: quote.source
          });
        }
      } catch (error) {
        console.error(`Error updating ${quote.ticker}:`, error.message);
        errors.push({ ticker: quote.ticker, error: error.message });
      }
    }

    // Add quote errors to error list
    errors.push(...quoteErrors);

    const updatedPortfolio = await getPortfolio();
    const lastUpdate = updatedPortfolio.length > 0
      ? updatedPortfolio[0].updated_at
      : new Date().toISOString();

    res.json({
      success: true,
      updated: updates.length,
      errors: errors.length,
      updates,
      errors: errors.length > 0 ? errors : undefined,
      lastUpdate,
      portfolio: updatedPortfolio
    });
  } catch (error) {
    console.error('Error refreshing prices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get portfolio history
app.get('/api/portfolio/history', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const history = await getPortfolioHistory(days);

    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error fetching portfolio history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manually trigger portfolio snapshot (for testing)
app.post('/api/portfolio/snapshot', async (req, res) => {
  try {
    const result = await savePortfolioSnapshot();
    res.json(result);
  } catch (error) {
    console.error('Error creating snapshot:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Watchlist Routes

app.get('/api/watchlists', async (req, res) => {
  try {
    const watchlists = await getWatchlists();
    res.json({ success: true, data: watchlists });
  } catch (error) {
    console.error('Error fetching watchlists:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/watchlists', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    const result = await createWatchlist(name);
    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (error) {
    console.error('Error creating watchlist:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/watchlists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteWatchlist(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting watchlist:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/watchlists/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const items = await getWatchlistItems(id);

    // Fetch current prices for all items
    const tickers = items.map(item => item.ticker);
    const { quotes } = await priceService.getBatchQuotes(tickers);

    // Merge price data with watchlist items
    const itemsWithPrices = items.map(item => {
      const quote = quotes.find(q => q.ticker === item.ticker);
      return {
        ...item,
        current_price: quote?.price || null,
        change: quote?.change || null,
        changePercent: quote?.changePercent || null,
        volume: quote?.volume || null,
        source: quote?.source || null
      };
    });

    res.json({ success: true, data: itemsWithPrices });
  } catch (error) {
    console.error('Error fetching watchlist items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/watchlists/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const { ticker, notes, target_entry, alert_price } = req.body;

    if (!ticker) {
      return res.status(400).json({ success: false, error: 'Ticker is required' });
    }

    // Get company name
    let companyName = ticker;
    if (finnhub.isFinnhubConfigured()) {
      try {
        const profile = await finnhub.getCompanyProfile(`${ticker}.OL`);
        companyName = profile.name || ticker;
      } catch (error) {
        console.log(`Could not fetch company name for ${ticker}, using ticker`);
      }
    }

    const result = await addWatchlistItem(
      id,
      ticker.toUpperCase(),
      companyName,
      notes || null,
      target_entry ? parseFloat(target_entry) : null,
      alert_price ? parseFloat(alert_price) : null
    );

    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (error) {
    console.error('Error adding watchlist item:', error);
    if (error.message === 'Stock already in watchlist') {
      res.status(409).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

app.put('/api/watchlists/:watchlistId/items/:ticker', async (req, res) => {
  try {
    const { watchlistId, ticker } = req.params;
    const { notes, target_entry, alert_price } = req.body;

    await updateWatchlistItem(watchlistId, ticker, {
      notes,
      target_entry: target_entry ? parseFloat(target_entry) : null,
      alert_price: alert_price ? parseFloat(alert_price) : null
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating watchlist item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/watchlists/:watchlistId/items/:ticker', async (req, res) => {
  try {
    const { watchlistId, ticker } = req.params;
    await deleteWatchlistItem(watchlistId, ticker);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting watchlist item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stock Routes

app.get('/api/stocks/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const tickerUpper = ticker.toUpperCase();

    // Use price-service (Finnhub primary, Yahoo fallback)
    const quote = await priceService.getStockQuote(tickerUpper);

    res.json({
      success: true,
      data: {
        ticker: tickerUpper,
        name: quote.name || tickerUpper, // Name may not be available from Finnhub
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        volume: quote.volume, // May be null from Finnhub - that's OK
        marketCap: quote.marketCap || null, // Not available from Finnhub
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || null,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow || null,
        currency: 'NOK',
        source: quote.source // 'finnhub' or 'yahoo'
      }
    });
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rate limiting for historical data (Yahoo Finance)
let lastHistoricalFetch = 0;
const HISTORICAL_MIN_DELAY = 3000; // 3 seconds between historical fetches

app.get('/api/stocks/:ticker/history', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { days = 90 } = req.query;
    const tickerUpper = ticker.toUpperCase();

    // Check if we have cached data
    let history = await getPriceHistory(tickerUpper, parseInt(days));

    // Check if data is stale (last entry is older than 1 day on a weekday)
    const isStale = () => {
      if (history.length === 0) return true;
      const lastDate = new Date(history[0].date); // Most recent entry
      const now = new Date();
      const daysDiff = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
      // Consider stale if more than 1 day old (accounting for weekends)
      return daysDiff > 3; // Allow weekend gap + 1 day buffer
    };

    // Only fetch if no data or data is stale
    if (history.length === 0 || isStale()) {
      // Rate limit: wait between Yahoo historical calls
      const now = Date.now();
      const timeSinceLastFetch = now - lastHistoricalFetch;
      if (timeSinceLastFetch < HISTORICAL_MIN_DELAY) {
        // If we have stale data, return it rather than waiting
        if (history.length > 0) {
          return res.json({ success: true, data: history, stale: true });
        }
        await new Promise(resolve => setTimeout(resolve, HISTORICAL_MIN_DELAY - timeSinceLastFetch));
      }
      lastHistoricalFetch = Date.now();

      const tickerSymbol = `${tickerUpper}.OL`;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      try {
        const result = await yahooFinance.historical(tickerSymbol, {
          period1: startDate,
          period2: endDate,
        });

        // Save to database
        for (const item of result) {
          await savePriceHistory({
            ticker: tickerUpper,
            date: item.date.toISOString().split('T')[0],
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volume
          });
        }

        history = await getPriceHistory(tickerUpper, parseInt(days));
      } catch (yahooError) {
        // If Yahoo fails and we have stale data, return that
        if (history.length > 0) {
          console.log(`Yahoo historical failed for ${tickerUpper}, returning cached data`);
          return res.json({ success: true, data: history, stale: true });
        }
        throw yahooError;
      }
    }

    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching stock history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stocks/:ticker/analysis', async (req, res) => {
  try {
    const { ticker } = req.params;
    const tickerUpper = ticker.toUpperCase();

    // Check cache first
    const cached = await getCachedAnalysis(tickerUpper);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true
      });
    }

    // Fetch fresh data for analysis using price-service (Finnhub primary, Yahoo fallback)
    const quote = await priceService.getStockQuote(tickerUpper);

    // Get recent news
    const recentNews = await getNews(tickerUpper, 10);

    // Prepare context for Claude
    const newsContext = recentNews.map(n => `- ${n.title} (${n.published_date})`).join('\n');

    // Build price info string (handle missing fields gracefully)
    const volumeStr = quote.volume ? `Volume: ${quote.volume}` : 'Volume: N/A';
    const rangeStr = (quote.fiftyTwoWeekLow && quote.fiftyTwoWeekHigh)
      ? `52W Range: ${quote.fiftyTwoWeekLow} - ${quote.fiftyTwoWeekHigh}`
      : '52W Range: N/A';

    const prompt = `Analyze ${tickerUpper} stock for swing trading.

Current Price: ${quote.price} NOK
Change: ${quote.changePercent?.toFixed(2)}%
${rangeStr}
${volumeStr}

Recent News:
${newsContext || 'No recent news available'}

Provide:
1. Overall sentiment (bullish/neutral/bearish)
2. Confidence level (0-100)
3. 3-5 key points for swing trading decision
4. Brief analysis (2-3 sentences)

Format response as JSON:
{
  "sentiment": "bullish|neutral|bearish",
  "confidence": 0-100,
  "key_points": ["point1", "point2", ...],
  "analysis": "brief analysis text"
}`;

    const message = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;
    let analysisData;

    try {
      // Try to parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback if JSON parsing fails
      analysisData = {
        sentiment: 'neutral',
        confidence: 50,
        key_points: ['Analysis format error'],
        analysis: responseText
      };
    }

    // Save to cache
    await saveAnalysis(
      tickerUpper,
      analysisData.analysis,
      analysisData.sentiment,
      analysisData.confidence,
      analysisData.key_points,
      parseInt(process.env.AI_CACHE_DURATION_MINUTES || 30)
    );

    res.json({
      success: true,
      data: analysisData,
      cached: false
    });

  } catch (error) {
    console.error('Error generating analysis:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// News Routes

app.get('/api/news', async (req, res) => {
  try {
    const { ticker, limit = 50 } = req.query;
    const news = await getNews(ticker?.toUpperCase(), parseInt(limit));
    res.json({ success: true, data: news });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/news/latest', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const news = await getLatestNews(parseInt(hours));
    res.json({ success: true, data: news });
  } catch (error) {
    console.error('Error fetching latest news:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual news refresh endpoint
app.post('/api/news/refresh', async (req, res) => {
  try {
    console.log('[News Refresh] Starting manual refresh...');

    // Step 1: Get top movers
    const topMovers = await getTopMovers(25);
    console.log(`[News Refresh] Found ${topMovers.length} top movers`);

    if (topMovers.length === 0) {
      return res.json({
        success: true,
        message: 'No significant market movers found today',
        stats: {
          tickersScraped: 0,
          totalNewsFound: 0,
          newItems: 0,
          errors: 0
        },
        topMovers: []
      });
    }

    // Step 2: Scrape news for top movers
    const allNews = [];
    const errors = [];

    for (const mover of topMovers) {
      try {
        const news = await scrapeNewsweb(mover.ticker, 10);
        allNews.push(...news);
      } catch (error) {
        errors.push({ ticker: mover.ticker, error: error.message });
      }
    }

    console.log(`[News Refresh] Scraped ${allNews.length} news items`);

    // Step 3: Filter out duplicates (check if already in database)
    const newItems = [];
    for (const item of allNews) {
      const existing = await db.get('SELECT id FROM news WHERE link = ?', [item.link]);
      if (!existing) {
        newItems.push(item);
      }
    }

    console.log(`[News Refresh] ${newItems.length} new items (${allNews.length - newItems.length} already in database)`);

    // Step 4: Analyze sentiment for new items
    let sentiments = [];
    if (newItems.length > 0) {
      console.log('[News Refresh] Analyzing sentiment...');
      sentiments = await analyzeBatchSentiment(newItems);
    }

    // Step 5: Save to database with sentiment
    let insertedCount = 0;
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const sentiment = sentiments[i] || { sentiment: 'neutral', confidence: 0.0 };

      try {
        const result = await saveNews({
          ...item,
          sentiment: sentiment.sentiment,
          ai_confidence: sentiment.confidence
        });

        if (result.changes > 0) insertedCount++;
      } catch (error) {
        console.error(`[News Refresh] Error saving item: ${error.message}`);
      }
    }

    console.log(`[News Refresh] ✓ Inserted ${insertedCount} new items`);

    res.json({
      success: true,
      message: `Successfully scraped ${insertedCount} new articles from ${topMovers.length} active stocks`,
      stats: {
        tickersScraped: topMovers.length,
        totalNewsFound: allNews.length,
        newItems: insertedCount,
        errors: errors.length
      },
      topMovers: topMovers.slice(0, 10).map(m => ({
        ticker: m.ticker,
        name: m.name,
        priceChange: `${m.priceChangePercent.toFixed(2)}%`,
        volumeSpike: `${m.volumeSpike.toFixed(2)}x`
      }))
    });

  } catch (error) {
    console.error('[News Refresh] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Insider Trading

app.get('/api/insider/transactions', async (req, res) => {
  try {
    const { ticker, days = 90 } = req.query;
    const transactions = await getInsiderTransactions(
      ticker?.toUpperCase(),
      parseInt(days)
    );

    res.json({
      success: true,
      data: transactions,
      count: transactions.length
    });
  } catch (error) {
    console.error('Error fetching insider transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/insider/summary/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { days = 30 } = req.query;

    const summary = await getInsiderSummary(ticker.toUpperCase(), parseInt(days));
    const scoreData = await insiderScoring.calculateInsiderScore(ticker.toUpperCase(), parseInt(days));
    const recentTransactions = await getInsiderTransactions(ticker.toUpperCase(), parseInt(days));

    res.json({
      success: true,
      ticker: ticker.toUpperCase(),
      days: parseInt(days),
      summary,
      score: scoreData.score,
      signal: insiderScoring.getInsiderSignal(scoreData.score),
      scoreDetails: {
        seniorBuys: scoreData.seniorBuys,
        largeBuys: scoreData.largeBuys,
        recentBuys: scoreData.recentBuys
      },
      recentTransactions: recentTransactions.slice(0, 10)
    });
  } catch (error) {
    console.error(`Error fetching insider summary for ${req.params.ticker}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/insider/top-buys', async (req, res) => {
  try {
    const { days = 7, limit = 10 } = req.query;

    const opportunities = await insiderScoring.getTopInsiderOpportunities(
      parseInt(days),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: opportunities,
      count: opportunities.length,
      period: `Last ${days} days`
    });
  } catch (error) {
    console.error('Error fetching top insider buys:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Parse insider transactions from news (automatic background job)
app.post('/api/insider/parse-from-news', async (req, res) => {
  try {
    console.log('[Insider Parser] Starting parse from news with Puppeteer scraping...');

    // Get recent news (last 30 days to catch all insider transactions)
    const recentNews = await getLatestNews(720); // Last 30 days

    // Filter for insider-related news first (to avoid unnecessary scraping)
    const insiderNews = recentNews.filter(news => insiderParser.isInsiderTransaction(news));
    console.log(`[Insider Parser] Found ${insiderNews.length} insider-related news items`);

    if (insiderNews.length === 0) {
      return res.json({
        success: true,
        parsed: 0,
        saved: 0,
        skipped: 0,
        message: 'No insider-related news found'
      });
    }

    // Scrape full content from Newsweb for each insider news item
    console.log(`[Insider Parser] Scraping content from ${insiderNews.length} Newsweb articles...`);
    const transactions = [];

    for (const newsItem of insiderNews) {
      try {
        // Scrape full content if we have a link
        if (newsItem.link) {
          console.log(`[Insider Parser] Scraping ${newsItem.ticker}: ${newsItem.link}`);
          const scrapedContent = await newswebScraper.scrapeNewswebArticle(newsItem.link);

          if (scrapedContent) {
            // Create enriched news item with scraped content
            const enrichedNews = {
              ...newsItem,
              content: scrapedContent
            };

            // Parse the transaction with full content
            const transaction = insiderParser.parseInsiderTransaction(enrichedNews);
            if (transaction) {
              transactions.push(transaction);
            }
          }
        }
      } catch (error) {
        console.error(`[Insider Parser] Error processing ${newsItem.ticker}:`, error.message);
      }
    }

    console.log(`[Insider Parser] Parsed ${transactions.length} insider transactions from scraped content`);

    // Save to database
    let savedCount = 0;
    for (const transaction of transactions) {
      try {
        const result = await saveInsiderTransaction(transaction);
        if (result.changes > 0) savedCount++;
      } catch (error) {
        console.error('[Insider Parser] Error saving transaction:', error.message);
      }
    }

    console.log(`[Insider Parser] ✓ Saved ${savedCount} new insider transactions`);

    // Close browser to free resources
    await newswebScraper.closeBrowser();

    res.json({
      success: true,
      parsed: transactions.length,
      saved: savedCount,
      skipped: transactions.length - savedCount
    });
  } catch (error) {
    console.error('[Insider Parser] Error:', error);
    await newswebScraper.closeBrowser();
    res.status(500).json({ success: false, error: error.message });
  }
});

// Recommendations

app.get('/api/recommendations', async (req, res) => {
  try {
    // Check cache first
    let cachedRecs = await getCachedRecommendations();

    if (cachedRecs.length > 0) {
      return res.json({
        success: true,
        data: cachedRecs.slice(0, 5),
        cached: true,
        lastUpdate: cachedRecs[0].created_at
      });
    }

    // Clean old recommendations
    await clearOldRecommendations();

    // Get portfolio tickers to EXCLUDE them
    const portfolio = await getPortfolio();
    const portfolioTickers = new Set(portfolio.map(p => p.ticker));

    console.log(`📊 Analyzing Oslo Børs stocks (excluding ${portfolioTickers.size} portfolio holdings)...`);

    // Use major liquid Oslo Børs tickers to avoid rate limiting
    const majorTickers = [
      'EQNR', 'MOWI', 'DNB', 'TEL', 'YAR', 'VAR', 'ORK', 'SALM', 'NHY',
      'AKSO', 'BAKKA', 'SUBC', 'XXL', 'KOG', 'AUTOSTR', 'SCATC', 'KAHOT',
      'NONG', 'TGS', 'AUSS', 'BORR', 'RECSI', 'ADEVNT', 'SDSD', 'AFG',
      'MPCC', 'FLNG', 'GOGL', 'PARB', 'HAFNI', 'AKRBP', 'PGS', 'SHLF',
      'WWI', 'REACH', 'NSKOG', 'GJF', 'STB', 'BOUV', 'MULTI'
    ];

    // Get full ticker objects for the major tickers
    const allTickersData = tickersData.tickers || [];
    const allTickers = allTickersData.filter(t => majorTickers.includes(t.symbol));

    console.log(`🔍 Screening ${allTickers.length} major liquid stocks...`);

    // Filter candidates
    const candidates = [];
    let rateLimitErrors = 0;

    for (const tickerObj of allTickers) {
      const ticker = tickerObj.symbol;

      // Skip if already in portfolio
      if (portfolioTickers.has(ticker)) {
        continue;
      }

      try {
        const quote = await priceService.getStockQuote(ticker);

        // Debug: log what we got
        console.log(`  ${ticker}: price=${quote.price}, vol=${quote.volume || 'N/A'}, source=${quote.source}`);

        // Filter by price range (5-1000 NOK)
        if (!quote.price || quote.price < 5 || quote.price > 1000) {
          console.log(`    ✗ Filtered out: price out of range`);
          continue;
        }

        // Volume filtering (more lenient if from Finnhub which doesn't always have volume)
        const minVolume = quote.source === 'finnhub' ? 1000 : 10000;
        if (quote.volume && quote.volume < minVolume) {
          console.log(`    ✗ Filtered out: volume too low`);
          continue;
        }

        // Get recent news count
        const recentNews = await getNews(ticker, 5);
        const newsCount = recentNews.length;

        // Calculate volume spike if volume data available
        const volumeSpike = quote.averageVolume && quote.volume && quote.averageVolume > 0
          ? quote.volume / quote.averageVolume
          : 1;

        // Get insider activity score (last 30 days)
        let insiderScore = 0;
        let insiderSignal = null;
        try {
          const insiderData = await insiderScoring.calculateInsiderScore(ticker, 30);
          insiderScore = insiderData.score || 0;
          insiderSignal = insiderScoring.getInsiderSignal(insiderScore);
        } catch (error) {
          // No insider data available
        }

        candidates.push({
          ticker,
          name: tickerObj.name,
          sector: tickerObj.sector,
          price: quote.price,
          volume: quote.volume,
          volumeSpike,
          newsCount,
          quote,
          recentNews,
          insiderScore,
          insiderSignal,
          // Scoring: prioritize volume spikes, recent news, and insider activity
          score: (volumeSpike * 10) + (newsCount * 5) + (insiderScore * 0.5) + Math.random()
        });

      } catch (error) {
        // Track rate limit errors
        if (error.message.includes('Too Many Requests')) {
          rateLimitErrors++;
        }
        // Skip stocks with errors (delisted, suspended, etc.)
        console.log(`  ${ticker}: ✗ Error - ${error.message}`);
        continue;
      }
    }

    console.log(`✓ Found ${candidates.length} eligible candidates (${rateLimitErrors} rate limit errors)`);

    // If we got mostly rate limit errors, use news-based fallback
    if (candidates.length === 0 && rateLimitErrors > allTickers.length * 0.5) {
      console.log(`⚠️  Yahoo Finance rate limited. Using news-based recommendations...`);

      const recommendations = [];

      // Get tickers with most recent news
      const newsBasedCandidates = await new Promise((resolve, reject) => {
        db.all(`
          SELECT ticker, COUNT(*) as news_count, MAX(published_date) as latest_news
          FROM news
          WHERE ticker IN (${majorTickers.map(t => `'${t}'`).join(',')})
            AND ticker NOT IN (${Array.from(portfolioTickers).map(t => `'${t}'`).join(',') || "''"})
            AND published_date >= datetime('now', '-7 days')
          GROUP BY ticker
          HAVING news_count >= 2
          ORDER BY news_count DESC, latest_news DESC
          LIMIT 10
        `, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      console.log(`📰 Found ${newsBasedCandidates.length} stocks with recent news activity`);

      if (newsBasedCandidates.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: 'Yahoo Finance is temporarily unavailable. No recent news activity to base recommendations on.'
        });
      }

      // Generate recommendations based on news sentiment
      for (const candidate of newsBasedCandidates) {
        const tickerObj = allTickersData.find(t => t.symbol === candidate.ticker);
        if (!tickerObj) continue;

        const recentNews = await getNews(candidate.ticker, 5);
        const newsContext = recentNews
          .map(n => `- ${n.title} (${n.published_date}, sentiment: ${n.sentiment || 'neutral'})`)
          .join('\n');

        // Get insider activity score
        let insiderScore = 0;
        let insiderSignal = null;
        try {
          const insiderData = await insiderScoring.calculateInsiderScore(candidate.ticker, 30);
          insiderScore = insiderData.score || 0;
          insiderSignal = insiderScoring.getInsiderSignal(insiderScore);
        } catch (error) {
          // No insider data available
        }

        const insiderContext = insiderScore > 0
          ? `\nInsider Activity (Last 30 days):
Signal: ${insiderSignal}
Score: ${insiderScore}/100
${insiderScore >= 65 ? '⚠️ STRONG INSIDER BUYING - Very bullish!' : insiderScore >= 50 ? '✓ Moderate insider buying' : 'Some insider activity'}`
          : '';

        // Simplified prompt for news-only analysis
        const prompt = `You are a professional swing trader analyzing Norwegian stocks (Oslo Børs).

Stock: ${candidate.ticker} (${tickerObj.name})
Sector: ${tickerObj.sector || 'Unknown'}

Recent News Activity (${candidate.news_count} articles in last 7 days):
${newsContext}${insiderContext}

Note: Market data temporarily unavailable. Base your analysis on news sentiment, company developments, and insider activity.

Provide a swing trade recommendation in JSON format:
{
  "recommendation": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "AVOID",
  "confidence": 0-100,
  "reasoning": [
    "Point 1",
    "Point 2",
    "Point 3"
  ]
}

Only recommend if confidence > 50. Focus on news-driven catalysts.`;

        try {
          const message = await anthropic.messages.create({
            model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            messages: [{
              role: 'user',
              content: prompt
            }]
          });

          const responseText = message.content[0].text;
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);

          if (jsonMatch) {
            const analysis = JSON.parse(jsonMatch[0]);

            if (analysis.confidence > 50) {
              const recommendation = {
                ticker: candidate.ticker,
                name: tickerObj.name,
                sector: tickerObj.sector || 'Unknown',
                recommendation: analysis.recommendation,
                confidence: analysis.confidence,
                reasoning: analysis.reasoning,
                news_count: candidate.news_count,
                latest_news: candidate.latest_news,
                insider_score: insiderScore,
                insider_signal: insiderSignal
              };

              // Save to database
              await saveRecommendation(recommendation);
              recommendations.push(recommendation);
            }
          }
        } catch (error) {
          console.error(`Error analyzing ${candidate.ticker}:`, error.message);
        }
      }

      console.log(`✅ Generated ${recommendations.length} news-based recommendations`);

      return res.json({
        success: true,
        data: recommendations.slice(0, 5),
        news_based: true,
        message: `Generated ${recommendations.length} recommendations based on recent news activity (market data temporarily unavailable)`
      });
    }

    if (candidates.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No eligible stocks found. Try adjusting filter criteria.'
      });
    }

    // Sort by score and take top 10
    candidates.sort((a, b) => b.score - a.score);
    const topCandidates = candidates.slice(0, 10);

    console.log(`🔍 Analyzing top 10 candidates with Claude AI...`);

    const recommendations = [];

    // Analyze each candidate with Claude
    for (const candidate of topCandidates) {
      try {
        const newsContext = candidate.recentNews
          .map(n => `- ${n.title} (${n.published_date})`)
          .join('\n');

        // Insider activity context
        const insiderContext = candidate.insiderScore > 0
          ? `\nInsider Activity (Last 30 days):
Signal: ${candidate.insiderSignal}
Score: ${candidate.insiderScore}/100
${candidate.insiderScore >= 65 ? '⚠️ STRONG INSIDER BUYING DETECTED - This is a very bullish signal!' : candidate.insiderScore >= 50 ? '✓ Moderate insider buying activity' : candidate.insiderScore > 0 ? 'Some insider activity present' : ''}`
          : '';

        // Claude API prompt
        const prompt = `You are a professional swing trader analyzing Norwegian stocks (Oslo Børs).

Stock: ${candidate.ticker} (${candidate.name})
Sector: ${candidate.sector}
Current Price: ${candidate.price} NOK
Change: ${candidate.quote.regularMarketChangePercent?.toFixed(2)}%
52W Range: ${candidate.quote.fiftyTwoWeekLow} - ${candidate.quote.fiftyTwoWeekHigh}
Volume: ${candidate.volume.toLocaleString()}
Volume Spike: ${candidate.volumeSpike.toFixed(2)}x average${insiderContext}

Recent News:
${newsContext || 'No recent news available'}

Provide a swing trade recommendation in JSON format:
{
  "recommendation": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "AVOID",
  "confidence": 0-100,
  "entry_range": [min_price, max_price],
  "target_price": number,
  "stop_loss": number,
  "hold_period": "2-3 months" (text),
  "position_size_percent": 5-20,
  "risk_reward_ratio": "1:2.5" (text),
  "reasoning": [
    "Point 1",
    "Point 2",
    "Point 3"
  ]
}

Only recommend if confidence > 50. Focus on actionable swing trades (2-6 month hold).`;

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
            const recData = JSON.parse(jsonMatch[0]);

            // Only include if confidence > 50
            if (recData.confidence > 50) {
              const fullData = {
                ticker: candidate.ticker,
                ...recData,
                insider_score: candidate.insiderScore,
                insider_signal: candidate.insiderSignal
              };

              // Save to cache
              await saveRecommendation(fullData, 4);
              recommendations.push(fullData);
              console.log(`  ✓ ${candidate.ticker}: ${recData.recommendation} (${recData.confidence}%) ${candidate.insiderScore > 0 ? `[Insider: ${candidate.insiderScore}]` : ''}`);
            } else {
              console.log(`  ✗ ${candidate.ticker}: Low confidence (${recData.confidence}%)`);
            }
          }
        } catch (parseError) {
          console.error(`Error parsing recommendation for ${candidate.ticker}:`, parseError);
        }

      } catch (error) {
        console.error(`Error analyzing ${candidate.ticker}:`, error.message);
      }
    }

    // Sort by confidence and return top 5
    recommendations.sort((a, b) => b.confidence - a.confidence);
    const topRecs = recommendations.slice(0, 5);

    console.log(`🎯 Generated ${topRecs.length} high-confidence recommendations`);

    res.json({
      success: true,
      data: topRecs,
      cached: false,
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Chat Endpoint

app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Gather context: Portfolio
    const portfolio = await getPortfolio();
    let portfolioSummary = 'No positions in portfolio yet.';

    if (portfolio.length > 0) {
      portfolioSummary = portfolio.map(p => {
        const pl = p.current_price
          ? ((p.current_price - p.avg_buy_price) / p.avg_buy_price * 100).toFixed(2)
          : 'N/A';
        return `- ${p.ticker} (${p.company_name}): ${p.shares} shares @ ${p.avg_buy_price} NOK (Current: ${p.current_price || 'N/A'} NOK, P/L: ${pl}%)`;
      }).join('\n');
    }

    // Gather context: Recent news (last 24 hours)
    const recentNews = await getLatestNews(24);
    let newsContext = 'No recent news available.';

    if (recentNews.length > 0) {
      newsContext = recentNews.slice(0, 10).map(n =>
        `- [${n.ticker}] ${n.title} (${new Date(n.published_date).toLocaleDateString('no-NO')})`
      ).join('\n');
    }

    // Gather context: Current recommendations
    const cachedRecs = await getCachedRecommendations();
    let recsContext = 'No active recommendations.';

    if (cachedRecs.length > 0) {
      recsContext = cachedRecs.slice(0, 5).map(r =>
        `- ${r.ticker}: ${r.recommendation} (Confidence: ${r.confidence}%, Target: ${r.target_price} NOK)`
      ).join('\n');
    }

    // Build conversation history
    let historyContext = '';
    if (conversationHistory.length > 0) {
      historyContext = conversationHistory
        .slice(-10) // Last 10 messages
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');
    }

    // Claude API prompt
    const systemPrompt = `You are an expert swing trading advisor for Oslo Børs (Norwegian stocks).

User's Portfolio:
${portfolioSummary}

Recent Market News (Last 24 Hours):
${newsContext}

AI Recommendations:
${recsContext}

${historyContext ? `Conversation History:\n${historyContext}\n` : ''}
User Question: ${message}

Provide concise, actionable trading advice. Include:
- Specific price levels (entry, target, stop loss) when relevant
- Time horizons (hold period)
- Risk assessment
- Position sizing if suggesting a trade
- Support your advice with data from the portfolio, news, or recommendations above

Keep responses under 200 words. Be direct and practical. Use Norwegian terms when the user speaks Norwegian.`;

    const apiMessage = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: systemPrompt
        }
      ]
    });

    const assistantResponse = apiMessage.content[0].text;

    res.json({
      success: true,
      response: assistantResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Screener

app.get('/api/screener/results', (req, res) => {
  try {
    // This will be populated by the screener agent
    // For now, return placeholder
    res.json({
      success: true,
      data: [],
      message: 'Screener results will be populated by the screener agent'
    });
  } catch (error) {
    console.error('Error fetching screener results:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tips & Insights

app.get('/api/tips-insights', async (req, res) => {
  try {
    const { ticker, type, limit = 10 } = req.query;

    // Check cache first
    const cachedTips = await getCachedTips(ticker, type, parseInt(limit));

    if (cachedTips.length > 0) {
      return res.json({
        success: true,
        data: cachedTips,
        cached: true,
        lastUpdate: cachedTips[0].created_at
      });
    }

    // If no cached tips, return empty for now (agent will populate)
    res.json({
      success: true,
      data: [],
      cached: false,
      message: 'Tips will be generated by the tips-insights agent. Run the agent or wait for the next scheduled generation.'
    });

  } catch (error) {
    console.error('Error fetching tips:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tips-insights/daily-digest', async (req, res) => {
  try {
    // Get all cached tips
    const allTips = await getCachedTips(null, null, 50);

    if (allTips.length === 0) {
      return res.json({
        success: true,
        data: {
          insights: [],
          alerts: [],
          warnings: [],
          suggestions: []
        },
        cached: false,
        message: 'No tips available. Agent needs to run first.'
      });
    }

    // Group tips by type
    const insights = allTips.filter(t => t.tip_type === 'daily_insight');
    const alerts = allTips.filter(t => t.tip_type === 'smart_alert');
    const warnings = allTips.filter(t => t.tip_type === 'risk_warning');
    const suggestions = allTips.filter(t => t.tip_type === 'entry_exit');

    res.json({
      success: true,
      data: {
        insights,
        alerts,
        warnings,
        suggestions
      },
      cached: true,
      lastUpdate: allTips[0].created_at
    });

  } catch (error) {
    console.error('Error fetching daily digest:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tips-insights/refresh', async (req, res) => {
  try {
    const { ticker } = req.body;

    // This will trigger generation (for now, just clear cache to force regeneration)
    await clearOldTips();

    res.json({
      success: true,
      message: `Tips refresh requested${ticker ? ` for ${ticker}` : ''}. The tips-insights agent will regenerate on next run.`
    });

  } catch (error) {
    console.error('Error refreshing tips:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analytics

app.get('/api/analytics/overview', async (req, res) => {
  try {
    // Check cache first
    const cached = await getCachedAnalytics('overview');

    if (cached && cached.metric_data) {
      return res.json({
        success: true,
        data: cached.metric_data,
        cached: true,
        lastUpdate: cached.created_at
      });
    }

    // Calculate all metrics
    const [winRate, avgHoldTime, sectorPerformance, monthlyPL] = await Promise.all([
      calculateWinRate(),
      calculateAvgHoldTime(),
      calculateSectorPerformance(),
      calculateMonthlyPL(12)
    ]);

    const overviewData = {
      winRate: winRate.winRate,
      winningTrades: winRate.winningTrades,
      losingTrades: winRate.losingTrades,
      totalTrades: winRate.totalTrades,
      avgHoldTimeDays: avgHoldTime.avgHoldTimeDays,
      totalClosedPositions: avgHoldTime.totalClosedPositions,
      sectorPerformance,
      monthlyPL
    };

    // Cache for 1 hour
    await saveAnalyticsCache('overview', null, overviewData, 1);

    res.json({
      success: true,
      data: overviewData,
      cached: false,
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/analytics/risk-adjusted', async (req, res) => {
  try {
    // Check cache first
    const cached = await getCachedAnalytics('risk_adjusted');

    if (cached && cached.metric_data) {
      return res.json({
        success: true,
        data: cached.metric_data,
        cached: true,
        lastUpdate: cached.created_at
      });
    }

    // Calculate Sharpe ratio and other risk metrics
    const sharpeData = await calculateSharpeRatio();

    // Get portfolio history for max drawdown calculation
    const history = await getPortfolioHistory(90);

    let maxDrawdown = 0;
    if (history.length > 1) {
      let peak = history[0].value;
      history.forEach(snapshot => {
        if (snapshot.value > peak) {
          peak = snapshot.value;
        }
        const drawdown = ((peak - snapshot.value) / peak) * 100;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      });
    }

    const riskAdjustedData = {
      sharpeRatio: sharpeData.sharpeRatio,
      volatility: sharpeData.volatility,
      annualizedReturns: sharpeData.returns,
      maxDrawdown: Math.round(maxDrawdown * 10) / 10
    };

    // Cache for 1 hour
    await saveAnalyticsCache('risk_adjusted', sharpeData.sharpeRatio, riskAdjustedData, 1);

    res.json({
      success: true,
      data: riskAdjustedData,
      cached: false,
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching risk-adjusted metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/analytics/benchmark', async (req, res) => {
  try {
    // Check cache first
    const cached = await getCachedAnalytics('benchmark');

    if (cached && cached.metric_data) {
      return res.json({
        success: true,
        data: cached.metric_data,
        cached: true,
        lastUpdate: cached.created_at
      });
    }

    // Get portfolio history
    const portfolioHistory = await getPortfolioHistory(90);

    if (portfolioHistory.length === 0) {
      return res.json({
        success: true,
        data: {
          portfolioPerformance: [],
          benchmarkPerformance: [],
          relativePerformance: 0
        },
        cached: false,
        message: 'No portfolio history available'
      });
    }

    // Fetch OSEBX benchmark data (Oslo Børs Index) - uses 24-hour cache
    try {
      const { data: osebxData, cached: benchmarkCached } = await priceService.getBenchmarkHistory('^OSEBX', 90);

      if (benchmarkCached) {
        console.log('[Benchmark] Using cached OSEBX data');
      }

      // Normalize both to percentage change from start
      const portfolioStart = portfolioHistory[0].value;
      const osebxStart = osebxData[0]?.close || 1;

      const portfolioPerformance = portfolioHistory.map(snapshot => ({
        date: snapshot.date,
        value: ((snapshot.value - portfolioStart) / portfolioStart) * 100
      }));

      const benchmarkPerformance = osebxData.map(day => ({
        date: day.date.toISOString().split('T')[0],
        value: ((day.close - osebxStart) / osebxStart) * 100
      }));

      // Calculate relative performance (last data points)
      const portfolioFinal = portfolioPerformance[portfolioPerformance.length - 1]?.value || 0;
      const benchmarkFinal = benchmarkPerformance[benchmarkPerformance.length - 1]?.value || 0;
      const relativePerformance = portfolioFinal - benchmarkFinal;

      const benchmarkData = {
        portfolioPerformance,
        benchmarkPerformance,
        relativePerformance: Math.round(relativePerformance * 10) / 10
      };

      // Cache for 1 hour
      await saveAnalyticsCache('benchmark', relativePerformance, benchmarkData, 1);

      res.json({
        success: true,
        data: benchmarkData,
        cached: false,
        lastUpdate: new Date().toISOString()
      });

    } catch (benchmarkError) {
      console.error('Error fetching OSEBX data:', benchmarkError);

      // Return portfolio data only
      const portfolioStart = portfolioHistory[0].value;
      const portfolioPerformance = portfolioHistory.map(snapshot => ({
        date: snapshot.date,
        value: ((snapshot.value - portfolioStart) / portfolioStart) * 100
      }));

      res.json({
        success: true,
        data: {
          portfolioPerformance,
          benchmarkPerformance: [],
          relativePerformance: 0
        },
        cached: false,
        message: 'Benchmark data unavailable'
      });
    }

  } catch (error) {
    console.error('Error fetching benchmark comparison:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Notifications

app.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await getUnreadNotifications();

    res.json({
      success: true,
      data: notifications.map(n => ({
        ...n,
        read_status: n.read_status === 1
      })),
      count: notifications.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/notifications/all', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const notifications = await getAllNotifications(parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      data: notifications.map(n => ({
        ...n,
        read_status: n.read_status === 1
      })),
      count: notifications.length
    });
  } catch (error) {
    console.error('Error fetching all notifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/notifications/mark-read/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await markNotificationRead(parseInt(id));

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/notifications/mark-all-read', async (req, res) => {
  try {
    const result = await markAllNotificationsRead();

    res.json({
      success: true,
      message: `Marked ${result.changes} notifications as read`
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/notifications/clear', async (req, res) => {
  try {
    const result = await clearAllNotifications();

    res.json({
      success: true,
      message: `Cleared ${result.changes} notifications`
    });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/notifications/preferences', async (req, res) => {
  try {
    const preferences = await getNotificationPreferences();

    res.json({
      success: true,
      data: preferences.map(p => ({
        ...p,
        enabled: p.enabled === 1
      }))
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/notifications/preferences', async (req, res) => {
  try {
    const { notification_type, enabled, ticker, threshold_value, threshold_type } = req.body;

    const result = await saveNotificationPreference({
      notification_type,
      enabled,
      ticker,
      threshold_value,
      threshold_type
    });

    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: 'Preference saved'
    });
  } catch (error) {
    console.error('Error saving notification preference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/notifications/preferences/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, threshold_value, threshold_type } = req.body;

    await updateNotificationPreference(parseInt(id), {
      enabled,
      threshold_value,
      threshold_type
    });

    res.json({
      success: true,
      message: 'Preference updated'
    });
  } catch (error) {
    console.error('Error updating notification preference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/notifications/preferences/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteNotificationPreference(parseInt(id));

    res.json({
      success: true,
      message: 'Preference deleted'
    });
  } catch (error) {
    console.error('Error deleting notification preference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Data source status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const status = priceService.getDataSourceStatus();

    // Test Finnhub connection if configured
    if (finnhub.isFinnhubConfigured()) {
      status.finnhub.tested = await finnhub.testConnection();
    }

    res.json({
      success: true,
      dataSources: status,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${process.env.DATABASE_PATH || './database/trading.db'}`);
  console.log(`🤖 Claude Model: ${process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'}`);

  // Test Finnhub connection on startup
  if (finnhub.isFinnhubConfigured()) {
    console.log(`📈 Testing Finnhub connection...`);
    const finnhubWorking = await finnhub.testConnection();
    if (finnhubWorking) {
      console.log(`✓ Finnhub API ready (primary data source)`);
    } else {
      console.log(`⚠️  Finnhub connection failed, will use Yahoo Finance as fallback`);
    }
  } else {
    console.log(`⚠️  Finnhub not configured, using Yahoo Finance only`);
    console.log(`   Add FINNHUB_API_KEY to .env to enable Finnhub (recommended)`);
  }
});

// Cron Jobs

// Daily portfolio snapshot at 18:30 (after market close at 16:20)
cron.schedule('30 18 * * *', async () => {
  console.log('📸 Running daily portfolio snapshot...');
  try {
    const result = await savePortfolioSnapshot();
    if (result.success) {
      console.log(`✓ Snapshot saved: ${result.totalValue.toFixed(0)} NOK (${result.positionCount} positions)`);
    }
  } catch (error) {
    console.error('✗ Error in daily snapshot:', error);
  }
});

// Clean old history records every Sunday at midnight (keep 90 days)
cron.schedule('0 0 * * 0', async () => {
  console.log('🧹 Cleaning old portfolio history...');
  try {
    const result = await clearOldHistory(90);
    console.log(`✓ Cleaned ${result.changes} old records`);
  } catch (error) {
    console.error('✗ Error cleaning history:', error);
  }
});

console.log('⏰ Cron jobs scheduled:');
console.log('   - Daily snapshot: 18:30');
console.log('   - Clean history: Sundays 00:00');

// Auto-start agents with server (controlled by START_AGENTS env variable)
// Set START_AGENTS=false to disable auto-start
if (process.env.START_AGENTS !== 'false') {
  try {
    startAllAgents();
  } catch (error) {
    console.error('⚠️  Failed to start agents:', error.message);
    console.log('   Server will continue without agents. Run "npm run agents" separately.');
  }
} else {
  console.log('ℹ️  Agents disabled (START_AGENTS=false). Run "npm run agents" separately.');
}

export default app;
