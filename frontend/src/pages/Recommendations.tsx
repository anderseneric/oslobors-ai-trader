import { useEffect, useState } from 'react'
import { Lightbulb, RefreshCw, Clock, TrendingUp, TrendingDown, Target, Shield, Calendar, PieChart, Zap, AlertCircle } from 'lucide-react'
import { recommendationsAPI } from '../services/api'
import type { Recommendation } from '../types'

export default function Recommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadRecommendations()
  }, [])

  const loadRecommendations = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const result = await recommendationsAPI.getAll()

      setRecommendations(result.data || [])
      setLastUpdate(result.lastUpdate)
      setIsCached(result.cached || false)
      setMessage(result.message || null)
    } catch (error) {
      console.error('Error loading recommendations:', error)
      setMessage('Unable to connect to the recommendation service. Please check that the backend is running and try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'STRONG_BUY':
        return 'bg-green-600 text-white'
      case 'BUY':
        return 'bg-green-500 text-white'
      case 'HOLD':
        return 'bg-yellow-500 text-black'
      case 'SELL':
        return 'bg-red-500 text-white'
      case 'AVOID':
        return 'bg-red-700 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getRecommendationIcon = (rec: string) => {
    switch (rec) {
      case 'STRONG_BUY':
      case 'BUY':
        return <TrendingUp className="w-5 h-5" />
      case 'SELL':
      case 'AVOID':
        return <TrendingDown className="w-5 h-5" />
      default:
        return <Zap className="w-5 h-5" />
    }
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '--:--:--'
    const date = new Date(dateString)
    return date.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const isStaleData = (dateString: string | null) => {
    if (!dateString) return false
    const now = new Date()
    const lastUpdate = new Date(dateString)
    const diffMs = now.getTime() - lastUpdate.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    return diffHours > 24
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center">
            <Lightbulb className="w-8 h-8 mr-3 text-yellow-500" />
            AI Swing Trade Picks
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-6 bg-slate-700 rounded w-1/3 mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-slate-700 rounded w-full"></div>
                <div className="h-4 bg-slate-700 rounded w-5/6"></div>
                <div className="h-4 bg-slate-700 rounded w-4/6"></div>
              </div>
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
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold flex items-center">
            <Lightbulb className="w-8 h-8 mr-3 text-yellow-500" />
            AI Swing Trade Picks
          </h2>
          {lastUpdate && (
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              <span>Last updated: {formatTime(lastUpdate)}</span>
              {isCached && <span className="text-xs bg-blue-600 px-2 py-1 rounded">Cached</span>}
            </div>
          )}
        </div>
        <button
          onClick={() => loadRecommendations(true)}
          disabled={refreshing}
          className={`btn-secondary flex items-center space-x-2 ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Analyzing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
        <p className="text-sm text-blue-200">
          <strong>Note:</strong> These are AI-generated recommendations based on recent news, technical indicators, and market conditions.
          Always do your own research before making investment decisions. Recommendations are cached for 4 hours.
        </p>
      </div>

      {/* Stale Data Alert */}
      {lastUpdate && isStaleData(lastUpdate) && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-yellow-300 font-semibold">Recommendations are from yesterday</p>
            <p className="text-yellow-200/80 text-sm mt-1">
              These recommendations are over 24 hours old. Consider refreshing for today's analysis based on the latest market conditions.
            </p>
          </div>
          <button
            onClick={() => loadRecommendations(true)}
            disabled={refreshing}
            className="ml-4 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-semibold whitespace-nowrap disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
      )}

      {/* Recommendations Grid */}
      {message && recommendations.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Lightbulb className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <p className="text-lg">{message}</p>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Lightbulb className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <p className="text-lg font-semibold text-white">No High-Confidence Recommendations Today</p>
          <p className="text-sm mt-3 max-w-2xl mx-auto leading-relaxed">
            All analyzed stocks had confidence below 50%. The AI only recommends stocks when market conditions are favorable for swing trading.
          </p>
          <p className="text-sm mt-2 text-gray-500">
            Check back later or click <strong className="text-blue-400">Refresh</strong> to re-analyze with the latest market data.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {recommendations.map((rec, index) => (
            <div key={rec.id || index} className="card p-6 hover:shadow-lg transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-blue-400">{rec.ticker}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center space-x-1 ${getRecommendationColor(rec.recommendation)}`}>
                      {getRecommendationIcon(rec.recommendation)}
                      <span>{rec.recommendation.replace('_', ' ')}</span>
                    </span>
                    <span className="text-sm text-gray-400">
                      Confidence: <strong className="text-white">{rec.confidence}%</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-700/50 p-3 rounded">
                  <div className="flex items-center text-sm text-gray-400 mb-1">
                    <Target className="w-4 h-4 mr-1" />
                    Entry Range
                  </div>
                  <div className="text-lg font-semibold text-green-400">
                    {rec.entry_range[0].toFixed(2)} - {rec.entry_range[1].toFixed(2)} NOK
                  </div>
                </div>

                <div className="bg-slate-700/50 p-3 rounded">
                  <div className="flex items-center text-sm text-gray-400 mb-1">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Target Price
                  </div>
                  <div className="text-lg font-semibold text-blue-400">
                    {rec.target_price.toFixed(2)} NOK
                  </div>
                </div>

                <div className="bg-slate-700/50 p-3 rounded">
                  <div className="flex items-center text-sm text-gray-400 mb-1">
                    <Shield className="w-4 h-4 mr-1" />
                    Stop Loss
                  </div>
                  <div className="text-lg font-semibold text-red-400">
                    {rec.stop_loss.toFixed(2)} NOK
                  </div>
                </div>

                <div className="bg-slate-700/50 p-3 rounded">
                  <div className="flex items-center text-sm text-gray-400 mb-1">
                    <Zap className="w-4 h-4 mr-1" />
                    Risk/Reward
                  </div>
                  <div className="text-lg font-semibold text-yellow-400">
                    {rec.risk_reward_ratio}
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div className="flex items-center text-gray-400">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>Hold: <strong className="text-white">{rec.hold_period}</strong></span>
                </div>
                <div className="flex items-center text-gray-400">
                  <PieChart className="w-4 h-4 mr-2" />
                  <span>Position: <strong className="text-white">{rec.position_size_percent}%</strong></span>
                </div>
              </div>

              {/* Reasoning */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Why this trade?</h4>
                <ul className="space-y-1">
                  {rec.reasoning.map((reason, i) => (
                    <li key={i} className="text-sm text-gray-400 flex items-start">
                      <span className="text-blue-400 mr-2">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
