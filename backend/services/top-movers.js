import yahooFinance from 'yahoo-finance2';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load Oslo Børs tickers
const tickersData = JSON.parse(
  readFileSync(join(__dirname, '../../oslo-bors-tickers.json'), 'utf-8')
);

// Cache for top movers (5 minutes)
let cachedMovers = null;
let cacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

  console.log(`[Top Movers] Analyzing all Oslo Børs stocks...`);
  const movers = [];
  const errors = [];

  // Fetch quotes in parallel with batching to avoid rate limits
  const batchSize = 10;
  const tickers = tickersData.tickers || tickersData;

  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (tickerObj) => {
        try {
          const symbol = `${tickerObj.symbol}.OL`;
          const quote = await yahooFinance.quote(symbol);

          // Calculate metrics
          const priceChangePercent = Math.abs(quote.regularMarketChangePercent || 0);
          const currentVolume = quote.regularMarketVolume || 0;
          const avgVolume = quote.averageVolume || 1;
          const volumeSpike = avgVolume > 0 ? currentVolume / avgVolume : 1;

          // Score: prioritize both price movement and volume
          const score = (priceChangePercent * 5) + (volumeSpike * 10);

          // Filter: only include if significant movement
          if (priceChangePercent > 3 || volumeSpike > 1.5) {
            return {
              ticker: tickerObj.symbol,
              name: tickerObj.name || quote.longName || tickerObj.symbol,
              sector: tickerObj.sector || 'Unknown',
              priceChangePercent,
              volumeSpike,
              score,
              price: quote.regularMarketPrice,
              volume: currentVolume,
              quote
            };
          }
          return null;
        } catch (error) {
          errors.push({ ticker: tickerObj.symbol, error: error.message });
          return null;
        }
      })
    );

    // Collect successful results
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        movers.push(result.value);
      }
    });

    // Small delay between batches to respect rate limits
    if (i + batchSize < tickers.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
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
