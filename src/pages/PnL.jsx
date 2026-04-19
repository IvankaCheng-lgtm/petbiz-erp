import { useState, useMemo, useRef } from 'react'
import { Sparkles, TrendingUp, TrendingDown, Download } from 'lucide-react'
import { SectionCard, btnPrimary } from '../components/ui'
import { fmt } from '../utils/format'
import { getAIInsight } from '../utils/aiInsight'
import { exportToCSV, buildMonthlyReport } from '../utils/exportReport'

function PnLRow({ label, value, indent = 0, bold = false, highlight, border }) {
  return (
    <div className={`flex justify-between items-center py-2.5 px-4
      ${indent === 1 ? 'pl-8' : indent === 2 ? 'pl-12' : ''}
      ${bold ? 'font-bold' : ''}
      ${highlight === 'green' ? 'bg-emerald-50 rounded-xl' : highlight === 'red' ? 'bg-red-50 rounded-xl' : ''}
      ${border ? 'border-t border-gray-200 mt-1' : ''}
    `}>
      <span className={`text-sm ${bold ? 'text-gray-800' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm font-semibold
        ${value < 0 ? 'text-red-600' : value > 0 && highlight ? 'text-emerald-600' : 'text-gray-800'}
      `}>
        {value < 0 ? `(${fmt(Math.abs(value))})` : fmt(value)}
      </span>
    </div>
  )
}

