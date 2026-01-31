import { ReactNode, useState } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'

export interface Column {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  format?: (value: any, row: any) => ReactNode
  className?: string
}

interface DataTableProps {
  columns: Column[]
  data: any[]
  keyField?: string
  onRowClick?: (row: any) => void
  className?: string
  compact?: boolean
}

/**
 * Professional Bloomberg-style data table
 * Features: sortable columns, fixed headers, alternating rows,
 * monospace numbers, right-aligned numeric columns
 */
export default function DataTable({
  columns,
  data,
  keyField = 'id',
  onRowClick,
  className = '',
  compact = false
}: DataTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }

  const sortedData = [...data].sort((a, b) => {
    if (!sortColumn) return 0

    const aVal = a[sortColumn]
    const bVal = b[sortColumn]

    if (aVal === bVal) return 0

    const comparison = aVal > bVal ? 1 : -1
    return sortDirection === 'asc' ? comparison : -comparison
  })

  const rowHeight = compact ? 'py-2' : 'py-3'

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead className="bg-navy-900 border-b border-white/10 sticky top-0">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`${rowHeight} px-4 text-sm font-semibold text-neutral uppercase tracking-wider ${
                  column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'
                } ${column.sortable ? 'cursor-pointer hover:text-white transition-colors' : ''}`}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div className={`flex items-center ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : 'justify-start'} space-x-1`}>
                  <span>{column.label}</span>
                  {column.sortable && sortColumn === column.key && (
                    <span className="text-amber-500">
                      {sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => (
            <tr
              key={row[keyField] || index}
              className={`border-b border-white/5 transition-colors ${
                onRowClick ? 'cursor-pointer hover:bg-white/5' : ''
              } ${index % 2 === 0 ? 'bg-navy-900/30' : 'bg-navy-900/10'}`}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((column) => {
                const value = row[column.key]
                const isNumeric = typeof value === 'number'

                return (
                  <td
                    key={column.key}
                    className={`${rowHeight} px-4 text-sm ${
                      column.align === 'right' || isNumeric ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'
                    } ${isNumeric ? 'font-mono' : ''} ${column.className || ''}`}
                  >
                    {column.format ? column.format(value, row) : value}
                  </td>
                )
              })}
            </tr>
          ))}
          {sortedData.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-neutral">
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
