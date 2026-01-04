import { useEffect, useState } from 'react'
import { ExternalLink, Clock, Tag, RefreshCw, CheckCircle } from 'lucide-react'
import { newsAPI } from '../services/api'
import type { NewsItem } from '../types'
import { formatDistanceToNow } from 'date-fns'

export default function News() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'latest'>('all')
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  useEffect(() => {
    loadNews()
  }, [filter])

  const loadNews = async () => {
    try {
      setLoading(true)
      const data = filter === 'latest'
        ? await newsAPI.getLatest(24)
        : await newsAPI.getAll(100)
      setNews(data)
    } catch (error) {
      console.error('Error loading news:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      const result = await newsAPI.refresh()

      showSuccessToast(
        `✓ ${result.message}\n` +
        `Analyzed ${result.stats.tickersScraped} stocks, found ${result.stats.newItems} new articles`
      )

      // Reload news after refresh
      await loadNews()
    } catch (error) {
      console.error('Error refreshing news:', error)
      showSuccessToast('✗ Failed to refresh news. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  const showSuccessToast = (message: string) => {
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 5000)
  }

  const getSentimentBadge = (sentiment?: string) => {
    if (!sentiment) return null

    const colors = {
      bullish: 'bg-green-600 text-white',
      neutral: 'bg-gray-600 text-white',
      bearish: 'bg-red-600 text-white'
    }

    return (
      <span className={`px-2 py-1 ${colors[sentiment as keyof typeof colors]} text-xs font-semibold rounded`}>
        {sentiment.toUpperCase()}
      </span>
    )
  }

  if (loading) {
    return <div className="text-center py-12">Loading news...</div>
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600/90 backdrop-blur-lg text-white px-6 py-3 rounded-xl shadow-lg flex items-center space-x-2 animate-slide-in border border-green-500/30">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="whitespace-pre-line">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Oslo Børs News</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            All News
          </button>
          <button
            onClick={() => setFilter('latest')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'latest'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            Last 24h
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2 transition-all ${
              refreshing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh News'}</span>
          </button>
        </div>
      </div>

      {/* News Count */}
      <div className="text-sm text-gray-400">
        {news.length} news items from Newsweb
      </div>

      {/* News List */}
      {news.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p>No news available. Click "Refresh News" to scrape the latest articles from top market movers.</p>
          <p className="text-sm mt-2">Or run the scheduled agent: <code className="bg-slate-700 px-2 py-1 rounded">npm run agents</code></p>
        </div>
      ) : (
        <div className="space-y-3">
          {news.map((item) => (
            <div key={item.id} className="card p-4 hover:border-slate-600 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded">
                      {item.ticker}
                    </span>
                    {getSentimentBadge(item.sentiment)}
                    {item.category && (
                      <span className="flex items-center text-xs text-gray-400">
                        <Tag className="w-3 h-3 mr-1" />
                        {item.category}
                      </span>
                    )}
                    <span className="flex items-center text-xs text-gray-400">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDistanceToNow(new Date(item.published_date), { addSuffix: true })}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white">{item.title}</h3>
                  {item.content && (
                    <p className="text-sm text-gray-400 line-clamp-2">{item.content}</p>
                  )}
                </div>
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-4 text-blue-500 hover:text-blue-400 flex-shrink-0"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
