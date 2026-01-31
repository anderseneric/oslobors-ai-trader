import { useEffect, useState } from 'react'
import { LayoutDashboard, TrendingUp, TrendingDown, Activity, BarChart3, Eye, Briefcase, Target } from 'lucide-react'
import ProfessionalPanel from '../components/ProfessionalPanel'
import MarketStatus from '../components/MarketStatus'
import { portfolioAPI } from '../services/api'

interface PortfolioSummary {
  totalValue: number
  totalCost: number
  totalPL: number
  totalPLPercent: number
}

interface TopMover {
  ticker: string
  name: string
  price: number
  changePercent: number
}

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState<any[]>([])
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>({
    totalValue: 0,
    totalCost: 0,
    totalPL: 0,
    totalPLPercent: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPortfolio()
  }, [])

  const loadPortfolio = async () => {
    try {
      const data = await portfolioAPI.getAll()
      setPortfolio(data || [])
      calculateSummary(data || [])
    } catch (error) {
      console.error('Error loading portfolio:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateSummary = (positions: any[]) => {
    const totalValue = positions.reduce((sum, pos) => {
      const value = (pos.current_price || pos.avg_buy_price) * pos.shares
      return sum + value
    }, 0)

    const totalCost = positions.reduce((sum, pos) => {
      return sum + (pos.avg_buy_price * pos.shares)
    }, 0)

    const totalFees = positions.reduce((sum, pos) => sum + (pos.transaction_fees || 0), 0)
    const totalPL = totalValue - totalCost - totalFees
    const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0

    setPortfolioSummary({
      totalValue,
      totalCost,
      totalPL,
      totalPLPercent
    })
  }

  const topPositions = portfolio
    .sort((a, b) => (b.current_price || b.avg_buy_price) * b.shares - (a.current_price || a.avg_buy_price) * a.shares)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <LayoutDashboard className="w-8 h-8 text-amber-500" />
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-neutral">Your daily trading overview</p>
          </div>
        </div>
      </div>

      {/* Top Row: Market Status + Portfolio Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market Status */}
        <div className="lg:col-span-1">
          <ProfessionalPanel title="Market Status">
            <MarketStatus />
          </ProfessionalPanel>
        </div>

        {/* Portfolio Summary */}
        <div className="lg:col-span-2">
          <ProfessionalPanel title="Portfolio Summary">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-neutral uppercase tracking-wider mb-1">Total Value</div>
                <div className="text-2xl font-bold text-white font-mono">
                  {portfolioSummary.totalValue.toLocaleString('no-NO', { maximumFractionDigits: 0 })} NOK
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral uppercase tracking-wider mb-1">Cost Basis</div>
                <div className="text-2xl font-bold text-white font-mono">
                  {portfolioSummary.totalCost.toLocaleString('no-NO', { maximumFractionDigits: 0 })} NOK
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral uppercase tracking-wider mb-1">Net P/L</div>
                <div className={`text-2xl font-bold font-mono ${
                  portfolioSummary.totalPL >= 0 ? 'text-profit' : 'text-loss'
                }`}>
                  {portfolioSummary.totalPL >= 0 ? '+' : ''}{portfolioSummary.totalPL.toLocaleString('no-NO', { maximumFractionDigits: 0 })} NOK
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral uppercase tracking-wider mb-1">Return</div>
                <div className={`text-2xl font-bold font-mono flex items-center ${
                  portfolioSummary.totalPLPercent >= 0 ? 'text-profit' : 'text-loss'
                }`}>
                  {portfolioSummary.totalPLPercent >= 0 ? (
                    <TrendingUp className="w-5 h-5 mr-1" />
                  ) : (
                    <TrendingDown className="w-5 h-5 mr-1" />
                  )}
                  {portfolioSummary.totalPLPercent >= 0 ? '+' : ''}{portfolioSummary.totalPLPercent.toFixed(2)}%
                </div>
              </div>
            </div>
          </ProfessionalPanel>
        </div>
      </div>

      {/* Middle Row: Top Positions + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Positions */}
        <ProfessionalPanel title="Top 5 Positions" subtitle="By market value">
          {loading ? (
            <div className="text-center text-neutral py-8">Loading positions...</div>
          ) : topPositions.length === 0 ? (
            <div className="text-center text-neutral py-8">
              <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No positions yet. Add stocks to your portfolio to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topPositions.map((pos) => {
                const currentPrice = pos.current_price || pos.avg_buy_price
                const value = currentPrice * pos.shares
                const cost = pos.avg_buy_price * pos.shares
                const pl = value - cost - (pos.transaction_fees || 0)
                const plPercent = cost > 0 ? (pl / cost) * 100 : 0

                return (
                  <div
                    key={pos.id}
                    className="flex items-center justify-between p-3 bg-navy-900/50 rounded-lg border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <div>
                        <div className="font-bold text-white">{pos.ticker}</div>
                        <div className="text-xs text-neutral">
                          {pos.shares.toLocaleString()} shares @ {currentPrice.toFixed(2)} NOK
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-white font-semibold">
                        {value.toLocaleString('no-NO', { maximumFractionDigits: 0 })} NOK
                      </div>
                      <div className={`text-xs font-mono ${plPercent >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {plPercent >= 0 ? '+' : ''}{plPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ProfessionalPanel>

        {/* Quick Actions */}
        <ProfessionalPanel title="Quick Actions">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => window.location.hash = '#watchlist'}
              className="flex flex-col items-center justify-center p-6 bg-navy-900/50 rounded-lg border border-white/10 hover:border-amber-500 hover:bg-navy-900 transition-all group"
            >
              <Eye className="w-8 h-8 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
              <div className="font-semibold text-white">Watchlist</div>
              <div className="text-xs text-neutral mt-1">Monitor stocks</div>
            </button>

            <button
              onClick={() => window.location.hash = '#market'}
              className="flex flex-col items-center justify-center p-6 bg-navy-900/50 rounded-lg border border-white/10 hover:border-amber-500 hover:bg-navy-900 transition-all group"
            >
              <TrendingUp className="w-8 h-8 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
              <div className="font-semibold text-white">Market</div>
              <div className="text-xs text-neutral mt-1">View recommendations</div>
            </button>

            <button
              onClick={() => window.location.hash = '#portfolio'}
              className="flex flex-col items-center justify-center p-6 bg-navy-900/50 rounded-lg border border-white/10 hover:border-amber-500 hover:bg-navy-900 transition-all group"
            >
              <Briefcase className="w-8 h-8 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
              <div className="font-semibold text-white">Portfolio</div>
              <div className="text-xs text-neutral mt-1">Manage positions</div>
            </button>

            <button
              onClick={() => window.location.hash = '#positions'}
              className="flex flex-col items-center justify-center p-6 bg-navy-900/50 rounded-lg border border-white/10 hover:border-amber-500 hover:bg-navy-900 transition-all group"
            >
              <Target className="w-8 h-8 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
              <div className="font-semibold text-white">Positions</div>
              <div className="text-xs text-neutral mt-1">Manage trades</div>
            </button>
          </div>
        </ProfessionalPanel>
      </div>

      {/* Market Pulse */}
      <ProfessionalPanel title="Market Pulse" subtitle="Key indicators and signals">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center space-x-4 p-4 bg-navy-900/50 rounded-lg">
            <div className="w-12 h-12 rounded-lg bg-profit/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-profit" />
            </div>
            <div>
              <div className="text-xs text-neutral uppercase tracking-wider">Active Positions</div>
              <div className="text-2xl font-bold text-white">{portfolio.length}</div>
            </div>
          </div>

          <div className="flex items-center space-x-4 p-4 bg-navy-900/50 rounded-lg">
            <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <div className="text-xs text-neutral uppercase tracking-wider">Portfolio Value</div>
              <div className="text-2xl font-bold text-white">
                {portfolioSummary.totalValue > 0
                  ? `${(portfolioSummary.totalValue / 1000).toFixed(0)}K`
                  : '0'}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4 p-4 bg-navy-900/50 rounded-lg">
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <div className="text-xs text-neutral uppercase tracking-wider">Market Volatility</div>
              <div className="text-2xl font-bold text-white">Normal</div>
            </div>
          </div>
        </div>
      </ProfessionalPanel>
    </div>
  )
}
