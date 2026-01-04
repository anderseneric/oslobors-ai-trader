import { useState } from 'react'
import { Lightbulb, AlertTriangle, Shield, Target, ChevronDown, ChevronUp } from 'lucide-react'
import type { TipInsight } from '../types'

interface TipsInsightsGridProps {
  tips: TipInsight[]
}

export default function TipsInsightsGrid({ tips }: TipsInsightsGridProps) {
  const [expandedTips, setExpandedTips] = useState<Set<number>>(new Set())

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedTips)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedTips(newExpanded)
  }

  const getIcon = (tipType: string) => {
    switch (tipType) {
      case 'daily_insight':
        return <Lightbulb className="w-5 h-5" />
      case 'smart_alert':
        return <AlertTriangle className="w-5 h-5" />
      case 'risk_warning':
        return <Shield className="w-5 h-5" />
      case 'entry_exit':
        return <Target className="w-5 h-5" />
      default:
        return <Lightbulb className="w-5 h-5" />
    }
  }

  const getColorClasses = (severity: string) => {
    switch (severity) {
      case 'high':
        return {
          border: 'border-red-500/30',
          bg: 'bg-red-500/5',
          text: 'text-red-400',
          badge: 'bg-red-500/20 text-red-300',
          hover: 'hover:shadow-[0_8px_32px_rgba(239,68,68,0.2)]'
        }
      case 'medium':
        return {
          border: 'border-yellow-500/30',
          bg: 'bg-yellow-500/5',
          text: 'text-yellow-400',
          badge: 'bg-yellow-500/20 text-yellow-300',
          hover: 'hover:shadow-[0_8px_32px_rgba(234,179,8,0.2)]'
        }
      case 'low':
        return {
          border: 'border-blue-500/30',
          bg: 'bg-blue-500/5',
          text: 'text-blue-400',
          badge: 'bg-blue-500/20 text-blue-300',
          hover: 'hover:shadow-[0_8px_32px_rgba(59,130,246,0.2)]'
        }
      default:
        return {
          border: 'border-white/10',
          bg: 'bg-white/5',
          text: 'text-white',
          badge: 'bg-white/20 text-white',
          hover: 'hover:shadow-[0_8px_32px_rgba(255,255,255,0.1)]'
        }
    }
  }

  const getTipTypeLabel = (tipType: string) => {
    switch (tipType) {
      case 'daily_insight':
        return 'Daily Insight'
      case 'smart_alert':
        return 'Smart Alert'
      case 'risk_warning':
        return 'Risk Warning'
      case 'entry_exit':
        return 'Entry/Exit Signal'
      default:
        return tipType
    }
  }

  if (tips.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
        <Lightbulb className="w-16 h-16 mx-auto mb-4 text-white/20" />
        <p className="text-lg text-white/40">No tips available for this filter.</p>
        <p className="text-sm text-white/30 mt-2">Try adjusting your filters or wait for the next agent run.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {tips.map((tip) => {
        const colors = getColorClasses(tip.severity)
        const isExpanded = expandedTips.has(tip.id)

        return (
          <div
            key={tip.id}
            className={`bg-white/5 backdrop-blur-xl border ${colors.border} rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-6 transition-all duration-300 ${colors.hover}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start space-x-3 flex-1">
                <div className={`${colors.text} mt-1`}>
                  {getIcon(tip.tip_type)}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white leading-tight">
                    {tip.title}
                  </h3>
                  {tip.ticker && (
                    <div className="mt-1">
                      <span className="text-xs bg-white/10 text-white/80 px-2 py-1 rounded">
                        {tip.ticker}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-col items-end space-y-2">
                <span className={`text-xs px-2 py-1 rounded ${colors.badge} font-medium`}>
                  {tip.severity.toUpperCase()}
                </span>
                <span className="text-xs bg-white/10 text-white/60 px-2 py-1 rounded">
                  {tip.confidence}% confidence
                </span>
              </div>
            </div>

            {/* Type Badge */}
            <div className="mb-3">
              <span className="text-xs bg-white/5 text-white/60 px-2 py-1 rounded border border-white/10">
                {getTipTypeLabel(tip.tip_type)}
              </span>
            </div>

            {/* Description Preview */}
            <p className={`text-sm text-white/80 mb-4 ${!isExpanded && 'line-clamp-2'}`}>
              {tip.description}
            </p>

            {/* Metadata (if expanded) */}
            {isExpanded && tip.metadata && (
              <div className="mb-4 bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-xs text-white/60 mb-2 font-semibold">Technical Data:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {tip.metadata.rsi && (
                    <div>
                      <span className="text-white/40">RSI:</span>{' '}
                      <span className="text-white/80">{tip.metadata.rsi.toFixed(2)}</span>
                    </div>
                  )}
                  {tip.metadata.volume_spike && (
                    <div>
                      <span className="text-white/40">Volume Spike:</span>{' '}
                      <span className="text-white/80">{tip.metadata.volume_spike.toFixed(2)}x</span>
                    </div>
                  )}
                  {tip.metadata.current_price && (
                    <div>
                      <span className="text-white/40">Price:</span>{' '}
                      <span className="text-white/80">{tip.metadata.current_price.toFixed(2)} NOK</span>
                    </div>
                  )}
                  {tip.metadata.pl_percent && (
                    <div>
                      <span className="text-white/40">P/L:</span>{' '}
                      <span className={`${parseFloat(tip.metadata.pl_percent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {parseFloat(tip.metadata.pl_percent) >= 0 ? '+' : ''}{tip.metadata.pl_percent}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => toggleExpand(tip.id)}
                className="flex items-center space-x-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <span>{isExpanded ? 'Show Less' : 'Show More'}</span>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {tip.action_required && (
                <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg text-sm font-semibold transition-all">
                  Take Action
                </button>
              )}
            </div>

            {/* Timestamp */}
            <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/40">
              {new Date(tip.created_at).toLocaleString('no-NO', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
