import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../database/trading.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('✓ Connected to SQLite database');
  }
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

// Promisify other database methods
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

// Enable WAL mode for better concurrency
db.run('PRAGMA journal_mode = WAL', (err) => {
  if (err) console.error('Error setting WAL mode:', err);
});

// Create tables
const initDatabase = async () => {
  try {
    // Portfolio table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS portfolio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        company_name TEXT,
        shares INTEGER NOT NULL,
        avg_buy_price REAL NOT NULL,
        current_price REAL,
        purchase_date TEXT NOT NULL,
        notes TEXT,
        transaction_fees REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add transaction_fees column if it doesn't exist (migration)
    try {
      await dbRun('ALTER TABLE portfolio ADD COLUMN transaction_fees REAL DEFAULT 0');
      console.log('✓ Added transaction_fees column');
    } catch (err) {
      // Column already exists, ignore error
    }

    // Price history table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        date TEXT NOT NULL,
        open REAL,
        high REAL,
        low REAL,
        close REAL NOT NULL,
        volume INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ticker, date)
      )
    `);

    // AI analyses table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS ai_analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        analysis TEXT NOT NULL,
        sentiment TEXT,
        confidence REAL,
        key_points TEXT,
        cached_until TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ticker, cached_until)
      )
    `);

    // News table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT,
        link TEXT UNIQUE,
        content TEXT,
        published_date TEXT NOT NULL,
        source TEXT DEFAULT 'newsweb',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add sentiment columns if they don't exist (migration)
    try {
      await dbRun('ALTER TABLE news ADD COLUMN sentiment TEXT');
    } catch (e) {
      // Column already exists, skip
    }

    try {
      await dbRun('ALTER TABLE news ADD COLUMN ai_confidence REAL');
    } catch (e) {
      // Column already exists, skip
    }

    // Recommendations table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        confidence INTEGER NOT NULL,
        entry_range_min REAL,
        entry_range_max REAL,
        target_price REAL,
        stop_loss REAL,
        hold_period TEXT,
        position_size_percent INTEGER,
        risk_reward_ratio TEXT,
        reasoning TEXT,
        cached_until TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ticker, cached_until)
      )
    `);

    // Portfolio History table (daily snapshots)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS portfolio_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_date TEXT NOT NULL,
        total_value REAL NOT NULL,
        total_cost REAL NOT NULL,
        total_pl REAL NOT NULL,
        total_fees REAL NOT NULL,
        position_count INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(snapshot_date)
      )
    `);

    // Tips & Insights table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS tips_insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tip_type TEXT NOT NULL,
        ticker TEXT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT,
        confidence INTEGER,
        action_required BOOLEAN DEFAULT 0,
        metadata TEXT,
        cached_until TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ticker, tip_type, cached_until)
      )
    `);

    // Trade History table (for analytics)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS trade_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        action TEXT NOT NULL,
        shares INTEGER NOT NULL,
        price REAL NOT NULL,
        fees REAL DEFAULT 0,
        total_value REAL NOT NULL,
        trade_date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Portfolio Analytics Cache table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS portfolio_analytics_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_type TEXT NOT NULL,
        metric_value REAL,
        metric_data TEXT,
        cached_until TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(metric_type, cached_until)
      )
    `);

    // Notification Preferences table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notification_type TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        ticker TEXT,
        threshold_value REAL,
        threshold_type TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Notification History table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS notification_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notification_type TEXT NOT NULL,
        ticker TEXT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT,
        read_status BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better query performance
    await dbRun('CREATE INDEX IF NOT EXISTS idx_portfolio_ticker ON portfolio(ticker)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_price_history_ticker_date ON price_history(ticker, date)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_ai_analyses_ticker ON ai_analyses(ticker)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_news_ticker_date ON news(ticker, published_date)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_recommendations_cached ON recommendations(cached_until)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_portfolio_history_date ON portfolio_history(snapshot_date)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_tips_insights_cached ON tips_insights(cached_until)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_tips_insights_ticker ON tips_insights(ticker)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_trade_history_ticker_date ON trade_history(ticker, trade_date)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_analytics_cache_type ON portfolio_analytics_cache(metric_type, cached_until)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_notification_prefs_type ON notification_preferences(notification_type)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_notification_history_read ON notification_history(read_status, created_at)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_notification_history_ticker ON notification_history(ticker)');

    console.log('✓ Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
};

