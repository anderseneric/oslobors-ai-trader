import { useEffect, useState } from 'react'
import { TrendingUp, Users, DollarSign, Calendar, RefreshCw, AlertCircle, CheckCircle2, Building2, Clock } from 'lucide-react'
import { insiderAPI } from '../services/api'
import type { InsiderOpportunity, InsiderTransaction } from '../types'

// AI-Tech Glass Card Component
const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-gray-900/40 backdrop-blur-xl border border-blue-500/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(59,130,246,0.1)] hover:border-blue-500/30 hover:shadow-[0_8px_32px_rgba(59,130,246,0.2)] transition-all duration-300 ${className}`}>
    {children}
  </div>
)

// Signal badge component
const SignalBadge = ({ signal }: { signal: string }) => {
  const colors = {
    'STRONGLY BULLISH': 'bg-green-500/20 text-green-400 border-green-500/30',
    'BULLISH': 'bg-green-500/10 text-green-400 border-green-500/20',
    'MODERATELY BULLISH': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'NEUTRAL': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    'MODERATELY BEARISH': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'BEARISH': 'bg-red-500/10 text-red-400 border-red-500/20'
  }

  const color = colors[signal as keyof typeof colors] || colors.NEUTRAL

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${color}`}>
      {signal}
    </span>
  )
}

export default function InsiderActivity() {
  const [topBuys, setTopBuys] = useState<InsiderOpportunity[]>([])
  const [recentTransactions, setRecentTransactions] = useState<InsiderTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dayFilter, setDayFilter] = useState<7 | 30 | 90>(7)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchInsiderData = async () => {
    try {
      setLoading(true)

      // Fetch top insider buy opportunities
      const topBuysData = await insiderAPI.getTopBuys(dayFilter, 15)
      setTopBuys(topBuysData.data)

      // Fetch recent insider transactions
      const transactionsData = await insiderAPI.getTransactions(undefined, dayFilter)
      setRecentTransactions(transactionsData.data.slice(0, 20))

      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error fetching insider data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      // Trigger parsing of news for insider transactions
      await insiderAPI.parseFromNews()
      // Fetch updated data
      await fetchInsiderData()
    } catch (error) {
      console.error('Error refreshing insider data:', error)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchInsiderData()
  }, [dayFilter])

  const formatCurrency = (value?: number) => {
    if (!value) return 'N/A'
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M NOK`
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K NOK`
    return `${value.toFixed(0)} NOK`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('no-NO', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">Loading insider activity...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent mb-2">
            Insider Activity
          </h1>
          <p className="text-white/60">
            Track PDMR (Primary Insider) transactions on Oslo Børs
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Time Filter */}
          <div className="flex items-center space-x-2 bg-gray-900/40 backdrop-blur-xl border border-blue-500/20 rounded-xl p-1">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setDayFilter(days as 7 | 30 | 90)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  dayFilter === days
                    ? 'bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/20'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </span>
          </button>
        </div>
      </div>

      {/* Last Update */}
      {lastUpdate && (
        <div className="flex items-center space-x-2 text-sm text-white/40">
          <Clock className="w-4 h-4" />
          <span>Last updated: {lastUpdate.toLocaleTimeString('no-NO')}</span>
        </div>
      )}

      {/* Top Insider Buy Opportunities */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Top Insider Buy Opportunities</h2>
              <p className="text-sm text-white/60">Ranked by insider activity score (0-100)</p>
            </div>
          </div>
        </div>

        {topBuys.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 mb-2">No insider transactions found</p>
            <p className="text-sm text-white/30">
              Try refreshing or selecting a longer time period
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-white/80">Ticker</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-white/80">Score</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-white/80">Signal</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-white/80">Buy Count</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-white/80">Total Value</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-white/80">Insiders</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-white/80">Senior Buys</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-white/80">Latest</th>
                </tr>
              </thead>
              <tbody>
                {topBuys.map((opp, index) => (
                  <tr
                    key={opp.ticker}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors duration-200"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold">
                          {index + 1}
                        </div>
                        <span className="font-semibold text-white">{opp.ticker}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center">
                        <div className={`text-2xl font-bold ${
                          opp.insiderScore >= 80 ? 'text-green-400' :
                          opp.insiderScore >= 65 ? 'text-green-400/80' :
                          opp.insiderScore >= 50 ? 'text-blue-400' :
                          'text-white/60'
                        }`}>
                          {opp.insiderScore}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <SignalBadge signal={opp.signal} />
                    </td>
                    <td className="py-4 px-4 text-center text-white/80">{opp.buyCount}</td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-green-400 font-semibold">
                        {formatCurrency(opp.totalValue)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-white/80">{opp.insiderCount}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      {opp.seniorBuys > 0 ? (
                        <div className="flex items-center justify-center space-x-1">
                          <CheckCircle2 className="w-4 h-4 text-purple-400" />
                          <span className="text-purple-400 font-semibold">{opp.seniorBuys}</span>
                        </div>
                      ) : (
                        <span className="text-white/30">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-white/60">
                      {formatDate(opp.latestTransaction)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Recent Insider Transactions */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Recent Insider Transactions</h2>
              <p className="text-sm text-white/60">Latest PDMR trading activity</p>
            </div>
          </div>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 mb-2">No recent insider transactions</p>
            <p className="text-sm text-white/30">
              Click refresh to parse latest news for insider activity
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-lg font-bold text-white">{transaction.ticker}</span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        transaction.transaction_type === 'BUY'
                          ? 'bg-green-500/20 text-green-400'
                          : transaction.transaction_type === 'SELL'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {transaction.transaction_type === 'UNKNOWN' ? 'Pending Review' : transaction.transaction_type}
                      </span>
                      {transaction.role && (
                        <div className="flex items-center space-x-1 text-xs">
                          <Building2 className="w-3 h-3 text-purple-400" />
                          <span className="text-purple-400 font-medium">{transaction.role}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-white/80 mb-1">{transaction.insider_name}</p>
                    <div className="flex items-center space-x-4 text-xs text-white/60">
                      {transaction.shares && (
                        <div className="flex items-center space-x-1">
                          <span>Shares:</span>
                          <span className="font-semibold text-white/80">
                            {transaction.shares.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {transaction.price && (
                        <div className="flex items-center space-x-1">
                          <span>Price:</span>
                          <span className="font-semibold text-white/80">
                            {transaction.price.toFixed(2)} NOK
                          </span>
                        </div>
                      )}
                      {transaction.value && (
                        <div className="flex items-center space-x-1">
                          <DollarSign className="w-3 h-3" />
                          <span className="font-semibold text-white/80">
                            {formatCurrency(transaction.value)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-1 text-sm text-white/60 mb-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(transaction.transaction_date)}</span>
                    </div>
                    {transaction.news_link && (
                      <a
                        href={transaction.news_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        View News →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Info Banner */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-100/80">
            <p className="font-semibold mb-1">About Insider Activity</p>
            <p className="text-blue-100/60">
              PDMR (Primary Insider) transactions are legally required to be reported when executives,
              board members, and significant shareholders buy or sell company stock. These transactions
              can provide valuable insights into company insiders' confidence in the business.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
