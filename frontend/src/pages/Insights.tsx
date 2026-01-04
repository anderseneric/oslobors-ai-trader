import { useEffect, useState } from 'react'
import { RefreshCw, Lightbulb, AlertCircle } from 'lucide-react'
import { tipsAPI } from '../services/api'
import type { TipInsight, DailyDigest } from '../types'
import DailyDigestCard from '../components/DailyDigestCard'
import TipsInsightsGrid from '../components/TipsInsightsGrid'
import InsightsFilters from '../components/InsightsFilters'

export default function Insights() {
  const [digest, setDigest] = useState<DailyDigest | null>(null)
  const [allTips, setAllTips] = useState<TipInsight[]>([])
  const [filteredTips, setFilteredTips] = useState<TipInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')

  useEffect(() => {
    loadInsights()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [allTips, selectedType, selectedSeverity])

  const loadInsights = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load daily digest
      const digestResponse = await tipsAPI.getDailyDigest()

      if (digestResponse.success) {
        setDigest(digestResponse.data)
        setLastUpdate(digestResponse.lastUpdate || new Date().toISOString())
        setIsCached(digestResponse.cached)

        // Combine all tips from digest
        const combined = [
          ...digestResponse.data.insights,
          ...digestResponse.data.alerts,
          ...digestResponse.data.warnings,
          ...digestResponse.data.suggestions
        ]
        setAllTips(combined)
      } else if (digestResponse.message) {
        setError(digestResponse.message)
      }

    } catch (err) {
      console.error('Error loading insights:', err)
      setError('Failed to load insights. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      await tipsAPI.refresh()
      // Wait a moment for cache to clear, then reload
      setTimeout(() => {
        loadInsights()
        setRefreshing(false)
      }, 1000)
    } catch (err) {
      console.error('Error refreshing:', err)
      setRefreshing(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...allTips]

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(tip => tip.tip_type === selectedType)
    }

    // Filter by severity
    if (selectedSeverity !== 'all') {
      filtered = filtered.filter(tip => tip.severity === selectedSeverity)
    }

    // Sort by severity (high first), then by confidence
    filtered.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 }
      const severityDiff = severityOrder[b.severity as keyof typeof severityOrder] - severityOrder[a.severity as keyof typeof severityOrder]
      if (severityDiff !== 0) return severityDiff
      return b.confidence - a.confidence
    })

    setFilteredTips(filtered)
  }

  const handleClearFilters = () => {
    setSelectedType('all')
    setSelectedSeverity('all')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-10 bg-white/5 rounded w-64 animate-pulse" />
          <div className="h-10 bg-white/5 rounded w-32 animate-pulse" />
        </div>

        {/* Digest Skeleton */}
        <div className="bg-white/5 rounded-2xl p-6 animate-pulse">
          <div className="h-8 bg-white/10 rounded w-48 mb-4" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-white/10 rounded" />
            ))}
          </div>
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white/5 rounded-2xl p-6 animate-pulse">
              <div className="h-6 bg-white/10 rounded w-3/4 mb-3" />
              <div className="h-4 bg-white/10 rounded w-full mb-2" />
              <div className="h-4 bg-white/10 rounded w-5/6" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center">
            <Lightbulb className="w-8 h-8 mr-3 text-yellow-500" />
            AI Insights & Tips
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Actionable trading insights powered by Claude AI
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

      {/* Error Message */}
      {error && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-yellow-300 font-semibold">No Insights Available</p>
            <p className="text-yellow-200/80 text-sm mt-1">{error}</p>
            <p className="text-yellow-200/60 text-xs mt-2">
              The tips-insights agent runs daily at 08:00. You can also manually run it with: <code className="bg-yellow-500/20 px-2 py-1 rounded">npm run agents</code>
            </p>
          </div>
        </div>
      )}

      {/* Daily Digest */}
      {digest && (
        <DailyDigestCard
          digest={digest}
          lastUpdate={lastUpdate || undefined}
          cached={isCached}
        />
      )}

      {/* Filters */}
      {allTips.length > 0 && (
        <InsightsFilters
          selectedType={selectedType}
          selectedSeverity={selectedSeverity}
          onTypeChange={setSelectedType}
          onSeverityChange={setSelectedSeverity}
          onClearFilters={handleClearFilters}
        />
      )}

      {/* Results Count */}
      {allTips.length > 0 && (
        <div className="flex items-center justify-between text-sm text-white/60">
          <span>
            Showing {filteredTips.length} of {allTips.length} tips
          </span>
          {(selectedType !== 'all' || selectedSeverity !== 'all') && (
            <span className="text-blue-400">Filters active</span>
          )}
        </div>
      )}

      {/* Tips Grid */}
      <TipsInsightsGrid tips={filteredTips} />

      {/* Info Banner */}
      {allTips.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4 mt-6">
          <p className="text-sm text-blue-200">
            <strong>💡 How it works:</strong> The AI agent analyzes your portfolio positions daily at 08:00,
            combining technical indicators (RSI, MACD, volume), recent news, and market context to generate
            actionable insights. Tips are cached for 2 hours to minimize API costs.
          </p>
        </div>
      )}
    </div>
  )
}
