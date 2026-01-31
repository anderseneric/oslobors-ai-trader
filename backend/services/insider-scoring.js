import { getInsiderSummary, getInsiderTransactions } from '../database.js';

/**
 * Calculate insider activity score for a ticker
 * Returns a score between 0-100
 */
export async function calculateInsiderScore(ticker, days = 30) {
  try {
    const summary = await getInsiderSummary(ticker, days);
    const transactions = await getInsiderTransactions(ticker, days);

    let score = 0;

    // 1. Number of buyers (max 20 points)
    score += Math.min(summary.buyCount * 5, 20);

    // 2. Total value bought (max 25 points)
    // Scale: 0-5M = 0-10pts, 5-20M = 10-20pts, 20M+ = 20-25pts
    const valueMillion = summary.valueBought / 1000000;
    if (valueMillion > 0) {
      if (valueMillion <= 5) {
        score += valueMillion * 2; // 0-10 points
      } else if (valueMillion <= 20) {
        score += 10 + ((valueMillion - 5) / 15) * 10; // 10-20 points
      } else {
        score += 20 + Math.min((valueMillion - 20) / 10, 5); // 20-25 points
      }
    }

    // 3. CEO/CFO/Chairman buying bonus (max 20 points)
    const seniorBuys = transactions.filter(t =>
      t.transaction_type === 'BUY' &&
      t.role &&
      ['CEO', 'CFO', 'Chairman'].includes(t.role)
    );
    score += Math.min(seniorBuys.length * 10, 20);

    // 4. Large individual purchases >5M NOK (max 15 points)
    const largeBuys = transactions.filter(t =>
      t.transaction_type === 'BUY' &&
      t.value &&
      t.value > 5000000
    );
    score += Math.min(largeBuys.length * 7.5, 15);

    // 5. Multiple different insiders buying (clustering) (max 15 points)
    if (summary.uniqueInsiders > 1) {
      score += Math.min((summary.uniqueInsiders - 1) * 5, 15);
    }

    // 6. Penalty for insider selling (max -20 points)
    score -= Math.min(summary.sellCount * 5, 20);

    // 7. Bonus for recent activity (last 7 days) (max 10 points)
    const recentTransactions = transactions.filter(t => {
      const txDate = new Date(t.transaction_date);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return txDate >= sevenDaysAgo && t.transaction_type === 'BUY';
    });
    score += Math.min(recentTransactions.length * 3, 10);

    // Ensure score is between 0-100
    score = Math.max(0, Math.min(100, score));

    return {
      score: Math.round(score),
      summary,
      seniorBuys: seniorBuys.length,
      largeBuys: largeBuys.length,
      recentBuys: recentTransactions.length
    };
  } catch (error) {
    console.error(`Error calculating insider score for ${ticker}:`, error);
    return {
      score: 0,
      summary: null,
      error: error.message
    };
  }
}

/**
 * Get signal strength based on insider score
 */
export function getInsiderSignal(score) {
  if (score >= 80) return 'STRONGLY BULLISH';
  if (score >= 65) return 'BULLISH';
  if (score >= 50) return 'MODERATELY BULLISH';
  if (score >= 35) return 'NEUTRAL';
  if (score >= 20) return 'MODERATELY BEARISH';
  return 'BEARISH';
}

/**
 * Get top insider buy opportunities
 */
export async function getTopInsiderOpportunities(days = 7, limit = 10) {
  const { getTopInsiderBuys } = await import('../database.js');
  const topBuys = await getTopInsiderBuys(days, limit * 2); // Get more for filtering

  const opportunities = [];

  for (const stock of topBuys) {
    const scoreData = await calculateInsiderScore(stock.ticker, days);

    if (scoreData.score >= 50) { // Only include if score is decent
      opportunities.push({
        ticker: stock.ticker,
        insiderScore: scoreData.score,
        signal: getInsiderSignal(scoreData.score),
        buyCount: stock.transaction_count,
        totalValue: stock.total_value,
        insiderCount: stock.insider_count,
        latestTransaction: stock.latest_transaction,
        seniorBuys: scoreData.seniorBuys,
        largeBuys: scoreData.largeBuys,
        recentBuys: scoreData.recentBuys
      });
    }
  }

  // Sort by score
  opportunities.sort((a, b) => b.insiderScore - a.insiderScore);

  return opportunities.slice(0, limit);
}

export default {
  calculateInsiderScore,
  getInsiderSignal,
  getTopInsiderOpportunities
};
