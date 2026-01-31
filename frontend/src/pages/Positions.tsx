import { useEffect, useState } from 'react'
import { Target, TrendingUp, TrendingDown, Edit2, X, Calendar, DollarSign } from 'lucide-react'
import ProfessionalPanel from '../components/ProfessionalPanel'
import { portfolioAPI } from '../services/api'

interface Position {
  id: number
  ticker: string
  company_name: string
  shares: number
  avg_buy_price: number
  current_price: number
  purchase_date: string
  notes: string | null
  transaction_fees: number
}

export default function Positions() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPosition, setEditingPosition] = useState<number | null>(null)
  const [targetPrice, setTargetPrice] = useState('')
  const [stopLoss, setStopLoss] = useState('')

  useEffect(() => {
    loadPositions()
  }, [])

  const loadPositions = async () => {
    try {
      const data = await portfolioAPI.getAll()
      setPositions(data || [])
    } catch (error) {
      console.error('Error loading positions:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateHoldTime = (purchaseDate: string) => {
    const purchase = new Date(purchaseDate)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - purchase.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const calculatePL = (position: Position) => {
    const currentValue = position.current_price * position.shares
    const costBasis = position.avg_buy_price * position.shares
    const pl = currentValue - costBasis - position.transaction_fees
    const plPercent = costBasis > 0 ? (pl / costBasis) * 100 : 0
    return { pl, plPercent }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral">Loading positions...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Target className="w-8 h-8 text-amber-500" />
          <div>
            <h1 className="text-3xl font-bold text-white">Active Positions</h1>
            <p className="text-neutral">Manage your swing trade positions with entry, targets, and stop losses</p>
          </div>
        </div>
      </div>

      {positions.length === 0 ? (
        <ProfessionalPanel>
          <div className="text-center py-12">
            <Target className="w-16 h-16 mx-auto mb-4 text-neutral opacity-50" />
            <p className="text-neutral text-lg">No active positions</p>
            <p className="text-neutral/70 text-sm mt-2">Add stocks to your portfolio to start tracking positions</p>
          </div>
        </ProfessionalPanel>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {positions.map((position) => {
            const { pl, plPercent } = calculatePL(position)
            const holdTime = calculateHoldTime(position.purchase_date)
            const isEditing = editingPosition === position.id

            // Calculate target and stop loss progress (dummy values for now, can be persisted later)
            const suggestedTarget = position.avg_buy_price * 1.15 // +15%
            const suggestedStopLoss = position.avg_buy_price * 0.95 // -5%

            return (
              <ProfessionalPanel
                key={position.id}
                className="hover:border-amber-500/30 transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <h3 className="text-2xl font-bold text-white">{position.ticker}</h3>
                    </div>
                    <p className="text-sm text-neutral">{position.company_name}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (isEditing) {
                        setEditingPosition(null)
                        setTargetPrice('')
                        setStopLoss('')
                      } else {
                        setEditingPosition(position.id)
                        setTargetPrice(suggestedTarget.toFixed(2))
                        setStopLoss(suggestedStopLoss.toFixed(2))
                      }
                    }}
                    className="p-2 text-neutral hover:text-white transition-colors"
                  >
                    {isEditing ? <X className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
                  </button>
                </div>

                {/* Price Grid */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="p-3 bg-navy-900/50 rounded-lg">
                    <div className="text-xs text-neutral uppercase tracking-wider mb-1">Entry</div>
                    <div className="text-lg font-mono font-bold text-white">
                      {position.avg_buy_price.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 bg-navy-900/50 rounded-lg">
                    <div className="text-xs text-neutral uppercase tracking-wider mb-1">Current</div>
                    <div className="text-lg font-mono font-bold text-white">
                      {position.current_price.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 bg-profit/10 rounded-lg border border-profit/20">
                    <div className="text-xs text-profit uppercase tracking-wider mb-1">Target</div>
                    <div className="text-lg font-mono font-bold text-profit">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={targetPrice}
                          onChange={(e) => setTargetPrice(e.target.value)}
                          className="w-full bg-transparent border-b border-profit/50 focus:outline-none focus:border-profit"
                        />
                      ) : (
                        suggestedTarget.toFixed(2)
                      )}
                    </div>
                  </div>
                  <div className="p-3 bg-loss/10 rounded-lg border border-loss/20">
                    <div className="text-xs text-loss uppercase tracking-wider mb-1">Stop</div>
                    <div className="text-lg font-mono font-bold text-loss">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={stopLoss}
                          onChange={(e) => setStopLoss(e.target.value)}
                          className="w-full bg-transparent border-b border-loss/50 focus:outline-none focus:border-loss"
                        />
                      ) : (
                        suggestedStopLoss.toFixed(2)
                      )}
                    </div>
                  </div>
                </div>

                {/* P/L Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral uppercase tracking-wider">Position P/L</span>
                    <span className={`text-sm font-mono font-bold ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {pl >= 0 ? '+' : ''}{pl.toLocaleString('no-NO', { maximumFractionDigits: 0 })} NOK ({pl >= 0 ? '+' : ''}{plPercent.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-navy-900/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${pl >= 0 ? 'bg-profit' : 'bg-loss'}`}
                      style={{
                        width: `${Math.min(Math.abs(plPercent) * 2, 100)}%`
                      }}
                    />
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="flex items-center space-x-2 text-sm">
                    <Calendar className="w-4 h-4 text-neutral" />
                    <div>
                      <div className="text-xs text-neutral">Hold Time</div>
                      <div className="font-semibold text-white">{holdTime} days</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <DollarSign className="w-4 h-4 text-neutral" />
                    <div>
                      <div className="text-xs text-neutral">Shares</div>
                      <div className="font-semibold text-white">{position.shares.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    {pl >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-profit" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-loss" />
                    )}
                    <div>
                      <div className="text-xs text-neutral">Status</div>
                      <div className={`font-semibold ${pl >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {pl >= 0 ? 'Winning' : 'Losing'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {position.notes && (
                  <div className="p-3 bg-navy-900/50 rounded-lg">
                    <div className="text-xs text-neutral uppercase tracking-wider mb-1">Thesis</div>
                    <p className="text-sm text-white">{position.notes}</p>
                  </div>
                )}

                {/* Actions */}
                {isEditing && (
                  <div className="mt-4 pt-4 border-t border-white/10 flex space-x-2">
                    <button
                      onClick={() => {
                        // Save logic here
                        setEditingPosition(null)
                        alert('Target and stop loss saved!')
                      }}
                      className="flex-1 px-4 py-2 bg-amber-500 rounded-lg text-navy-900 font-semibold hover:bg-amber-400 transition-colors"
                    >
                      Save Targets
                    </button>
                    <button
                      onClick={() => {
                        setEditingPosition(null)
                        setTargetPrice('')
                        setStopLoss('')
                      }}
                      className="px-4 py-2 bg-navy-900 border border-white/10 rounded-lg text-neutral hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </ProfessionalPanel>
            )
          })}
        </div>
      )}
    </div>
  )
}
