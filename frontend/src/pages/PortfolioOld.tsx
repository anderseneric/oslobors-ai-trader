import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, TrendingUp, TrendingDown, Search, RefreshCw, Clock, CheckCircle } from 'lucide-react'
import { portfolioAPI } from '../services/api'
import type { PortfolioPosition } from '../types'
import osloTickers from '../../../oslo-bors-tickers.json'

interface Ticker {
  symbol: string
  name: string
  sector: string
}

export default function Portfolio() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [tickerSearch, setTickerSearch] = useState('')
  const [selectedTicker, setSelectedTicker] = useState<Ticker | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [transactionFees, setTransactionFees] = useState<string>('0')
  const [autoCalculateFees, setAutoCalculateFees] = useState(true)
  const searchRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const tickers: Ticker[] = osloTickers.tickers

  // Check if market is open (Oslo Børs: 09:00-16:20 Norwegian time)
  const isMarketOpen = () => {
    const now = new Date()
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const timeInMinutes = hours * 60 + minutes

    // Market hours: 9:00 (540 min) to 16:20 (980 min)
    const marketOpen = 540 // 9:00
    const marketClose = 980 // 16:20

    // Also check if it's a weekday (Mon-Fri)
    const day = now.getDay()
    const isWeekday = day >= 1 && day <= 5

    return isWeekday && timeInMinutes >= marketOpen && timeInMinutes <= marketClose
  }

  useEffect(() => {
    loadPortfolio()

    // Auto-refresh on page load
    setTimeout(() => {
      refreshPrices()
    }, 1000)

    // Start polling if market is open
    if (isMarketOpen()) {
      startPolling()
    }

    return () => {
      stopPolling()
    }
  }, [])

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const startPolling = () => {
    // Poll every 2 minutes (120000 ms)
    pollIntervalRef.current = setInterval(() => {
      if (isMarketOpen()) {
        refreshPrices(true) // silent refresh
      } else {
        stopPolling()
      }
    }, 120000) // 2 minutes
  }

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }

  const loadPortfolio = async () => {
    try {
      setLoading(true)
      const data = await portfolioAPI.getAll()
      setPositions(data)

      // Set last update from most recent position update
      if (data.length > 0 && data[0].updated_at) {
        setLastUpdate(new Date(data[0].updated_at))
      }
    } catch (error) {
      console.error('Error loading portfolio:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshPrices = async (silent = false) => {
    try {
      if (!silent) setRefreshing(true)

      const result = await portfolioAPI.refreshPrices()

      if (result.success) {
        setPositions(result.portfolio)
        setLastUpdate(new Date())

        if (!silent) {
          showSuccessToast(`✓ Updated ${result.updated} stock${result.updated !== 1 ? 's' : ''}`)
        }
      }
    } catch (error) {
      console.error('Error refreshing prices:', error)
      if (!silent) {
        showSuccessToast('✗ Failed to refresh prices')
      }
    } finally {
      if (!silent) setRefreshing(false)
    }
  }

  const showSuccessToast = (message: string) => {
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to remove this position?')) {
      try {
        await portfolioAPI.delete(id)
        await loadPortfolio()
        showSuccessToast('✓ Position removed')
      } catch (error) {
        console.error('Error deleting position:', error)
        showSuccessToast('✗ Failed to remove position')
      }
    }
  }

  const calculatePL = (position: PortfolioPosition) => {
    if (!position.current_price) return null
    const grossPL = (position.current_price - position.avg_buy_price) * position.shares
    const fees = position.transaction_fees || 0
    const netPL = grossPL - fees
    const netPLPercent = ((position.current_price - position.avg_buy_price) / position.avg_buy_price) * 100
    return { grossPL, fees, netPL, netPLPercent }
  }

  // Filter tickers based on search
  const filteredTickers = tickers.filter(ticker =>
    tickerSearch.length > 0 && (
      ticker.symbol.toLowerCase().includes(tickerSearch.toLowerCase()) ||
      ticker.name.toLowerCase().includes(tickerSearch.toLowerCase())
    )
  ).slice(0, 10)

  const handleTickerSelect = (ticker: Ticker) => {
    setSelectedTicker(ticker)
    setTickerSearch('')
    setShowDropdown(false)
  }

  const formatTime = (date: Date | null) => {
    if (!date) return '--:--:--'
    return date.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  // Calculate transaction fees (0.15% of trade value)
  const calculateFees = (shares: number, avgPrice: number) => {
    const tradeValue = shares * avgPrice
    const fees = tradeValue * 0.0015 // 0.15%
    return fees.toFixed(2)
  }

  const totalValue = positions.reduce(
    (sum, pos) => sum + (pos.current_price || 0) * pos.shares,
    0
  )
  const totalCost = positions.reduce(
    (sum, pos) => sum + pos.avg_buy_price * pos.shares,
    0
  )
  const totalFees = positions.reduce(
    (sum, pos) => sum + (pos.transaction_fees || 0),
    0
  )
  const totalGrossPL = totalValue - totalCost
  const totalNetPL = totalGrossPL - totalFees
  const totalPLPercent = totalCost > 0 ? (totalNetPL / totalCost) * 100 : 0

  if (loading) {
    return <div className="text-center py-12">Loading portfolio...</div>
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-slide-in">
          <CheckCircle className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-sm text-gray-400">Total Value</div>
          <div className="text-2xl font-bold">{totalValue.toFixed(0)} NOK</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-400">Total Cost</div>
          <div className="text-2xl font-bold">{totalCost.toFixed(0)} NOK</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-400">Net P/L</div>
          <div className={`text-2xl font-bold ${totalNetPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalNetPL >= 0 ? '+' : ''}{totalNetPL.toFixed(0)} NOK
          </div>
          <div className="text-xs text-gray-500 mt-1">
            P/L: {totalGrossPL >= 0 ? '+' : ''}{totalGrossPL.toFixed(0)} | Fees: -{totalFees.toFixed(0)}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-400">P/L %</div>
          <div className={`text-2xl font-bold flex items-center ${totalPLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalPLPercent >= 0 ? <TrendingUp className="w-6 h-6 mr-1" /> : <TrendingDown className="w-6 h-6 mr-1" />}
            {totalPLPercent >= 0 ? '+' : ''}{totalPLPercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Last Updated & Actions */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold">Positions</h2>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Last updated: {formatTime(lastUpdate)}</span>
            {isMarketOpen() && pollIntervalRef.current && (
              <span className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></span>
                Live
              </span>
            )}
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => refreshPrices(false)}
            disabled={refreshing}
            className={`btn-secondary flex items-center space-x-2 ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Prices'}</span>
          </button>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm)
              setSelectedTicker(null)
              setTickerSearch('')
            }}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Position</span>
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Add New Position</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!selectedTicker) {
                alert('Please select a ticker from the dropdown')
                return
              }
              const formData = new FormData(e.currentTarget)
              try {
                await portfolioAPI.add({
                  ticker: selectedTicker.symbol,
                  shares: parseInt(formData.get('shares') as string),
                  avg_buy_price: parseFloat(formData.get('avg_buy_price') as string),
                  purchase_date: formData.get('purchase_date') as string,
                  notes: formData.get('notes') as string || undefined,
                  transaction_fees: parseFloat(formData.get('transaction_fees') as string) || 0,
                })
                setShowAddForm(false)
                setSelectedTicker(null)
                setTransactionFees('0')
                setAutoCalculateFees(true)
                await loadPortfolio()
                await refreshPrices(false)
                showSuccessToast('✓ Position added successfully')
              } catch (error) {
                console.error('Error adding position:', error)
                showSuccessToast('✗ Failed to add position')
              }
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* Ticker Autocomplete */}
            <div className="relative md:col-span-2" ref={searchRef}>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Stock Ticker
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={selectedTicker ? `${selectedTicker.symbol} - ${selectedTicker.name}` : tickerSearch}
                  onChange={(e) => {
                    setTickerSearch(e.target.value)
                    setSelectedTicker(null)
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search by ticker or company name (e.g., 'Equ' or 'EQNR')"
                  className="input pl-10 w-full"
                  required
                />
              </div>

              {/* Dropdown */}
              {showDropdown && tickerSearch && filteredTickers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredTickers.map((ticker) => (
                    <button
                      key={ticker.symbol}
                      type="button"
                      onClick={() => handleTickerSelect(ticker)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-600 flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-blue-400">{ticker.symbol}</div>
                        <div className="text-sm text-gray-300">{ticker.name}</div>
                      </div>
                      <span className="text-xs text-gray-400 px-2 py-1 bg-slate-800 rounded">
                        {ticker.sector}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {showDropdown && tickerSearch && filteredTickers.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-lg p-4 text-center text-gray-400">
                  No results found. Try another search term.
                </div>
              )}
            </div>

            <input
              name="shares"
              type="number"
              placeholder="Number of shares"
              className="input"
              required
              onChange={(e) => {
                if (autoCalculateFees) {
                  const form = e.currentTarget.form
                  const avgPrice = parseFloat((form?.avg_buy_price as HTMLInputElement)?.value || '0')
                  const shares = parseFloat(e.target.value || '0')
                  if (shares && avgPrice) {
                    setTransactionFees(calculateFees(shares, avgPrice))
                  }
                }
              }}
            />
            <input
              name="avg_buy_price"
              type="number"
              step="0.01"
              placeholder="Average buy price (NOK)"
              className="input"
              required
              onChange={(e) => {
                if (autoCalculateFees) {
                  const form = e.currentTarget.form
                  const shares = parseFloat((form?.shares as HTMLInputElement)?.value || '0')
                  const avgPrice = parseFloat(e.target.value || '0')
                  if (shares && avgPrice) {
                    setTransactionFees(calculateFees(shares, avgPrice))
                  }
                }
              }}
            />
            <input name="purchase_date" type="date" className="input" required />

            {/* Transaction Fees */}
            <div className="relative">
              <input
                name="transaction_fees"
                type="number"
                step="0.01"
                placeholder="Transaction fees (NOK)"
                className="input"
                value={transactionFees}
                onChange={(e) => {
                  setTransactionFees(e.target.value)
                  setAutoCalculateFees(false)
                }}
                required
              />
              <label className="flex items-center mt-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={autoCalculateFees}
                  onChange={(e) => {
                    setAutoCalculateFees(e.target.checked)
                    if (e.target.checked) {
                      const form = e.currentTarget.form
                      const shares = parseFloat((form?.shares as HTMLInputElement)?.value || '0')
                      const avgPrice = parseFloat((form?.avg_buy_price as HTMLInputElement)?.value || '0')
                      if (shares && avgPrice) {
                        setTransactionFees(calculateFees(shares, avgPrice))
                      }
                    }
                  }}
                  className="mr-2"
                />
                Auto-calculate (0.15%)
              </label>
            </div>

            <input name="notes" placeholder="Notes (optional)" className="input" />

            <div className="md:col-span-2 flex space-x-3">
              <button type="submit" className="btn-primary" disabled={!selectedTicker}>
                Add Position
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setSelectedTicker(null)
                  setTickerSearch('')
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Positions Table */}
      {positions.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p>No positions yet. Add your first position to get started.</p>
          <p className="text-sm mt-2">Search from {tickers.length}+ Oslo Børs stocks</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left">Ticker</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-right">Shares</th>
                <th className="px-4 py-3 text-right">Avg Price</th>
                <th className="px-4 py-3 text-right">Current Price</th>
                <th className="px-4 py-3 text-right">Net P/L</th>
                <th className="px-4 py-3 text-right">P/L %</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {positions.map((position) => {
                const pl = calculatePL(position)
                return (
                  <tr key={position.id} className="hover:bg-slate-750">
                    <td className="px-4 py-3 font-semibold text-blue-400">{position.ticker}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{position.company_name}</td>
                    <td className="px-4 py-3 text-right">{position.shares}</td>
                    <td className="px-4 py-3 text-right">{position.avg_buy_price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{position.current_price?.toFixed(2) || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      {pl ? (
                        <div>
                          <div className={`font-semibold ${pl.netPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {pl.netPL >= 0 ? '+' : ''}{pl.netPL.toFixed(0)} NOK
                          </div>
                          <div className="text-xs text-gray-500">
                            P/L: {pl.grossPL >= 0 ? '+' : ''}{pl.grossPL.toFixed(0)} | Fees: -{pl.fees.toFixed(0)}
                          </div>
                        </div>
                      ) : '-'}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${pl && pl.netPLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pl ? `${pl.netPLPercent >= 0 ? '+' : ''}${pl.netPLPercent.toFixed(2)}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(position.id)}
                        className="text-red-500 hover:text-red-400 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
