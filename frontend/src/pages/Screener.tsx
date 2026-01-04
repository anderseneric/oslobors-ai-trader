import { useEffect, useState } from 'react'
import { RefreshCw, TrendingUp, Activity } from 'lucide-react'
import { screenerAPI } from '../services/api'
import type { ScreenerResult } from '../types'

export default function Screener() {
  const [results, setResults] = useState<ScreenerResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadResults()
  }, [])

  const loadResults = async () => {
    try {
      setLoading(true)
      const data = await screenerAPI.getResults()
      setResults(data || [])
    } catch (error) {
      console.error('Error loading screener results:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRSIColor = (rsi: number) => {
    if (rsi < 30) return 'text-green-500' // Oversold - bullish
    if (rsi > 70) return 'text-red-500' // Overbought - bearish
    return 'text-yellow-500' // Neutral
  }

  const getRSILabel = (rsi: number) => {
    if (rsi < 30) return 'Oversold'
    if (rsi > 70) return 'Overbought'
    return 'Neutral'
  }

  if (loading) {
    return <div className="text-center py-12">Loading screener results...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Stock Screener</h2>
          <p className="text-sm text-gray-400 mt-1">
            Daily screening results • Runs at 18:00 after market close
          </p>
        </div>
        <button
          onClick={loadResults}
          className="btn-primary flex items-center space-x-2"
        >
          <RefreshCw className="w-5 h-5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Criteria Info */}
      <div className="card p-4">
        <h3 className="font-semibold mb-3">Screening Criteria</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-400">RSI Range</div>
            <div className="font-semibold">30 - 70</div>
          </div>
          <div>
            <div className="text-gray-400">Volume Spike</div>
            <div className="font-semibold">≥ 1.5x average</div>
          </div>
          <div>
            <div className="text-gray-400">Market</div>
            <div className="font-semibold">Oslo Børs</div>
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">No screening results yet</p>
          <p className="text-sm">The screener agent runs daily at 18:00</p>
          <p className="text-sm mt-2">To run manually: <code className="bg-slate-700 px-2 py-1 rounded">npm run agents</code></p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="bg-slate-700 px-4 py-3 border-b border-slate-600">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Top {results.length} Results</span>
              <span className="text-sm text-gray-400">
                Sorted by score
              </span>
            </div>
          </div>
          <table className="w-full">
            <thead className="bg-slate-750">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Ticker</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">RSI</th>
                <th className="px-4 py-3 text-right">Volume Spike</th>
                <th className="px-4 py-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {results.map((result, index) => (
                <tr key={result.ticker} className="hover:bg-slate-750">
                  <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-blue-400">{result.ticker}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        result.rsi < 30 ? 'bg-green-900 text-green-300' :
                        result.rsi > 70 ? 'bg-red-900 text-red-300' :
                        'bg-yellow-900 text-yellow-300'
                      }`}>
                        {getRSILabel(result.rsi)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{result.price.toFixed(2)} NOK</td>
                  <td className={`px-4 py-3 text-right font-semibold ${getRSIColor(result.rsi)}`}>
                    {result.rsi.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="flex items-center justify-end">
                      <TrendingUp className="w-4 h-4 mr-1 text-blue-400" />
                      {result.volume_spike.toFixed(2)}x
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-blue-400">
                    {result.score.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
