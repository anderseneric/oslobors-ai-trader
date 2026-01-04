import { useState } from 'react'
import { TrendingUp, LayoutDashboard, Newspaper, Sparkles, BarChart3 } from 'lucide-react'
import Home from './pages/Home'
import Portfolio from './pages/Portfolio'
import News from './pages/News'
import Recommendations from './pages/Recommendations'
import Analytics from './pages/Analytics'
import FloatingChatWidget from './components/FloatingChatWidget'
import NotificationBell from './components/NotificationBell'
import GeometricBackground from './components/GeometricBackground'

type Page = 'home' | 'portfolio' | 'news' | 'recommendations' | 'analytics'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Interactive Geometric Background */}
      <GeometricBackground />
      {/* AI-Tech Navbar */}
      <nav className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-blue-500/20 shadow-[0_4px_24px_rgba(59,130,246,0.1)]">
        <div className="max-w-[1440px] mx-auto px-20">
          <div className="flex items-center justify-between h-18">
            {/* Logo */}
            <div className="flex items-center">
              <h1
                onClick={() => setCurrentPage('home')}
                className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent hover:scale-105 transition-transform cursor-pointer"
                style={{ textShadow: '0 0 20px rgba(59, 130, 246, 0.5)' }}
              >
                Eric
              </h1>
            </div>

            {/* Navigation Menu (with Notification Bell at the end) */}
            <div className="flex items-center space-x-6">
              {/* Main Navigation */}
              <div className="flex items-center space-x-10">
              <button
                onClick={() => setCurrentPage('portfolio')}
                className={`group flex items-center space-x-2 px-4 py-3 font-medium transition-all duration-300 ${
                  currentPage === 'portfolio'
                    ? 'text-blue-500'
                    : 'text-white/60 hover:text-white hover:-translate-y-0.5'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>Portfolio</span>
                {currentPage === 'portfolio' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-600" />
                )}
              </button>
              <button
                onClick={() => setCurrentPage('news')}
                className={`group flex items-center space-x-2 px-4 py-3 font-medium transition-all duration-300 ${
                  currentPage === 'news'
                    ? 'text-blue-500'
                    : 'text-white/60 hover:text-white hover:-translate-y-0.5'
                }`}
              >
                <Newspaper className="w-5 h-5" />
                <span>News</span>
                {currentPage === 'news' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-600" />
                )}
              </button>
              <button
                onClick={() => setCurrentPage('recommendations')}
                className={`group relative flex items-center space-x-2 px-4 py-3 font-medium transition-all duration-300 ${
                  currentPage === 'recommendations'
                    ? 'text-blue-500'
                    : 'text-white/60 hover:text-white hover:-translate-y-0.5'
                }`}
              >
                <Sparkles className="w-5 h-5" />
                <span>Recommendations</span>
                {currentPage === 'recommendations' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-600" />
                )}
              </button>
              <button
                onClick={() => setCurrentPage('analytics')}
                className={`group relative flex items-center space-x-2 px-4 py-3 font-medium transition-all duration-300 ${
                  currentPage === 'analytics'
                    ? 'text-blue-500'
                    : 'text-white/60 hover:text-white hover:-translate-y-0.5'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                <span>Analytics</span>
                {currentPage === 'analytics' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-600" />
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
      <main className="max-w-[1280px] mx-auto px-20 py-10 relative z-10">
        {currentPage === 'home' && <Home />}
        {currentPage === 'portfolio' && <Portfolio />}
        {currentPage === 'news' && <News />}
        {currentPage === 'recommendations' && <Recommendations />}
        {currentPage === 'analytics' && <Analytics />}
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-blue-500/10 bg-black/60 backdrop-blur-lg relative z-10">
        <div className="max-w-[1280px] mx-auto px-20 py-6 text-center text-sm text-white/40">
          <p>Oslo Børs Swing Trading • Powered by Claude AI • Data from Newsweb & Yahoo Finance</p>
        </div>
      </footer>

      {/* Floating Chat Widget - Always Available */}
      <FloatingChatWidget />
    </div>
  )
}

export default App
