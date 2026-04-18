import { X } from 'lucide-react'

export function KpiCard({ title, value, sub, icon, color = 'brand', trend }) {
  const colors = {
    brand:  'from-brand-dark to-brand-dark/80',
    orange: 'from-brand-dark to-brand-dark/80',
    green:  'from-emerald-400 to-emerald-500',
    blue:   'from-blue-400 to-blue-500',
    red:    'from-red-400 to-red-500',
    purple: 'from-purple-400 to-purple-500',
  }
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
      <div className={`bg-gradient-to-br ${colors[color]} rounded-xl p-3 text-white text-2xl shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-gray-800 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        {trend !== undefined && (
          <p className={`text-xs font-medium mt-0.5 ${trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  )
}

export function Modal({ title, onClose, children, size = 'md' }) {
  const widths = {
    sm:  'max-w-md',
    md:  'max-w-2xl',
    lg:  'max-w-4xl',
    xl:  'max-w-6xl',
    full: 'max-w-[95vw]',
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${widths[size]} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto overflow-x-auto p-6 flex-1">{children}</div>
      </div>
    </div>
  )
}

export function Badge({ children, color = 'gray' }) {
  const cls = {
    gray:   'bg-gray-100 text-gray-600',
    orange: 'bg-orange-100 text-orange-700',
    green:  'bg-emerald-100 text-emerald-700',
    red:    'bg-red-100 text-red-700',
    blue:   'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls[color]}`}>
      {children}
    </span>
  )
}

export function SectionCard({ title, action, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      {(title || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          {title && <h2 className="font-bold text-gray-800">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
}

export function FormRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}

export const inputCls = 'w-full border border-brand-light rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-dark transition'
export const btnPrimary = 'bg-brand-dark hover:bg-brand-dark/90 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors'
export const btnSecondary = 'bg-brand-light/40 hover:bg-brand-light/70 text-brand-dark font-medium px-4 py-2 rounded-lg text-sm transition-colors'
export const btnDanger = 'bg-red-50 hover:bg-red-100 text-red-600 font-medium px-3 py-1.5 rounded-lg text-xs transition-colors'
