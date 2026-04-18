import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { SectionCard } from '../components/ui'
import { fmt, CATEGORY_COLORS, CHANNEL_COLORS } from '../utils/format'

const PIE_COLORS = ['#FFB84D', '#10B981', '#8B5CF6', '#3B82F6']

export default function Performance({ data }) {
  const { revenues, expenses } = data

  const categoryData = useMemo(() => {
    const cats = ['食品', '烘焙', '蛋糕', '用品']
    return cats.map(cat => ({
      name: cat,
      value: revenues.filter(r => r.category === cat).reduce((s, r) => s + r.amount, 0),
    })).filter(d => d.value > 0)
  }, [revenues])

  const channelData = useMemo(() => {
    const channels = ['電商', '市集']
    const totalCogs = expenses.filter(e => e.type === '進貨').reduce((s, e) => s + e.amount, 0)
    const totalRev = revenues.reduce((s, r) => s + r.amount, 0)
    const cogsRatio = totalRev > 0 ? totalCogs / totalRev : 0

    return channels.map(ch => {
      const rev = revenues.filter(r => r.channel === ch).reduce((s, r) => s + r.amount, 0)
      const boothCost = ch === '市集' ? expenses.filter(e => e.type === '攤位').reduce((s, e) => s + e.amount, 0) : 0
      const estimatedCogs = rev * cogsRatio
      const grossProfit = rev - estimatedCogs - boothCost
      return { name: ch, 營收: rev, 毛利: Math.round(grossProfit), 毛利率: rev > 0 ? +(grossProfit / rev * 100).toFixed(1) : 0 }
    })
  }, [revenues, expenses])

  const monthlyChannel = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const label = `${d.getMonth() + 1}月`
      const y = d.getFullYear(), m = d.getMonth() + 1
      const filter = (ch) => revenues
        .filter(r => { const rd = new Date(r.date); return rd.getFullYear() === y && rd.getMonth() + 1 === m && r.channel === ch })
        .reduce((s, r) => s + r.amount, 0)
      return { label, 電商: filter('電商'), 市集: filter('市集') }
    })
  }, [revenues])

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
        {payload.map(p => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-600">{p.name}：</span>
            <span className="font-semibold">{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">商品／通路表現</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 產品線佔比圓餅圖 */}
        <SectionCard title="產品線營收佔比">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" outerRadius={100}
                dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}>
                {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* 通路毛利對比 */}
        <SectionCard title="通路毛利對比">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {channelData.map(ch => (
              <div key={ch.name} className={`rounded-xl p-4 ${ch.name === '電商' ? 'bg-orange-50' : 'bg-emerald-50'}`}>
                <p className="text-xs text-gray-500 font-medium">{ch.name}</p>
                <p className="text-xl font-bold text-gray-800 mt-1">{fmt(ch.毛利)}</p>
                <p className={`text-xs font-medium mt-0.5 ${ch.毛利率 >= 25 ? 'text-emerald-600' : 'text-orange-500'}`}>
                  毛利率 {ch.毛利率}%
                </p>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={channelData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="營收" fill="#FFB84D" radius={[4, 4, 0, 0]} />
              <Bar dataKey="毛利" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* 近6個月通路趨勢 */}
      <SectionCard title="近 6 個月通路營收趨勢">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyChannel} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="電商" fill="#FFB84D" radius={[4, 4, 0, 0]} />
            <Bar dataKey="市集" fill="#10B981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  )
}