// Initialize database on import
initDatabase();

// Export database instance and helper functions
export default db;

// Helper functions
export const getPortfolio = async () => {
  return await dbAll('SELECT * FROM portfolio ORDER BY ticker');
};

export const addToPortfolio = async (data) => {
  const result = await dbRun(
    `INSERT INTO portfolio (ticker, company_name, shares, avg_buy_price, current_price, purchase_date, notes, transaction_fees)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.ticker, data.company_name, data.shares, data.avg_buy_price, data.current_price, data.purchase_date, data.notes, data.transaction_fees || 0]
  );
  return { lastInsertRowid: result.lastID, changes: result.changes };
};

export const updatePortfolioPrice = async (ticker, currentPrice) => {
  const result = await dbRun(
    'UPDATE portfolio SET current_price = ?, updated_at = CURRENT_TIMESTAMP WHERE ticker = ?',
    [currentPrice, ticker]
  );
  return { changes: result.changes };
};

export const deleteFromPortfolio = async (id) => {
  const result = await dbRun('DELETE FROM portfolio WHERE id = ?', [id]);
  return { changes: result.changes };
};

export const savePriceHistory = async (data) => {
  const result = await dbRun(
    `INSERT OR REPLACE INTO price_history (ticker, date, open, high, low, close, volume)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.ticker, data.date, data.open, data.high, data.low, data.close, data.volume]
  );
  return { lastInsertRowid: result.lastID, changes: result.changes };
};

export const getPriceHistory = async (ticker, days = 90) => {
  return await dbAll(
    `SELECT * FROM price_history
     WHERE ticker = ?
     ORDER BY date DESC
     LIMIT ?`,
    [ticker, days]
  );
};

export const saveAnalysis = async (ticker, analysis, sentiment, confidence, keyPoints, cacheMinutes = 30) => {
  const cachedUntil = new Date(Date.now() + cacheMinutes * 60 * 1000).toISOString();
  const result = await dbRun(
    `INSERT OR REPLACE INTO ai_analyses (ticker, analysis, sentiment, confidence, key_points, cached_until)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [ticker, analysis, sentiment, confidence, JSON.stringify(keyPoints), cachedUntil]
  );
  return { lastInsertRowid: result.lastID, changes: result.changes };
};

export const getCachedAnalysis = async (ticker) => {
  const analysis = await dbGet(
    `SELECT * FROM ai_analyses
     WHERE ticker = ? AND cached_until > datetime('now')
     ORDER BY created_at DESC
     LIMIT 1`,
    [ticker]
  );

  if (analysis && analysis.key_points) {
    try {
      analysis.key_points = JSON.parse(analysis.key_points);
    } catch (e) {
      console.error('Error parsing key_points:', e);
    }
  }

  return analysis;
};

export const saveNews = async (data) => {
  const result = await dbRun(
    `INSERT OR IGNORE INTO news (ticker, title, category, link, content, published_date, source, sentiment, ai_confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.ticker, data.title, data.category, data.link, data.content, data.published_date, data.source, data.sentiment || null, data.ai_confidence || null]
  );
  return { lastInsertRowid: result.lastID, changes: result.changes };
};

export const getNews = async (ticker = null, limit = 50) => {
  if (ticker) {
    return await dbAll('SELECT * FROM news WHERE ticker = ? ORDER BY published_date DESC LIMIT ?', [ticker, limit]);
  }
  return await dbAll('SELECT * FROM news ORDER BY published_date DESC LIMIT ?', [limit]);
};

export const getLatestNews = async (hours = 24) => {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return await dbAll(
    `SELECT * FROM news
     WHERE published_date > ?
     ORDER BY published_date DESC`,
    [since]
  );
};

