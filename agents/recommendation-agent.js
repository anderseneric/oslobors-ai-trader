import cron from 'node-cron';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env'), override: true });

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

/**
 * Generate recommendations by calling the API endpoint
 */
async function generateRecommendations() {
  console.log('\n[Recommendation Agent] Starting recommendation generation...');

  try {
    const response = await axios.get(`${API_BASE}/api/recommendations`, {
      timeout: 300000, // 5 minute timeout
    });

    if (response.data.success) {
      const count = response.data.data?.length || 0;
      console.log(`[Recommendation Agent] ✓ Generated ${count} high-confidence recommendations`);

      if (count > 0) {
        response.data.data.forEach((rec, index) => {
          console.log(`  ${index + 1}. ${rec.ticker}: ${rec.recommendation} (${rec.confidence}%)`);
        });
      } else {
        console.log('[Recommendation Agent] ℹ No stocks met confidence threshold (>60%)');
      }
    } else {
      console.error('[Recommendation Agent] ✗ API returned error:', response.data.error);
    }

    console.log('[Recommendation Agent] ✓ Complete\n');

  } catch (error) {
    console.error('[Recommendation Agent] ✗ Error:', error.message);
  }
}

/**
 * Start the recommendation agent with cron schedule
 */
export function startRecommendationAgent() {
  const schedule = process.env.RECOMMENDATION_SCHEDULE || '0 18 * * *'; // Daily at 18:00

  console.log(`[Recommendation Agent] Scheduled: ${schedule} (Daily at 18:00 after market close)`);

  // Run immediately on start
  generateRecommendations();

  // Schedule recurring runs
  cron.schedule(schedule, () => {
    generateRecommendations();
  });
}

export default {
  generateRecommendations,
  startRecommendationAgent,
};
