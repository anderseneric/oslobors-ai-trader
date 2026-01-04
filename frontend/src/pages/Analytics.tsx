import { useEffect, useState } from 'react'
import { TrendingUp, Activity, Target, AlertTriangle, BarChart3, RefreshCw } from 'lucide-react'
import { analyticsAPI } from '../services/api'
import type { AnalyticsOverview, RiskAdjustedMetrics, BenchmarkComparison } from '../types'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export default function Analytics() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [riskMetrics, setRiskMetrics] = useState<RiskAdjustedMetrics | null>(null)
  const [benchmark, setBenchmark] = useState<BenchmarkComparison | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      const [overviewRes, riskRes, benchmarkRes] = await Promise.all([
        analyticsAPI.getOverview(),
        analyticsAPI.getRiskAdjusted(),
        analyticsAPI.getBenchmark()
      ])

      if (overviewRes.success) setOverview(overviewRes.data)
      if (riskRes.success) setRiskMetrics(riskRes.data)
      if (benchmarkRes.success) setBenchmark(benchmarkRes.data)

    } catch (err) {
      console.error('Error loading analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAnalytics()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-10 bg-white/5 rounded w-64 animate-pulse" />
          <div className="h-10 bg-white/5 rounded w-32 animate-pulse" />
        </div>
        <div className="grid grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="h-96 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const winRateData = overview ? [
    { name: 'Wins', value: overview.winningTrades, color: '#10b981' },
    { name: 'Losses', value: overview.losingTrades, color: '#ef4444' }
  ] : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center">
            <BarChart3 className="w-8 h-8 mr-3 text-blue-500" />
            Portfolio Analytics
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Performance metrics and risk-adjusted returns
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg flex items-center space-x-2 transition-all ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Win Rate */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:shadow-[0_8px_32px_rgba(16,185,129,0.2)] transition-all">
          <div className="flex items-center justify-between mb-4">
            <Target className="w-8 h-8 text-green-400" />
            <span className="text-xs text-white/60">Last Hour</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {overview?.winRate || 0}%
          </div>
          <div className="text-sm text-white/60">Win Rate</div>
          <div className="text-xs text-white/40 mt-2">
            {overview?.winningTrades || 0} wins / {overview?.totalTrades || 0} trades
          </div>
        </div>

        {/* Avg Hold Time */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:shadow-[0_8px_32px_rgba(59,130,246,0.2)] transition-all">
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-8 h-8 text-blue-400" />
            <span className="text-xs text-white/60">Average</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {overview?.avgHoldTimeDays || 0}d
          </div>
          <div className="text-sm text-white/60">Avg Hold Time</div>
          <div className="text-xs text-white/40 mt-2">
            {overview?.totalClosedPositions || 0} closed positions
          </div>
        </div>

        {/* Sharpe Ratio */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:shadow-[0_8px_32px_rgba(168,85,247,0.2)] transition-all">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 text-purple-400" />
            <span className="text-xs text-white/60">Risk-Adjusted</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {riskMetrics?.sharpeRatio?.toFixed(2) || '0.00'}
          </div>
          <div className="text-sm text-white/60">Sharpe Ratio</div>
          <div className="text-xs text-white/40 mt-2">
            {riskMetrics?.annualizedReturns?.toFixed(1) || 0}% annual return
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:shadow-[0_8px_32px_rgba(239,68,68,0.2)] transition-all">
          <div className="flex items-center justify-between mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <span className="text-xs text-white/60">Risk</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {riskMetrics?.maxDrawdown?.toFixed(1) || 0}%
          </div>
          <div className="text-sm text-white/60">Max Drawdown</div>
          <div className="text-xs text-white/40 mt-2">
            {riskMetrics?.volatility?.toFixed(1) || 0}% volatility
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector Performance Chart */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Sector Performance</h2>
          {overview && overview.sectorPerformance && overview.sectorPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={overview.sectorPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="sector" stroke="rgba(255,255,255,0.6)" />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(10, 14, 39, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="totalPL" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-white/40">
              No sector data available
            </div>
          )}
        </div>

        {/* Win Rate Pie Chart */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Win/Loss Distribution</h2>
          {overview && winRateData.length > 0 && overview.totalTrades > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={winRateData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {winRateData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(10, 14, 39, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-white/40">
              No trade history available
            </div>
          )}
        </div>
      </div>

      {/* Monthly P/L Chart */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Monthly P/L Trend (Last 12 Months)</h2>
        {overview && overview.monthlyPL && overview.monthlyPL.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={overview.monthlyPL}>
              <defs>
                <linearGradient id="colorPL" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.6)" />
              <YAxis stroke="rgba(255,255,255,0.6)" />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(10, 14, 39, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="pl" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPL)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-white/40">
            No monthly P/L data available. Portfolio history snapshots needed.
          </div>
        )}
      </div>

      {/* Benchmark Comparison Chart */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center justify-between">
          <span>Portfolio vs OSEBX Benchmark</span>
          {benchmark && (
            <span className={`text-sm ${benchmark.relativePerformance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {benchmark.relativePerformance >= 0 ? '+' : ''}{benchmark.relativePerformance}% vs benchmark
            </span>
          )}
        </h2>
        {benchmark && benchmark.portfolioPerformance && benchmark.portfolioPerformance.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                type="category"
                allowDuplicatedCategory={false}
                stroke="rgba(255,255,255,0.6)"
              />
              <YAxis stroke="rgba(255,255,255,0.6)" />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(10, 14, 39, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Line
                data={benchmark.portfolioPerformance}
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                name="Your Portfolio"
                strokeWidth={2}
                dot={false}
              />
              {benchmark.benchmarkPerformance && benchmark.benchmarkPerformance.length > 0 && (
                <Line
                  data={benchmark.benchmarkPerformance}
                  type="monotone"
                  dataKey="value"
                  stroke="#9333ea"
                  name="OSEBX"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-white/40">
            No portfolio history available for benchmark comparison
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4">
        <p className="text-sm text-blue-200">
          <strong>Note:</strong> Analytics are calculated from your portfolio history and completed trades.
          Data is cached for 1 hour to minimize computation. Some metrics may not be available until you have sufficient trading history.
        </p>
      </div>
    </div>
  )
}