export const saveRecommendation = async (data, cacheHours = 4) => {
  const cachedUntil = new Date(Date.now() + cacheHours * 60 * 60 * 1000).toISOString();
  const result = await dbRun(
    `INSERT OR REPLACE INTO recommendations (
      ticker, recommendation, confidence, entry_range_min, entry_range_max,
      target_price, stop_loss, hold_period, position_size_percent,
      risk_reward_ratio, reasoning, cached_until
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.ticker,
      data.recommendation,
      data.confidence,
      data.entry_range?.[0],
      data.entry_range?.[1],
      data.target_price,
      data.stop_loss,
      data.hold_period,
      data.position_size_percent,
      data.risk_reward_ratio,
      JSON.stringify(data.reasoning),
      cachedUntil
    ]
  );
  return { lastInsertRowid: result.lastID, changes: result.changes };
};

export const getCachedRecommendations = async () => {
  const recommendations = await dbAll(
    `SELECT * FROM recommendations
     WHERE cached_until > datetime('now')
     ORDER BY confidence DESC, created_at DESC
     LIMIT 10`
  );

  // Parse reasoning JSON
  return recommendations.map(rec => ({
    ...rec,
    entry_range: [rec.entry_range_min, rec.entry_range_max],
    reasoning: rec.reasoning ? JSON.parse(rec.reasoning) : []
  }));
};

export const clearOldRecommendations = async () => {
  const result = await dbRun(
    `DELETE FROM recommendations WHERE cached_until < datetime('now')`
  );
  return { changes: result.changes };
};

// Portfolio History

export const savePortfolioSnapshot = async () => {
  try {
    // Get all current positions
    const portfolio = await getPortfolio();

    if (portfolio.length === 0) {
      console.log('⚠️  No positions to snapshot');
      return { success: false, message: 'No positions' };
    }

    // Calculate totals
    const totalValue = portfolio.reduce((sum, pos) => sum + (pos.current_price || 0) * pos.shares, 0);
    const totalCost = portfolio.reduce((sum, pos) => sum + pos.avg_buy_price * pos.shares, 0);
    const totalFees = portfolio.reduce((sum, pos) => sum + (pos.transaction_fees || 0), 0);
    const totalPL = totalValue - totalCost - totalFees;

    // Get today's date (Norwegian timezone)
    const snapshotDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Save snapshot (INSERT OR REPLACE to update if exists)
    const result = await dbRun(
      `INSERT OR REPLACE INTO portfolio_history
       (snapshot_date, total_value, total_cost, total_pl, total_fees, position_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [snapshotDate, totalValue, totalCost, totalPL, totalFees, portfolio.length]
    );

    console.log(`✓ Portfolio snapshot saved for ${snapshotDate}`);
    return {
      success: true,
      date: snapshotDate,
      totalValue,
      totalCost,
      totalPL,
      positionCount: portfolio.length
    };
  } catch (error) {
    console.error('Error saving portfolio snapshot:', error);
    throw error;
  }
};

export const getPortfolioHistory = async (days = 30) => {
  try {
    const history = await dbAll(
      `SELECT snapshot_date as date, total_value as value, total_cost as cost,
              total_pl as pl, total_fees as fees, position_count as positions
       FROM portfolio_history
       ORDER BY snapshot_date DESC
       LIMIT ?`,
      [days]
    );

    // Return in chronological order (oldest first)
    return history.reverse();
  } catch (error) {
    console.error('Error fetching portfolio history:', error);
    throw error;
  }
};

export const clearOldHistory = async (daysToKeep = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffString = cutoffDate.toISOString().split('T')[0];

    const result = await dbRun(
      `DELETE FROM portfolio_history WHERE snapshot_date < ?`,
      [cutoffString]
    );

    console.log(`✓ Cleared ${result.changes} old history records (older than ${daysToKeep} days)`);
    return { changes: result.changes };
  } catch (error) {
    console.error('Error clearing old history:', error);
    throw error;
  }
};

// Tips & Insights

