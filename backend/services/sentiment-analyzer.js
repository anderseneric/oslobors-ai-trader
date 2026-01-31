import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '../../.env'), override: true });

// Lazy-load Anthropic client to ensure env vars are loaded
let anthropic = null;
function getAnthropicClient() {
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropic;
}

// Cache for sentiment analysis (24 hours)
const sentimentCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Analyze sentiment of a single news item
 * @param {Object} newsItem - News item with title, ticker, category, content
 * @returns {Promise<Object>} Sentiment analysis result
 */
export async function analyzeNewsSentiment(newsItem) {
  // Check cache first (based on link)
  const cacheKey = newsItem.link || `${newsItem.ticker}-${newsItem.title}`;
  const cached = sentimentCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    return cached.result;
  }

  try {
    const prompt = `Analyze the sentiment of this Oslo Børs (Norwegian stock market) news article.

Ticker: ${newsItem.ticker}
Title: ${newsItem.title}
Category: ${newsItem.category}
${newsItem.content ? `Content: ${newsItem.content.substring(0, 500)}` : ''}

Determine:
1. Sentiment: Is this bullish, neutral, or bearish for the stock?
2. Confidence: How confident are you in this assessment (0.0 to 1.0)?

Guidelines:
- "bullish" = positive news that could drive stock price UP (revenue growth, new contracts, dividends, analyst upgrades, expansion, partnerships, strong earnings)
- "bearish" = negative news that could drive stock price DOWN (losses, downgrades, regulatory issues, lawoffs, missed earnings, debt problems, scandals)
- "neutral" = procedural/administrative announcements with minimal price impact (AGM notices, board appointments, routine filings, minor updates)

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "sentiment": "bullish",
  "confidence": 0.85
}`;

    const message = await getAnthropicClient().messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text.trim();

    // Extract JSON from response
    let result;
    try {
      // Try parsing directly
      result = JSON.parse(responseText);
    } catch (e) {
      // Try extracting JSON from markdown or other formats
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse JSON from response');
      }
    }

    // Validate result
    if (!result.sentiment || !['bullish', 'neutral', 'bearish'].includes(result.sentiment)) {
      throw new Error('Invalid sentiment value');
    }

    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      result.confidence = 0.5; // Default confidence if invalid
    }

    // Cache the result
    sentimentCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    return result;

  } catch (error) {
    console.error('[Sentiment Analyzer] Error:', error.message);

    // Return default neutral sentiment on error
    return {
      sentiment: 'neutral',
      confidence: 0.0
    };
  }
}

/**
 * Analyze sentiment for multiple news items in a single batch
 * @param {Array} newsItems - Array of news items (max 20 per call)
 * @returns {Promise<Array>} Array of sentiment results
 */
