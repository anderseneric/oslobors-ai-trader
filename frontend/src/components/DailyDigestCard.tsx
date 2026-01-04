import { TrendingUp, TrendingDown, Calendar, Newspaper, Activity } from 'lucide-react'
import type { DailyDigest } from '../types'

interface DailyDigestCardProps {
  digest: DailyDigest
  lastUpdate?: string
  cached?: boolean
}

export default function DailyDigestCard({ digest, lastUpdate, cached }: DailyDigestCardProps) {
  // Calculate summary stats
  const totalTips = digest.insights.length + digest.alerts.length + digest.warnings.length + digest.suggestions.length
  const highPriorityCount = [
    ...digest.insights,
    ...digest.alerts,
    ...digest.warnings,
    ...digest.suggestions
  ].filter(tip => tip.severity === 'high').length

  // Market sentiment calculation (mock - will be enhanced with real data)
  const calculateMarketSentiment = () => {
    const bullishSignals = digest.suggestions.filter(s => s.title.toLowerCase().includes('buy')).length
    const bearishSignals = digest.warnings.length
    const neutral = totalTips - bullishSignals - bearishSignals

    if (bullishSignals > bearishSignals) return { score: 7, label: 'Bullish', color: 'text-green-400' }
    if (bearishSignals > bullishSignals) return { score: 3, label: 'Bearish', color: 'text-red-400' }
    return { score: 5, label: 'Neutral', color: 'text-yellow-400' }
  }

  const sentiment = calculateMarketSentiment()

  const formatTime = (dateString?: string) => {
    if (!dateString) return '--:--'
    const date = new Date(dateString)
    return date.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-6 hover:shadow-[0_8px_32px_rgba(59,130,246,0.2)] transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Activity className="w-7 h-7 mr-3 text-blue-400" />
            Daily Market Digest
          </h2>
          <p className="text-sm text-white/60 mt-1">
            Last updated: {formatTime(lastUpdate)}
            {cached && <span className="ml-2 text-xs bg-blue-600/30 text-blue-300 px-2 py-1 rounded">Cached</span>}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${sentiment.color}`}>{sentiment.score}/10</div>
          <div className="text-sm text-white/60">{sentiment.label}</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Insights */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <span className="text-2xl font-bold text-blue-400">{digest.insights.length}</span>
          </div>
          <div className="text-sm text-white/80">Daily Insights</div>
        </div>

        {/* Alerts */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-yellow-400" />
            <span className="text-2xl font-bold text-yellow-400">{digest.alerts.length}</span>
          </div>
          <div className="text-sm text-white/80">Smart Alerts</div>
        </div>

        {/* Warnings */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <span className="text-2xl font-bold text-red-400">{digest.warnings.length}</span>
          </div>
          <div className="text-sm text-white/80">Risk Warnings</div>
        </div>

        {/* Suggestions */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-5 h-5 text-green-400" />
            <span className="text-2xl font-bold text-green-400">{digest.suggestions.length}</span>
          </div>
          <div className="text-sm text-white/80">Entry/Exit Signals</div>
        </div>
      </div>

      {/* High Priority Summary */}
      {highPriorityCount > 0 && (
        <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center space-x-2 text-red-400">
            <Newspaper className="w-5 h-5" />
            <span className="font-semibold">
              {highPriorityCount} high-priority {highPriorityCount === 1 ? 'item' : 'items'} requiring attention
            </span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {totalTips === 0 && (
        <div className="mt-6 text-center py-8 text-white/40">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No tips available yet. The agent will generate insights at 08:00 daily.</p>
        </div>
      )}
    </div>
  )
}