export const saveTipInsight = async (data, cacheHours = 2) => {
  const cachedUntil = new Date(Date.now() + cacheHours * 60 * 60 * 1000).toISOString();
  const result = await dbRun(
    `INSERT OR REPLACE INTO tips_insights (
      tip_type, ticker, title, description, severity, confidence,
      action_required, metadata, cached_until
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.tip_type,
      data.ticker || null,
      data.title,
      data.description,
      data.severity,
      data.confidence,
      data.action_required ? 1 : 0,
      data.metadata ? JSON.stringify(data.metadata) : null,
      cachedUntil
    ]
  );
  return { lastInsertRowid: result.lastID, changes: result.changes };
};

export const getCachedTips = async (ticker = null, type = null, limit = 10) => {
  let query = `SELECT * FROM tips_insights WHERE cached_until > datetime('now')`;
  const params = [];

  if (ticker) {
    query += ` AND ticker = ?`;
    params.push(ticker);
  }

  if (type) {
    query += ` AND tip_type = ?`;
    params.push(type);
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  const tips = await dbAll(query, params);

  // Parse metadata JSON
  return tips.map(tip => ({
    ...tip,
    action_required: tip.action_required === 1,
    metadata: tip.metadata ? JSON.parse(tip.metadata) : null
  }));
};

export const clearOldTips = async () => {
  const result = await dbRun(
    `DELETE FROM tips_insights WHERE cached_until < datetime('now')`
  );
  return { changes: result.changes };
};

// Trade History & Analytics

export const saveTradeHistory = async (data) => {
  const result = await dbRun(
    `INSERT INTO trade_history (ticker, action, shares, price, fees, total_value, trade_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.ticker, data.action, data.shares, data.price, data.fees || 0, data.total_value, data.trade_date, data.notes]
  );
  return { lastInsertRowid: result.lastID, changes: result.changes };
};

export const getTradeHistory = async (ticker = null, limit = 100) => {
  if (ticker) {
    return await dbAll(
      'SELECT * FROM trade_history WHERE ticker = ? ORDER BY trade_date DESC LIMIT ?',
      [ticker, limit]
    );
  }
  return await dbAll('SELECT * FROM trade_history ORDER BY trade_date DESC LIMIT ?', [limit]);
};

export const saveAnalyticsCache = async (metricType, metricValue, metricData, cacheHours = 1) => {
  const cachedUntil = new Date(Date.now() + cacheHours * 60 * 60 * 1000).toISOString();
  const result = await dbRun(
    `INSERT OR REPLACE INTO portfolio_analytics_cache (metric_type, metric_value, metric_data, cached_until)
     VALUES (?, ?, ?, ?)`,
    [metricType, metricValue, metricData ? JSON.stringify(metricData) : null, cachedUntil]
  );
  return { lastInsertRowid: result.lastID, changes: result.changes };
};

export const getCachedAnalytics = async (metricType) => {
  const cached = await dbGet(
    `SELECT * FROM portfolio_analytics_cache
     WHERE metric_type = ? AND cached_until > datetime('now')
     ORDER BY created_at DESC
     LIMIT 1`,
    [metricType]
  );

  if (cached && cached.metric_data) {
    try {
      cached.metric_data = JSON.parse(cached.metric_data);
    } catch (e) {
      console.error('Error parsing metric_data:', e);
    }
  }

  return cached;
};

export const clearOldAnalyticsCache = async () => {
  const result = await dbRun(
    `DELETE FROM portfolio_analytics_cache WHERE cached_until < datetime('now')`
  );
  return { changes: result.changes };
};

// Analytics Calculations

export const calculateWinRate = async () => {
  try {
    // Get all completed trades (pairs of BUY and SELL for same ticker)
    const trades = await dbAll('SELECT * FROM trade_history ORDER BY ticker, trade_date');

    const tradesByTicker = {};
    trades.forEach(trade => {
      if (!tradesByTicker[trade.ticker]) {
        tradesByTicker[trade.ticker] = [];
      }
      tradesByTicker[trade.ticker].push(trade);
    });

    let winningTrades = 0;
    let losingTrades = 0;

    Object.values(tradesByTicker).forEach(tickerTrades => {
      let buyQueue = [];

      tickerTrades.forEach(trade => {
        if (trade.action === 'BUY') {
          buyQueue.push(trade);
        } else if (trade.action === 'SELL' && buyQueue.length > 0) {
          const buyTrade = buyQueue.shift();
          const pl = (trade.price - buyTrade.price) * trade.shares - trade.fees - buyTrade.fees;
          if (pl > 0) winningTrades++;
          else losingTrades++;
        }
      });
    });

    const totalTrades = winningTrades + losingTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    return {
      winRate: Math.round(winRate * 10) / 10,
      winningTrades,
      losingTrades,
      totalTrades
    };
  } catch (error) {
    console.error('Error calculating win rate:', error);
    return { winRate: 0, winningTrades: 0, losingTrades: 0, totalTrades: 0 };
  }
};

export const calculateAvgHoldTime = async () => {
  try {
    const trades = await dbAll('SELECT * FROM trade_history ORDER BY ticker, trade_date');

    const tradesByTicker = {};
    trades.forEach(trade => {
      if (!tradesByTicker[trade.ticker]) {
        tradesByTicker[trade.ticker] = [];
      }
      tradesByTicker[trade.ticker].push(trade);
    });

    const holdTimes = [];

    Object.values(tradesByTicker).forEach(tickerTrades => {
      let buyQueue = [];

      tickerTrades.forEach(trade => {
        if (trade.action === 'BUY') {
          buyQueue.push(trade);
        } else if (trade.action === 'SELL' && buyQueue.length > 0) {
          const buyTrade = buyQueue.shift();
          const buyDate = new Date(buyTrade.trade_date);
          const sellDate = new Date(trade.trade_date);
          const daysDiff = Math.floor((sellDate - buyDate) / (1000 * 60 * 60 * 24));
          holdTimes.push(daysDiff);
        }
      });
    });

    const avgHoldTime = holdTimes.length > 0
      ? Math.round(holdTimes.reduce((sum, days) => sum + days, 0) / holdTimes.length)
      : 0;

    return {
      avgHoldTimeDays: avgHoldTime,
      totalClosedPositions: holdTimes.length
    };
  } catch (error) {
    console.error('Error calculating avg hold time:', error);
    return { avgHoldTimeDays: 0, totalClosedPositions: 0 };
  }
};

export const calculateMonthlyPL = async (months = 12) => {
  try {
    // Get portfolio history for last N months
    const history = await dbAll(
      `SELECT snapshot_date, total_pl
       FROM portfolio_history
       WHERE snapshot_date >= date('now', '-${months} months')
       ORDER BY snapshot_date ASC`
    );

    // Group by month
    const monthlyData = {};

    history.forEach(row => {
      const month = row.snapshot_date.substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = [];
      }
      monthlyData[month].push(row.total_pl);
    });

    // Calculate average P/L for each month
    const monthlyPL = Object.entries(monthlyData).map(([month, pls]) => {
      const avgPL = pls.reduce((sum, pl) => sum + pl, 0) / pls.length;
      return { month, pl: Math.round(avgPL) };
    });

    return monthlyPL;
  } catch (error) {
    console.error('Error calculating monthly P/L:', error);
    return [];
  }
};

