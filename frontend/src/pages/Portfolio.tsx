import { useEffect, useState, useRef } from 'react'
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Clock,
  Briefcase,
  DollarSign,
  PieChart as PieChartIcon
} from 'lucide-react'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { portfolioAPI } from '../services/api'
import type { PortfolioPosition } from '../types'
import osloTickers from '../../../oslo-bors-tickers.json'
import ProfessionalPanel from '../components/ProfessionalPanel'
import DataTable, { Column } from '../components/DataTable'

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
  const [historyData, setHistoryData] = useState<Array<{ date: string; value: number }>>([])
  const [timeRange, setTimeRange] = useState<'1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'>('1M')
  const searchRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [formData, setFormData] = useState({
    shares: '',
    avgBuyPrice: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    notes: ''
  })

  const tickers: Ticker[] = osloTickers.tickers

  const isMarketOpen = () => {
    const now = new Date()
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const timeInMinutes = hours * 60 + minutes
    const marketOpen = 540
    const marketClose = 980
    const day = now.getDay()
    const isWeekday = day >= 1 && day <= 5
    return isWeekday && timeInMinutes >= marketOpen && timeInMinutes <= marketClose
  }

  const getDaysFromTimeRange = (range: typeof timeRange): number => {
    switch (range) {
      case '1D': return 1
      case '1W': return 7
      case '1M': return 30
      case '3M': return 90
      case '6M': return 180
      case '1Y': return 365
      case 'ALL': return 9999
      default: return 30
    }
  }

  useEffect(() => {
    loadPortfolio()
    loadHistory(getDaysFromTimeRange(timeRange))
    setTimeout(() => refreshPrices(), 1000)
    if (isMarketOpen()) startPolling()
    return () => stopPolling()
  }, [])

  useEffect(() => {
    loadHistory(getDaysFromTimeRange(timeRange))
  }, [timeRange])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (autoCalculateFees && formData.shares && formData.avgBuyPrice) {
      const fees = calculateFees(parseFloat(formData.shares), parseFloat(formData.avgBuyPrice))
      setTransactionFees(fees)
    }
  }, [formData.shares, formData.avgBuyPrice, autoCalculateFees])

  const startPolling = () => {
    pollIntervalRef.current = setInterval(() => {
      if (isMarketOpen()) refreshPrices(true)
      else stopPolling()
    }, 120000)
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
      if (data.length > 0 && data[0].updated_at) {
        setLastUpdate(new Date(data[0].updated_at))
      }
    } catch (error) {
      console.error('Error loading portfolio:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async (days: number = 30) => {
    try {
      const result = await portfolioAPI.getHistory(days)
      if (result.data && result.data.length > 0) {
        const formattedData = result.data.map(item => ({
          date: new Date(item.date).toLocaleDateString('no-NO', { month: 'short', day: 'numeric' }),
          value: Math.round(item.value)
        }))
        setHistoryData(formattedData)
      }
    } catch (error) {
      console.error('Error loading history:', error)
    }
  }

  const refreshPrices = async (silent = false) => {
    try {
      if (!silent) setRefreshing(true)
      const result = await portfolioAPI.refreshPrices()
      if (result.success) {
        setPositions(result.portfolio)
        setLastUpdate(new Date())
        if (!silent) showSuccessToast(`✓ Updated ${result.updated} stock${result.updated !== 1 ? 's' : ''}`)
      }
    } catch (error) {
      console.error('Error refreshing prices:', error)
      if (!silent) showSuccessToast('✗ Failed to refresh prices')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicker) return

    try {
      await portfolioAPI.add({
        ticker: selectedTicker.symbol,
        shares: parseInt(formData.shares),
        avg_buy_price: parseFloat(formData.avgBuyPrice),
        purchase_date: formData.purchaseDate,
        notes: formData.notes || null,
        transaction_fees: parseFloat(transactionFees) || 0
      })

      setShowAddForm(false)
      setSelectedTicker(null)
      setFormData({
        shares: '',
        avgBuyPrice: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        notes: ''
      })
      setTransactionFees('0')
      await loadPortfolio()
      showSuccessToast('✓ Position added successfully')
    } catch (error) {
      console.error('Error adding position:', error)
      showSuccessToast('✗ Failed to add position')
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

  const calculateFees = (shares: number, avgPrice: number) => {
    const tradeValue = shares * avgPrice
    const fees = tradeValue * 0.0015
    return fees.toFixed(2)
  }

  // Calculate totals
  const totalValue = positions.reduce((sum, pos) => sum + (pos.current_price || 0) * pos.shares, 0)
  const totalCost = positions.reduce((sum, pos) => sum + pos.avg_buy_price * pos.shares, 0)
  const totalFees = positions.reduce((sum, pos) => sum + (pos.transaction_fees || 0), 0)
  const totalGrossPL = totalValue - totalCost
  const totalNetPL = totalGrossPL - totalFees
  const totalPLPercent = totalCost > 0 ? (totalNetPL / totalCost) * 100 : 0

  // Sector allocation
  const sectorData = positions.reduce((acc: any, pos) => {
    const ticker = tickers.find(t => t.symbol === pos.ticker)
    const sector = ticker?.sector || 'Other'
    const value = (pos.current_price || pos.avg_buy_price) * pos.shares
    acc[sector] = (acc[sector] || 0) + value
    return acc
  }, {})

  const sectorChartData = Object.entries(sectorData).map(([sector, value]) => ({
    name: sector,
    value: Number(value)
  }))

  const SECTOR_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

  // Table columns
  const columns: Column[] = [
    {
      key: 'ticker',
      label: 'TICKER',
      sortable: true,
      format: (value, row) => (
        <div>
          <div className="font-bold text-white">{value}</div>
          <div className="text-xs text-neutral">{row.company_name}</div>
        </div>
      )
    },
    {
      key: 'shares',
      label: 'SHARES',
      align: 'right',
      sortable: true,
      format: (value) => value.toLocaleString()
    },
    {
      key: 'avg_buy_price',
      label: 'AVG BUY',
      align: 'right',
      sortable: true,
      format: (value) => `${value.toFixed(2)} NOK`,
      className: 'text-white'
    },
    {
      key: 'current_price',
      label: 'CURRENT',
      align: 'right',
      sortable: true,
      format: (value) => value ? `${value.toFixed(2)} NOK` : '—',
      className: 'text-white'
    },
    {
      key: 'pl',
      label: 'P/L',
      align: 'right',
      sortable: true,
      format: (_, row) => {
        const pl = calculatePL(row)
        if (!pl) return '—'
        return (
          <div className={pl.netPL >= 0 ? 'text-profit' : 'text-loss'}>
            <div className="font-semibold">{pl.netPL >= 0 ? '+' : ''}{pl.netPL.toLocaleString('no-NO', { maximumFractionDigits: 0 })} NOK</div>
            <div className="text-xs">{pl.netPLPercent >= 0 ? '+' : ''}{pl.netPLPercent.toFixed(2)}%</div>
          </div>
        )
      }
    },
    {
      key: 'value',
      label: 'VALUE',
      align: 'right',
      sortable: true,
      format: (_, row) => {
        const value = (row.current_price || row.avg_buy_price) * row.shares
        return `${value.toLocaleString('no-NO', { maximumFractionDigits: 0 })} NOK`
      },
      className: 'text-white font-semibold'
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      format: (_, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDelete(row.id)
          }}
          className="text-neutral hover:text-loss transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Briefcase className="w-8 h-8 text-amber-500" />
          <div>
            <h1 className="text-3xl font-bold text-white">Portfolio</h1>
            <p className="text-neutral">Track and manage your holdings</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-sm text-neutral">
            <Clock className="w-4 h-4" />
            <span>Last update: {formatTime(lastUpdate)}</span>
          </div>
          <button
            onClick={() => refreshPrices()}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-navy-800 border border-white/10 rounded-lg text-white hover:bg-navy-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-500 rounded-lg text-navy-900 font-semibold hover:bg-amber-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Position</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <ProfessionalPanel>
          <div className="text-xs text-neutral uppercase tracking-wider mb-2">Total Value</div>
          <div className="text-2xl font-bold text-white font-mono">
            {totalValue.toLocaleString('no-NO', { maximumFractionDigits: 0 })} NOK
          </div>
        </ProfessionalPanel>

        <ProfessionalPanel>
          <div className="text-xs text-neutral uppercase tracking-wider mb-2">Cost Basis</div>
          <div className="text-2xl font-bold text-white font-mono">
            {totalCost.toLocaleString('no-NO', { maximumFractionDigits: 0 })} NOK
          </div>
        </ProfessionalPanel>

        <ProfessionalPanel>
          <div className="text-xs text-neutral uppercase tracking-wider mb-2">Net P/L</div>
          <div className={`text-2xl font-bold font-mono ${totalNetPL >= 0 ? 'text-profit' : 'text-loss'}`}>
            {totalNetPL >= 0 ? '+' : ''}{totalNetPL.toLocaleString('no-NO', { maximumFractionDigits: 0 })} NOK
          </div>
        </ProfessionalPanel>

        <ProfessionalPanel>
          <div className="text-xs text-neutral uppercase tracking-wider mb-2">Return</div>
          <div className={`text-2xl font-bold font-mono flex items-center ${totalPLPercent >= 0 ? 'text-profit' : 'text-loss'}`}>
            {totalPLPercent >= 0 ? <TrendingUp className="w-6 h-6 mr-2" /> : <TrendingDown className="w-6 h-6 mr-2" />}
            {totalPLPercent >= 0 ? '+' : ''}{totalPLPercent.toFixed(2)}%
          </div>
        </ProfessionalPanel>
      </div>

      {/* Holdings Table */}
      <ProfessionalPanel title="Holdings" subtitle={`${positions.length} position${positions.length !== 1 ? 's' : ''}`}>
        {loading ? (
          <div className="text-center text-neutral py-8">Loading positions...</div>
        ) : positions.length === 0 ? (
          <div className="text-center text-neutral py-12">
            <Briefcase className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">No positions yet</p>
            <p className="text-sm text-neutral/70">Click "Add Position" to get started</p>
          </div>
        ) : (
          <DataTable columns={columns} data={positions} keyField="id" compact />
        )}
      </ProfessionalPanel>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Chart */}
        <ProfessionalPanel
          title="Portfolio Performance"
          actions={
            <div className="flex space-x-1">
              {(['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    timeRange === range
                      ? 'bg-amber-500 text-navy-900'
                      : 'text-neutral hover:text-white'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          }
        >
          <div className="h-64">
            {historyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f3243', border: '1px solid #ffffff20', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8' }}
                    itemStyle={{ color: '#f59e0b' }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-neutral">
                <p>No historical data yet. Check back after 24 hours.</p>
              </div>
            )}
          </div>
        </ProfessionalPanel>

        {/* Sector Allocation */}
        <ProfessionalPanel title="Sector Allocation">
          <div className="h-64">
            {sectorChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {sectorChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={SECTOR_COLORS[index % SECTOR_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f3243', border: '1px solid #ffffff20', borderRadius: '8px' }}
                    formatter={(value: any) => `${Number(value).toLocaleString('no-NO', { maximumFractionDigits: 0 })} NOK`}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-neutral">
                <p>Add positions to see sector allocation</p>
              </div>
            )}
          </div>
        </ProfessionalPanel>
      </div>

      {/* Add Position Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-navy-800 border border-white/10 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">Add New Position</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Ticker Search */}
              <div ref={searchRef}>
                <label className="block text-sm font-medium text-neutral mb-2">
                  Stock Symbol *
                </label>
                {selectedTicker ? (
                  <div className="flex items-center justify-between p-3 bg-navy-900 border border-amber-500/50 rounded-lg">
                    <div>
                      <div className="font-bold text-white">{selectedTicker.symbol}</div>
                      <div className="text-sm text-neutral">{selectedTicker.name}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedTicker(null)}
                      className="text-neutral hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral" />
                      <input
                        type="text"
                        value={tickerSearch}
                        onChange={(e) => {
                          setTickerSearch(e.target.value)
                          setShowDropdown(true)
                        }}
                        onFocus={() => setShowDropdown(true)}
                        placeholder="Search ticker or company name..."
                        className="w-full pl-10 pr-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-white placeholder-neutral focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    {showDropdown && filteredTickers.length > 0 && (
                      <div className="absolute mt-1 w-full bg-navy-900 border border-white/10 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                        {filteredTickers.map((ticker) => (
                          <button
                            key={ticker.symbol}
                            type="button"
                            onClick={() => handleTickerSelect(ticker)}
                            className="w-full text-left px-4 py-3 hover:bg-navy-800 transition-colors border-b border-white/5 last:border-0"
                          >
                            <div className="font-semibold text-white">{ticker.symbol}</div>
                            <div className="text-sm text-neutral">{ticker.name}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral mb-2">Shares *</label>
                  <input
                    type="number"
                    value={formData.shares}
                    onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral mb-2">Avg Buy Price (NOK) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.avgBuyPrice}
                    onChange={(e) => setFormData({ ...formData, avgBuyPrice: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral mb-2">Purchase Date *</label>
                <input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral mb-2">Transaction Fees (NOK)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    step="0.01"
                    value={transactionFees}
                    onChange={(e) => setTransactionFees(e.target.value)}
                    disabled={autoCalculateFees}
                    className="flex-1 px-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                  <label className="flex items-center space-x-2 text-sm text-neutral">
                    <input
                      type="checkbox"
                      checked={autoCalculateFees}
                      onChange={(e) => setAutoCalculateFees(e.target.checked)}
                      className="rounded"
                    />
                    <span>Auto (0.15%)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral mb-2">Notes (optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-white placeholder-neutral focus:outline-none focus:border-amber-500"
                  placeholder="Investment thesis, entry reason..."
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setSelectedTicker(null)
                    setFormData({
                      shares: '',
                      avgBuyPrice: '',
                      purchaseDate: new Date().toISOString().split('T')[0],
                      notes: ''
                    })
                  }}
                  className="flex-1 px-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-neutral hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedTicker}
                  className="flex-1 px-4 py-2 bg-amber-500 rounded-lg text-navy-900 font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50"
                >
                  Add Position
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-8 right-8 bg-navy-800 border border-amber-500/50 rounded-lg px-6 py-3 shadow-lg z-50 animate-fadeIn">
          <p className="text-white font-medium">{toastMessage}</p>
        </div>
      )}
    </div>
  )
}
