import ExcelJS from 'exceljs'

/**
 * 匯出收支對帳單 XLSX（含樣式）
 */
export async function exportStatementXLSX({ stmtMonth, revenues, expenses }) {
  const mRevs = revenues.filter(r => r.date.startsWith(stmtMonth)).sort((a, b) => a.date.localeCompare(b.date))
  const mExps = expenses.filter(e => e.date.startsWith(stmtMonth)).sort((a, b) => a.date.localeCompare(b.date))
  const totalRev = mRevs.reduce((s, r) => s + r.amount, 0)
  const totalExp = mExps.reduce((s, r) => s + r.amount, 0)
  const netProfit = totalRev - totalExp
  const [y, m] = stmtMonth.split('-')
  const label = y + ' 年 ' + parseInt(m) + ' 月'

  const wb = new ExcelJS.Workbook()
  wb.creator = '萌獸探險隊 ERP'
  wb.created = new Date()

  // ── 樣式常數 ──────────────────────────────────────────────
  const ORANGE  = 'FFEA580C'
  const ORANGE_L = 'FFFFF7ED'
  const GREEN   = 'FF059669'
  const GREEN_L  = 'FFECFDF5'
  const RED     = 'FFDC2626'
  const RED_L    = 'FFFEF2F2'
  const GRAY_H  = 'FFF3F4F6'
  const GRAY_B  = 'FF6B7280'
  const WHITE   = 'FFFFFFFF'
  const DARK    = 'FF1F2937'

  function titleStyle(bgHex, fgHex = WHITE) {
    return {
      font: { bold: true, size: 11, color: { argb: fgHex } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgHex } },
      alignment: { vertical: 'middle', horizontal: 'left' },
      border: {
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      },
    }
  }
  function headerStyle() {
    return {
      font: { bold: true, size: 10, color: { argb: DARK } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_H } },
      alignment: { vertical: 'middle', horizontal: 'center' },
      border: {
        top:    { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left:   { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
      },
    }
  }
  function dataStyle(bgHex = WHITE, align = 'left') {
    return {
      font: { size: 10, color: { argb: DARK } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgHex } },
      alignment: { vertical: 'middle', horizontal: align },
      border: {
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left:   { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right:  { style: 'hair', color: { argb: 'FFE5E7EB' } },
      },
    }
  }
  function subtotalStyle(bgHex, fgHex = DARK) {
    return {
      font: { bold: true, size: 10, color: { argb: fgHex } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgHex } },
      alignment: { vertical: 'middle', horizontal: 'right' },
      border: {
        top:    { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'double', color: { argb: 'FFD1D5DB' } },
      },
    }
  }

  function applyRow(row, styles) {
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const s = styles[col - 1]
      if (!s) return
      if (s.font)      cell.font      = s.font
      if (s.fill)      cell.fill      = s.fill
      if (s.alignment) cell.alignment = s.alignment
      if (s.border)    cell.border    = s.border
      if (s.numFmt)    cell.numFmt    = s.numFmt
    })
    row.height = 20
  }

  // ── Sheet 1：營收明細 ──────────────────────────────────────
  const ws1 = wb.addWorksheet('營收明細')
  ws1.columns = [
    { key: 'date',   width: 14 },
    { key: 'ch',     width: 14 },
    { key: 'cat',    width: 14 },
    { key: 'amt',    width: 14 },
    { key: 'status', width: 12 },
  ]

  // 標題列
  const t1 = ws1.addRow(['萌獸探險隊 ' + label + ' 收支對帳單 — 營收明細', '', '', '', ''])
  ws1.mergeCells(t1.number, 1, t1.number, 5)
  t1.height = 28
  t1.getCell(1).font      = { bold: true, size: 13, color: { argb: WHITE } }
  t1.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } }
  t1.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }

  const sub1 = ws1.addRow(['產出日期：' + new Date().toLocaleDateString('zh-TW'), '', '', '', ''])
  ws1.mergeCells(sub1.number, 1, sub1.number, 5)
  sub1.height = 18
  sub1.getCell(1).font      = { size: 9, color: { argb: GRAY_B } }
  sub1.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE_L } }
  sub1.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }

  ws1.addRow([])

  // 欄位標題
  const h1 = ws1.addRow(['日期', '通路', '類別', '金額', '處理狀態'])
  applyRow(h1, [headerStyle(), headerStyle(), headerStyle(), headerStyle(), headerStyle()])

  // 資料列
  mRevs.forEach((r, i) => {
    const bg = i % 2 === 0 ? WHITE : 'FFF9FAFB'
    const row = ws1.addRow([r.date, r.channel || '', r.category || '', r.amount, r.isReported ? '✅ 已處理' : '⬜ 未處理'])
    const ds = dataStyle(bg)
    const amtStyle = { ...dataStyle(bg, 'right'), numFmt: '#,##0', font: { size: 10, color: { argb: GREEN } } }
    const stStyle  = { ...dataStyle(bg, 'center'), font: { size: 10, color: { argb: r.isReported ? GREEN : GRAY_B } } }
    applyRow(row, [ds, ds, ds, amtStyle, stStyle])
  })

  // 小計列
  const st1 = ws1.addRow(['營收小計', '', '', totalRev, ''])
  ws1.mergeCells(st1.number, 1, st1.number, 3)
  const stS = subtotalStyle(GREEN_L, GREEN)
  st1.getCell(1).font      = stS.font
  st1.getCell(1).fill      = stS.fill
  st1.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' }
  st1.getCell(1).border    = stS.border
  st1.getCell(4).font      = { bold: true, size: 11, color: { argb: GREEN } }
  st1.getCell(4).fill      = stS.fill
  st1.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' }
  st1.getCell(4).numFmt    = '#,##0'
  st1.getCell(4).border    = stS.border
  st1.height = 22

  // ── Sheet 2：支出明細 ──────────────────────────────────────
  const ws2 = wb.addWorksheet('支出明細')
  ws2.columns = [
    { key: 'date',   width: 14 },
    { key: 'type',   width: 12 },
    { key: 'note',   width: 32 },
    { key: 'amt',    width: 14 },
    { key: 'status', width: 12 },
  ]

  const t2 = ws2.addRow(['萌獸探險隊 ' + label + ' 收支對帳單 — 支出明細', '', '', '', ''])
  ws2.mergeCells(t2.number, 1, t2.number, 5)
  t2.height = 28
  t2.getCell(1).font      = { bold: true, size: 13, color: { argb: WHITE } }
  t2.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } }
  t2.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }

  const sub2 = ws2.addRow(['產出日期：' + new Date().toLocaleDateString('zh-TW'), '', '', '', ''])
  ws2.mergeCells(sub2.number, 1, sub2.number, 5)
  sub2.height = 18
  sub2.getCell(1).font      = { size: 9, color: { argb: GRAY_B } }
  sub2.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_L } }
  sub2.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }

  ws2.addRow([])

  const h2 = ws2.addRow(['日期', '類型', '備註', '金額', '處理狀態'])
  applyRow(h2, [headerStyle(), headerStyle(), headerStyle(), headerStyle(), headerStyle()])

  mExps.forEach((e, i) => {
    const bg = i % 2 === 0 ? WHITE : 'FFF9FAFB'
    const row = ws2.addRow([e.date, e.type || '', e.note || '', e.amount, e.isReported ? '✅ 已處理' : '⬜ 未處理'])
    const ds = dataStyle(bg)
    const amtStyle = { ...dataStyle(bg, 'right'), numFmt: '#,##0', font: { size: 10, color: { argb: RED } } }
    const stStyle  = { ...dataStyle(bg, 'center'), font: { size: 10, color: { argb: e.isReported ? GREEN : GRAY_B } } }
    applyRow(row, [ds, ds, ds, amtStyle, stStyle])
  })

  const st2 = ws2.addRow(['支出小計', '', '', totalExp, ''])
  ws2.mergeCells(st2.number, 1, st2.number, 3)
  const stS2 = subtotalStyle(RED_L, RED)
  st2.getCell(1).font      = stS2.font
  st2.getCell(1).fill      = stS2.fill
  st2.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' }
  st2.getCell(1).border    = stS2.border
  st2.getCell(4).font      = { bold: true, size: 11, color: { argb: RED } }
  st2.getCell(4).fill      = stS2.fill
  st2.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' }
  st2.getCell(4).numFmt    = '#,##0'
  st2.getCell(4).border    = stS2.border
  st2.height = 22

  // ── Sheet 3：損益摘要 ──────────────────────────────────────
  const ws3 = wb.addWorksheet('損益摘要')
  ws3.columns = [{ width: 22 }, { width: 18 }]

  const t3 = ws3.addRow(['萌獸探險隊 ' + label + ' 損益摘要', ''])
  ws3.mergeCells(t3.number, 1, t3.number, 2)
  t3.height = 28
  t3.getCell(1).font      = { bold: true, size: 13, color: { argb: WHITE } }
  t3.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }
  t3.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }

  ws3.addRow([])

  const summaryRows = [
    { label: '總營收',  value: totalRev,  fmt: '#,##0', color: GREEN,  bg: GREEN_L },
    { label: '總支出',  value: totalExp,  fmt: '#,##0', color: RED,    bg: RED_L },
    { label: '淨利',    value: netProfit, fmt: '#,##0', color: netProfit >= 0 ? GREEN : RED, bg: netProfit >= 0 ? GREEN_L : RED_L },
    { label: '利潤率',  value: totalRev > 0 ? parseFloat((netProfit / totalRev * 100).toFixed(1)) : 0, fmt: '0.0%', color: netProfit >= 0 ? GREEN : RED, bg: netProfit >= 0 ? GREEN_L : RED_L },
  ]

  summaryRows.forEach(({ label, value, fmt: nf, color, bg }) => {
    const isRate = nf === '0.0%'
    const row = ws3.addRow([label, isRate ? value / 100 : value])
    row.height = 26
    row.getCell(1).font      = { bold: true, size: 11, color: { argb: DARK } }
    row.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_H } }
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
    row.getCell(1).border    = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
    row.getCell(2).font      = { bold: true, size: 13, color: { argb: color } }
    row.getCell(2).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' }
    row.getCell(2).numFmt    = nf
    row.getCell(2).border    = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
  })

  // 下載
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '萌獸探險隊_對帳單_' + stmtMonth + '.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

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
