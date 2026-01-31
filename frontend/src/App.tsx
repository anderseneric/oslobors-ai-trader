import { useState } from 'react'
import { TrendingUp, LayoutDashboard, Eye, Briefcase, Target } from 'lucide-react'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Watchlist from './pages/Watchlist'
import Market from './pages/Market'
import Portfolio from './pages/Portfolio'
import Positions from './pages/Positions'
import FloatingChatWidget from './components/FloatingChatWidget'
import NotificationBell from './components/NotificationBell'

type Page = 'home' | 'dashboard' | 'watchlist' | 'market' | 'portfolio' | 'positions'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')

  return (
    <div className="min-h-screen bg-navy-900 text-white relative">
      {/* Professional Trading Platform Navbar */}
      <nav className="sticky top-0 z-40 bg-navy-900/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-[1440px] mx-auto px-20">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center">
                <TrendingUp className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex flex-col">
                <h1
                  onClick={() => setCurrentPage('home')}
                  className="text-lg font-bold text-white tracking-tight cursor-pointer hover:text-amber-500 transition-colors"
                >
                  NORDIC TRADER
                </h1>
                <span className="text-xs text-neutral/80">Oslo Børs · Professional Trading Platform</span>
              </div>
            </div>

            {/* Navigation Menu (with Notification Bell at the end) */}
            <div className="flex items-center space-x-6">
              {/* Main Navigation */}
              <div className="flex items-center space-x-8">
              <button
                onClick={() => setCurrentPage('dashboard')}
                className={`group relative flex items-center space-x-2 px-3 py-3 font-medium transition-colors ${
                  currentPage === 'dashboard'
                    ? 'text-amber-500'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>Dashboard</span>
                {currentPage === 'dashboard' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
                )}
              </button>
              <button
                onClick={() => setCurrentPage('watchlist')}
                className={`group relative flex items-center space-x-2 px-3 py-3 font-medium transition-colors ${
                  currentPage === 'watchlist'
                    ? 'text-amber-500'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Eye className="w-5 h-5" />
                <span>Watchlist</span>
                {currentPage === 'watchlist' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
                )}
              </button>
              <button
                onClick={() => setCurrentPage('market')}
                className={`group relative flex items-center space-x-2 px-3 py-3 font-medium transition-colors ${
                  currentPage === 'market'
                    ? 'text-amber-500'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <TrendingUp className="w-5 h-5" />
                <span>Market</span>
                {currentPage === 'market' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
                )}
              </button>
              <button
                onClick={() => setCurrentPage('portfolio')}
                className={`group relative flex items-center space-x-2 px-3 py-3 font-medium transition-colors ${
                  currentPage === 'portfolio'
                    ? 'text-amber-500'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Briefcase className="w-5 h-5" />
                <span>Portfolio</span>
                {currentPage === 'portfolio' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
                )}
              </button>
              <button
                onClick={() => setCurrentPage('positions')}
                className={`group relative flex items-center space-x-2 px-3 py-3 font-medium transition-colors ${
                  currentPage === 'positions'
                    ? 'text-amber-500'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Target className="w-5 h-5" />
                <span>Positions</span>
                {currentPage === 'positions' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
                )}
              </button>
              </div>

              {/* Notification Bell */}
              <NotificationBell />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-20 py-10 relative z-10">
        {currentPage === 'home' && <Home onNavigate={(page) => setCurrentPage(page as Page)} />}
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'watchlist' && <Watchlist />}
        {currentPage === 'market' && <Market />}
        {currentPage === 'portfolio' && <Portfolio />}
        {currentPage === 'positions' && <Positions />}
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-white/10 bg-navy-900/80">
        <div className="max-w-[1280px] mx-auto px-20 py-6 text-center text-sm text-neutral">
          <p>Oslo Børs Professional Trading Platform • Real-time data from Finnhub & Yahoo Finance</p>
        </div>
      </footer>

      {/* Floating Chat Widget - Always Available */}
      <FloatingChatWidget />
    </div>
  )
}

export default App
