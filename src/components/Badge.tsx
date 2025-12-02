import { BadgeColor } from '../types'

interface BadgeProps {
  label: string
  color: BadgeColor
  hasBorder?: boolean
}

function Badge({ label, color, hasBorder = false }: BadgeProps) {
  const colorClasses: Record<BadgeColor, string> = {
    blue: 'bg-blue-100 text-blue-800',
    red: 'bg-red-100 text-red-800',
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800',
    orange: 'bg-orange-100 text-orange-800',
    cyan: 'bg-cyan-100 text-cyan-800',
    purple: 'bg-purple-100 text-purple-800',
    pink: 'bg-pink-100 text-pink-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    gray: 'bg-gray-100 text-gray-800',
  }

  const borderClasses: Record<BadgeColor, string> = {
    blue: 'border-blue-200',
    red: 'border-red-200',
    green: 'border-green-200',
    amber: 'border-amber-200',
    orange: 'border-orange-200',
    cyan: 'border-cyan-200',
    purple: 'border-purple-200',
    pink: 'border-pink-200',
    yellow: 'border-yellow-200',
    gray: 'border-gray-200',
  }

  const baseClasses = 'inline-flex px-3 py-1 text-xs font-semibold rounded-full'
  const colorClass = colorClasses[color] || colorClasses.gray
  const borderClass = hasBorder ? `border ${borderClasses[color] || borderClasses.gray}` : ''

  return (
    <span className={`${baseClasses} ${colorClass} ${borderClass}`}>
      {label}
    </span>
  )
}

export default Badge