async function analyzeBatchAPI(newsItems) {
  // Check cache first for all items
  const cachedResults = [];
  const uncachedItems = [];
  const uncachedIndexes = [];

  newsItems.forEach((item, index) => {
    const cacheKey = item.link || `${item.ticker}-${item.title}`;
    const cached = sentimentCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      cachedResults[index] = cached.result;
    } else {
      uncachedItems.push(item);
      uncachedIndexes.push(index);
    }
  });

  // If all cached, return immediately
  if (uncachedItems.length === 0) {
    return cachedResults;
  }

  try {
    // Build prompt with all items
    const itemsList = uncachedItems.map((item, i) => `
${i + 1}. Ticker: ${item.ticker}
   Title: ${item.title}
   Category: ${item.category || 'N/A'}`).join('\n');

    const prompt = `Analyze sentiment for these ${uncachedItems.length} Oslo Børs news articles. For each, determine if it's bullish (positive for stock price), bearish (negative), or neutral (minimal impact).

${itemsList}

Guidelines:
- "bullish" = revenue growth, contracts, dividends, upgrades, strong earnings, expansion
- "bearish" = losses, downgrades, layoffs, missed earnings, debt, scandals
- "neutral" = procedural announcements, routine filings, minor updates

Return ONLY a JSON array with ${uncachedItems.length} objects (no markdown, no explanation):
[
  {"sentiment": "bullish", "confidence": 0.85},
  {"sentiment": "neutral", "confidence": 0.95},
  ...
]`;

    const message = await getAnthropicClient().messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text.trim();

    // Parse JSON response
    let batchResults;
    try {
      batchResults = JSON.parse(responseText);
    } catch (e) {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        batchResults = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse JSON array from response');
      }
    }

    // Validate and cache results
    batchResults.forEach((result, i) => {
      if (!result.sentiment || !['bullish', 'neutral', 'bearish'].includes(result.sentiment)) {
        result.sentiment = 'neutral';
      }
      if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
        result.confidence = 0.5;
      }

      // Cache the result
      const item = uncachedItems[i];
      const cacheKey = item.link || `${item.ticker}-${item.title}`;
      sentimentCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      // Place result in correct position
      const originalIndex = uncachedIndexes[i];
      cachedResults[originalIndex] = result;
    });

    return cachedResults;

  } catch (error) {
    console.error('[Sentiment Analyzer] Batch error:', error.message);

    // Fill in defaults for failed items
    uncachedIndexes.forEach(index => {
      if (!cachedResults[index]) {
        cachedResults[index] = { sentiment: 'neutral', confidence: 0.0 };
      }
    });

    return cachedResults;
  }
}

/**
 * Analyze sentiment for multiple news items in batches
 * @param {Array} newsItems - Array of news items
 * @param {number} batchSize - Number of items per API call (max 20 recommended)
 * @returns {Promise<Array>} Array of sentiment results
 */
export async function analyzeBatchSentiment(newsItems, batchSize = 15) {
  if (!newsItems || newsItems.length === 0) {
    return [];
  }

  console.log(`[Sentiment Analyzer] Analyzing ${newsItems.length} news items...`);
  const results = [];

  // Filter out low-value news before analysis (saves API calls)
  const proceduralKeywords = ['financial calendar', 'agm notice', 'annual general meeting', 'notice of', 'notification of'];

  const filteredItems = [];
  for (const item of newsItems) {
    // Skip very short titles
    if (!item.title || item.title.length < 20) {
      results.push({ sentiment: 'neutral', confidence: 0.1 });
      continue;
    }

    // Skip purely procedural items
    const titleLower = item.title.toLowerCase();
    if (proceduralKeywords.some(keyword => titleLower.includes(keyword))) {
      results.push({ sentiment: 'neutral', confidence: 0.3 });
      continue;
    }

    filteredItems.push(item);
  }

  const apiCalls = Math.ceil(filteredItems.length / batchSize);
  console.log(`[Sentiment Analyzer] Processing ${filteredItems.length} items in ${apiCalls} API calls (${newsItems.length - filteredItems.length} skipped)`);

  // Process in batches to save API credits
  for (let i = 0; i < filteredItems.length; i += batchSize) {
    const batch = filteredItems.slice(i, i + batchSize);
    const batchResults = await analyzeBatchAPI(batch);
    results.push(...batchResults);

    // Brief delay between batches
    if (i + batchSize < filteredItems.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[Sentiment Analyzer] ✓ Complete (${apiCalls} API calls)`);
  console.log(`[Sentiment Analyzer] Bullish: ${results.filter(r => r.sentiment === 'bullish').length}, Neutral: ${results.filter(r => r.sentiment === 'neutral').length}, Bearish: ${results.filter(r => r.sentiment === 'bearish').length}`);

  return results;
}

/**
 * Clear the sentiment cache
 */
export function clearCache() {
  sentimentCache.clear();
  console.log('[Sentiment Analyzer] Cache cleared');
}

export default {
  analyzeNewsSentiment,
  analyzeBatchSentiment,
  clearCache
};
