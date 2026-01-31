import { ReactNode } from 'react'

interface ProfessionalPanelProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Professional panel component for Bloomberg-inspired layout
 * Clean, data-dense design with subtle borders, no glassmorphism
 */
export default function ProfessionalPanel({
  title,
  subtitle,
  actions,
  children,
  className = ''
}: ProfessionalPanelProps) {
  return (
    <div className={`bg-navy-800 border border-white/10 rounded-lg ${className}`}>
      {(title || actions) && (
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-white">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-neutral mt-1">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center space-x-2">{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
}
