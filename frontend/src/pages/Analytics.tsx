import { useEffect, useState } from 'react'
import { TrendingUp, Activity, Target, AlertTriangle, BarChart3, RefreshCw } from 'lucide-react'
import { analyticsAPI } from '../services/api'
import type { AnalyticsOverview, RiskAdjustedMetrics, BenchmarkComparison } from '../types'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import ProfessionalPanel from '../components/ProfessionalPanel'

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
          <div className="h-10 bg-navy-900/50 rounded w-64 animate-pulse" />
          <div className="h-10 bg-navy-900/50 rounded w-32 animate-pulse" />
        </div>
        <div className="grid grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-navy-900/50 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="h-96 bg-navy-900/50 rounded-lg animate-pulse" />
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
        <div className="flex items-center space-x-3">
          <BarChart3 className="w-8 h-8 text-amber-500" />
          <div>
            <h1 className="text-3xl font-bold text-white">Portfolio Analytics</h1>
            <p className="text-neutral">Performance metrics and risk-adjusted returns</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`flex items-center space-x-2 px-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-neutral hover:text-white hover:border-amber-500/50 transition-colors ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Win Rate */}
        <ProfessionalPanel className="hover:border-amber-500/30 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <Target className="w-8 h-8 text-profit" />
            <span className="text-xs text-neutral uppercase tracking-wider">Performance</span>
          </div>
          <div className="text-3xl font-bold text-white font-mono mb-1">
            {overview?.winRate || 0}%
          </div>
          <div className="text-sm text-neutral uppercase tracking-wider">Win Rate</div>
          <div className="text-xs text-neutral opacity-70 mt-2">
            {overview?.winningTrades || 0} wins / {overview?.totalTrades || 0} trades
          </div>
        </ProfessionalPanel>

        {/* Avg Hold Time */}
        <ProfessionalPanel className="hover:border-amber-500/30 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-8 h-8 text-amber-500" />
            <span className="text-xs text-neutral uppercase tracking-wider">Average</span>
          </div>
          <div className="text-3xl font-bold text-white font-mono mb-1">
            {overview?.avgHoldTimeDays || 0}d
          </div>
          <div className="text-sm text-neutral uppercase tracking-wider">Avg Hold Time</div>
          <div className="text-xs text-neutral opacity-70 mt-2">
            {overview?.totalClosedPositions || 0} closed positions
          </div>
        </ProfessionalPanel>

        {/* Sharpe Ratio */}
        <ProfessionalPanel className="hover:border-amber-500/30 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 text-amber-500" />
            <span className="text-xs text-neutral uppercase tracking-wider">Risk-Adjusted</span>
          </div>
          <div className="text-3xl font-bold text-white font-mono mb-1">
            {riskMetrics?.sharpeRatio?.toFixed(2) || '0.00'}
          </div>
          <div className="text-sm text-neutral uppercase tracking-wider">Sharpe Ratio</div>
          <div className="text-xs text-neutral opacity-70 mt-2">
            {riskMetrics?.annualizedReturns?.toFixed(1) || 0}% annual return
          </div>
        </ProfessionalPanel>

        {/* Max Drawdown */}
        <ProfessionalPanel className="hover:border-amber-500/30 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <AlertTriangle className="w-8 h-8 text-loss" />
            <span className="text-xs text-neutral uppercase tracking-wider">Risk</span>
          </div>
          <div className="text-3xl font-bold text-white font-mono mb-1">
            {riskMetrics?.maxDrawdown?.toFixed(1) || 0}%
          </div>
          <div className="text-sm text-neutral uppercase tracking-wider">Max Drawdown</div>
          <div className="text-xs text-neutral opacity-70 mt-2">
            {riskMetrics?.volatility?.toFixed(1) || 0}% volatility
          </div>
        </ProfessionalPanel>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector Performance Chart */}
        <ProfessionalPanel title="Sector Performance">
          {overview && overview.sectorPerformance && overview.sectorPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={overview.sectorPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="sector" stroke="rgba(255,255,255,0.6)" />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f3243', border: '1px solid #ffffff20', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="totalPL" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-neutral">
              No sector data available
            </div>
          )}
        </ProfessionalPanel>

        {/* Win Rate Pie Chart */}
        <ProfessionalPanel title="Win/Loss Distribution">
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
                  contentStyle={{ backgroundColor: '#1f3243', border: '1px solid #ffffff20', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-neutral">
              No trade history available
            </div>
          )}
        </ProfessionalPanel>
      </div>

      {/* Monthly P/L Chart */}
      <ProfessionalPanel title="Monthly P/L Trend (Last 12 Months)">
        {overview && overview.monthlyPL && overview.monthlyPL.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={overview.monthlyPL}>
              <defs>
                <linearGradient id="colorPL" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.6)" />
              <YAxis stroke="rgba(255,255,255,0.6)" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f3243', border: '1px solid #ffffff20', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="pl" stroke="#f59e0b" fillOpacity={1} fill="url(#colorPL)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-neutral">
            No monthly P/L data available. Portfolio history snapshots needed.
          </div>
        )}
      </ProfessionalPanel>

      {/* Benchmark Comparison Chart */}
      <ProfessionalPanel
        title="Portfolio vs OSEBX Benchmark"
        subtitle={benchmark && benchmark.relativePerformance !== undefined ?
          `${benchmark.relativePerformance >= 0 ? '+' : ''}${benchmark.relativePerformance}% vs benchmark` :
          undefined
        }
      >
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
                contentStyle={{ backgroundColor: '#1f3243', border: '1px solid #ffffff20', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Line
                data={benchmark.portfolioPerformance}
                type="monotone"
                dataKey="value"
                stroke="#f59e0b"
                name="Your Portfolio"
                strokeWidth={2}
                dot={false}
              />
              {benchmark.benchmarkPerformance && benchmark.benchmarkPerformance.length > 0 && (
                <Line
                  data={benchmark.benchmarkPerformance}
                  type="monotone"
                  dataKey="value"
                  stroke="#94a3b8"
                  name="OSEBX"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-neutral">
            No portfolio history available for benchmark comparison
          </div>
        )}
      </ProfessionalPanel>

      {/* Info Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <p className="text-sm text-neutral">
          <strong className="text-white">Note:</strong> Analytics are calculated from your portfolio history and completed trades.
          Data is cached for 1 hour to minimize computation. Some metrics may not be available until you have sufficient trading history.
        </p>
      </div>
    </div>
  )
}
