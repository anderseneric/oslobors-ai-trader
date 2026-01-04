import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:5000';

/**
 * Default Oslo Børs tickers to screen
 */
export const DEFAULT_TICKERS = [
  'MOWI', 'VAR', 'YAR', 'NEL', 'SALM', 'EQNR', 'DNB', 'ORK', 'STB', 'TGS',
  'AKSO', 'AKER', 'ASC', 'B2H', 'BAKKA', 'DNO', 'GOGL', 'GJF', 'KAHOT',
  'LSG', 'NHY', 'NOD', 'ORK', 'PGS', 'REC', 'SUBC', 'TEL', 'XXL'
];

/**
 * Default screening criteria
 */
export const DEFAULT_CRITERIA = {
  rsi_min: parseInt(process.env.RSI_MIN) || 30,
  rsi_max: parseInt(process.env.RSI_MAX) || 70,
  volume_spike: parseFloat(process.env.VOLUME_SPIKE_THRESHOLD) || 1.5,
};

/**
 * Run stock screener using Python technical indicators API
 * @param {Array<string>} tickers - List of ticker symbols to screen
 * @param {Object} criteria - Screening criteria
 * @returns {Promise<Object>} Screening results
 */
export async function runScreener(tickers = DEFAULT_TICKERS, criteria = DEFAULT_CRITERIA) {
  try {
    console.log(`[Screener] Screening ${tickers.length} stocks...`);
    console.log(`[Screener] Criteria: RSI ${criteria.rsi_min}-${criteria.rsi_max}, Volume Spike: ${criteria.volume_spike}x`);

    const response = await axios.post(`${PYTHON_API_URL}/screener`, {
      tickers,
      criteria,
    }, {
      timeout: 120000, // 2 minutes timeout for large batches
    });

    const results = response.data;

    console.log(`[Screener] ✓ Found ${results.matches} matches out of ${results.total_scanned} stocks`);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      criteria,
      ...results,
    };

  } catch (error) {
    console.error('[Screener] ✗ Error:', error.message);
    throw new Error(`Screener failed: ${error.message}`);
  }
}

/**
 * Get top N results from screener
 * @param {number} topN - Number of top results to return
 * @param {Array<string>} tickers - Tickers to screen
 * @param {Object} criteria - Screening criteria
 * @returns {Promise<Array>} Top N screening results
 */
export async function getTopResults(topN = 10, tickers = DEFAULT_TICKERS, criteria = DEFAULT_CRITERIA) {
  const results = await runScreener(tickers, criteria);
  return results.results.slice(0, topN);
}

/**
 * Filter stocks by specific criteria
 * @param {Object} filters - Additional filters
 * @returns {Promise<Array>} Filtered results
 */
export async function filterStocks(filters = {}) {
  const criteria = { ...DEFAULT_CRITERIA, ...filters };
  return await runScreener(DEFAULT_TICKERS, criteria);
}

// Export for use as module
export default {
  runScreener,
  getTopResults,
  filterStocks,
  DEFAULT_TICKERS,
  DEFAULT_CRITERIA,
};
