import { AlertTriangle, RefreshCw } from 'lucide-react'

interface DataWarningBannerProps {
  message?: string
  type?: 'warning' | 'info' | 'error'
}

export default function DataWarningBanner({
  message = "Live price data temporarily unavailable due to API rate limiting. Showing cached data or news-based analysis.",
  type = 'warning'
}: DataWarningBannerProps) {
  const bgColors = {
    warning: 'bg-yellow-900/20 border-yellow-500/30',
    info: 'bg-blue-900/20 border-blue-500/30',
    error: 'bg-red-900/20 border-red-500/30'
  }

  const textColors = {
    warning: 'text-yellow-400',
    info: 'text-blue-400',
    error: 'text-red-400'
  }

  return (
    <div className={`${bgColors[type]} backdrop-blur-sm border rounded-lg p-4 mb-6 flex items-start gap-3`}>
      <AlertTriangle className={`w-5 h-5 ${textColors[type]} flex-shrink-0 mt-0.5`} />
      <div className="flex-1">
        <p className="text-sm text-gray-300">{message}</p>
        <p className="text-xs text-gray-500 mt-1">
          Yahoo Finance API rate limit exceeded. Data will update automatically when the limit resets (typically within a few hours).
        </p>
      </div>
      <RefreshCw className={`w-4 h-4 ${textColors[type]} animate-spin opacity-50`} />
    </div>
  )
}
