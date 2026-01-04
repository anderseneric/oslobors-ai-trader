import { useEffect, useState, useRef } from 'react'
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
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

interface Ticker {
  symbol: string
  name: string
  sector: string
}

// AI-Tech Glass Card Component
const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-gray-900/40 backdrop-blur-xl border border-blue-500/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(59,130,246,0.1)] hover:border-blue-500/30 hover:shadow-[0_8px_32px_rgba(59,130,246,0.2)] transition-all duration-300 ${className}`}>
    {children}
  </div>
)

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

  const tickers: Ticker[] = osloTickers.tickers

  // Check if market is open (Oslo Børs: 09:00-16:20 Norwegian time)
  const isMarketOpen = () => {
    const now = new Date()
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const timeInMinutes = hours * 60 + minutes
    const marketOpen = 540 // 9:00
    const marketClose = 980 // 16:20
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

  // Get performance data (real history or mock fallback)
  const getPerformanceData = () => {
    // Use real historical data if available
    if (historyData.length > 0) {
      return historyData
    }

    // Fallback to mock data for new portfolios
    const data = []
    const startValue = totalCost || 50000
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const randomVariation = (Math.random() - 0.48) * 1000
      const value = i === 0 ? totalValue : startValue + (totalValue - startValue) * ((29 - i) / 29) + randomVariation
      data.push({
        date: date.toLocaleDateString('no-NO', { month: 'short', day: 'numeric' }),
        value: Math.round(value)
      })
    }
    return data
  }

  // Calculate sector breakdown
  const getSectorData = () => {
    const sectorMap: { [key: string]: number } = {}
    positions.forEach(pos => {
      const ticker = tickers.find(t => t.symbol === pos.ticker)
      const sector = ticker?.sector || 'Other'
      const value = (pos.current_price || pos.avg_buy_price) * pos.shares
      sectorMap[sector] = (sectorMap[sector] || 0) + value
    })
    return Object.entries(sectorMap).map(([name, value]) => ({ name, value }))
  }

  const performanceData = getPerformanceData()
  const sectorData = getSectorData()

  const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899']

  if (loading) {
    return <div className="text-center py-12 text-white/60">Loading portfolio...</div>
  }

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600/90 backdrop-blur-lg text-white px-6 py-3 rounded-xl shadow-lg flex items-center space-x-2 animate-slide-in border border-green-500/30">
          <CheckCircle className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Stats - 4 Glass Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <GlassCard className="p-6 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">Total Value</span>
            <DollarSign className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white">{totalValue.toFixed(0)} <span className="text-xl text-white/60">NOK</span></div>
        </GlassCard>

        <GlassCard className="p-6 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">Total Cost</span>
            <TrendingUp className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-white">{totalCost.toFixed(0)} <span className="text-xl text-white/60">NOK</span></div>
        </GlassCard>

        <GlassCard className="p-6 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">Net P/L</span>
            {totalNetPL >= 0 ? <TrendingUp className="w-5 h-5 text-green-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
          </div>
          <div className={`text-3xl font-bold ${totalNetPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalNetPL >= 0 ? '+' : ''}{totalNetPL.toFixed(0)} <span className="text-xl">NOK</span>
          </div>
          <div className="text-xs text-white/40 mt-2">
            Gross: {totalGrossPL.toFixed(0)} | Fees: -{totalFees.toFixed(0)}
          </div>
        </GlassCard>

        <GlassCard className="p-6 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">P/L %</span>
            <PieChartIcon className="w-5 h-5 text-cyan-400" />
          </div>
          <div className={`text-3xl font-bold flex items-center ${totalPLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPLPercent >= 0 ? '+' : ''}{totalPLPercent.toFixed(2)}%
          </div>
        </GlassCard>
      </div>

      {/* Holdings Table + Sector Chart */}
      <div className="grid grid-cols-12 gap-6">
        {/* Portfolio Table - 8 columns */}
        <div className="col-span-12 lg:col-span-8">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Holdings</h2>
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm)
                  setSelectedTicker(null)
                  setTickerSearch('')
                }}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg flex items-center space-x-2 transition-all"
              >
                <Plus className="w-5 h-5" />
                <span>Add Position</span>
              </button>
            </div>

            {positions.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <p>No positions yet. Add your first position to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white/80">Ticker</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">Shares</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">Avg Price</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">Current</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">Net P/L</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">P/L %</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((position) => {
                      const pl = calculatePL(position)
                      return (
                        <tr key={position.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-4 py-4">
                            <div className="font-semibold text-blue-400">{position.ticker}</div>
                            <div className="text-xs text-white/40">{position.company_name}</div>
                          </td>
                          <td className="px-4 py-4 text-right text-white">{position.shares}</td>
                          <td className="px-4 py-4 text-right text-white/80">{position.avg_buy_price.toFixed(2)}</td>
                          <td className="px-4 py-4 text-right text-white">{position.current_price?.toFixed(2) || '-'}</td>
                          <td className="px-4 py-4 text-right">
                            {pl ? (
                              <div>
                                <div className={`font-semibold ${pl.netPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {pl.netPL >= 0 ? '+' : ''}{pl.netPL.toFixed(0)} NOK
                                </div>
                                <div className="text-xs text-white/40">
                                  P/L: {pl.grossPL.toFixed(0)} | Fees: -{pl.fees.toFixed(0)}
                                </div>
                              </div>
                            ) : '-'}
                          </td>
                          <td className={`px-4 py-4 text-right font-semibold ${pl && pl.netPLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pl ? `${pl.netPLPercent >= 0 ? '+' : ''}${pl.netPLPercent.toFixed(2)}%` : '-'}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              onClick={() => handleDelete(position.id)}
                              className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded-lg transition-all"
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
          </GlassCard>
        </div>

        {/* Sector Breakdown - 4 columns */}
        <div className="col-span-12 lg:col-span-4">
          <GlassCard className="p-6 h-full">
            <h2 className="text-xl font-bold text-white mb-6">Sector Allocation</h2>
            {sectorData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={sectorData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {sectorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(10, 14, 39, 0.5)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(19, 23, 41, 0.95)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '12px',
                      color: '#fff'
                    }}
                    formatter={(value: number) => `${value.toFixed(0)} NOK`}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[350px] text-white/40">
                <p>No sector data available</p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Portfolio Performance Chart */}
      <GlassCard className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Portfolio Performance</h2>
            <p className="text-sm text-white/60 mt-1">
              {timeRange === '1D' ? 'Today' : timeRange === '1W' ? 'Last 7 days' : timeRange === '1M' ? 'Last 30 days' : timeRange === '3M' ? 'Last 3 months' : timeRange === '6M' ? 'Last 6 months' : timeRange === '1Y' ? 'Last year' : 'All time'}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-white/60">
              <Clock className="w-4 h-4" />
              <span>Updated: {formatTime(lastUpdate)}</span>
              {isMarketOpen() && pollIntervalRef.current && (
                <span className="flex items-center ml-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></span>
                  <span className="text-green-400">Live</span>
                </span>
              )}
            </div>
            <button
              onClick={() => refreshPrices(false)}
              disabled={refreshing}
              className={`px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg flex items-center space-x-2 transition-all ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="text-sm text-white">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Time Range Filter Buttons */}
        <div className="flex space-x-2 mb-6">
          {(['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={performanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" style={{ fontSize: '12px' }} />
            <YAxis
              stroke="rgba(255,255,255,0.4)"
              style={{ fontSize: '12px' }}
              domain={[(dataMin: number) => Math.floor(dataMin * 0.98), (dataMax: number) => Math.ceil(dataMax * 1.02)]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(19, 23, 41, 0.95)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                color: '#fff'
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: '#fff', stroke: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              fill="url(#colorValue)"
            />
          </LineChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* Add Position Form */}
      {showAddForm && (
        <GlassCard className="p-8 border-2 border-blue-500/30">
          <h3 className="text-2xl font-bold text-white mb-6">Add New Position</h3>
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
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {/* Ticker Autocomplete */}
            <div className="relative md:col-span-2" ref={searchRef}>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Stock Ticker
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  value={selectedTicker ? `${selectedTicker.symbol} - ${selectedTicker.name}` : tickerSearch}
                  onChange={(e) => {
                    setTickerSearch(e.target.value)
                    setSelectedTicker(null)
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search by ticker or company name"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {showDropdown && tickerSearch && filteredTickers.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-slate-800/95 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredTickers.map((ticker) => (
                    <button
                      key={ticker.symbol}
                      type="button"
                      onClick={() => handleTickerSelect(ticker)}
                      className="w-full px-4 py-3 text-left hover:bg-white/10 flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-blue-400">{ticker.symbol}</div>
                        <div className="text-sm text-white/60">{ticker.name}</div>
                      </div>
                      <span className="text-xs text-white/40 px-2 py-1 bg-white/10 rounded">
                        {ticker.sector}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              name="shares"
              type="number"
              placeholder="Number of shares"
              className="px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              onChange={(e) => {
                if (autoCalculateFees) {
                  const form = e.currentTarget.form
                  const avgPrice = parseFloat((form?.avg_buy_price as HTMLInputElement)?.value || '0')
                  const shares = parseFloat(e.target.value || '0')
                  if (shares && avgPrice) setTransactionFees(calculateFees(shares, avgPrice))
                }
              }}
            />
            <input
              name="avg_buy_price"
              type="number"
              step="0.01"
              placeholder="Average buy price (NOK)"
              className="px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              onChange={(e) => {
                if (autoCalculateFees) {
                  const form = e.currentTarget.form
                  const shares = parseFloat((form?.shares as HTMLInputElement)?.value || '0')
                  const avgPrice = parseFloat(e.target.value || '0')
                  if (shares && avgPrice) setTransactionFees(calculateFees(shares, avgPrice))
                }
              }}
            />
            <input
              name="purchase_date"
              type="date"
              className="px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />

            <div className="relative">
              <input
                name="transaction_fees"
                type="number"
                step="0.01"
                placeholder="Transaction fees (NOK)"
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={transactionFees}
                onChange={(e) => {
                  setTransactionFees(e.target.value)
                  setAutoCalculateFees(false)
                }}
                required
              />
              <label className="flex items-center mt-2 text-sm text-white/60">
                <input
                  type="checkbox"
                  checked={autoCalculateFees}
                  onChange={(e) => {
                    setAutoCalculateFees(e.target.checked)
                    if (e.target.checked) {
                      const form = e.currentTarget.form
                      const shares = parseFloat((form?.shares as HTMLInputElement)?.value || '0')
                      const avgPrice = parseFloat((form?.avg_buy_price as HTMLInputElement)?.value || '0')
                      if (shares && avgPrice) setTransactionFees(calculateFees(shares, avgPrice))
                    }
                  }}
                  className="mr-2"
                />
                Auto-calculate (0.15%)
              </label>
            </div>

            <input
              name="notes"
              placeholder="Notes (optional)"
              className="px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="md:col-span-2 flex space-x-3">
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-semibold transition-all disabled:opacity-50"
                disabled={!selectedTicker}
              >
                Add Position
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setSelectedTicker(null)
                  setTickerSearch('')
                }}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </GlassCard>
      )}
    </div>
  )
}
