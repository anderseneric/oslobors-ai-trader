import { useState } from 'react'
import { TrendingUp, Newspaper, UserCheck } from 'lucide-react'
import Recommendations from './Recommendations'
import News from './News'
import InsiderActivity from './InsiderActivity'

type Tab = 'screener' | 'news' | 'insider'

export default function Market() {
  const [activeTab, setActiveTab] = useState<Tab>('screener')

  const tabs = [
    { id: 'screener' as Tab, label: 'Screener', icon: TrendingUp, description: 'AI-powered stock recommendations' },
    { id: 'news' as Tab, label: 'News', icon: Newspaper, description: 'Latest Oslo Børs announcements' },
    { id: 'insider' as Tab, label: 'Insider', icon: UserCheck, description: 'PDMR transaction tracking' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <TrendingUp className="w-8 h-8 text-amber-500" />
          <div>
            <h1 className="text-3xl font-bold text-white">Market Intelligence</h1>
            <p className="text-neutral">Recommendations, news, and insider activity for Oslo Børs</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-navy-800 border border-white/10 rounded-lg p-1 flex space-x-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-navy-900'
                  : 'text-neutral hover:text-white hover:bg-navy-700'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Description */}
      <div className="text-sm text-neutral pl-2">
        {tabs.find(t => t.id === activeTab)?.description}
      </div>

      {/* Tab Content */}
      <div className="animate-fadeIn">
        {activeTab === 'screener' && <Recommendations />}
        {activeTab === 'news' && <News />}
        {activeTab === 'insider' && <InsiderActivity />}
      </div>
    </div>
  )
}
