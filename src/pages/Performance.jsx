import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { SectionCard } from '../components/ui'
import { fmt, CATEGORY_COLORS, CHANNEL_COLORS } from '../utils/format'

const PIE_COLORS = ['#FFB84D', '#10B981', '#8B5CF6', '#3B82F6']

export default function Performance({ data }) {
  const { revenues, expenses, orders = [] } = data

  // 電商平台名稱（對應到「電商」通路）
  const EC_PLATFORMS = ['萌獸官網', 'PChome', 'Yahoo', '跑皮']

  const categoryData = useMemo(() => {
    // 包含手動營收的傳統類別 + 訂單產生的「電商銷售」展開為商品分類
    const cats = ['食品', '烘焙', '蛋糕', '用品']
    const manualCats = cats.map(cat => ({
      name: cat,
      value: revenues.filter(r => r.category === cat).reduce((s, r) => s + r.amount, 0),
    }))

    // 將訂單產生的營收依商品 items 展開分類
    const orderCatMap = {}
    revenues
      .filter(r => EC_PLATFORMS.includes(r.channel) && r.items)
      .forEach(r => {
        r.items.forEach(it => {
          const cat = it.category === 'A用品' ? '用品' : '食品'
          orderCatMap[cat] = (orderCatMap[cat] || 0) + it.qty * it.unitPrice
        })
      })

    return cats.map((cat, i) => ({
      name: cat,
      value: (manualCats[i].value || 0) + (orderCatMap[cat] || 0),
    })).filter(d => d.value > 0)
  }, [revenues])

  const channelData = useMemo(() => {
    const totalCogs = expenses.filter(e => e.type === '進貨').reduce((s, e) => s + e.amount, 0)

    // 電商營收：手動 + 訂單
    const ecRev = revenues
      .filter(r => r.channel === '電商' || EC_PLATFORMS.includes(r.channel))
      .reduce((s, r) => s + r.amount, 0)

    // 市集營收
    const mktRev = revenues
      .filter(r => r.channel === '市集')
      .reduce((s, r) => s + r.amount, 0)

    const totalRev = ecRev + mktRev
    // 用實際營收總和計算 cogsRatio，避免分母為 0
    const cogsRatio = totalRev > 0 ? totalCogs / totalRev : 0

    const boothCost = expenses.filter(e => e.type === '攤位').reduce((s, e) => s + e.amount, 0)

    const ecGross  = ecRev  - ecRev  * cogsRatio
    const mktGross = mktRev - mktRev * cogsRatio - boothCost

    return [
      { name: '電商', 營收: ecRev,  毛利: Math.round(ecGross),  毛利率: ecRev  > 0 ? +(ecGross  / ecRev  * 100).toFixed(1) : 0 },
      { name: '市集', 營收: mktRev, 毛利: Math.round(mktGross), 毛利率: mktRev > 0 ? +(mktGross / mktRev * 100).toFixed(1) : 0 },
    ]
  }, [revenues, expenses])

  const monthlyChannel = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const label = `${d.getMonth() + 1}月`
      const y = d.getFullYear(), m = d.getMonth() + 1
      const inMonth = (r) => { const rd = new Date(r.date); return rd.getFullYear() === y && rd.getMonth() + 1 === m }
      const ec  = revenues.filter(r => inMonth(r) && (r.channel === '電商' || EC_PLATFORMS.includes(r.channel))).reduce((s, r) => s + r.amount, 0)
      const mkt = revenues.filter(r => inMonth(r) && r.channel === '市集').reduce((s, r) => s + r.amount, 0)
      return { label, 電商: ec, 市集: mkt }
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
