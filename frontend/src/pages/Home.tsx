import { TrendingUp, BarChart3, LineChart, Zap, Shield, Globe } from 'lucide-react'

interface HomeProps {
  onNavigate: (page: string) => void
}

export default function Home({ onNavigate }: HomeProps) {
  return (
    <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="h-full w-full" style={{
            backgroundImage: `
              linear-gradient(rgba(245, 158, 11, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(245, 158, 11, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }} />
        </div>

        {/* Floating chart lines */}
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 1000 600">
          <path
            d="M0,400 Q100,350 200,380 T400,320 T600,360 T800,280 T1000,320"
            stroke="url(#gradient1)"
            strokeWidth="2"
            fill="none"
            className="animate-draw-line"
          />
          <path
            d="M0,450 Q150,400 300,420 T500,380 T700,400 T900,350 T1000,380"
            stroke="url(#gradient2)"
            strokeWidth="2"
            fill="none"
            className="animate-draw-line animation-delay-1000"
          />
          <defs>
            <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
        {/* Logo Animation */}
        <div className="mb-8 inline-flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/20 animate-float">
              <TrendingUp className="w-10 h-10 text-navy-900" />
            </div>
          </div>
        </div>

        {/* Title with gradient */}
        <h1 className="text-6xl md:text-7xl font-bold mb-4 tracking-tight">
          <span className="bg-gradient-to-r from-white via-white to-neutral bg-clip-text text-transparent animate-gradient">
            NORDIC
          </span>
          <span className="bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent ml-3">
            TRADER
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-neutral mb-2 animate-fade-in-up animation-delay-300">
          Professional Trading Platform
        </p>
        <p className="text-lg text-neutral/60 mb-12 animate-fade-in-up animation-delay-500">
          Oslo Børs · Real-time Analytics · AI-Powered Insights
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in-up animation-delay-700">
          <button
            onClick={() => onNavigate('dashboard')}
            className="group relative px-8 py-4 bg-amber-500 hover:bg-amber-400 text-navy-900 font-bold rounded-xl transition-all duration-300 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-105"
          >
            <span className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Enter Dashboard</span>
            </span>
          </button>
          <button
            onClick={() => onNavigate('market')}
            className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 hover:border-amber-500/50 transition-all duration-300"
          >
            <span className="flex items-center space-x-2">
              <LineChart className="w-5 h-5" />
              <span>View Market</span>
            </span>
          </button>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up animation-delay-900">
          <div className="p-6 bg-navy-800/50 rounded-xl border border-white/5 hover:border-amber-500/30 transition-all group">
            <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-amber-500/20 transition-colors">
              <Zap className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="font-bold text-white mb-2">Real-Time Data</h3>
            <p className="text-sm text-neutral">Live market data from Finnhub and Yahoo Finance with instant updates.</p>
          </div>

          <div className="p-6 bg-navy-800/50 rounded-xl border border-white/5 hover:border-amber-500/30 transition-all group">
            <div className="w-12 h-12 bg-profit/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-profit/20 transition-colors">
              <Shield className="w-6 h-6 text-profit" />
            </div>
            <h3 className="font-bold text-white mb-2">AI-Powered Analysis</h3>
            <p className="text-sm text-neutral">Claude AI analyzes news sentiment and provides trading recommendations.</p>
          </div>

          <div className="p-6 bg-navy-800/50 rounded-xl border border-white/5 hover:border-amber-500/30 transition-all group">
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
              <Globe className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="font-bold text-white mb-2">Oslo Børs Focus</h3>
            <p className="text-sm text-neutral">Specialized for Norwegian markets with Newsweb integration.</p>
          </div>
        </div>
      </div>

      {/* Animated Styles */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 6s ease-in-out infinite;
        }
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-300 {
          animation-delay: 0.3s;
        }
        .animation-delay-500 {
          animation-delay: 0.5s;
        }
        .animation-delay-700 {
          animation-delay: 0.7s;
        }
        .animation-delay-900 {
          animation-delay: 0.9s;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
          opacity: 0;
        }
        @keyframes draw-line {
          from {
            stroke-dashoffset: 2000;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        .animate-draw-line {
          stroke-dasharray: 2000;
          animation: draw-line 3s ease-in-out infinite alternate;
        }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 4s ease infinite;
        }
      `}</style>
    </div>
  )
}
