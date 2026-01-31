export interface Stock {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  currency: string;
}

export interface PortfolioPosition {
  id: number;
  ticker: string;
  company_name: string;
  shares: number;
  avg_buy_price: number;
  current_price: number;
  purchase_date: string;
  notes?: string;
  transaction_fees: number;
  created_at: string;
  updated_at: string;
}

export interface PriceHistory {
  id: number;
  ticker: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AIAnalysis {
  sentiment: 'bullish' | 'neutral' | 'bearish';
  confidence: number;
  key_points: string[];
  analysis: string;
}

export interface NewsItem {
  id: number;
  ticker: string;
  title: string;
  category: string;
  link: string;
  content: string;
  published_date: string;
  source: string;
  sentiment?: 'bullish' | 'neutral' | 'bearish';
  ai_confidence?: number;
  created_at: string;
}

export interface ScreenerResult {
  ticker: string;
  price: number;
  rsi: number;
  volume_spike: number;
  score: number;
  screened_at?: string;
}

export interface Alert {
  type: 'price_change' | 'volume_spike' | 'news_event' | 'rsi_extreme';
  ticker: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  data: any;
  timestamp: string;
}

export interface Recommendation {
  id?: number;
  ticker: string;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'AVOID';
  confidence: number;
  entry_range: [number, number];
  target_price: number;
  stop_loss: number;
  hold_period: string;
  position_size_percent: number;
  risk_reward_ratio: string;
  reasoning: string[];
  insider_score?: number;
  insider_signal?: string;
  created_at?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface TipInsight {
  id: number;
  tip_type: 'daily_insight' | 'smart_alert' | 'risk_warning' | 'entry_exit';
  ticker?: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  confidence: number;
  action_required: boolean;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface DailyDigest {
  insights: TipInsight[];
  alerts: TipInsight[];
  warnings: TipInsight[];
  suggestions: TipInsight[];
}

export interface AnalyticsOverview {
  winRate: number;
  winningTrades: number;
  losingTrades: number;
  totalTrades: number;
  avgHoldTimeDays: number;
  totalClosedPositions: number;
  sectorPerformance: SectorPerformance[];
  monthlyPL: MonthlyPL[];
}

export interface SectorPerformance {
  sector: string;
  totalPL: number;
  positions: number;
}

export interface MonthlyPL {
  month: string;
  pl: number;
}

export interface RiskAdjustedMetrics {
  sharpeRatio: number;
  volatility: number;
  annualizedReturns: number;
  maxDrawdown: number;
}

export interface BenchmarkComparison {
  portfolioPerformance: PerformanceDataPoint[];
  benchmarkPerformance: PerformanceDataPoint[];
  relativePerformance: number;
}

export interface PerformanceDataPoint {
  date: string;
  value: number;
}

export interface Notification {
  id: number;
  notification_type: 'price_alert' | 'technical_breakout' | 'news_alert' | 'daily_summary';
  ticker?: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  read_status: boolean;
  created_at: string;
}

export interface NotificationPreference {
  id?: number;
  notification_type: string;
  enabled: boolean;
  ticker?: string;
  threshold_value?: number;
  threshold_type?: 'above' | 'below' | 'change_percent';
  created_at?: string;
}

export interface InsiderTransaction {
  id: number;
  ticker: string;
  insider_name: string;
  role?: string;
  transaction_type: 'BUY' | 'SELL';
  shares?: number;
  price?: number;
  value?: number;
  transaction_date: string;
  reported_date: string;
  source: string;
  news_link?: string;
  created_at: string;
}

export interface InsiderSummary {
  buy_count: number;
  sell_count: number;
  shares_bought: number;
  shares_sold: number;
  value_bought: number;
  value_sold: number;
  unique_insiders: number;
  net_shares: number;
  net_value: number;
}

export interface InsiderOpportunity {
  ticker: string;
  insiderScore: number;
  signal: 'STRONGLY BULLISH' | 'BULLISH' | 'MODERATELY BULLISH' | 'NEUTRAL' | 'MODERATELY BEARISH' | 'BEARISH';
  buyCount: number;
  totalValue: number;
  insiderCount: number;
  latestTransaction: string;
  seniorBuys: number;
  largeBuys: number;
  recentBuys: number;
}

export interface InsiderTickerSummary {
  ticker: string;
  summary: InsiderSummary;
  score: number;
  signal: string;
  scoreDetails: {
    seniorBuys: number;
    largeBuys: number;
    recentBuys: number;
  };
  recentTransactions: InsiderTransaction[];
}