export default function PnL({ data }) {
  const { revenues, expenses, kpi, inventoryAlerts, inventory = [], orders = [] } = data
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const printRef = useRef()

  // 庫存 cost 對照表
  const inventoryCostMap = useMemo(() => {
    const map = {}
    inventory.forEach(i => { map[i.id] = i.cost || 0 })
    return map
  }, [inventory])

  // 從 orders.items 計算實際商品成本
  const actualCogs = useMemo(() =>
    orders.reduce((s, o) =>
      s + (o.items || []).reduce((ss, it) =>
        ss + it.qty * (inventoryCostMap[it.itemId] || 0), 0), 0),
    [orders, inventoryCostMap]
  )

  // 本月月份
  const currentMonth = new Date().toISOString().slice(0, 7)

  // 時間範圍選擇
  const now = new Date()
  const [rangeType, setRangeType] = useState('month') // 'month' | 'quarter' | 'year'
  const [rangeYear, setRangeYear] = useState(now.getFullYear())
  const [rangeMonth, setRangeMonth] = useState(now.getMonth() + 1)
  const [rangeQ, setRangeQ] = useState(Math.ceil((now.getMonth() + 1) / 3))

  // 可選年份列表
  const availableYears = useMemo(() => {
    const years = new Set([
      ...revenues.map(r => r.date.slice(0, 4)),
      ...expenses.map(e => e.date.slice(0, 4)),
    ])
    return [...years].sort((a, b) => b - a)
  }, [revenues, expenses])

  // 依範圍筛選資料
  const filteredRevenues = useMemo(() => {
    return revenues.filter(r => {
      const d = r.date
      if (rangeType === 'month') return d.startsWith(rangeYear + '-' + String(rangeMonth).padStart(2, '0'))
      if (rangeType === 'quarter') {
        const m = parseInt(d.slice(5, 7))
        return d.startsWith(String(rangeYear)) && Math.ceil(m / 3) === rangeQ
      }
      return d.startsWith(String(rangeYear))
    })
  }, [revenues, rangeType, rangeYear, rangeMonth, rangeQ])

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const d = e.date
      if (rangeType === 'month') return d.startsWith(rangeYear + '-' + String(rangeMonth).padStart(2, '0'))
      if (rangeType === 'quarter') {
        const m = parseInt(d.slice(5, 7))
        return d.startsWith(String(rangeYear)) && Math.ceil(m / 3) === rangeQ
      }
      return d.startsWith(String(rangeYear))
    })
  }, [expenses, rangeType, rangeYear, rangeMonth, rangeQ])

  // 範圍標籤
  const rangeLabel = useMemo(() => {
    if (rangeType === 'month') return rangeYear + ' 年 ' + rangeMonth + ' 月'
    if (rangeType === 'quarter') return rangeYear + ' 年 Q' + rangeQ
    return rangeYear + ' 年'
  }, [rangeType, rangeYear, rangeMonth, rangeQ])

  // 月度結算資料
  const monthlySummary = useMemo(() => {
    const mRevs = revenues.filter(r => r.date.startsWith(currentMonth))
    const mExps = expenses.filter(e => e.date.startsWith(currentMonth))
    const totalRev  = mRevs.reduce((s, r) => s + r.amount, 0)
    const totalExp  = mExps.reduce((s, e) => s + e.amount, 0)
    const netProfit = totalRev - totalExp
    const abInv     = inventory.filter(i => i.category === 'A用品' || i.category === 'B食品')
    const invValue  = abInv.reduce((s, i) => s + (i.salePrice || 0) * i.currentQty, 0)
    return { month: currentMonth, totalRev, totalExp, netProfit, invValue }
  }, [revenues, expenses, inventory, currentMonth])

  function handleExportMonthly() {
    const rows = buildMonthlyReport(currentMonth, revenues, expenses, inventory, orders)
    exportToCSV(rows, `萌獸探險隊_營運結算_${currentMonth}.csv`)
  }

  const pnl = useMemo(() => {
    const totalRev = filteredRevenues.reduce((s, r) => s + r.amount, 0)
    const ecRev = filteredRevenues.filter(r => r.channel === '電商').reduce((s, r) => s + r.amount, 0)
    const mktRev = filteredRevenues.filter(r => r.channel === '市集').reduce((s, r) => s + r.amount, 0)

    const byCategory = ['食品', '烘焙', '蛋糕', '用品'].map(cat => ({
      cat, amount: filteredRevenues.filter(r => r.category === cat).reduce((s, r) => s + r.amount, 0),
    }))

    const purchaseCogs = filteredExpenses.filter(e => ['進貨'].includes(e.type)).reduce((s, e) => s + e.amount, 0)
    const cogs = Math.max(actualCogs, purchaseCogs)
    const grossProfit = totalRev - cogs

    const opExpenses = {
      rent:      filteredExpenses.filter(e => e.type === '租金').reduce((s, e) => s + e.amount, 0),
      electric:  filteredExpenses.filter(e => e.type === '電費').reduce((s, e) => s + e.amount, 0),
      labor:     filteredExpenses.filter(e => e.type === '人事').reduce((s, e) => s + e.amount, 0),
      booth:     filteredExpenses.filter(e => e.type === '攤位').reduce((s, e) => s + e.amount, 0),
      marketing: filteredExpenses.filter(e => e.type === '行銷').reduce((s, e) => s + e.amount, 0),
      material:  filteredExpenses.filter(e => e.type === '耗材').reduce((s, e) => s + e.amount, 0),
      equipment: filteredExpenses.filter(e => e.type === '設備').reduce((s, e) => s + e.amount, 0),
      misc:      filteredExpenses.filter(e => e.type === '雜項').reduce((s, e) => s + e.amount, 0),
    }
    const totalOpExp = Object.values(opExpenses).reduce((s, v) => s + v, 0)
    const netProfit = grossProfit - totalOpExp

    return { totalRev, ecRev, mktRev, byCategory, cogs, grossProfit, opExpenses, totalOpExp, netProfit }
  }, [filteredRevenues, filteredExpenses, actualCogs])

  // 財務指標：當月毛利 + 營運開销
  const financialMetrics = useMemo(() => {
    const mRevs = revenues.filter(r => r.date.startsWith(currentMonth))
    const mExps = expenses.filter(e => e.date.startsWith(currentMonth))

    const monthRev  = mRevs.reduce((s, r) => s + r.amount, 0)
    // 當月銷貨成本：進貨 + 生產電費（直接生產製造成本）
    const monthCogs = mExps
      .filter(e => e.type === '進貨' || (e.type === '電費' && e.isProductionCost))
      .reduce((s, e) => s + e.amount, 0)
    const grossProfit = monthRev - monthCogs

    const booth    = mExps.filter(e => e.type === '攤位').reduce((s, e) => s + e.amount, 0)
    const shipping = mExps.filter(e => e.type === '運費').reduce((s, e) => s + e.amount, 0)
    const ads      = mExps.filter(e => e.type === '行銷').reduce((s, e) => s + e.amount, 0)
    const opExp    = booth + shipping + ads

    return { monthRev, monthCogs, grossProfit, opExp, booth, shipping, ads }
  }, [revenues, expenses, currentMonth])

  // 庫存深度分析
  const inventoryMetrics = useMemo(() => {
    const stockLevel = inventory.reduce((s, i) => s + (i.currentQty || 0), 0)
    const today = new Date()
    const expiryWarnings = []
    inventory.forEach(item => {
      (item.expiryBatches || []).forEach(batch => {
        const exp = batch.normalExp || batch.shelfExpiry
        if (!exp) return
        const daysLeft = Math.ceil((new Date(exp) - today) / 86400000)
        if (daysLeft < 30) {
          expiryWarnings.push({
            itemName: item.itemName,
            exp,
            daysLeft,
            qty: batch.qty || 0,
          })
        }
      })
    })
    expiryWarnings.sort((a, b) => a.daysLeft - b.daysLeft)
    return { stockLevel, expiryWarnings }
  }, [inventory])

  // 平台 ROI：(平台營收 - 商品成本) / (手續費 + 相關行銷支出)
  const platformROI = useMemo(() => {
    const platforms = [...new Set(orders.map(o => o.platform).filter(Boolean))]

    // 各平台從 expenses 找備註含平台名的行銷支出
    const adsByPlatform = {}
    expenses.filter(e => e.type === '行銷' && e.note).forEach(e => {
      platforms.forEach(p => {
        if (e.note.includes(p)) adsByPlatform[p] = (adsByPlatform[p] || 0) + e.amount
      })
    })

    // 用整體 cogs 佔營收比例估算各平台商品成本
    const cogsRate = pnl.totalRev > 0 ? pnl.cogs / pnl.totalRev : 0

    const result = platforms.map(p => {
      const platformOrders = orders.filter(o => o.platform === p)
      const rev          = platformOrders.reduce((s, o) => s + (o.total || 0), 0)
      const itemCost     = rev * cogsRate
      // 手續費：從訂單的 platformCost 加總（包含自動建立的支出和手動填寫）
      const platformFees = platformOrders.reduce((s, o) => s + (o.platformCost || 0), 0)
      const adsCost      = adsByPlatform[p] || 0
      const totalCost    = platformFees + adsCost
      // 實際獲利 = 營收 - 商品成本 - 手續費 - 廣告費
      const netProfit    = rev - itemCost - totalCost
      // ROI 僅在有實際成本時才計算
      const roi          = totalCost > 0 ? (rev - itemCost) / totalCost : null
      return { platform: p, rev, itemCost, platformFees, adsCost, totalCost, netProfit, roi }
    // 改用實際獲利金額排序，而非 ROI
    }).sort((a, b) => b.netProfit - a.netProfit)

    return result
  }, [orders, expenses, pnl.cogs, pnl.totalRev])

  async function handleAI() {
    setAiLoading(true)
    setAiText('')
    try {
      const result = await getAIInsight({ kpi, inventoryAlerts, revenues, expenses })
      setAiText(result)
    } finally {
      setAiLoading(false)
    }
  }

  function handlePrint() {
    const date = new Date().toLocaleDateString('zh-TW')
    const bgColor     = pnl.netProfit >= 0 ? '#ecfdf5' : '#fef2f2'
    const amountColor = pnl.netProfit >= 0 ? '#059669' : '#dc2626'
    const gpClass     = pnl.grossProfit >= 0 ? 'green' : 'red'
    const npClass     = pnl.netProfit   >= 0 ? 'green' : 'red'
    const gpFmt = pnl.grossProfit < 0 ? '(' + fmt(Math.abs(pnl.grossProfit)) + ')' : fmt(pnl.grossProfit)
    const npFmt = pnl.netProfit   < 0 ? '(' + fmt(Math.abs(pnl.netProfit))   + ')' : fmt(pnl.netProfit)
    const printContent = [
      '<html><head><meta charset="utf-8">',
      '<title>\u640d\u76ca\u8868 ' + date + '</title>',
      '<style>',
      'body { font-family: sans-serif; padding: 32px; color: #1f2937; }',
      'h1 { font-size: 22px; font-weight: bold; margin-bottom: 4px; }',
      '.date { font-size: 12px; color: #6b7280; margin-bottom: 24px; }',
      'table { width: 100%; border-collapse: collapse; font-size: 14px; }',
      'tr { border-bottom: 1px solid #f3f4f6; }',
      'td { padding: 8px 12px; }',
      'td:last-child { text-align: right; font-weight: 600; }',
      '.bold td { font-weight: bold; font-size: 15px; background: #f9fafb; }',
      '.green td:last-child { color: #059669; }',
      '.red td:last-child { color: #dc2626; }',
      '.indent1 td:first-child { padding-left: 28px; }',
      '.indent2 td:first-child { padding-left: 48px; }',
      '.section-gap { border-top: 2px solid #e5e7eb !important; }',
      '.profit-box { margin-top: 24px; padding: 16px; border-radius: 8px; background: ' + bgColor + '; }',
      '.profit-box h2 { font-size: 14px; color: #6b7280; margin: 0 0 4px; }',
      '.profit-box .amount { font-size: 28px; font-weight: 900; color: ' + amountColor + '; }',
      '.profit-box .rate { font-size: 14px; color: #6b7280; margin-top: 4px; }',
      '@media print { body { padding: 16px; } }',
      '</style></head><body>',
      '<h1>\u840c\u7378\u63a2\u96aa\u968a \u00b7 \u640d\u76ca\u8868</h1>',
      '<div class="date">\u5217\u5370\u65e5\u671f\uff1a' + date + '</div>',
      '<table>',
      '<tr class="bold"><td>\u258c \u71df\u696d\u6536\u5165</td><td>' + fmt(pnl.totalRev) + '</td></tr>',
      '<tr class="indent1"><td>\u96fb\u5546\u901a\u8def</td><td>' + fmt(pnl.ecRev) + '</td></tr>',
      '<tr class="indent1"><td>\u5e02\u96c6\u901a\u8def</td><td>' + fmt(pnl.mktRev) + '</td></tr>',
      pnl.byCategory.map(function(c) { return '<tr class="indent2"><td>\u2514 ' + c.cat + '</td><td>' + fmt(c.amount) + '</td></tr>' }).join(''),
      '<tr class="bold section-gap"><td>\u258c (-) \u71df\u696d\u6210\u672c</td><td>(' + fmt(pnl.cogs) + ')</td></tr>',
      '<tr class="indent1"><td>\u9032\u8ca8\u6210\u672c</td><td>(' + fmt(pnl.cogs) + ')</td></tr>',
      '<tr class="bold section-gap ' + gpClass + '"><td>\u258c \u6bdb\u5229</td><td>' + gpFmt + '</td></tr>',
      '<tr class="bold section-gap"><td>\u258c (-) \u71df\u696d\u8cbb\u7528</td><td>(' + fmt(pnl.totalOpExp) + ')</td></tr>',
      '<tr class="indent1"><td>\u79df\u91d1</td><td>(' + fmt(pnl.opExpenses.rent) + ')</td></tr>',
      '<tr class="indent1"><td>\u96fb\u8cbb</td><td>(' + fmt(pnl.opExpenses.electric) + ')</td></tr>',
      '<tr class="indent1"><td>\u4eba\u4e8b</td><td>(' + fmt(pnl.opExpenses.labor) + ')</td></tr>',
      '<tr class="indent1"><td>\u6524\u4f4d\u8cbb</td><td>(' + fmt(pnl.opExpenses.booth) + ')</td></tr>',
      '<tr class="indent1"><td>\u884c\u92b7\u8cbb</td><td>(' + fmt(pnl.opExpenses.marketing) + ')</td></tr>',
      '<tr class="indent1"><td>\u8017\u6750</td><td>(' + fmt(pnl.opExpenses.material) + ')</td></tr>',
      '<tr class="indent1"><td>\u8a2d\u5099</td><td>(' + fmt(pnl.opExpenses.equipment) + ')</td></tr>',
      '<tr class="indent1"><td>\u96dc\u9805</td><td>(' + fmt(pnl.opExpenses.misc) + ')</td></tr>',
      '<tr class="bold section-gap ' + npClass + '"><td>\u258c \u7a05\u524d\u6de8\u5229</td><td>' + npFmt + '</td></tr>',
      '</table>',
      '<div class="profit-box">',
      '<h2>\u7a05\u524d\u6de8\u5229</h2>',
      '<div class="amount">' + npFmt + '</div>',
      '<div class="rate">\u5229\u6f64\u7387\uff1a' + profitRate.toFixed(1) + '%\u3000\uff5c\u3000\u7e3d\u6536\u5165\uff1a' + fmt(pnl.totalRev) + '</div>',
      '</div></body></html>',
    ].join('')
    const win = window.open('', '_blank')
    win.document.write(printContent)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  const profitRate = pnl.totalRev > 0 ? (pnl.netProfit / pnl.totalRev * 100) : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">盈虧損益表</h1>
          <p className="text-sm text-gray-400 mt-0.5">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 時間範圍選擇器 */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[{k:'month',l:'月'},{k:'quarter',l:'季'},{k:'year',l:'年'}].map(({k,l}) => (
              <button key={k} onClick={() => setRangeType(k)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  rangeType === k ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>{l}</button>
            ))}
          </div>
          <select value={rangeYear} onChange={e => setRangeYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
            {availableYears.map(y => <option key={y} value={y}>{y} 年</option>)}
          </select>
          {rangeType === 'month' && (
            <select value={rangeMonth} onChange={e => setRangeMonth(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
              {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m} 月</option>)}
            </select>
          )}
          {rangeType === 'quarter' && (
            <select value={rangeQ} onChange={e => setRangeQ(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
              {[1,2,3,4].map(q => <option key={q} value={q}>Q{q}</option>)}
            </select>
          )}
          <button onClick={handleExportMonthly}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-emerald-700">
            <Download size={15} /> 匯出報表
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            <Download size={15} /> 匯出 PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="損益結構">
          <div className="space-y-1">
            {/* 營業收入 */}
            <PnLRow label="▌ 營業收入" value={pnl.totalRev} bold />
            <PnLRow label="電商通路" value={pnl.ecRev} indent={1} />
            <PnLRow label="市集通路" value={pnl.mktRev} indent={1} />
            {pnl.byCategory.map(({ cat, amount }) => (
              <PnLRow key={cat} label={`└ ${cat}`} value={amount} indent={2} />
            ))}

            {/* 營業成本 */}
            <PnLRow label="▌ (-) 營業成本" value={-pnl.cogs} bold border />
            <PnLRow label="進貨成本" value={-pnl.cogs} indent={1} />

            {/* 毛利 */}
            <PnLRow label="▌ 毛利" value={pnl.grossProfit} bold border
              highlight={pnl.grossProfit >= 0 ? 'green' : 'red'} />

            {/* 營業費用 */}
            <PnLRow label="▌ (-) 營業費用" value={-pnl.totalOpExp} bold border />
            <PnLRow label="租金" value={-pnl.opExpenses.rent} indent={1} />
            <PnLRow label="電費" value={-pnl.opExpenses.electric} indent={1} />
            <PnLRow label="人事" value={-pnl.opExpenses.labor} indent={1} />
            <PnLRow label="攤位費" value={-pnl.opExpenses.booth} indent={1} />
            <PnLRow label="行銷費" value={-pnl.opExpenses.marketing} indent={1} />
            <PnLRow label="耗材" value={-pnl.opExpenses.material} indent={1} />
            <PnLRow label="設備" value={-pnl.opExpenses.equipment} indent={1} />
            <PnLRow label="雜項" value={-pnl.opExpenses.misc} indent={1} />

            {/* 稅前淨利 */}
            <PnLRow label="▌ 稅前淨利" value={pnl.netProfit} bold border
              highlight={pnl.netProfit >= 0 ? 'green' : 'red'} />
          </div>
        </SectionCard>

        <div className="space-y-4">
          {/* 利潤率儀表 */}
          <SectionCard title="利潤率">
            <div className="flex items-center gap-4">
              <div className={`text-5xl font-black ${profitRate >= 25 ? 'text-emerald-500' : profitRate >= 15 ? 'text-orange-400' : 'text-red-500'}`}>
                {profitRate.toFixed(1)}%
              </div>
              <div>
                {profitRate >= 25
                  ? <div className="flex items-center gap-1 text-emerald-600 font-medium"><TrendingUp size={18} /> 健康</div>
                  : <div className="flex items-center gap-1 text-red-500 font-medium"><TrendingDown size={18} /> 需改善</div>
                }
                <p className="text-xs text-gray-400 mt-1">建議目標：≥ 25%</p>
              </div>
            </div>
            <div className="mt-4 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700
                ${profitRate >= 25 ? 'bg-emerald-400' : profitRate >= 15 ? 'bg-orange-400' : 'bg-red-400'}`}
                style={{ width: `${Math.min(Math.max(profitRate, 0), 100)}%` }} />
            </div>
          </SectionCard>

          {/* AI 智慧建議 */}
          <SectionCard title="🤖 AI 智慧建議">
            <div className="space-y-3">
              {!aiText && !aiLoading && (
                <p className="text-sm text-gray-400">根據損益數據，AI 將提供針對性的改善建議。</p>
              )}
              {aiLoading && (
                <div className="flex items-center gap-3 text-orange-500">
                  <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">分析中...</span>
                </div>
              )}
              {aiText && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {aiText}
                </div>
              )}
              <button onClick={handleAI} disabled={aiLoading}
                className={`${btnPrimary} flex items-center gap-2 disabled:opacity-50`}>
                <Sparkles size={16} />
                {aiLoading ? '分析中...' : '產生智慧建議'}
              </button>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* 營運深度分析 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* 財務儀表板 */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm">📊 財務儀表板
            <span className="text-xs font-normal text-gray-400 ml-1">(本月)</span>
          </h3>
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-black ${financialMetrics.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {fmt(financialMetrics.grossProfit)}
            </span>
            <span className="text-xs text-gray-400 mb-1">毛利</span>
          </div>
          <div className="text-sm text-gray-500">
            毛利率：
            <span className={`font-semibold ml-1 ${
              financialMetrics.monthRev > 0 && financialMetrics.grossProfit / financialMetrics.monthRev >= 0.3
                ? 'text-emerald-600' : 'text-orange-500'
            }`}>
              {financialMetrics.monthRev > 0 ? (financialMetrics.grossProfit / financialMetrics.monthRev * 100).toFixed(1) : '0.0'}%
            </span>
            <span className="text-xs text-gray-400 ml-1">(營收 - 進貨/電費)</span>
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-1.5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">營運開销佔比</p>
            {[
              { label: '攤位費', value: financialMetrics.booth },
              { label: '運費',   value: financialMetrics.shipping },
              { label: '廣告費', value: financialMetrics.ads },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-14">{label}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-400 rounded-full"
                    style={{ width: `${pnl.totalRev > 0 ? Math.min(value / pnl.totalRev * 100, 100) : 0}%` }} />
                </div>
                <span className="text-xs text-gray-500 w-10 text-right">
                  {pnl.totalRev > 0 ? (value / pnl.totalRev * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 庫存警戒區 */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm">📦 庫存警戒區</h3>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-blue-600">{inventoryMetrics.stockLevel}</span>
            <span className="text-xs text-gray-400 mb-1">總庫存件數</span>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">即期品警告（30天內）</p>
            {inventoryMetrics.expiryWarnings.length === 0 ? (
              <div className="flex items-center gap-1.5 text-emerald-600 text-sm">
                <span>✅</span>
                <span>效期狀態良好</span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {inventoryMetrics.expiryWarnings.map((w, i) => (
                  <div key={i} className="flex items-center justify-between bg-red-50 rounded-lg px-2.5 py-1.5">
                    <div>
                      <p className="text-xs font-semibold text-red-600">{w.itemName}</p>
                      <p className="text-xs text-red-400">剩 {w.daysLeft} 天到期（{w.exp}）</p>
                    </div>
                    <span className="text-xs font-bold text-red-500">{w.qty} 件</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 通路戰情室 */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm">🎯 通路戰情室</h3>
          {platformROI.length === 0 ? (
            <p className="text-sm text-gray-400">尚無訂單資料</p>
          ) : (
            <>
              <div className="bg-emerald-50 rounded-xl px-3 py-2.5">
                <p className="text-xs text-gray-400">表現最佳平台（依獲利金額）</p>
                <p className="text-lg font-black text-emerald-600">{platformROI[0].platform}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  獲利：{fmt(Math.round(platformROI[0].netProfit))}
                  {platformROI[0].roi !== null && <>　ROI：{platformROI[0].roi.toFixed(1)}x</>}
                </p>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                💡 {platformROI[0].platform} 獲利最高，建議增加該平台投放。
                {platformROI.length > 1 && (
                  <> {platformROI[platformROI.length - 1].platform} 獲利較低，可考慮減少投放。</>
                )}
              </p>
              <div className="space-y-2">
                {platformROI.map(p => (
                  <div key={p.platform} className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">{p.platform}</span>
                      <span className={`font-bold ${
                        p.netProfit > 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        獲利 {fmt(Math.round(p.netProfit))}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-400 mt-0.5">
                      <span>營收 {fmt(p.rev)} / 手續費 {fmt(p.platformFees)}</span>
                      <span>{p.roi !== null ? `ROI ${p.roi.toFixed(1)}x` : 'ROI 無資料'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
