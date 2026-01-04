import axios from 'axios';
import type { Stock, PortfolioPosition, PriceHistory, AIAnalysis, NewsItem, Recommendation, ChatMessage, TipInsight, DailyDigest } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Portfolio API
export const portfolioAPI = {
  getAll: async () => {
    const response = await api.get<{ success: boolean; data: PortfolioPosition[] }>('/api/portfolio');
    return response.data.data;
  },

  add: async (data: {
    ticker: string;
    shares: number;
    avg_buy_price: number;
    purchase_date: string;
    notes?: string;
    transaction_fees?: number;
  }) => {
    const response = await api.post('/api/portfolio', data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/api/portfolio/${id}`);
    return response.data;
  },

  refreshPrices: async () => {
    const response = await api.post<{
      success: boolean;
      updated: number;
      errors: number;
      updates: any[];
      lastUpdate: string;
      portfolio: PortfolioPosition[];
    }>('/api/portfolio/refresh-prices');
    return response.data;
  },

  getHistory: async (days: number = 30) => {
    const response = await api.get<{
      success: boolean;
      data: Array<{
        date: string;
        value: number;
        cost: number;
        pl: number;
        fees: number;
        positions: number;
      }>;
      count: number;
    }>(`/api/portfolio/history?days=${days}`);
    return response.data;
  },

  createSnapshot: async () => {
    const response = await api.post('/api/portfolio/snapshot');
    return response.data;
  }
};

// Stock API
export const stockAPI = {
  getDetails: async (ticker: string) => {
    const response = await api.get<{ success: boolean; data: Stock }>(`/api/stocks/${ticker}`);
    return response.data.data;
  },

  getHistory: async (ticker: string, days: number = 90) => {
    const response = await api.get<{ success: boolean; data: PriceHistory[] }>(
      `/api/stocks/${ticker}/history?days=${days}`
    );
    return response.data.data;
  },

  getAnalysis: async (ticker: string) => {
    const response = await api.get<{ success: boolean; data: AIAnalysis; cached: boolean }>(
      `/api/stocks/${ticker}/analysis`
    );
    return response.data;
  },
};

// News API
export const newsAPI = {
  getAll: async (limit: number = 50) => {
    const response = await api.get<{ success: boolean; data: NewsItem[] }>(
      `/api/news?limit=${limit}`
    );
    return response.data.data;
  },

  getByTicker: async (ticker: string, limit: number = 50) => {
    const response = await api.get<{ success: boolean; data: NewsItem[] }>(
      `/api/news?ticker=${ticker}&limit=${limit}`
    );
    return response.data.data;
  },

  getLatest: async (hours: number = 24) => {
    const response = await api.get<{ success: boolean; data: NewsItem[] }>(
      `/api/news/latest?hours=${hours}`
    );
    return response.data.data;
  },

  refresh: async () => {
    const response = await api.post<{
      success: boolean;
      message: string;
      stats: {
        tickersScraped: number;
        totalNewsFound: number;
        newItems: number;
        errors: number;
      };
      topMovers: Array<{
        ticker: string;
        name: string;
        priceChange: string;
        volumeSpike: string;
      }>;
    }>('/api/news/refresh', {}, {
      timeout: 180000, // 3 minutes
    });
    return response.data;
  },
};

// Screener API
export const screenerAPI = {
  getResults: async () => {
    const response = await api.get('/api/screener/results');
    return response.data.data;
  },
};

// Recommendations API
export const recommendationsAPI = {
  getAll: async () => {
    const response = await api.get<{
      success: boolean;
      data: Recommendation[];
      cached: boolean;
      lastUpdate: string;
      message?: string;
    }>('/api/recommendations', {
      timeout: 300000, // 5 minutes - AI analysis can take time
    });
    return response.data;
  },
};

// Chat API
export const chatAPI = {
  sendMessage: async (message: string, conversationHistory: ChatMessage[]) => {
    const response = await api.post<{
      success: boolean;
      response: string;
      timestamp: string;
    }>('/api/chat', {
      message,
      conversationHistory,
    });
    return response.data;
  },
};

// Tips & Insights API
export const tipsAPI = {
  getAll: async (ticker?: string, type?: string) => {
    const params = new URLSearchParams();
    if (ticker) params.append('ticker', ticker);
    if (type) params.append('type', type);
    const query = params.toString() ? `?${params.toString()}` : '';

    const response = await api.get<{
      success: boolean;
      data: TipInsight[];
      cached: boolean;
      lastUpdate?: string;
      message?: string;
    }>(`/api/tips-insights${query}`);
    return response.data;
  },

  getDailyDigest: async () => {
    const response = await api.get<{
      success: boolean;
      data: DailyDigest;
      cached: boolean;
      lastUpdate?: string;
      message?: string;
    }>('/api/tips-insights/daily-digest');
    return response.data;
  },

  refresh: async (ticker?: string) => {
    const response = await api.post<{
      success: boolean;
      message: string;
    }>('/api/tips-insights/refresh', { ticker });
    return response.data;
  },
};

// Analytics API
export const analyticsAPI = {
  getOverview: async () => {
    const response = await api.get<{
      success: boolean;
      data: import('../types').AnalyticsOverview;
      cached: boolean;
      lastUpdate: string;
    }>('/api/analytics/overview');
    return response.data;
  },

  getRiskAdjusted: async () => {
    const response = await api.get<{
      success: boolean;
      data: import('../types').RiskAdjustedMetrics;
      cached: boolean;
      lastUpdate: string;
    }>('/api/analytics/risk-adjusted');
    return response.data;
  },

  getBenchmark: async () => {
    const response = await api.get<{
      success: boolean;
      data: import('../types').BenchmarkComparison;
      cached: boolean;
      lastUpdate: string;
      message?: string;
    }>('/api/analytics/benchmark');
    return response.data;
  },
};

// Notifications API
export const notificationsAPI = {
  getUnread: async () => {
    const response = await api.get<{
      success: boolean;
      data: import('../types').Notification[];
      count: number;
    }>('/api/notifications');
    return response.data;
  },

  getAll: async (limit = 50, offset = 0) => {
    const response = await api.get<{
      success: boolean;
      data: import('../types').Notification[];
      count: number;
    }>(`/api/notifications/all?limit=${limit}&offset=${offset}`);
    return response.data;
  },

  markRead: async (id: number) => {
    const response = await api.post<{
      success: boolean;
      message: string;
    }>(`/api/notifications/mark-read/${id}`);
    return response.data;
  },

  markAllRead: async () => {
    const response = await api.post<{
      success: boolean;
      message: string;
    }>('/api/notifications/mark-all-read');
    return response.data;
  },

  getPreferences: async () => {
    const response = await api.get<{
      success: boolean;
      data: import('../types').NotificationPreference[];
    }>('/api/notifications/preferences');
    return response.data;
  },

  savePreference: async (preference: import('../types').NotificationPreference) => {
    const response = await api.post<{
      success: boolean;
      id: number;
      message: string;
    }>('/api/notifications/preferences', preference);
    return response.data;
  },

  updatePreference: async (id: number, preference: Partial<import('../types').NotificationPreference>) => {
    const response = await api.put<{
      success: boolean;
      message: string;
    }>(`/api/notifications/preferences/${id}`, preference);
    return response.data;
  },

  deletePreference: async (id: number) => {
    const response = await api.delete<{
      success: boolean;
      message: string;
    }>(`/api/notifications/preferences/${id}`);
    return response.data;
  },
};

export default api;
