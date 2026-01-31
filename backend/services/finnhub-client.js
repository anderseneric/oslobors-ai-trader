import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// Rate limiting: Free tier allows 60 calls/minute
let requestQueue = [];
let lastRequestTime = Date.now();
const MIN_REQUEST_INTERVAL = 1050; // ~57 requests per minute to be safe

/**
 * Rate-limited request to Finnhub API
 */
async function rateLimitedRequest(endpoint, params = {}) {
  // Wait if needed to respect rate limit
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();

  try {
    const response = await axios.get(`${FINNHUB_BASE_URL}${endpoint}`, {
      params: {
        ...params,
        token: FINNHUB_API_KEY
      },
      timeout: 10000
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      console.error('[Finnhub] Rate limit exceeded');
      throw new Error('Finnhub rate limit exceeded');
    }
    throw error;
  }
}

/**
 * Get real-time quote for a stock
 * @param {string} symbol - Stock symbol (e.g., "EQNR.OL" for Oslo Børs)
 * @returns {Promise<Object>} Quote data
 */
export async function getQuote(symbol) {
  try {
    const data = await rateLimitedRequest('/quote', { symbol });

    return {
      symbol,
      currentPrice: data.c,        // Current price
      change: data.d,               // Change
      changePercent: data.dp,       // Percent change
      high: data.h,                 // High price of the day
      low: data.l,                  // Low price of the day
      open: data.o,                 // Open price of the day
      previousClose: data.pc,       // Previous close price
      timestamp: data.t             // Unix timestamp
    };
  } catch (error) {
    console.error(`[Finnhub] Error fetching quote for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Get company profile
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Company profile
 */
export async function getCompanyProfile(symbol) {
  try {
    const data = await rateLimitedRequest('/stock/profile2', { symbol });

    return {
      symbol,
      name: data.name,
      sector: data.finnhubIndustry,
      marketCap: data.marketCapitalization,
      country: data.country,
      currency: data.currency,
      exchange: data.exchange,
      ipo: data.ipo,
      logo: data.logo,
      phone: data.phone,
      shareOutstanding: data.shareOutstanding,
      weburl: data.weburl
    };
  } catch (error) {
    console.error(`[Finnhub] Error fetching profile for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Get batch quotes for multiple symbols
 * @param {string[]} symbols - Array of stock symbols
 * @returns {Promise<Object[]>} Array of quotes
 */
export async function getBatchQuotes(symbols) {
  const quotes = [];
  const errors = [];

  // Process in batches to respect rate limits
  for (const symbol of symbols) {
    try {
      const quote = await getQuote(symbol);
      quotes.push(quote);
    } catch (error) {
      errors.push({ symbol, error: error.message });
    }
  }

  return { quotes, errors };
}

/**
 * Check if Finnhub is configured and available
 * @returns {boolean}
 */
export function isFinnhubConfigured() {
  return !!FINNHUB_API_KEY && FINNHUB_API_KEY !== 'your_finnhub_api_key_here';
}

/**
 * Test Finnhub connection
 * @returns {Promise<boolean>}
 */
export async function testConnection() {
  if (!isFinnhubConfigured()) {
    console.error('[Finnhub] API key not configured');
    return false;
  }

  try {
    // Test with a known Oslo Børs stock
    await getQuote('EQNR.OL');
    console.log('[Finnhub] ✓ Connection test successful');
    return true;
  } catch (error) {
    console.error('[Finnhub] ✗ Connection test failed:', error.message);
    return false;
  }
}

export default {
  getQuote,
  getCompanyProfile,
  getBatchQuotes,
  isFinnhubConfigured,
  testConnection
};
