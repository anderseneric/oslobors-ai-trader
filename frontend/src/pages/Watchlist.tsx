import { useState, useEffect } from 'react'
import { Plus, RefreshCw, Trash2, Edit2, TrendingUp, TrendingDown, Eye, Search } from 'lucide-react'
import ProfessionalPanel from '../components/ProfessionalPanel'
import DataTable, { Column } from '../components/DataTable'

interface WatchlistItem {
  id: number
  watchlist_id: number
  ticker: string
  company_name: string
  added_date: string
  notes: string | null
  target_entry: number | null
  alert_price: number | null
  current_price: number | null
  change: number | null
  changePercent: number | null
  volume: number | null
  source: string | null
}

interface Watchlist {
  id: number
  name: string
  created_at: string
}

export default function Watchlist() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([])
  const [currentWatchlist, setCurrentWatchlist] = useState<Watchlist | null>(null)
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Add stock form
  const [newTicker, setNewTicker] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [newTargetEntry, setNewTargetEntry] = useState('')
  const [newAlertPrice, setNewAlertPrice] = useState('')

  // Oslo Børs tickers for autocomplete
  const [osloTickers, setOsloTickers] = useState<any[]>([])

  useEffect(() => {
    loadWatchlists()
    loadOsloTickers()
  }, [])

  useEffect(() => {
    if (currentWatchlist) {
      loadWatchlistItems()
    }
  }, [currentWatchlist])

  const loadOsloTickers = async () => {
    try {
      const response = await fetch('/oslo-bors-tickers.json')
      const data = await response.json()
      setOsloTickers(data.tickers || data)
    } catch (error) {
      console.error('Error loading Oslo Børs tickers:', error)
    }
  }

  const loadWatchlists = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/watchlists')
      const data = await response.json()
      if (data.success) {
        setWatchlists(data.data)
        if (data.data.length > 0 && !currentWatchlist) {
          setCurrentWatchlist(data.data[0])
        }
      }
    } catch (error) {
      console.error('Error loading watchlists:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadWatchlistItems = async () => {
    if (!currentWatchlist) return

    setRefreshing(true)
    try {
      const response = await fetch(`http://localhost:3000/api/watchlists/${currentWatchlist.id}/items`)
      const data = await response.json()
      if (data.success) {
        setItems(data.data)
      }
    } catch (error) {
      console.error('Error loading watchlist items:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentWatchlist || !newTicker.trim()) return

    try {
      const response = await fetch(`http://localhost:3000/api/watchlists/${currentWatchlist.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: newTicker.toUpperCase(),
          notes: newNotes || null,
          target_entry: newTargetEntry ? parseFloat(newTargetEntry) : null,
          alert_price: newAlertPrice ? parseFloat(newAlertPrice) : null
        })
      })

      const data = await response.json()
      if (data.success) {
        setShowAddModal(false)
        setNewTicker('')
        setNewNotes('')
        setNewTargetEntry('')
        setNewAlertPrice('')
        loadWatchlistItems()
      } else {
        alert(data.error || 'Failed to add stock')
      }
    } catch (error) {
      console.error('Error adding stock:', error)
      alert('Failed to add stock to watchlist')
    }
  }

  const handleRemoveStock = async (ticker: string) => {
    if (!currentWatchlist) return
    if (!confirm(`Remove ${ticker} from watchlist?`)) return

    try {
      const response = await fetch(
        `http://localhost:3000/api/watchlists/${currentWatchlist.id}/items/${ticker}`,
        { method: 'DELETE' }
      )
      const data = await response.json()
      if (data.success) {
        loadWatchlistItems()
      }
    } catch (error) {
      console.error('Error removing stock:', error)
    }
  }

  const filteredItems = items.filter(item =>
    item.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const columns: Column[] = [
    {
      key: 'ticker',
      label: 'TICKER',
      align: 'left',
      sortable: true,
      format: (value, row) => (
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <div>
            <div className="font-bold text-white">{value}</div>
            <div className="text-xs text-neutral">{row.company_name}</div>
          </div>
        </div>
      )
    },
    {
      key: 'current_price',
      label: 'PRICE',
      align: 'right',
      sortable: true,
      format: (value) => value ? `${value.toFixed(2)} NOK` : '—',
      className: 'text-white'
    },
    {
      key: 'changePercent',
      label: 'CHANGE',
      align: 'right',
      sortable: true,
      format: (value, row) => {
        if (!value) return '—'
        const isPositive = value >= 0
        return (
          <div className="flex items-center justify-end space-x-1">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-profit" />
            ) : (
              <TrendingDown className="w-4 h-4 text-loss" />
            )}
            <span className={isPositive ? 'text-profit' : 'text-loss'}>
              {isPositive ? '+' : ''}{value.toFixed(2)}%
            </span>
          </div>
        )
      }
    },
    {
      key: 'volume',
      label: 'VOLUME',
      align: 'right',
      sortable: true,
      format: (value) => value ? value.toLocaleString() : '—'
    },
    {
      key: 'target_entry',
      label: 'TARGET ENTRY',
      align: 'right',
      format: (value) => value ? `${value.toFixed(2)} NOK` : '—',
      className: 'text-amber-500'
    },
    {
      key: 'notes',
      label: 'NOTES',
      align: 'left',
      format: (value) => (
        <div className="text-sm text-neutral truncate max-w-xs">
          {value || '—'}
        </div>
      )
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      format: (_, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleRemoveStock(row.ticker)
          }}
          className="text-neutral hover:text-loss transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral">Loading watchlists...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Eye className="w-8 h-8 text-amber-500" />
          <div>
            <h1 className="text-3xl font-bold text-white">Watchlist</h1>
            <p className="text-neutral">Monitor stocks before adding to portfolio</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadWatchlistItems}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-navy-800 border border-white/10 rounded-lg text-white hover:bg-navy-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Prices</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-500 rounded-lg text-navy-900 font-semibold hover:bg-amber-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Stock</span>
          </button>
        </div>
      </div>

      {/* Watchlist Tabs */}
      {watchlists.length > 1 && (
        <div className="flex items-center space-x-2">
          {watchlists.map((wl) => (
            <button
              key={wl.id}
              onClick={() => setCurrentWatchlist(wl)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentWatchlist?.id === wl.id
                  ? 'bg-amber-500 text-navy-900'
                  : 'bg-navy-800 text-neutral hover:text-white border border-white/10'
              }`}
            >
              {wl.name}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral" />
        <input
          type="text"
          placeholder="Search by ticker or company name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-navy-800 border border-white/10 rounded-lg text-white placeholder-neutral focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Watchlist Table */}
      <ProfessionalPanel
        title={`${currentWatchlist?.name || 'Watchlist'} (${filteredItems.length} stocks)`}
      >
        <DataTable
          columns={columns}
          data={filteredItems}
          keyField="ticker"
          compact
        />
      </ProfessionalPanel>

      {/* Add Stock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-navy-800 border border-white/10 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Add Stock to Watchlist</h3>
            <form onSubmit={handleAddStock} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral mb-2">
                  Ticker Symbol *
                </label>
                <input
                  type="text"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                  placeholder="e.g., EQNR"
                  className="w-full px-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-white placeholder-neutral focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral mb-2">
                  Target Entry Price (optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newTargetEntry}
                  onChange={(e) => setNewTargetEntry(e.target.value)}
                  placeholder="NOK"
                  className="w-full px-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-white placeholder-neutral focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral mb-2">
                  Alert Price (optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newAlertPrice}
                  onChange={(e) => setNewAlertPrice(e.target.value)}
                  placeholder="NOK"
                  className="w-full px-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-white placeholder-neutral focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Investment thesis, reasons to watch..."
                  rows={3}
                  className="w-full px-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-white placeholder-neutral focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setNewTicker('')
                    setNewNotes('')
                    setNewTargetEntry('')
                    setNewAlertPrice('')
                  }}
                  className="flex-1 px-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-neutral hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-amber-500 rounded-lg text-navy-900 font-semibold hover:bg-amber-400 transition-colors"
                >
                  Add to Watchlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
