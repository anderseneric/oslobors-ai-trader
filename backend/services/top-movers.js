import * as priceService from './price-service.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load Oslo Børs tickers
const tickersData = JSON.parse(
  readFileSync(join(__dirname, '../../oslo-bors-tickers.json'), 'utf-8')
);

// Cache for top movers (2 hours to avoid excessive Yahoo Finance calls)
let cachedMovers = null;
let cacheTime = null;
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours - very conservative to avoid rate limits

/**
 * Get top daily movers based on price change and volume spike
 * @param {number} limit - Maximum number of movers to return
 * @returns {Promise<Array>} Top movers with their metrics
 */
export async function getTopMovers(limit = 30) {
  // Return cached if still valid
  if (cachedMovers && cacheTime && (Date.now() - cacheTime < CACHE_DURATION)) {
    console.log(`[Top Movers] Returning cached results (${cachedMovers.length} movers)`);
    return cachedMovers.slice(0, limit);
  }

  console.log(`[Top Movers] Analyzing major Oslo Børs stocks using price-service (Finnhub primary)...`);
  const movers = [];

  // Only analyze major liquid stocks
  const majorTickers = [
    'EQNR', 'MOWI', 'DNB', 'TEL', 'YAR', 'VAR', 'ORK', 'SALM', 'NHY',
    'AKSO', 'BAKKA', 'SUBC', 'XXL', 'KOG', 'AUTOSTR', 'SCATC', 'KAHOT',
    'NONG', 'TGS', 'AUSS', 'BORR', 'RECSI'
  ];

  const allTickers = tickersData.tickers || tickersData;
  const tickers = allTickers.filter(t => majorTickers.includes(t.symbol));

  console.log(`[Top Movers] Scanning ${tickers.length} major stocks using price-service`);

  // Use priceService.getBatchQuotes which handles Finnhub/Yahoo switching and rate limiting
  const tickerSymbols = tickers.map(t => t.symbol);
  const { quotes, errors } = await priceService.getBatchQuotes(tickerSymbols);

  // Process quotes
  for (const quote of quotes) {
    const tickerObj = tickers.find(t => t.symbol === quote.ticker);
    if (!tickerObj) continue;

    // Calculate metrics
    const priceChangePercent = Math.abs(quote.changePercent || 0);
    const currentVolume = quote.volume || 0;
    const avgVolume = quote.averageVolume || 1;
    // If volume is null (Finnhub), skip volume spike calculation
    const volumeSpike = (quote.volume !== null && avgVolume > 0) ? currentVolume / avgVolume : null;

    // Score: prioritize price movement (and volume if available)
    const volumeScore = volumeSpike !== null ? (volumeSpike * 10) : 0;
    const score = (priceChangePercent * 5) + volumeScore;

    // Filter: only include if significant price movement (volume is optional from Finnhub)
    if (priceChangePercent > 3 || (volumeSpike !== null && volumeSpike > 1.5)) {
      movers.push({
        ticker: quote.ticker,
        name: tickerObj.name || quote.ticker,
        sector: tickerObj.sector || 'Unknown',
        priceChangePercent,
        volumeSpike: volumeSpike !== null ? volumeSpike : 'N/A',
        score,
        price: quote.price,
        volume: currentVolume || 'N/A',
        source: quote.source // 'finnhub' or 'yahoo'
      });
    }
  }

  if (errors.length > 0) {
    console.log(`[Top Movers] ${errors.length} stocks had errors:`, errors.slice(0, 5).map(e => e.ticker).join(', '));
  }

  // Sort by score (highest first)
  movers.sort((a, b) => b.score - a.score);

  console.log(`[Top Movers] Found ${movers.length} active stocks (${errors.length} errors)`);
  if (movers.length > 0) {
    console.log(`[Top Movers] Top 5: ${movers.slice(0, 5).map(m =>
      `${m.ticker} (${m.priceChangePercent.toFixed(1)}%, ${m.volumeSpike.toFixed(1)}x vol)`
    ).join(', ')}`);
  }

  // Cache results
  cachedMovers = movers;
  cacheTime = Date.now();

  return movers.slice(0, limit);
}

/**
 * Clear the cache (useful for testing)
 */
export function clearCache() {
  cachedMovers = null;
  cacheTime = null;
}

export default {
  getTopMovers,
  clearCache
};
