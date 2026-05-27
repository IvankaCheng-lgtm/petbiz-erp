import { useState, useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { SectionCard } from '../components/ui'
import { Download } from 'lucide-react'
import { fmt, CATEGORY_COLORS, CHANNEL_COLORS } from '../utils/format'

const PIE_COLORS = ['#FFB84D', '#10B981', '#8B5CF6', '#3B82F6']

export default function Performance({ data }) {
  const { revenues, expenses, orders = [], inventory = [], marketEvents = [] } = data

  const EC_PLATFORMS = ['?摰雯', 'PChome', 'Yahoo', '?衣']
  const OFFLINE_PLATFORMS = ['蝘?閮頃', 'LINE閮頃']
  const [itemTab, setItemTab] = useState('ec')
  const [expandedItem, setExpandedItem] = useState(null)
  const [expandedMarginItem, setExpandedMarginItem] = useState(null)
  const [selectedMarketEvent, setSelectedMarketEvent] = useState('all')
  const [pageAll, setPageAll] = useState(1)
  const [pageMargin, setPageMargin] = useState(1)
  const [pageTurnover, setPageTurnover] = useState(1)
  const [riskFilter, setRiskFilter] = useState('all')
  const [pageChannel, setPageChannel] = useState(1)
  const [pageMarket, setPageMarket] = useState(1)
  const PAGE_SIZE = 10

  // ??蝭?蝭拚
  const now2 = new Date()
  const [rangeType, setRangeType] = useState('month')
  const [rangeYear, setRangeYear] = useState(now2.getFullYear())
  const [rangeMonth, setRangeMonth] = useState(now2.getMonth() + 1)
  const [rangeQ, setRangeQ] = useState(Math.ceil((now2.getMonth() + 1) / 3))

  const availableYears = useMemo(() => {
    const s = new Set(revenues.map(r => r.date.slice(0, 4)))
    orders.forEach(o => { if (o.orderDate) s.add(o.orderDate.slice(0, 4)) })
    const arr = [...s].sort((a, b) => b - a)
    return arr.length > 0 ? arr : [String(now2.getFullYear())]
  }, [revenues, orders])

  const rangeLabel = useMemo(() => {
    if (rangeType === 'month') return rangeYear + ' 撟?' + rangeMonth + ' ??
    if (rangeType === 'quarter') return rangeYear + ' 撟?Q' + rangeQ
    return rangeYear + ' 撟?
  }, [rangeType, rangeYear, rangeMonth, rangeQ])

  function inRange(dateStr) {
    if (!dateStr) return false
    if (rangeType === 'month') return dateStr.startsWith(rangeYear + '-' + String(rangeMonth).padStart(2, '0'))
    if (rangeType === 'quarter') {
      const m = parseInt(dateStr.slice(5, 7))
      return dateStr.startsWith(String(rangeYear)) && Math.ceil(m / 3) === rangeQ
    }
    return dateStr.startsWith(String(rangeYear))
  }

  function Pagination({ page, setPage, total }) {
    const pages = Math.ceil(total / PAGE_SIZE)
    if (pages <= 1) return null
    return (
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
        <span className="text-xs text-gray-400">??{total} 蝑?蝚?{page} / {pages} ??/span>
        <div className="flex gap-1">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">銝???/button>
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-7 h-7 text-xs rounded-lg border transition-colors ${
                p === page ? 'bg-orange-400 text-white border-orange-400' : 'border-gray-200 hover:bg-gray-50'
              }`}>{p}</button>
          ))}
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">銝???/button>
        </div>
      </div>
    )
  }

  const filteredOrders = useMemo(
    () => orders.filter(o => inRange(o.orderDate)),
    [orders, rangeType, rangeYear, rangeMonth, rangeQ]
  )
  const filteredRevenues = useMemo(
    () => revenues.filter(r => inRange(r.date)),
    [revenues, rangeType, rangeYear, rangeMonth, rangeQ]
  )

  // 撣???銵函
  const marketItemPerEvent = useMemo(() => {
    const mktRevs = filteredRevenues.filter(r => r.channel === '撣?' && r.items)
    const allMap = {}
    mktRevs.forEach(r => {
      ;(r.items || []).forEach(it => {
        if (!allMap[it.itemId]) allMap[it.itemId] = { name: it.itemName, qty: 0, amount: 0, byEvent: {} }
        allMap[it.itemId].qty += it.qty
        allMap[it.itemId].amount += it.qty * it.unitPrice
        const eid = r.eventId || 'unknown'
        allMap[it.itemId].byEvent[eid] = (allMap[it.itemId].byEvent[eid] || 0) + it.qty
      })
    })
    const byEvent = {}
    mktRevs.forEach(r => {
      const eid = r.eventId || 'unknown'
      if (!byEvent[eid]) byEvent[eid] = {}
      ;(r.items || []).forEach(it => {
        if (!byEvent[eid][it.itemId]) byEvent[eid][it.itemId] = { name: it.itemName, qty: 0, amount: 0 }
        byEvent[eid][it.itemId].qty += it.qty
        byEvent[eid][it.itemId].amount += it.qty * it.unitPrice
      })
    })
    return { byEvent, allItems: Object.values(allMap).sort((a, b) => b.qty - a.qty) }
  }, [filteredRevenues, rangeType, rangeYear, rangeMonth, rangeQ])

  // ???券楝蝝澆???
  const allItemStats = useMemo(() => {
    const map = {}

    // ?餃?閮
    filteredOrders.forEach(o => {
      const ch = EC_PLATFORMS.includes(o.platform) ? '?餃?' : '撖阡?'
      ;(o.items || []).forEach(it => {
        if (!map[it.itemId]) map[it.itemId] = { name: it.itemName, total: 0, amount: 0, ec: 0, market: 0, offline: 0, byPlatform: {} }
        map[it.itemId].total += it.qty
        map[it.itemId].amount += it.qty * it.unitPrice
        if (ch === '?餃?') map[it.itemId].ec += it.qty
        else map[it.itemId].offline += it.qty
        map[it.itemId].byPlatform[o.platform] = (map[it.itemId].byPlatform[o.platform] || 0) + it.qty
      })
    })

    // 撣??曉?嗆狡
    filteredRevenues.filter(r => r.channel === '撣?' && r.items).forEach(r => {
      ;(r.items || []).forEach(it => {
        if (!map[it.itemId]) map[it.itemId] = { name: it.itemName, total: 0, amount: 0, ec: 0, market: 0, offline: 0, byPlatform: {} }
        map[it.itemId].total += it.qty
        map[it.itemId].amount += it.qty * it.unitPrice
        map[it.itemId].market += it.qty
        map[it.itemId].byPlatform['撣?'] = (map[it.itemId].byPlatform['撣?'] || 0) + it.qty
      })
    })

    return Object.values(map)
      .map(item => {
        const inv = inventory.find(i => i.itemName === item.name)
        const stock = inv?.currentQty ?? null
        const turnover = stock !== null && item.total > 0 ? +(item.total / (item.total + stock) * 100).toFixed(1) : null
        return { ...item, stock, turnover }
      })
      .sort((a, b) => b.total - a.total)
  }, [filteredOrders, filteredRevenues, inventory, rangeType, rangeYear, rangeMonth, rangeQ])

  // 摨怠??刻?????  const turnoverStats = useMemo(() => {
    const now = new Date()
    const days30ago = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
    const days90ago = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10)

    // 閮?瘥??? 30 憭拙? 90 憭拍???桅?
    const salesMap = {}
    const countSales = (items, date) => {
      if (!items) return
      items.forEach(it => {
        if (!salesMap[it.itemId]) salesMap[it.itemId] = { name: it.itemName, qty30: 0, qty90: 0 }
        if (date >= days30ago) salesMap[it.itemId].qty30 += it.qty
        if (date >= days90ago) salesMap[it.itemId].qty90 += it.qty
      })
    }

    orders.forEach(o => countSales(o.items, o.orderDate))
    revenues.filter(r => r.channel === '撣?' && r.items).forEach(r => countSales(r.items, r.date))

    return inventory
      .filter(i => i.category === 'A?典?' || i.category === 'B憌?')
      .map(item => {
        const s = salesMap[item.id] || { qty30: 0, qty90: 0 }
        const dailyRate30 = s.qty30 / 30  // ?亙???桅?嚗?0憭抬?
        const dailyRate90 = s.qty90 / 90  // ?亙???桅?嚗?0憭抬?
        const daysLeft = dailyRate30 > 0 ? Math.round(item.currentQty / dailyRate30) : null
        const risk = s.qty30 === 0 && item.currentQty > 0 ? 'dead'
          : daysLeft !== null && daysLeft > 90 ? 'slow'
          : daysLeft !== null && daysLeft < 14 ? 'urgent'
          : 'normal'
        return { ...item, qty30: s.qty30, qty90: s.qty90, dailyRate30, daysLeft, risk }
      })
      .sort((a, b) => {
        const order = { dead: 0, slow: 1, urgent: 2, normal: 3 }
        return order[a.risk] - order[b.risk] || b.currentQty - a.currentQty
      })
  }, [orders, revenues, inventory])

  // ??瘥??
  const itemMarginStats = useMemo(() => {
    return allItemStats
      .map(item => {
        const inv = inventory.find(i => i.itemName === item.name)
        const salePrice = inv?.salePrice || 0
        const cost = inv?.cost || 0
        const margin = salePrice > 0 ? salePrice - cost : null
        const marginRate = salePrice > 0 && cost > 0 ? +((salePrice - cost) / salePrice * 100).toFixed(1) : null
        const totalProfit = margin !== null ? Math.round(margin * item.total) : null
        return { ...item, salePrice, cost, margin, marginRate, totalProfit }
      })
      .filter(i => i.salePrice > 0)
      .sort((a, b) => (b.totalProfit ?? -Infinity) - (a.totalProfit ?? -Infinity))
  }, [allItemStats, inventory])
  const ecItemStats = useMemo(() => {
    const map = {}
    filteredOrders
      .filter(o => EC_PLATFORMS.includes(o.platform))
      .forEach(o => {
        ;(o.items || []).forEach(it => {
          if (!map[it.itemId]) map[it.itemId] = { name: it.itemName, qty: 0, amount: 0, platforms: {} }
          map[it.itemId].qty += it.qty
          map[it.itemId].amount += it.qty * it.unitPrice
          map[it.itemId].platforms[o.platform] = (map[it.itemId].platforms[o.platform] || 0) + it.qty
        })
      })
    return Object.values(map).sort((a, b) => b.qty - a.qty)
  }, [filteredOrders, rangeType, rangeYear, rangeMonth, rangeQ])

  // ????桀???撣?嚗? revenues.items where channel=撣?嚗?  const marketItemStats = useMemo(() => {
    const map = {}
    filteredRevenues
      .filter(r => r.channel === '撣?' && r.items)
      .forEach(r => {
        ;(r.items || []).forEach(it => {
          if (!map[it.itemId]) map[it.itemId] = { name: it.itemName, qty: 0, amount: 0 }
          map[it.itemId].qty += it.qty
          map[it.itemId].amount += it.qty * it.unitPrice
        })
      })
    return Object.values(map).sort((a, b) => b.qty - a.qty)
  }, [filteredRevenues, rangeType, rangeYear, rangeMonth, rangeQ])

  // ????桀???撖阡??楝嚗?閮?LINE/撖都暺?
  const offlineItemStats = useMemo(() => {
    const map = {}
    filteredOrders
      .filter(o => OFFLINE_PLATFORMS.includes(o.platform) || (!EC_PLATFORMS.includes(o.platform) && o.platform !== '撣?'))
      .forEach(o => {
        ;(o.items || []).forEach(it => {
          if (!map[it.itemId]) map[it.itemId] = { name: it.itemName, qty: 0, amount: 0, platforms: {} }
          map[it.itemId].qty += it.qty
          map[it.itemId].amount += it.qty * it.unitPrice
          map[it.itemId].platforms[o.platform] = (map[it.itemId].platforms[o.platform] || 0) + it.qty
        })
      })
    return Object.values(map).sort((a, b) => b.qty - a.qty)
  }, [filteredOrders, rangeType, rangeYear, rangeMonth, rangeQ])

  // 摨怠? cost 撠銵?  const inventoryCostMap = useMemo(() => {
    const map = {}
    inventory.forEach(i => { map[i.id] = i.cost || 0 })
    return map
  }, [inventory])

  // 敺?orders.items 閮?撖阡????嚗ty ? inventory.cost嚗?  const actualCogs = useMemo(() =>
    filteredOrders.reduce((s, o) =>
      s + (o.items || []).reduce((ss, it) =>
        ss + it.qty * (inventoryCostMap[it.itemId] || 0), 0), 0),
    [filteredOrders, inventoryCostMap, rangeType, rangeYear, rangeMonth, rangeQ]
  )

  // 敺?expenses ?脰疏?嚗憌?/D??嚗?  const purchaseCogs = useMemo(
    () => expenses.filter(e => e.type === '?脰疏').reduce((s, e) => s + e.amount, 0),
    [expenses]
  )

  // ???憭批潔??箇蜇?嚗??銴?蝞?
  const totalCogs = useMemo(
    () => Math.max(actualCogs, purchaseCogs),
    [actualCogs, purchaseCogs]
  )

  const categoryData = useMemo(() => {
    const cats = ['憌?', '??', '??', '?典?']
    const manualCats = cats.map(cat => ({
      name: cat,
      value: revenues.filter(r => r.category === cat).reduce((s, r) => s + r.amount, 0),
    }))

    const orderCatMap = {}
    revenues
      .filter(r => EC_PLATFORMS.includes(r.channel) && r.items)
      .forEach(r => {
        r.items.forEach(it => {
          const cat = it.category === 'A?典?' ? '?典?' : '憌?'
          orderCatMap[cat] = (orderCatMap[cat] || 0) + it.qty * it.unitPrice
        })
      })

    return cats.map((cat, i) => ({
      name: cat,
      value: (manualCats[i].value || 0) + (orderCatMap[cat] || 0),
    })).filter(d => d.value > 0)
  }, [revenues])

  const channelData = useMemo(() => {
    const ecRev = filteredRevenues
      .filter(r => r.channel === '?餃?' || EC_PLATFORMS.includes(r.channel))
      .reduce((s, r) => s + r.amount, 0)

    const mktRev = filteredRevenues
      .filter(r => r.channel === '撣?')
      .reduce((s, r) => s + r.amount, 0)

    const totalRev = ecRev + mktRev
    const cogsRatio = totalRev > 0 ? totalCogs / totalRev : 0

    const boothCost = expenses.filter(e => e.type === '?支?').reduce((s, e) => s + e.amount, 0)

    const ecGross  = ecRev  - ecRev  * cogsRatio
    const mktGross = mktRev - mktRev * cogsRatio - boothCost

    return [
      { name: '?餃?', ?: ecRev,  瘥: Math.round(ecGross),  瘥?? ecRev  > 0 ? +(ecGross  / ecRev  * 100).toFixed(1) : 0 },
      { name: '撣?', ?: mktRev, 瘥: Math.round(mktGross), 瘥?? mktRev > 0 ? +(mktGross / mktRev * 100).toFixed(1) : 0 },
    ]
  }, [filteredRevenues, expenses, totalCogs, rangeType, rangeYear, rangeMonth, rangeQ])

  const monthlyChannel = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const label = `${d.getMonth() + 1}?
      const y = d.getFullYear(), m = d.getMonth() + 1
      const inMonth = (r) => { const rd = new Date(r.date); return rd.getFullYear() === y && rd.getMonth() + 1 === m }
      const ec  = revenues.filter(r => inMonth(r) && (r.channel === '?餃?' || EC_PLATFORMS.includes(r.channel))).reduce((s, r) => s + r.amount, 0)
      const mkt = revenues.filter(r => inMonth(r) && r.channel === '撣?').reduce((s, r) => s + r.amount, 0)
      return { label, ?餃?: ec, 撣?: mkt }
    })
  }, [revenues])

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
        {payload.map(p => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-600">{p.name}嚗?/span>
            <span className="font-semibold">{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    )
  }


  function handlePerformancePrint() {
    const date = new Date().toLocaleDateString('zh-TW')

    // ?楝瘥
    const channelRows = channelData.map(ch =>
      '<tr><td style="padding:8px 12px;font-weight:600">' + ch.name + '</td>' +
      '<td style="padding:8px 12px;text-align:right">' + fmt(ch['?']) + '</td>' +
      '<td style="padding:8px 12px;text-align:right;color:' + (ch['瘥'] >= 0 ? '#059669' : '#dc2626') + ';font-weight:700">' + fmt(ch['瘥']) + '</td>' +
      '<td style="padding:8px 12px;text-align:right;color:' + (ch['瘥??] >= 25 ? '#059669' : '#f97316') + '">' + ch['瘥??] + '%</td></tr>'
    ).join('')

    // ???券楝 Top 20
    const itemRows = allItemStats.slice(0, 20).map((item, i) =>
      '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f9fafb') + '">' +
      '<td style="padding:7px 10px;color:#9ca3af;font-size:12px">' + (i + 1) + '</td>' +
      '<td style="padding:7px 10px;font-weight:600">' + item.name + '</td>' +
      '<td style="padding:7px 10px;text-align:right;color:#f97316">' + (item.ec || '??) + '</td>' +
      '<td style="padding:7px 10px;text-align:right;color:#059669">' + (item.market || '??) + '</td>' +
      '<td style="padding:7px 10px;text-align:right;color:#8b5cf6">' + (item.offline || '??) + '</td>' +
      '<td style="padding:7px 10px;text-align:right;font-weight:700">' + item.total + '</td>' +
      '<td style="padding:7px 10px;text-align:right;color:#6b7280">' + fmt(item.amount) + '</td></tr>'
    ).join('')

    // ??瘥 Top 20
    const marginRows = itemMarginStats.slice(0, 20).map((item, i) =>
      `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}"><td style="padding:7px 10px;color:#9ca3af;font-size:12px">${i + 1}</td><td style="padding:7px 10px;font-weight:600">${item.name}</td><td style="padding:7px 10px;text-align:right">$${item.salePrice}</td><td style="padding:7px 10px;text-align:right;color:#9ca3af">$${item.cost}</td><td style="padding:7px 10px;text-align:right;font-weight:600;color:${item.marginRate >= 30 ? '#059669' : item.marginRate >= 20 ? '#f97316' : '#dc2626'}">${item.marginRate !== null ? item.marginRate + '%' : '??}</td><td style="padding:7px 10px;text-align:right;font-weight:700;color:#059669">${item.totalProfit !== null ? fmt(item.totalProfit) : '??}</td></tr>`
    ).join('')


    const html = [
      '<html><head><meta charset="utf-8"><title>?楝銵函?? ' + rangeLabel + '</title>',
      '<style>',
      'body{font-family:sans-serif;padding:28px;color:#1f2937;font-size:13px}',
      'h1{font-size:20px;font-weight:900;margin:0 0 4px}',
      '.sub{font-size:11px;color:#6b7280;margin-bottom:24px}',
      '.sec{margin-bottom:24px}',
      '.sec-title{font-size:14px;font-weight:700;border-left:4px solid #f97316;padding-left:9px;margin-bottom:10px;color:#1f2937}',
      'table{width:100%;border-collapse:collapse;font-size:12px}',
      'thead tr{background:#f3f4f6}',
      'th{text-align:left;padding:8px 10px;font-size:11px;font-weight:600;color:#374151}',
      'th:not(:first-child){text-align:right}',
      'tbody tr{border-bottom:1px solid #f3f4f6}',
      '.footer{margin-top:32px;font-size:10px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:10px}',
      '@media print{body{padding:12px}@page{size:A4;margin:1.2cm}}',
      '</style></head><body>',
      '<h1>??ａ??繚 ??嚗楝銵函??</h1>',
      '<div class="sub">?梯”蝭?嚗? + rangeLabel + '????交?嚗? + date + '</div>',
      '<div class="sec"><div class="sec-title">?? ?楝瘥撠?</div>',
      '<table><thead><tr><th>?楝</th><th>?</th><th>瘥</th><th>瘥??/th></tr></thead>',
      '<tbody>' + channelRows + '</tbody></table></div>',
      allItemStats.length > 0 ? '<div class="sec"><div class="sec-title">?? ???券楝?瑕蝮質汗嚗op 20嚗?/div><table><thead><tr><th>#</th><th>??</th><th>?餃?</th><th>撣?</th><th>撖阡?</th><th>蝮質?</th><th>?瑕憿?/th></tr></thead><tbody>' + itemRows + '</tbody></table></div>' : '',
      itemMarginStats.length > 0 ? '<div class="sec"><div class="sec-title">? ??瘥??嚗op 20嚗?/div><table><thead><tr><th>#</th><th>??</th><th>?桀</th><th>?</th><th>瘥??/th><th>蝮賜??/th></tr></thead><tbody>' + marginRows + '</tbody></table></div>' : '',
      '<div class="footer">??ａ??ERP 繚 ??嚗楝銵函?? 繚 ' + rangeLabel + '</div>',
      '</body></html>',
    ].join('')
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }