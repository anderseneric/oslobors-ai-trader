import * as finnhub from './finnhub-client.js';
import YahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Yahoo Finance v3 client
const yf = new YahooFinance();

// Cache for quotes (30 minutes for Yahoo Finance to avoid rate limits)
const quoteCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes - aggressive caching for Yahoo Finance

// Cache for benchmark/historical data (24 hours)
const benchmarkCache = new Map();
const BENCHMARK_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting for Yahoo Finance
let lastYahooCall = 0;
const YAHOO_MIN_DELAY = 2000; // 2 seconds between calls to avoid rate limiting

/**
 * Get cached quote if available and not expired
 */
function getCachedQuote(symbol) {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

/**
 * Set quote in cache
 */
function setCachedQuote(symbol, data) {
  quoteCache.set(symbol, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Convert Oslo Børs ticker to Finnhub format
 * @param {string} ticker - Oslo Børs ticker (e.g., "EQNR")
 * @returns {string} Finnhub symbol (e.g., "EQNR.OL")
 */
function toFinnhubSymbol(ticker) {
  // If already has .OL, return as is
  if (ticker.endsWith('.OL')) {
    return ticker;
  }
  return `${ticker}.OL`;
}

/**
 * Convert Oslo Børs ticker to Yahoo Finance format
 * @param {string} ticker - Oslo Børs ticker (e.g., "EQNR")
 * @returns {string} Yahoo symbol (e.g., "EQNR.OL")
 */
function toYahooSymbol(ticker) {
  if (ticker.endsWith('.OL')) {
    return ticker;
  }
  return `${ticker}.OL`;
}

/**
 * Get stock quote using Finnhub (primary) or Yahoo Finance (fallback)
 * @param {string} ticker - Oslo Børs ticker
 * @returns {Promise<Object>} Normalized quote data
 */
export async function getStockQuote(ticker) {
  // Check cache first
  const cached = getCachedQuote(ticker);
  if (cached) {
    return { ...cached, cached: true };
  }

  // Try Finnhub first if configured
  if (finnhub.isFinnhubConfigured()) {
    try {
      const symbol = toFinnhubSymbol(ticker);
      const quote = await finnhub.getQuote(symbol);

      const normalized = {
        ticker,
        price: quote.currentPrice,
        change: quote.change,
        changePercent: quote.changePercent,
        high: quote.high,
        low: quote.low,
        open: quote.open,
        previousClose: quote.previousClose,
        volume: null, // Finnhub quote doesn't include volume
        source: 'finnhub',
        timestamp: quote.timestamp
      };

      setCachedQuote(ticker, normalized);
      return normalized;
    } catch (error) {
      console.log(`[Price Service] Finnhub failed for ${ticker}, trying Yahoo Finance...`);
    }
  }

  // Fallback to Yahoo Finance with rate limiting
  try {
    // Rate limit: wait at least 2 seconds between Yahoo calls
    const now = Date.now();
    const timeSinceLastCall = now - lastYahooCall;
    if (timeSinceLastCall < YAHOO_MIN_DELAY) {
      await new Promise(resolve => setTimeout(resolve, YAHOO_MIN_DELAY - timeSinceLastCall));
    }
    lastYahooCall = Date.now();

    const symbol = toYahooSymbol(ticker);
    const quote = await yf.quote(symbol);

    const normalized = {
      ticker,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      open: quote.regularMarketOpen,
      previousClose: quote.regularMarketPreviousClose,
      volume: quote.regularMarketVolume,
      averageVolume: quote.averageVolume,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      source: 'yahoo',
      timestamp: Date.now() / 1000
    };

    setCachedQuote(ticker, normalized);
    return normalized;
  } catch (error) {
    console.error(`[Price Service] Both Finnhub and Yahoo Finance failed for ${ticker}`);
    throw error;
  }
}

/**
 * Get quotes for multiple tickers
 * @param {string[]} tickers - Array of Oslo Børs tickers
 * @returns {Promise<Object>} { quotes: Array, errors: Array }
 */
export async function getBatchQuotes(tickers) {
  const quotes = [];
  const errors = [];
  let tickersToFetch = [...tickers];

  // Try Finnhub batch if configured
  if (finnhub.isFinnhubConfigured()) {
    const symbols = tickers.map(toFinnhubSymbol);
    const result = await finnhub.getBatchQuotes(symbols);

    const successfulTickers = new Set();
    result.quotes.forEach(quote => {
      const ticker = quote.symbol.replace('.OL', '');
      const normalized = {
        ticker,
        price: quote.currentPrice,
        change: quote.change,
        changePercent: quote.changePercent,
        high: quote.high,
        low: quote.low,
        open: quote.open,
        previousClose: quote.previousClose,
        source: 'finnhub',
        timestamp: quote.timestamp
      };
      quotes.push(normalized);
      setCachedQuote(ticker, normalized);
      successfulTickers.add(ticker);
    });

    // Filter out successful tickers, fallback to Yahoo for failed ones
    tickersToFetch = tickers.filter(t => !successfulTickers.has(t));

    // If all succeeded via Finnhub, return
    if (tickersToFetch.length === 0) {
      return { quotes, errors };
    }

    // Log that we're falling back for some tickers
    if (tickersToFetch.length > 0) {
      console.log(`[Price Service] Finnhub failed for ${tickersToFetch.length} tickers, falling back to Yahoo...`);
    }
  }

  // Fallback: process remaining tickers with Yahoo Finance
  for (const ticker of tickersToFetch) {
    try {
      const quote = await getStockQuote(ticker);
      quotes.push(quote);
    } catch (error) {
      // Check if it's a rate limit error
      if (error.message.includes('Too Many Requests') || error.message.includes('429')) {
        console.log(`[Price Service] ⚠️ Yahoo Finance rate limit hit. Stopping batch to preserve quota.`);
        errors.push({ ticker, error: 'Rate limit - stopped batch to preserve quota' });
        break; // Stop processing to avoid wasting more calls
      }
      errors.push({ ticker, error: error.message });
    }
  }

  return { quotes, errors };
}

/**
 * Clear quote cache
 */
export function clearCache() {
  quoteCache.clear();
  console.log('[Price Service] Cache cleared');
}

/**
 * Get benchmark/index historical data with 24-hour caching
 * @param {string} symbol - Index symbol (e.g., "^OSEBX")
 * @param {number} days - Number of days of history
 * @returns {Promise<Object>} { data: Array, cached: boolean }
 */
export async function getBenchmarkHistory(symbol, days) {
  const cacheKey = `${symbol}_${days}`;
  const cached = benchmarkCache.get(cacheKey);

  // Return cached data if still fresh
  if (cached && Date.now() - cached.timestamp < BENCHMARK_CACHE_DURATION) {
    console.log(`[Price Service] Returning cached benchmark data for ${symbol}`);
    return { data: cached.data, cached: true };
  }

  // Rate limit before Yahoo call
  const now = Date.now();
  const timeSinceLastCall = now - lastYahooCall;
  if (timeSinceLastCall < YAHOO_MIN_DELAY) {
    // If we have stale cached data, return that
    if (cached) {
      console.log(`[Price Service] Rate limited, returning stale benchmark data for ${symbol}`);
      return { data: cached.data, cached: true, stale: true };
    }
    await new Promise(resolve => setTimeout(resolve, YAHOO_MIN_DELAY - timeSinceLastCall));
  }
  lastYahooCall = Date.now();

  try {
    console.log(`[Price Service] Fetching benchmark data for ${symbol} (${days} days)`);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await yf.historical(symbol, {
      period1: startDate,
      period2: endDate,
    });

    // Cache the result
    benchmarkCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return { data: result, cached: false };
  } catch (error) {
    // If fetch fails and we have stale data, return that
    if (cached) {
      console.log(`[Price Service] Yahoo failed for ${symbol}, returning stale cached data`);
      return { data: cached.data, cached: true, stale: true };
    }
    throw error;
  }
}

/**
 * Get data source status
 */
export function getDataSourceStatus() {
  return {
    finnhub: {
      configured: finnhub.isFinnhubConfigured(),
      available: finnhub.isFinnhubConfigured()
    },
    yahoo: {
      configured: true,
      available: true // Always available as fallback
    },
    cache: {
      quotes: {
        size: quoteCache.size,
        maxAge: CACHE_DURATION / 1000 / 60 + ' minutes'
      },
      benchmark: {
        size: benchmarkCache.size,
        maxAge: BENCHMARK_CACHE_DURATION / 1000 / 60 / 60 + ' hours'
      }
    }
  };
}

export default {
  getStockQuote,
  getBatchQuotes,
  getBenchmarkHistory,
  clearCache,
  getDataSourceStatus
};
