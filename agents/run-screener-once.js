import { runStockScreener } from './screener-agent.js';

console.log('🔍 Running screener agent manually...\n');

runStockScreener().then(() => {
  console.log('\n✅ Screener complete! Exiting...');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Screener failed:', error);
  process.exit(1);
});