export const calculateSharpeRatio = async (riskFreeRate = 0.04) => {
  try {
    // Get daily portfolio values from history
    const history = await dbAll(
      `SELECT snapshot_date, total_value
       FROM portfolio_history
       ORDER BY snapshot_date ASC`
    );

    if (history.length < 2) {
      return { sharpeRatio: 0, volatility: 0, returns: 0 };
    }

    // Calculate daily returns
    const dailyReturns = [];
    for (let i = 1; i < history.length; i++) {
      const prevValue = history[i - 1].total_value;
      const currentValue = history[i].total_value;
      const dailyReturn = (currentValue - prevValue) / prevValue;
      dailyReturns.push(dailyReturn);
    }

    // Calculate average return
    const avgReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;

    // Calculate standard deviation (volatility)
    const squaredDiffs = dailyReturns.map(ret => Math.pow(ret - avgReturn, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
    const volatility = Math.sqrt(variance);

    // Annualize metrics (assuming ~252 trading days)
    const annualizedReturn = avgReturn * 252;
    const annualizedVolatility = volatility * Math.sqrt(252);

    // Calculate Sharpe Ratio
    const sharpeRatio = annualizedVolatility > 0
      ? (annualizedReturn - riskFreeRate) / annualizedVolatility
      : 0;

    return {
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      volatility: Math.round(annualizedVolatility * 10000) / 100, // as percentage
      returns: Math.round(annualizedReturn * 10000) / 100 // as percentage
    };
  } catch (error) {
    console.error('Error calculating Sharpe ratio:', error);
    return { sharpeRatio: 0, volatility: 0, returns: 0 };
  }
};

export const calculateSectorPerformance = async () => {
  try {
    // For now, we'll use a simple sector mapping
    // In production, this should fetch from a tickers JSON or API
    const sectorMap = {
      'MOWI': 'Seafood',
      'SALM': 'Seafood',
      'VAR': 'Energy',
      'EQNR': 'Energy',
      'YAR': 'Materials',
      'DNB': 'Financials',
      'ORK': 'Energy',
      'NEL': 'Energy',
      'STB': 'Energy',
      'TGS': 'Energy'
    };

    const portfolio = await getPortfolio();
    const sectorPerformance = {};

    portfolio.forEach(pos => {
      const sector = sectorMap[pos.ticker] || 'Other';
      const cost = pos.avg_buy_price * pos.shares;
      const value = (pos.current_price || pos.avg_buy_price) * pos.shares;
      const pl = value - cost - (pos.transaction_fees || 0);

      if (!sectorPerformance[sector]) {
        sectorPerformance[sector] = { sector, totalPL: 0, positions: 0 };
      }

      sectorPerformance[sector].totalPL += pl;
      sectorPerformance[sector].positions += 1;
    });

    return Object.values(sectorPerformance).map(sector => ({
      ...sector,
      totalPL: Math.round(sector.totalPL)
    }));
  } catch (error) {
    console.error('Error calculating sector performance:', error);
    return [];
  }
};

// Notifications

export const saveNotification = async (data) => {
  const result = await dbRun(
    `INSERT INTO notification_history (notification_type, ticker, title, message, severity, read_status)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [data.notification_type, data.ticker || null, data.title, data.message, data.severity]
  );
  return { lastInsertRowid: result.lastID, changes: result.changes };
};

export const getUnreadNotifications = async () => {
  return await dbAll(
    `SELECT * FROM notification_history
     WHERE read_status = 0
     ORDER BY created_at DESC`
  );
};

export const getAllNotifications = async (limit = 50, offset = 0) => {
  return await dbAll(
    `SELECT * FROM notification_history
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
};

export const markNotificationRead = async (id) => {
  const result = await dbRun(
    'UPDATE notification_history SET read_status = 1 WHERE id = ?',
    [id]
  );
  return { changes: result.changes };
};

export const markAllNotificationsRead = async () => {
  const result = await dbRun(
    'UPDATE notification_history SET read_status = 1 WHERE read_status = 0'
  );
  return { changes: result.changes };
};

export const getNotificationPreferences = async () => {
  return await dbAll('SELECT * FROM notification_preferences ORDER BY notification_type');
};

export const saveNotificationPreference = async (data) => {
  const result = await dbRun(
    `INSERT INTO notification_preferences (notification_type, enabled, ticker, threshold_value, threshold_type)
     VALUES (?, ?, ?, ?, ?)`,
    [data.notification_type, data.enabled ? 1 : 0, data.ticker || null, data.threshold_value, data.threshold_type]
  );
  return { lastInsertRowid: result.lastID, changes: result.changes };
};

export const updateNotificationPreference = async (id, data) => {
  const result = await dbRun(
    `UPDATE notification_preferences
     SET enabled = ?, threshold_value = ?, threshold_type = ?
     WHERE id = ?`,
    [data.enabled ? 1 : 0, data.threshold_value, data.threshold_type, id]
  );
  return { changes: result.changes };
};

export const deleteNotificationPreference = async (id) => {
  const result = await dbRun('DELETE FROM notification_preferences WHERE id = ?', [id]);
  return { changes: result.changes };
};

export const clearOldNotifications = async (daysToKeep = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  const cutoffString = cutoffDate.toISOString();

  const result = await dbRun(
    `DELETE FROM notification_history WHERE created_at < ? AND read_status = 1`,
    [cutoffString]
  );
  return { changes: result.changes };
};
