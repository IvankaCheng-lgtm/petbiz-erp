/**
 * 匯出 CSV 檔案（含 BOM，確保 Excel 正確顯示中文）
 * @param {Array} data - 二維陣列，第一列為標題
 * @param {string} filename - 檔名（含 .csv）
 */
export function exportToCSV(data, filename) {
  const csv = data.map(row =>
    row.map(cell => {
      const str = cell === null || cell === undefined ? '' : String(cell)
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(',')
  ).join('\r\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 格式化月度營運報告資料
 * @param {string} month - 格式 'YYYY-MM'
 * @param {Array} revenues - 所有營收
 * @param {Array} expenses - 所有支出
 * @param {Array} inventory - 庫存
 * @param {Array} orders - 銷售訂單
 * @returns {Array} 二維陣列（可直接傳入 exportToCSV）
 */
export function buildMonthlyReport(month, revenues, expenses, inventory, orders) {
  const mRevs = revenues.filter(r => r.date.startsWith(month))
  const mExps = expenses.filter(e => e.date.startsWith(month))

  const totalRev  = mRevs.reduce((s, r) => s + r.amount, 0)
  const totalCost = mExps.reduce((s, e) => s + e.amount, 0)
  const netProfit = totalRev - totalCost
  const profitRate = totalRev > 0 ? (netProfit / totalRev * 100).toFixed(1) : '0.0'

  // 通路分析
  const ecRev  = mRevs.filter(r => r.channel === '電商').reduce((s, r) => s + r.amount, 0)
  const mktRev = mRevs.filter(r => r.channel === '市集').reduce((s, r) => s + r.amount, 0)

  // 支出明細
  const expTypes = ['進貨', '租金', '電費', '人事', '攤位', '行銷', '耗材', '設備', '雜項']
  const expByType = expTypes.map(t => ({
    type: t,
    amount: mExps.filter(e => e.type === t).reduce((s, e) => s + e.amount, 0),
  }))

  // 毛利：總營收 - 生產進貨成本
  const cogs        = mExps.filter(e => e.type === '進貨' && e.isProductionCost).reduce((s, e) => s + e.amount, 0)
  const grossProfit = totalRev - cogs
  const grossRate   = totalRev > 0 ? (grossProfit / totalRev * 100).toFixed(1) : '0.0'

  // 營運開销：攤位 + 運費 + 行銷
  const booth    = mExps.filter(e => e.type === '攤位').reduce((s, e) => s + e.amount, 0)
  const shipping = mExps.filter(e => e.type === '運費').reduce((s, e) => s + e.amount, 0)
  const ads      = mExps.filter(e => e.type === '行銷').reduce((s, e) => s + e.amount, 0)
  const opExp    = booth + shipping + ads

  // 庫存總價値（A用品 + B食品）
  const abInventory = inventory.filter(i => i.category === 'A用品' || i.category === 'B食品')
  const invValue = abInventory.reduce((s, i) => s + (i.salePrice || 0) * i.currentQty, 0)
  const invCost  = abInventory.reduce((s, i) => s + (i.cost || 0) * i.currentQty, 0)

  // 即期品：30 天內到期的批次
  const today = new Date()
  let expiryCount = 0
  const expiryList = []
  inventory.forEach(item => {
    ;(item.expiryBatches || []).forEach(batch => {
      const exp = batch.normalExp || batch.shelfExpiry
      if (!exp) return
      const daysLeft = Math.ceil((new Date(exp) - today) / 86400000)
      if (daysLeft < 30) {
        expiryCount += (batch.qty || 0)
        expiryList.push(`${item.itemName}(剩${daysLeft}天,${batch.qty || 0}件)`)
      }
    })
  })

  // 最佳平台 ROI
  const platforms = [...new Set(orders.map(o => o.platform).filter(Boolean))]
  const adsByPlatform = {}
  expenses.filter(e => e.type === '行銷' && e.note).forEach(e => {
    platforms.forEach(p => { if (e.note.includes(p)) adsByPlatform[p] = (adsByPlatform[p] || 0) + e.amount })
  })
  const platformROI = platforms.map(p => {
    const rev = orders.filter(o => o.platform === p).reduce((s, o) => s + (o.total || 0), 0)
    const cost = adsByPlatform[p] || 0
    return { platform: p, rev, roi: cost > 0 ? rev / cost : null }
  }).sort((a, b) => (b.roi ?? -1) - (a.roi ?? -1))
  const bestPlatform = platformROI[0]
    ? `${platformROI[0].platform}${platformROI[0].roi !== null ? ` (ROI ${platformROI[0].roi.toFixed(1)}x)` : ' (無廣告費用)'}`
    : '無資料'

  // 熱銷商品 Top 3
  const itemSales = {}
  orders.filter(o => o.orderDate?.startsWith(month)).forEach(o => {
    o.items?.forEach(({ itemName, qty, unitPrice }) => {
      if (!itemSales[itemName]) itemSales[itemName] = { qty: 0, revenue: 0 }
      itemSales[itemName].qty     += qty
      itemSales[itemName].revenue += qty * unitPrice
    })
  })
  mRevs.filter(r => r.channel === '市集' && r.items).forEach(r => {
    r.items.forEach(({ itemName, qty, unitPrice }) => {
      if (!itemSales[itemName]) itemSales[itemName] = { qty: 0, revenue: 0 }
      itemSales[itemName].qty     += qty
      itemSales[itemName].revenue += qty * unitPrice
    })
  })
  const top3 = Object.entries(itemSales).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 3)

  const [y, m] = month.split('-')
  const label = `${y} 年 ${parseInt(m)} 月`

  return [
    [`萌獸探險隊 ${label} 月度營運報告`],
    [`產出日期：${new Date().toLocaleDateString('zh-TW')}`],
    [],

    ['《損益摘要》'],
    ['項目', '金額'],
    ['總營收', totalRev],
    ['　電商通路', ecRev],
    ['　市集通路', mktRev],
    ['總成本', totalCost],
    ['毛利', grossProfit],
    ['毛利率', `${grossRate}%`],
    ['淨利', netProfit],
    ['利潤率', `${profitRate}%`],
    [],

    ['《支出明細》'],
    ['費用類型', '金額'],
    ...expByType.filter(e => e.amount > 0).map(e => [e.type, e.amount]),
    [],

    ['《營運開销分析》'],
    ['項目', '金額', '佔營收比'],
    ['攤位費', booth, totalRev > 0 ? `${(booth / totalRev * 100).toFixed(1)}%` : '0%'],
    ['運費',   shipping, totalRev > 0 ? `${(shipping / totalRev * 100).toFixed(1)}%` : '0%'],
    ['廣告費', ads,      totalRev > 0 ? `${(ads / totalRev * 100).toFixed(1)}%` : '0%'],
    ['營運開销總計', opExp, totalRev > 0 ? `${(opExp / totalRev * 100).toFixed(1)}%` : '0%'],
    [],

    ['《庫存狀況（A用品 / B食品）》'],
    ['項目', '數値'],
    ['庫存售價總値', invValue],
    ['庫存成本總値', invCost],
    ['品項數量', abInventory.length],
    ['即期品數量（30天內）', expiryCount],
    ['即期品明細', expiryList.length > 0 ? expiryList.join('、') : '無'],
    [],

    ['《熱銷商品 Top 3（本月）》'],
    ['排名', '商品名稱', '銷售數量', '銷售金額'],
    ...(top3.length > 0
      ? top3.map(([name, { qty, revenue }], i) => [i + 1, name, qty, revenue])
      : [['—', '本月無銷售紀錄', '', '']]),
    [],

    ['《通路表現》'],
    ['平台', '營收', 'ROI'],
    ...platformROI.map(p => [p.platform, p.rev, p.roi !== null ? `${p.roi.toFixed(1)}x` : '無廣告費用']),
    ['最佳平台', bestPlatform, ''],
    [],

    ['《營運狀況評估》'],
    ['指標', '數値', '狀態'],
    ['利潤率',     `${profitRate}%`, parseFloat(profitRate) >= 25 ? '✅ 健康' : parseFloat(profitRate) >= 15 ? '⚠️ 偏低' : '❌ 需改善'],
    ['毛利率',     `${grossRate}%`,  parseFloat(grossRate)  >= 40 ? '✅ 健康' : parseFloat(grossRate)  >= 25 ? '⚠️ 偏低' : '❌ 需改善'],
    ['營運開销佔比', totalRev > 0 ? `${(opExp / totalRev * 100).toFixed(1)}%` : '0%',
      totalRev > 0 && opExp / totalRev > 0.2 ? '⚠️ 偏高' : '✅ 正常'],
    ['即期品警告', expiryCount > 0 ? `${expiryCount} 件` : '無', expiryCount > 0 ? '⚠️ 請盡快處理' : '✅ 正常'],
  ]
}
  const mRevs = revenues.filter(r => r.date.startsWith(month))
  const mExps = expenses.filter(e => e.date.startsWith(month))

  const totalRev  = mRevs.reduce((s, r) => s + r.amount, 0)
  const totalCost = mExps.reduce((s, e) => s + e.amount, 0)
  const netProfit = totalRev - totalCost
  const profitRate = totalRev > 0 ? (netProfit / totalRev * 100).toFixed(1) : '0.0'

  // 通路分析
  const ecRev  = mRevs.filter(r => r.channel === '電商').reduce((s, r) => s + r.amount, 0)
  const mktRev = mRevs.filter(r => r.channel === '市集').reduce((s, r) => s + r.amount, 0)

  // 支出明細
  const expTypes = ['進貨', '租金', '電費', '人事', '攤位', '行銷', '耗材', '設備', '雜項']
  const expByType = expTypes.map(t => ({
    type: t,
    amount: mExps.filter(e => e.type === t).reduce((s, e) => s + e.amount, 0),
  }))

  // 庫存總價值（A用品 + B食品）
  const abInventory = inventory.filter(i => i.category === 'A用品' || i.category === 'B食品')
  const invValue = abInventory.reduce((s, i) => s + (i.salePrice || 0) * i.currentQty, 0)
  const invCost  = abInventory.reduce((s, i) => s + (i.cost || 0) * i.currentQty, 0)

  // 熱銷商品 Top 3（從當月訂單 + 市集收款統計）
  const itemSales = {}
  const mOrders = orders.filter(o => o.orderDate?.startsWith(month))
  mOrders.forEach(o => {
    o.items?.forEach(({ itemName, qty, unitPrice }) => {
      if (!itemSales[itemName]) itemSales[itemName] = { qty: 0, revenue: 0 }
      itemSales[itemName].qty     += qty
      itemSales[itemName].revenue += qty * unitPrice
    })
  })
  mRevs.filter(r => r.channel === '市集' && r.items).forEach(r => {
    r.items.forEach(({ itemName, qty, unitPrice }) => {
      if (!itemSales[itemName]) itemSales[itemName] = { qty: 0, revenue: 0 }
      itemSales[itemName].qty     += qty
      itemSales[itemName].revenue += qty * unitPrice
    })
  })
  const top3 = Object.entries(itemSales)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 3)

  const [y, m] = month.split('-')
  const label = `${y} 年 ${parseInt(m)} 月`

  const rows = [
    // ── 標題 ──
    [`萌獸探險隊 ${label} 月度營運報告`],
    [`產出日期：${new Date().toLocaleDateString('zh-TW')}`],
    [],

    // ── 損益摘要 ──
    ['【損益摘要】'],
    ['項目', '金額'],
    ['總營收', totalRev],
    ['　電商通路', ecRev],
    ['　市集通路', mktRev],
    ['總成本', totalCost],
    ['淨利', netProfit],
    ['利潤率', `${profitRate}%`],
    [],

    // ── 支出明細 ──
    ['【支出明細】'],
    ['費用類型', '金額'],
    ...expByType.filter(e => e.amount > 0).map(e => [e.type, e.amount]),
    [],

    // ── 庫存狀況 ──
    ['【庫存狀況（A用品 / B食品）】'],
    ['項目', '數值'],
    ['庫存售價總值', invValue],
    ['庫存成本總值', invCost],
    ['品項數量', abInventory.length],
    [],

    // ── 熱銷商品 Top 3 ──
    ['【熱銷商品 Top 3（本月）】'],
    ['排名', '商品名稱', '銷售數量', '銷售金額'],
    ...(top3.length > 0
      ? top3.map(([name, { qty, revenue }], i) => [i + 1, name, qty, revenue])
      : [['—', '本月無銷售紀錄', '', '']]),
    [],

    // ── 營運狀況評估 ──
    ['【營運狀況評估】'],
    ['指標', '數值', '狀態'],
    ['利潤率', `${profitRate}%`, parseFloat(profitRate) >= 25 ? '✅ 健康' : parseFloat(profitRate) >= 15 ? '⚠️ 偏低' : '❌ 需改善'],
    ['電費佔支出比', totalCost > 0 ? `${(expByType.find(e => e.type === '電費')?.amount / totalCost * 100).toFixed(1)}%` : '0%',
      totalCost > 0 && expByType.find(e => e.type === '電費')?.amount / totalCost > 0.2 ? '⚠️ 偏高' : '✅ 正常'],
    ['行銷費佔營收比', totalRev > 0 ? `${(expByType.find(e => e.type === '行銷')?.amount / totalRev * 100).toFixed(1)}%` : '0%',
      totalRev > 0 && expByType.find(e => e.type === '行銷')?.amount / totalRev > 0.1 ? '⚠️ 偏高' : '✅ 正常'],
  ]

  return rows
}
