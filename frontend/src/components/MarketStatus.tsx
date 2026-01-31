import { useEffect, useState } from 'react'
import { Clock, TrendingUp } from 'lucide-react'

interface MarketInfo {
  isOpen: boolean
  status: string
  timeUntil: string
  currentTime: string
}

/**
 * Shows Oslo Børs market status (Open/Closed)
 * Oslo Børs hours: 09:00 - 16:20 CET (Norwegian time)
 */
export default function MarketStatus() {
  const [marketInfo, setMarketInfo] = useState<MarketInfo>({
    isOpen: false,
    status: 'CLOSED',
    timeUntil: '',
    currentTime: ''
  })

  useEffect(() => {
    const updateMarketStatus = () => {
      const now = new Date()

      // Convert to Oslo time (CET/CEST)
      const osloTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Oslo' }))
      const hours = osloTime.getHours()
      const minutes = osloTime.getMinutes()
      const currentMinutes = hours * 60 + minutes
      const day = osloTime.getDay()

      // Oslo Børs: 09:00 - 16:20, Monday-Friday
      const marketOpen = 9 * 60 // 09:00 = 540 minutes
      const marketClose = 16 * 60 + 20 // 16:20 = 980 minutes
      const isWeekday = day >= 1 && day <= 5

      let isOpen = false
      let status = 'CLOSED'
      let timeUntil = ''

      if (!isWeekday) {
        status = 'CLOSED'
        timeUntil = 'Opens Monday 09:00'
      } else if (currentMinutes < marketOpen) {
        // Before market open
        const minutesUntilOpen = marketOpen - currentMinutes
        const hoursUntil = Math.floor(minutesUntilOpen / 60)
        const minsUntil = minutesUntilOpen % 60
        status = 'PRE-MARKET'
        timeUntil = `Opens in ${hoursUntil}h ${minsUntil}m`
      } else if (currentMinutes >= marketOpen && currentMinutes < marketClose) {
        // Market is open
        isOpen = true
        status = 'OPEN'
        const minutesUntilClose = marketClose - currentMinutes
        const hoursUntil = Math.floor(minutesUntilClose / 60)
        const minsUntil = minutesUntilClose % 60
        timeUntil = `Closes in ${hoursUntil}h ${minsUntil}m`
      } else {
        // After market close
        status = 'CLOSED'
        timeUntil = 'Opens tomorrow 09:00'
      }

      setMarketInfo({
        isOpen,
        status,
        timeUntil,
        currentTime: osloTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      })
    }

    updateMarketStatus()
    const interval = setInterval(updateMarketStatus, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center space-x-4 px-4 py-2 bg-navy-800 border border-white/10 rounded-lg">
      <div className="flex items-center space-x-2">
        <TrendingUp className={`w-4 h-4 ${marketInfo.isOpen ? 'text-profit' : 'text-neutral'}`} />
        <div>
          <div className="text-xs text-neutral">Oslo Børs</div>
          <div className={`text-sm font-bold ${marketInfo.isOpen ? 'text-profit' : 'text-neutral'}`}>
            {marketInfo.status}
          </div>
        </div>
      </div>
      <div className="h-8 w-px bg-white/10" />
      <div className="flex items-center space-x-2">
        <Clock className="w-4 h-4 text-neutral" />
        <div>
          <div className="text-xs text-neutral">{marketInfo.currentTime} CET</div>
          <div className="text-xs text-neutral/70">{marketInfo.timeUntil}</div>
        </div>
      </div>
    </div>
  )
}
