import { X } from 'lucide-react'

interface InsightsFiltersProps {
  selectedType: string
  selectedSeverity: string
  onTypeChange: (type: string) => void
  onSeverityChange: (severity: string) => void
  onClearFilters: () => void
}

export default function InsightsFilters({
  selectedType,
  selectedSeverity,
  onTypeChange,
  onSeverityChange,
  onClearFilters
}: InsightsFiltersProps) {
  const hasActiveFilters = selectedType !== 'all' || selectedSeverity !== 'all'

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Filter Label */}
        <span className="text-sm font-semibold text-white/80">Filters:</span>

        {/* Tip Type Filter */}
        <div className="flex-1 min-w-[200px]">
          <select
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-white/15 transition-colors"
          >
            <option value="all" className="bg-slate-800">All Types</option>
            <option value="daily_insight" className="bg-slate-800">Daily Insights</option>
            <option value="smart_alert" className="bg-slate-800">Smart Alerts</option>
            <option value="risk_warning" className="bg-slate-800">Risk Warnings</option>
            <option value="entry_exit" className="bg-slate-800">Entry/Exit Signals</option>
          </select>
        </div>

        {/* Severity Filter */}
        <div className="flex-1 min-w-[200px]">
          <select
            value={selectedSeverity}
            onChange={(e) => onSeverityChange(e.target.value)}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-white/15 transition-colors"
          >
            <option value="all" className="bg-slate-800">All Severities</option>
            <option value="high" className="bg-slate-800">High Priority</option>
            <option value="medium" className="bg-slate-800">Medium Priority</option>
            <option value="low" className="bg-slate-800">Low Priority</option>
          </select>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg flex items-center space-x-2 text-sm transition-all"
          >
            <X className="w-4 h-4" />
            <span>Clear Filters</span>
          </button>
        )}

        {/* Active Filter Count */}
        {hasActiveFilters && (
          <div className="text-xs text-white/60 bg-blue-500/20 px-3 py-1 rounded-full">
            {[selectedType !== 'all', selectedSeverity !== 'all'].filter(Boolean).length} active
          </div>
        )}
      </div>
    </div>
  )
}
