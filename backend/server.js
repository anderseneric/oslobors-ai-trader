import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import yahooFinance from 'yahoo-finance2';
import Anthropic from '@anthropic-ai/sdk';
import cron from 'node-cron';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getTopMovers } from './services/top-movers.js';
import { analyzeBatchSentiment } from './services/sentiment-analyzer.js';
import { scrapeNewsweb } from '../mcp-servers/news-scraper/scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  saveNotification,
  getUnreadNotifications,
  getAllNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  saveNotificationPreference,
  updateNotificationPreference,
  deleteNotificationPreference
} from './database.js';

dotenv.config();

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

    if (!ticker || !shares || !avg_buy_price || !purchase_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: ticker, shares, avg_buy_price, purchase_date'
      });
    }

    // Fetch current price and company name
    const tickerSymbol = `${ticker}.OL`;
    const quote = await yahooFinance.quote(tickerSymbol);

    const result = await addToPortfolio({
      ticker: ticker.toUpperCase(),
      company_name: quote.longName || quote.shortName || ticker,
      shares: parseInt(shares),
      avg_buy_price: parseFloat(avg_buy_price),
      current_price: quote.regularMarketPrice,
      purchase_date,
      notes: notes || null,
      transaction_fees: transaction_fees ? parseFloat(transaction_fees) : 0
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

    for (const position of portfolio) {
      try {
        const tickerSymbol = `${position.ticker}.OL`;
        const quote = await yahooFinance.quote(tickerSymbol);

        if (quote.regularMarketPrice) {
          await updatePortfolioPrice(position.ticker, quote.regularMarketPrice);
          updates.push({
            ticker: position.ticker,
            price: quote.regularMarketPrice,
            previousPrice: position.current_price
          });
        }
      } catch (error) {
        console.error(`Error updating ${position.ticker}:`, error.message);
        errors.push({ ticker: position.ticker, error: error.message });
      }
    }

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

// Stock Routes

app.get('/api/stocks/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const tickerSymbol = `${ticker.toUpperCase()}.OL`;

    const quote = await yahooFinance.quote(tickerSymbol);

    res.json({
      success: true,
      data: {
        ticker: ticker.toUpperCase(),
        name: quote.longName || quote.shortName,
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        volume: quote.regularMarketVolume,
        marketCap: quote.marketCap,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        currency: quote.currency
      }
    });
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stocks/:ticker/history', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { days = 90 } = req.query;

    // Check if we have cached data
    let history = await getPriceHistory(ticker.toUpperCase(), parseInt(days));

    // If no cached data or data is old, fetch from Yahoo Finance
    if (history.length === 0) {
      const tickerSymbol = `${ticker.toUpperCase()}.OL`;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      const result = await yahooFinance.historical(tickerSymbol, {
        period1: startDate,
        period2: endDate,
      });

      // Save to database
      for (const item of result) {
        await savePriceHistory({
          ticker: ticker.toUpperCase(),
          date: item.date.toISOString().split('T')[0],
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume
        });
      }

      history = await getPriceHistory(ticker.toUpperCase(), parseInt(days));
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

    // Fetch fresh data for analysis
    const tickerSymbol = `${tickerUpper}.OL`;
    const quote = await yahooFinance.quote(tickerSymbol);

    // Get recent news
    const recentNews = await getNews(tickerUpper, 10);

    // Prepare context for Claude
    const newsContext = recentNews.map(n => `- ${n.title} (${n.published_date})`).join('\n');

    const prompt = `Analyze ${tickerUpper} (${quote.longName}) stock for swing trading.

Current Price: ${quote.regularMarketPrice} ${quote.currency}
Change: ${quote.regularMarketChangePercent?.toFixed(2)}%
52W Range: ${quote.fiftyTwoWeekLow} - ${quote.fiftyTwoWeekHigh}
Volume: ${quote.regularMarketVolume}

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

    // Start with ALL Oslo Børs tickers
    const allTickers = tickersData.tickers || [];

    // Filter candidates
    const candidates = [];

    for (const tickerObj of allTickers) {
      const ticker = tickerObj.symbol;

      // Skip if already in portfolio
      if (portfolioTickers.has(ticker)) {
        continue;
      }

      try {
        const tickerSymbol = `${ticker}.OL`;
        const quote = await yahooFinance.quote(tickerSymbol);

        // Filter by price range (5-1000 NOK)
        if (!quote.regularMarketPrice ||
            quote.regularMarketPrice < 5 ||
            quote.regularMarketPrice > 1000) {
          continue;
        }

        // Filter by volume (> 100,000 shares/day)
        if (!quote.regularMarketVolume || quote.regularMarketVolume < 100000) {
          continue;
        }

        // Get recent news count
        const recentNews = await getNews(ticker, 5);
        const newsCount = recentNews.length;

        // Calculate volume spike (use current volume vs 3-month avg if available)
        const volumeSpike = quote.averageVolume && quote.averageVolume > 0
          ? quote.regularMarketVolume / quote.averageVolume
          : 1;

        candidates.push({
          ticker,
          name: tickerObj.name,
          sector: tickerObj.sector,
          price: quote.regularMarketPrice,
          volume: quote.regularMarketVolume,
          volumeSpike,
          newsCount,
          quote,
          recentNews,
          // Scoring: prioritize volume spikes and recent news
          score: (volumeSpike * 10) + (newsCount * 5) + Math.random()
        });

      } catch (error) {
        // Skip stocks with errors (delisted, suspended, etc.)
        continue;
      }
    }

    console.log(`✓ Found ${candidates.length} eligible candidates`);

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

        // Claude API prompt
        const prompt = `You are a professional swing trader analyzing Norwegian stocks (Oslo Børs).

Stock: ${candidate.ticker} (${candidate.name})
Sector: ${candidate.sector}
Current Price: ${candidate.price} NOK
Change: ${candidate.quote.regularMarketChangePercent?.toFixed(2)}%
52W Range: ${candidate.quote.fiftyTwoWeekLow} - ${candidate.quote.fiftyTwoWeekHigh}
Volume: ${candidate.volume.toLocaleString()}
Volume Spike: ${candidate.volumeSpike.toFixed(2)}x average

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
                ...recData
              };

              // Save to cache
              await saveRecommendation(fullData, 4);
              recommendations.push(fullData);
              console.log(`  ✓ ${candidate.ticker}: ${recData.recommendation} (${recData.confidence}%)`);
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

    // Fetch OSEBX benchmark data (Oslo Børs Index)
    try {
      const firstDate = portfolioHistory[0].date;
      const lastDate = portfolioHistory[portfolioHistory.length - 1].date;

      const osebxData = await yahooFinance.historical('^OSEBX', {
        period1: firstDate,
        period2: lastDate
      });

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
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${process.env.DATABASE_PATH || './database/trading.db'}`);
  console.log(`🤖 Claude Model: ${process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'}`);
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

export default app;
