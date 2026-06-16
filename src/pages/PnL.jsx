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
  const { revenues, expenses, kpi, inventoryAlerts, inventory = [], orders = [], suppliers = [], marketEvents = [], marketSales = [] } = data
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [pendingOpen, setPendingOpen] = useState(false)
  const printRef = useRef()

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
    const totalRev  = filteredRevenues.reduce((s, r) => s + r.amount, 0)
    const totalExp  = filteredExpenses.reduce((s, e) => s + e.amount, 0)
    const netProfit = totalRev - totalExp
    const abInv     = inventory.filter(i => i.category === 'A用品' || i.category === 'B食品')
    const invValue  = abInv.reduce((s, i) => s + (i.salePrice || 0) * i.currentQty, 0)
    return { month: currentMonth, totalRev, totalExp, netProfit, invValue }
  }, [filteredRevenues, filteredExpenses, inventory, currentMonth])

  function handleExportMonthly() {
    const rows = buildMonthlyReport(currentMonth, revenues, expenses, inventory, orders)
    exportToCSV(rows, `萌獸探險隊_營運結算_${currentMonth}.csv`)
  }

  const pnl = useMemo(() => {
    const totalRev = filteredRevenues.reduce((s, r) => s + r.amount, 0)
    const EC_PLATFORMS = ['萌獸官網', 'PChome', 'Yahoo', '蝦皮']
    const OTHER_PLATFORMS = ['私訊訂購', 'LINE訂購']
    const ecRev = filteredRevenues.filter(r => r.channel === '電商' || EC_PLATFORMS.includes(r.channel)).reduce((s, r) => s + r.amount, 0)
    const mktRev = filteredRevenues.filter(r => r.channel === '市集').reduce((s, r) => s + r.amount, 0)
    const otherRev = filteredRevenues.filter(r => OTHER_PLATFORMS.includes(r.channel)).reduce((s, r) => s + r.amount, 0)

    const byCategory = ['食品', '用品'].map(cat => ({
      cat, amount: filteredRevenues.filter(r =>
        cat === '食品'
          ? ['食品', '烘焙', '蛋糕'].includes(r.category)
          : r.category === cat
      ).reduce((s, r) => s + r.amount, 0),
    }))

    const rawMaterialCost = filteredExpenses.filter(e => e.type === '進貨' && e.inventoryCategory === 'C食材').reduce((s, e) => s + e.amount, 0)
    const packagingCost   = filteredExpenses.filter(e => e.type === '進貨' && e.inventoryCategory === 'D包材').reduce((s, e) => s + e.amount, 0)
    const goodsCost       = filteredExpenses.filter(e => e.type === '進貨' && (e.inventoryCategory === 'A用品' || e.inventoryCategory === 'B食品')).reduce((s, e) => s + e.amount, 0)
    const cogs = rawMaterialCost + packagingCost + goodsCost
    const grossProfit = totalRev - cogs

    const opExpenses = {
      rent:      filteredExpenses.filter(e => e.type === '租金').reduce((s, e) => s + e.amount, 0),
      electric:  filteredExpenses.filter(e => e.type === '電費').reduce((s, e) => s + e.amount, 0),
      labor:     filteredExpenses.filter(e => e.type === '人事').reduce((s, e) => s + e.amount, 0),
      booth:     filteredExpenses.filter(e => e.type === '攤位').reduce((s, e) => s + e.amount, 0),
      marketing: filteredExpenses.filter(e => e.type === '行銷').reduce((s, e) => s + e.amount, 0),
      material:  filteredExpenses.filter(e => e.type === '耗材').reduce((s, e) => s + e.amount, 0),
      equipment: filteredExpenses.filter(e => e.type === '設備').reduce((s, e) => s + e.amount, 0),
      shipping:  filteredExpenses.filter(e => e.type === '運費').reduce((s, e) => s + e.amount, 0),
      misc:      filteredExpenses.filter(e => e.type === '雜項').reduce((s, e) => s + e.amount, 0),
    }
    const totalOpExp = Object.values(opExpenses).reduce((s, v) => s + v, 0)
    const netProfit = grossProfit - totalOpExp

    return { totalRev, ecRev, mktRev, otherRev, byCategory, rawMaterialCost, packagingCost, goodsCost, cogs, grossProfit, opExpenses, totalOpExp, netProfit }
  }, [filteredRevenues, filteredExpenses])

  // 依選擇期間的待撥款統計
  const linepayPending = useMemo(() => {
    const inRange = (date) => {
      if (rangeType === 'month') return date.startsWith(rangeYear + '-' + String(rangeMonth).padStart(2, '0'))
      if (rangeType === 'quarter') { const m = parseInt(date.slice(5, 7)); return date.startsWith(String(rangeYear)) && Math.ceil(m / 3) === rangeQ }
      return date.startsWith(String(rangeYear))
    }
    const pendingRevenues = revenues.filter(r => r.isPending && inRange(r.date))
    const mktItems = [
      ...marketSales.filter(r => inRange(r.date) && r.channel === '市集'),
      ...pendingRevenues.filter(r => r.channel === '市集'),
    ]
    const orderLinePay = marketSales.filter(r => inRange(r.date) && r.channel !== '市集')
    const ecItems = pendingRevenues.filter(r => r.channel !== '市集')
    const mktAmount = mktItems.reduce((s, r) => s + r.amount, 0)
    const orderLinePayAmount = orderLinePay.reduce((s, r) => s + r.amount, 0)
    const ecAmount = ecItems.reduce((s, r) => s + r.amount, 0)
    return { total: mktAmount + orderLinePayAmount + ecAmount, mktAmount, mktCount: mktItems.length, orderLinePayAmount, orderLinePayCount: orderLinePay.length, ecAmount, ecCount: ecItems.length, ecItems }
  }, [revenues, marketSales, rangeType, rangeYear, rangeMonth, rangeQ])

  // 市集主辦收益與支出分析
  const organizerAnalysis = useMemo(() => {
    const organizers = suppliers.filter(s => s.category === '市集主辦')
    if (organizers.length === 0) return []
    return organizers.map(org => {
      const orgEventIds = new Set(marketEvents.filter(e => e.supplierId === org.id).map(e => e.id))
      const rev = filteredRevenues
        .filter(r => r.eventId && orgEventIds.has(r.eventId))
        .reduce((s, r) => s + r.amount, 0)
      const boothCost = marketEvents
        .filter(e => e.supplierId === org.id)
        .reduce((s, e) => s + (e.boothFee || 0), 0)
      const netProfit = rev - boothCost
      return { name: org.name, rev, boothCost, netProfit }
    }).filter(o => o.rev > 0 || o.boothCost > 0)
      .sort((a, b) => b.netProfit - a.netProfit)
  }, [suppliers, filteredRevenues, marketEvents])
  const financialMetrics = useMemo(() => {
    const booth    = filteredExpenses.filter(e => e.type === '攤位').reduce((s, e) => s + e.amount, 0)
    const shipping = filteredExpenses.filter(e => e.type === '運費').reduce((s, e) => s + e.amount, 0)
    const ads      = filteredExpenses.filter(e => e.type === '行銷').reduce((s, e) => s + e.amount, 0)
    return { booth, shipping, ads }
  }, [filteredExpenses])

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

  function handleChannelPrint() {
    const date = new Date().toLocaleDateString('zh-TW')

    // 前期範圍標籤（用於對比）
    let prevLabel = ''
    let prevRevenues = []
    if (rangeType === 'month') {
      const prevDate = new Date(rangeYear, rangeMonth - 2, 1)
      const py = prevDate.getFullYear()
      const pm = prevDate.getMonth() + 1
      prevLabel = py + ' 年 ' + pm + ' 月'
      const prefix = py + '-' + String(pm).padStart(2, '0')
      prevRevenues = revenues.filter(r => r.date.startsWith(prefix))
    } else if (rangeType === 'quarter') {
      const prevQ = rangeQ === 1 ? 4 : rangeQ - 1
      const prevY = rangeQ === 1 ? rangeYear - 1 : rangeYear
      prevLabel = prevY + ' 年 Q' + prevQ
      prevRevenues = revenues.filter(r => {
        const d = r.date; const m = parseInt(d.slice(5, 7))
        return d.startsWith(String(prevY)) && Math.ceil(m / 3) === prevQ
      })
    }

    // 計算前期各平台營收（用於對比）
    const prevRevByPlatform = {}
    prevRevenues.forEach(r => {
      if (r.channel) prevRevByPlatform[r.channel] = (prevRevByPlatform[r.channel] || 0) + r.amount
    })

    // 通路分析資料（使用已篩選的 filteredRevenues + orders）
    const adsByPlatform = {}
    expenses.filter(e => e.type === '行銷' && e.note).forEach(e => {
      platformROI.forEach(p => {
        if (e.note.includes(p.platform)) adsByPlatform[p.platform] = (adsByPlatform[p.platform] || 0) + e.amount
      })
    })

    const totalRev = platformROI.reduce((s, p) => s + p.rev, 0)

    const platformRows = platformROI.map(function(p) {
      const share = totalRev > 0 ? (p.rev / totalRev * 100).toFixed(1) : '0.0'
      const prev = prevRevByPlatform[p.platform] || 0
      const change = prev > 0 ? ((p.rev - prev) / prev * 100).toFixed(1) : null
      const changeHtml = change !== null
        ? '<span style="color:' + (parseFloat(change) >= 0 ? '#059669' : '#dc2626') + ';font-size:11px;margin-left:4px">' +
          (parseFloat(change) >= 0 ? '▲' : '▼') + Math.abs(change) + '%</span>'
        : '<span style="color:#9ca3af;font-size:11px;margin-left:4px">—</span>'
      const barW = Math.min(parseFloat(share), 100)
      const npColor = p.netProfit >= 0 ? '#059669' : '#dc2626'
      return [
        '<tr>',
        '<td style="font-weight:600;padding:10px 12px">' + p.platform + '</td>',
        '<td style="text-align:right;padding:10px 12px">' + fmt(p.rev) + changeHtml + '</td>',
        '<td style="text-align:right;padding:10px 12px">' + share + '%' +
          '<div style="margin-top:3px;height:4px;background:#e5e7eb;border-radius:9999px;overflow:hidden">' +
          '<div style="height:100%;width:' + barW + '%;background:#3b82f6;border-radius:9999px"></div></div></td>',
        '<td style="text-align:right;padding:10px 12px">' + fmt(p.platformFees) + '</td>',
        '<td style="text-align:right;padding:10px 12px">' + (p.roi !== null ? p.roi.toFixed(1) + 'x' : '—') + '</td>',
        '<td style="text-align:right;padding:10px 12px;font-weight:700;color:' + npColor + '">' + fmt(Math.round(p.netProfit)) + '</td>',
        '</tr>',
      ].join('')
    }).join('')

    // 市集主辦分析
    const organizerRows = organizerAnalysis.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:16px">本期無市集資料</td></tr>' :
      organizerAnalysis.map(function(o) {
        const npColor = o.netProfit >= 0 ? '#059669' : '#dc2626'
        const barW = o.rev > 0 ? Math.min(Math.abs(o.netProfit) / o.rev * 100, 100) : 0
        return '<tr>' +
          '<td style="font-weight:600;padding:10px 12px">' + o.name + '</td>' +
          '<td style="text-align:right;padding:10px 12px">' + fmt(o.rev) + '</td>' +
          '<td style="text-align:right;padding:10px 12px;color:#dc2626">(' + fmt(o.boothCost) + ')</td>' +
          '<td style="text-align:right;padding:10px 12px;font-weight:700;color:' + npColor + '">' +
          (o.netProfit >= 0 ? '+' : '') + fmt(Math.round(o.netProfit)) +
          '<div style="margin-top:3px;height:4px;background:#e5e7eb;border-radius:9999px;overflow:hidden">' +
          '<div style="height:100%;width:' + barW + '%;background:' + npColor + ';border-radius:9999px"></div></div>' +
          '</td></tr>'
      }).join('')

    // 最佳/最差平台摘要
    const best  = platformROI[0]
    const worst = platformROI[platformROI.length - 1]
    const summaryHtml = platformROI.length === 0 ? '' : [
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">',
      '<div style="background:#ecfdf5;border-radius:10px;padding:16px">',
      '<div style="font-size:11px;color:#6b7280;margin-bottom:4px">🏆 獲利最高平台</div>',
      '<div style="font-size:22px;font-weight:900;color:#059669">' + best.platform + '</div>',
      '<div style="font-size:13px;color:#374151;margin-top:4px">獲利 ' + fmt(Math.round(best.netProfit)) +
      (best.roi !== null ? '　ROI ' + best.roi.toFixed(1) + 'x' : '') + '</div>',
      '<div style="font-size:12px;color:#6b7280;margin-top:2px">營收 ' + fmt(best.rev) + '　手續費 ' + fmt(best.platformFees) + '</div>',
      '</div>',
      platformROI.length > 1 ? [
        '<div style="background:#fef2f2;border-radius:10px;padding:16px">',
        '<div style="font-size:11px;color:#6b7280;margin-bottom:4px">⚠️ 獲利最低平台</div>',
        '<div style="font-size:22px;font-weight:900;color:' + (worst.netProfit >= 0 ? '#059669' : '#dc2626') + '">' + worst.platform + '</div>',
        '<div style="font-size:13px;color:#374151;margin-top:4px">獲利 ' + fmt(Math.round(worst.netProfit)) +
        (worst.roi !== null ? '　ROI ' + worst.roi.toFixed(1) + 'x' : '') + '</div>',
        '<div style="font-size:12px;color:#6b7280;margin-top:2px">營收 ' + fmt(worst.rev) + '　手續費 ' + fmt(worst.platformFees) + '</div>',
        '</div>',
      ].join('') : '<div></div>',
      '</div>',
    ].join('')

    const prevNote = prevLabel ? '<span style="font-size:12px;color:#9ca3af;margin-left:8px">（對比：' + prevLabel + '）</span>' : ''

    const html = [
      '<html><head><meta charset="utf-8"><title>通路分析報表 ' + rangeLabel + '</title>',
      '<style>',
      'body{font-family:sans-serif;padding:32px;color:#1f2937;font-size:14px}',
      'h1{font-size:22px;font-weight:900;margin:0 0 4px}',
      '.sub{font-size:12px;color:#6b7280;margin-bottom:28px}',
      '.section{margin-bottom:28px}',
      '.section-title{font-size:15px;font-weight:700;border-left:4px solid #f97316;padding-left:10px;margin-bottom:14px}',
      'table{width:100%;border-collapse:collapse}',
      'thead tr{background:#f3f4f6}',
      'th{text-align:left;padding:9px 12px;font-size:12px;font-weight:600;color:#374151}',
      'th:not(:first-child){text-align:right}',
      'tbody tr{border-bottom:1px solid #f3f4f6}',
      'tbody tr:hover{background:#f9fafb}',
      '.footer{margin-top:40px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px}',
      '@media print{body{padding:16px}@page{size:A4;margin:1.5cm}}',
      '</style></head><body>',
      '<h1>萌獸探險隊 · 通路表現分析報表</h1>',
      '<div class="sub">報表範圍：' + rangeLabel + prevNote + '　　列印日期：' + date + '</div>',

      '<div class="section">',
      '<div class="section-title">🎯 通路績效摘要</div>',
      summaryHtml,
      '</div>',

      '<div class="section">',
      '<div class="section-title">📊 各平台詳細分析' + prevNote + '</div>',
      platformROI.length === 0
        ? '<p style="color:#9ca3af">本期無訂單資料</p>'
        : '<table><thead><tr><th>平台</th><th>營收</th><th>營收佔比</th><th>手續費</th><th>ROI</th><th>獲利</th></tr></thead><tbody>' + platformRows + '</tbody></table>',
      '</div>',

      organizerAnalysis.length > 0 ? [
        '<div class="section">',
        '<div class="section-title">🏪 市集主辦收益分析</div>',
        '<table><thead><tr><th>主辦單位</th><th>市集營收</th><th>攤位/場地費</th><th>淨利</th></tr></thead><tbody>' + organizerRows + '</tbody></table>',
        '</div>',
      ].join('') : '',

      '<div class="footer">萌獸探險隊 ERP · 通路分析報表 · ' + rangeLabel + '</div>',
      '</body></html>',
    ].join('')

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  function handlePrint() {
    const date = new Date().toLocaleDateString('zh-TW')
    const bgColor     = pnl.netProfit >= 0 ? '#ecfdf5' : '#fef2f2'
    const amountColor = pnl.netProfit >= 0 ? '#059669' : '#dc2626'
    const gpClass     = pnl.grossProfit >= 0 ? 'green' : 'red'
    const npClass     = pnl.netProfit   >= 0 ? 'green' : 'red'
    const gpFmt = pnl.grossProfit < 0 ? '(' + fmt(Math.abs(pnl.grossProfit)) + ')' : fmt(pnl.grossProfit)
    const npFmt = pnl.netProfit   < 0 ? '(' + fmt(Math.abs(pnl.netProfit))   + ')' : fmt(pnl.netProfit)
    const grossRate = pnl.totalRev > 0 ? (pnl.grossProfit / pnl.totalRev * 100).toFixed(1) : '0.0'

    // 財務儀表板 HTML
    const dashboardHtml = [
      '<div class="section-title">📊 財務儀表板 <span class="range-label">(' + rangeLabel + ')</span></div>',
      '<div class="dashboard-grid">',
      '<div class="dash-card">',
      '<div class="dash-label">毛利</div>',
      '<div class="dash-amount ' + (pnl.grossProfit >= 0 ? 'green' : 'red') + '">' + fmt(pnl.grossProfit) + '</div>',
      '<div class="dash-sub">毛利率：<strong>' + grossRate + '%</strong></div>',
      '<div class="dash-sub-note">(營業收入 - 營業成本) / 營業收入</div>',
      '</div>',
      '<div class="dash-card">',
      '<div class="dash-label">營運開銷佔比</div>',
      [
        { label: '攞位費', value: financialMetrics.booth },
        { label: '運費',   value: financialMetrics.shipping },
        { label: '廣告費', value: financialMetrics.ads },
      ].map(function(item) {
        const pct = pnl.totalRev > 0 ? (item.value / pnl.totalRev * 100).toFixed(1) : '0.0'
        const barW = pnl.totalRev > 0 ? Math.min(item.value / pnl.totalRev * 100, 100) : 0
        return '<div class="bar-row"><span class="bar-label">' + item.label + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + barW + '%"></div></div>' +
          '<span class="bar-pct">' + pct + '%</span></div>'
      }).join(''),
      '</div>',
      '</div>',
    ].join('')

    // 通路戰情室 HTML
    const channelHtml = platformROI.length === 0 ? '' : [
      '<div class="section-title">🎯 通路戰情室</div>',
      '<div class="channel-best">表現最佳平台（依獲利金額）：<strong>' + platformROI[0].platform + '</strong>',
      '　獲利：' + fmt(Math.round(platformROI[0].netProfit)) +
      (platformROI[0].roi !== null ? '　ROI：' + platformROI[0].roi.toFixed(1) + 'x' : '') + '</div>',
      '<table class="channel-table">',
      '<thead><tr><th>平台</th><th>營收</th><th>手續費</th><th>ROI</th><th>獲利</th></tr></thead>',
      '<tbody>',
      platformROI.map(function(p) {
        return '<tr>' +
          '<td>' + p.platform + '</td>' +
          '<td class="right">' + fmt(p.rev) + '</td>' +
          '<td class="right">' + fmt(p.platformFees) + '</td>' +
          '<td class="right">' + (p.roi !== null ? p.roi.toFixed(1) + 'x' : '-') + '</td>' +
          '<td class="right ' + (p.netProfit >= 0 ? 'green' : 'red') + '">' + fmt(Math.round(p.netProfit)) + '</td>' +
          '</tr>'
      }).join(''),
      '</tbody></table>',
    ].join('')

    // 市集主辦收益分析 HTML
    const organizerHtml = organizerAnalysis.length === 0 ? '' : [
      '<div class="section-title">🏪 市集主辦收益分析 <span class="range-label">(' + rangeLabel + ')</span></div>',
      '<table class="channel-table">',
      '<thead><tr><th>主辦單位</th><th>市集營收</th><th>攞位/場地費</th><th>淨利</th></tr></thead>',
      '<tbody>',
      organizerAnalysis.map(function(o) {
        return '<tr>' +
          '<td>' + o.name + '</td>' +
          '<td class="right">' + fmt(o.rev) + '</td>' +
          '<td class="right">(' + fmt(o.boothCost) + ')</td>' +
          '<td class="right ' + (o.netProfit >= 0 ? 'green' : 'red') + '">' +
          (o.netProfit >= 0 ? '+' : '') + fmt(Math.round(o.netProfit)) + '</td>' +
          '</tr>'
      }).join(''),
      '</tbody></table>',
    ].join('')

    const printContent = [
      '<html><head><meta charset="utf-8">',
      '<title>損益表 ' + date + '</title>',
      '<style>',
      'body { font-family: sans-serif; padding: 32px; color: #1f2937; }',
      'h1 { font-size: 22px; font-weight: bold; margin-bottom: 4px; }',
      '.date { font-size: 12px; color: #6b7280; margin-bottom: 24px; }',
      'table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 8px; }',
      'tr { border-bottom: 1px solid #f3f4f6; }',
      'td { padding: 8px 12px; }',
      'td:last-child { text-align: right; font-weight: 600; }',
      '.bold td { font-weight: bold; font-size: 15px; background: #f9fafb; }',
      '.green { color: #059669; }',
      '.red { color: #dc2626; }',
      '.indent1 td:first-child { padding-left: 28px; }',
      '.indent2 td:first-child { padding-left: 48px; }',
      '.section-gap { border-top: 2px solid #e5e7eb !important; }',
      '.profit-box { margin-top: 24px; padding: 16px; border-radius: 8px; background: ' + bgColor + '; margin-bottom: 32px; }',
      '.profit-box h2 { font-size: 14px; color: #6b7280; margin: 0 0 4px; }',
      '.profit-box .amount { font-size: 28px; font-weight: 900; color: ' + amountColor + '; }',
      '.profit-box .rate { font-size: 14px; color: #6b7280; margin-top: 4px; }',
      '.section-title { font-size: 15px; font-weight: bold; color: #1f2937; margin: 28px 0 12px; border-left: 4px solid #f97316; padding-left: 10px; }',
      '.range-label { font-size: 12px; font-weight: normal; color: #9ca3af; }',
      '.dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 8px; }',
      '.dash-card { background: #f9fafb; border-radius: 8px; padding: 14px; }',
      '.dash-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }',
      '.dash-amount { font-size: 26px; font-weight: 900; }',
      '.dash-sub { font-size: 13px; color: #6b7280; margin-top: 4px; }',
      '.dash-sub-note { font-size: 11px; color: #9ca3af; }',
      '.bar-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }',
      '.bar-label { font-size: 12px; color: #6b7280; width: 48px; }',
      '.bar-track { flex: 1; height: 6px; background: #e5e7eb; border-radius: 9999px; overflow: hidden; }',
      '.bar-fill { height: 100%; background: #fb923c; border-radius: 9999px; }',
      '.bar-pct { font-size: 12px; color: #6b7280; width: 36px; text-align: right; }',
      '.channel-best { font-size: 13px; color: #374151; background: #ecfdf5; border-radius: 8px; padding: 10px 14px; margin-bottom: 10px; }',
      '.channel-table { width: 100%; border-collapse: collapse; font-size: 13px; }',
      '.channel-table th { background: #f3f4f6; text-align: left; padding: 7px 10px; font-size: 12px; }',
      '.channel-table td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; }',
      '.channel-table .right { text-align: right; }',
      '@media print { body { padding: 16px; } }',
      '</style></head><body>',
      '<h1>萌獸探險隊 · 損益表</h1>',
      '<div class="date">列印日期：' + date + '　|　範圍：' + rangeLabel + '</div>',
      '<table>',
      '<tr class="bold"><td>▌ 營業收入</td><td>' + fmt(pnl.totalRev) + '</td></tr>',
      '<tr class="indent1"><td>電商通路</td><td>' + fmt(pnl.ecRev) + '</td></tr>',
      '<tr class="indent1"><td>市集通路</td><td>' + fmt(pnl.mktRev) + '</td></tr>',
      '<tr class="indent1"><td>其他通路</td><td>' + fmt(pnl.otherRev) + '</td></tr>',
      pnl.byCategory.map(function(c) { return '<tr class="indent2"><td>└ ' + c.cat + '</td><td>' + fmt(c.amount) + '</td></tr>' }).join(''),
      '<tr class="bold section-gap"><td>▌ (-) 營業成本</td><td>(' + fmt(pnl.cogs) + ')</td></tr>',
      '<tr class="indent1"><td>商品進貨（A用品/B食品）</td><td>(' + fmt(pnl.goodsCost) + ')</td></tr>',
      '<tr class="indent1"><td>原料成本（C食材）</td><td>(' + fmt(pnl.rawMaterialCost) + ')</td></tr>',
      '<tr class="indent1"><td>包裝成本（D包材）</td><td>(' + fmt(pnl.packagingCost) + ')</td></tr>',
      '<tr class="bold section-gap ' + gpClass + '"><td>▌ 毛利</td><td>' + gpFmt + '</td></tr>',
      '<tr class="bold section-gap"><td>▌ (-) 營業費用</td><td>(' + fmt(pnl.totalOpExp) + ')</td></tr>',
      '<tr class="indent1"><td>租金</td><td>(' + fmt(pnl.opExpenses.rent) + ')</td></tr>',
      '<tr class="indent1"><td>電費</td><td>(' + fmt(pnl.opExpenses.electric) + ')</td></tr>',
      '<tr class="indent1"><td>人事</td><td>(' + fmt(pnl.opExpenses.labor) + ')</td></tr>',
      '<tr class="indent1"><td>攞位費</td><td>(' + fmt(pnl.opExpenses.booth) + ')</td></tr>',
      '<tr class="indent1"><td>行銷費</td><td>(' + fmt(pnl.opExpenses.marketing) + ')</td></tr>',
      '<tr class="indent1"><td>耗材</td><td>(' + fmt(pnl.opExpenses.material) + ')</td></tr>',
      '<tr class="indent1"><td>設備</td><td>(' + fmt(pnl.opExpenses.equipment) + ')</td></tr>',
      '<tr class="indent1"><td>運費</td><td>(' + fmt(pnl.opExpenses.shipping) + ')</td></tr>',
      '<tr class="indent1"><td>雜項</td><td>(' + fmt(pnl.opExpenses.misc) + ')</td></tr>',
      '<tr class="bold section-gap ' + npClass + '"><td>▌ 稅前淨利</td><td>' + npFmt + '</td></tr>',
      '</table>',
      '<div class="profit-box">',
      '<h2>稅前淨利</h2>',
      '<div class="amount">' + npFmt + '</div>',
      '<div class="rate">利潤率：' + profitRate.toFixed(1) + '%　｜　總收入：' + fmt(pnl.totalRev) + '</div>',
      '</div>',
      dashboardHtml,
      channelHtml,
      organizerHtml,
      '</body></html>',
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
          <button onClick={handleChannelPrint}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            <Download size={15} /> 通路分析 PDF
          </button>
        </div>
      </div>

      {/* 待撥款差異說明 */}
      {(linepayPending.mktCount > 0 || linepayPending.ecCount > 0) && (
        <div className="bg-green-50 border border-green-200 rounded-2xl overflow-hidden">
          <button onClick={() => setPendingOpen(v => !v)}
            className="w-full flex items-center gap-2 px-5 py-4 hover:bg-green-100/50 transition-colors">
            <span className="text-base">💚</span>
            <span className="text-sm font-semibold text-green-800">待撥款——損益表與營業總覽差異說明</span>
            <span className="ml-auto text-lg font-black text-green-700">{fmt(linepayPending.total)}</span>
            <span className="text-green-400 text-xs ml-2">{pendingOpen ? '▲' : '▼'}</span>
          </button>
          {pendingOpen && (
            <div className="px-5 pb-4 space-y-2 border-t border-green-200">
              <p className="text-xs text-green-600 pt-3">已計入損益表營收，但尚未撥入帳戶，撥款後請在收支管理新增入帳。</p>
              {linepayPending.mktCount > 0 && (
                <div className="bg-white rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">🏪 市集 LINE Pay 待撥款</p>
                    <p className="text-xs text-gray-400">{linepayPending.mktCount} 筆</p>
                  </div>
                  <p className="text-sm font-black text-green-700">{fmt(linepayPending.mktAmount)}</p>
                </div>
              )}
              {linepayPending.orderLinePayCount > 0 && (
                <div className="bg-white rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">📱 銷售訂單 LINE Pay 待撥款</p>
                    <p className="text-xs text-gray-400">{linepayPending.orderLinePayCount} 筆</p>
                  </div>
                  <p className="text-sm font-black text-green-700">{fmt(linepayPending.orderLinePayAmount)}</p>
                </div>
              )}
              {linepayPending.ecCount > 0 && (
                <div className="bg-white rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">💻 電商平台待撥款</p>
                      <p className="text-xs text-gray-400">{linepayPending.ecCount} 筆</p>
                    </div>
                    <p className="text-sm font-black text-amber-600">{fmt(linepayPending.ecAmount)}</p>
                  </div>
                  <div className="space-y-1">
                    {linepayPending.ecItems.map(r => (
                      <div key={r.id} className="flex justify-between text-xs text-gray-500">
                        <span>{r.channel} · {r.date}</span>
                        <span className="font-medium">{fmt(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="損益結構">
          <div className="space-y-1">
            {/* 營業收入 */}
            <PnLRow label="▌ 營業收入" value={pnl.totalRev} bold />
            <PnLRow label="電商通路" value={pnl.ecRev} indent={1} />
            <PnLRow label="市集通路" value={pnl.mktRev} indent={1} />
            <PnLRow label="其他通路" value={pnl.otherRev} indent={1} />
            {pnl.byCategory.map(({ cat, amount }) => (
              <PnLRow key={cat} label={`└ ${cat}`} value={amount} indent={2} />
            ))}

            {/* 營業成本 */}
            <PnLRow label="▌ (-) 營業成本" value={-pnl.cogs} bold border />
            <PnLRow label="商品進貨（A用品/B食品）" value={-pnl.goodsCost} indent={1} />
            <PnLRow label="原料成本（C食材）" value={-pnl.rawMaterialCost} indent={1} />
            <PnLRow label="包裝成本（D包材）" value={-pnl.packagingCost} indent={1} />

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
            <PnLRow label="運費" value={-pnl.opExpenses.shipping} indent={1} />
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
            <span className="text-xs font-normal text-gray-400 ml-1">({rangeLabel})</span>
          </h3>
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-black ${pnl.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {fmt(pnl.grossProfit)}
            </span>
            <span className="text-xs text-gray-400 mb-1">毛利</span>
          </div>
          <div className="text-sm text-gray-500">
            毛利率：
            <span className={`font-semibold ml-1 ${
              pnl.totalRev > 0 && pnl.grossProfit / pnl.totalRev >= 0.3
                ? 'text-emerald-600' : 'text-orange-500'
            }`}>
              {pnl.totalRev > 0 ? (pnl.grossProfit / pnl.totalRev * 100).toFixed(1) : '0.0'}%
            </span>
            <span className="text-xs text-gray-400 ml-1">(營業收入 - 營業成本) / 營業收入</span>
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

      {/* 市集主辦收益分析 */}
      {organizerAnalysis.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800 text-sm">🏪 市集主辦收益分析
            <span className="text-xs font-normal text-gray-400 ml-1">({rangeLabel})</span>
          </h3>
          <div className="space-y-2">
            {organizerAnalysis.map(o => (
              <div key={o.name} className="border border-gray-100 rounded-xl px-3 py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-gray-700">{o.name}</span>
                  <span className={`text-sm font-bold ${o.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {o.netProfit >= 0 ? '+' : ''}{fmt(Math.round(o.netProfit))}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-gray-400">
                  <span>市集營收 <span className="text-gray-600 font-medium">{fmt(o.rev)}</span></span>
                  <span>攤位/場地費 <span className="text-red-400 font-medium">({fmt(o.boothCost)})</span></span>
                </div>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${o.netProfit >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                    style={{ width: `${o.rev > 0 ? Math.min(Math.abs(o.netProfit) / o.rev * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
