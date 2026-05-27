import ExcelJS from 'exceljs'

/**
 * 匯出收支對帳單 XLSX — 單一工作表，橫式 A4 列印
 * 版面：左半（A-E）營收明細，右半（G-K）支出明細，底部損益摘要
 */
export async function exportStatementXLSX({ stmtMonth, revenues, expenses }) {
  const mRevs = revenues.filter(r => r.date.startsWith(stmtMonth)).sort((a, b) => a.date.localeCompare(b.date))
  const mExps = expenses.filter(e => e.date.startsWith(stmtMonth)).sort((a, b) => a.date.localeCompare(b.date))
  const totalRev = mRevs.reduce((s, r) => s + r.amount, 0)
  const totalExp = mExps.reduce((s, r) => s + r.amount, 0)
  const netProfit = totalRev - totalExp
  const profitRate = totalRev > 0 ? (netProfit / totalRev * 100) : 0
  const [y, m] = stmtMonth.split('-')
  const label = y + ' 年 ' + parseInt(m) + ' 月'

  const wb = new ExcelJS.Workbook()
  wb.creator = '萌獸探險隊 ERP'
  wb.created = new Date()

  const ORANGE  = 'FFEA580C'
  const GREEN   = 'FF059669'
  const GREEN_L = 'FFECFDF5'
  const RED     = 'FFDC2626'
  const RED_L   = 'FFFEF2F2'
  const GRAY_H  = 'FFF3F4F6'
  const GRAY_B  = 'FF6B7280'
  const WHITE   = 'FFFFFFFF'
  const DARK    = 'FF1F2937'
  const BLUE_H  = 'FFEFF6FF'

  // 欄位配置：A-E 營收，F 空白，G-K 支出
  // A=日期, B=通路, C=類別, D=金額, E=狀態, F=空, G=日期, H=類型, I=備註, J=金額, K=狀態
  const ws = wb.addWorksheet('收支對帳單')
  ws.columns = [
    { width: 13 }, // A 日期
    { width: 12 }, // B 通路
    { width: 12 }, // C 類別
    { width: 12 }, // D 金額
    { width: 10 }, // E 狀態
    { width: 2  }, // F 分隔
    { width: 13 }, // G 日期
    { width: 10 }, // H 類型
    { width: 26 }, // I 備註
    { width: 12 }, // J 金額
    { width: 10 }, // K 狀態
  ]

  // 列印設定：橫式 A4，縮放至 1 頁寬
  ws.pageSetup = {
    paperSize: 9,          // A4
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  }
  ws.headerFooter = {
    oddHeader: '&C&B萌獸探險隊 ' + label + ' 收支對帳單',
    oddFooter: '&C第 &P 頁，共 &N 頁　　產出日期：' + new Date().toLocaleDateString('zh-TW'),
  }

  function cell(row, col) { return row.getCell(col) }

  function applyStyle(c, { font, fill, align, border, numFmt } = {}) {
    if (font)   c.font      = font
    if (fill)   c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    if (align)  c.alignment = { vertical: 'middle', horizontal: align, wrapText: true }
    if (border) c.border    = border
    if (numFmt) c.numFmt    = numFmt
  }

  const thinBorder = (color = 'FFD1D5DB') => ({
    top:    { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    left:   { style: 'thin', color: { argb: color } },
    right:  { style: 'thin', color: { argb: color } },
  })
  const hairBorder = () => ({
    bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
    left:   { style: 'hair', color: { argb: 'FFE5E7EB' } },
    right:  { style: 'hair', color: { argb: 'FFE5E7EB' } },
  })

  // ── 第 1 列：大標題 ──────────────────────────────────────
  const r1 = ws.addRow(['萌獸探險隊 ' + label + ' 收支對帳單', '', '', '', '', '', '', '', '', '', ''])
  ws.mergeCells(r1.number, 1, r1.number, 11)
  r1.height = 30
  applyStyle(cell(r1, 1), { font: { bold: true, size: 14, color: { argb: WHITE } }, fill: ORANGE, align: 'center' })

  // ── 第 2 列：副標 ─────────────────────────────────────────
  const r2 = ws.addRow(['產出日期：' + new Date().toLocaleDateString('zh-TW'), '', '', '', '', '', '', '', '', '', ''])
  ws.mergeCells(r2.number, 1, r2.number, 11)
  r2.height = 18
  applyStyle(cell(r2, 1), { font: { size: 9, color: { argb: GRAY_B } }, fill: 'FFFFF7ED', align: 'center' })

  ws.addRow([]).height = 6

  // ── 第 4 列：左右區塊標題 ────────────────────────────────
  const r4 = ws.addRow(['', '', '', '', '', '', '', '', '', '', ''])
  r4.height = 22
  ws.mergeCells(r4.number, 1, r4.number, 5)
  applyStyle(cell(r4, 1), { font: { bold: true, size: 11, color: { argb: WHITE } }, fill: GREEN, align: 'center' })
  cell(r4, 1).value = '▌ 營收明細'
  ws.mergeCells(r4.number, 7, r4.number, 11)
  applyStyle(cell(r4, 7), { font: { bold: true, size: 11, color: { argb: WHITE } }, fill: RED, align: 'center' })
  cell(r4, 7).value = '▌ 支出明細'

  // ── 第 5 列：欄位標題 ────────────────────────────────────
  const hStyle = { font: { bold: true, size: 10, color: { argb: DARK } }, fill: GRAY_H, align: 'center', border: thinBorder() }
  const r5 = ws.addRow(['日期', '通路', '類別', '金額', '狀態', '', '日期', '類型', '備註', '金額', '狀態'])
  r5.height = 20
  ;[1,2,3,4,5,7,8,9,10,11].forEach(col => applyStyle(cell(r5, col), hStyle))

  // ── 資料列 ───────────────────────────────────────────────
  const maxRows = Math.max(mRevs.length, mExps.length)
  for (let i = 0; i < maxRows; i++) {
    const bg = i % 2 === 0 ? WHITE : 'FFF9FAFB'
    const r = ws.addRow(['', '', '', '', '', '', '', '', '', '', ''])
    r.height = 19

    const rev = mRevs[i]
    if (rev) {
      cell(r, 1).value = rev.date
      cell(r, 2).value = rev.channel || ''
      cell(r, 3).value = rev.category || ''
      cell(r, 4).value = rev.amount
      cell(r, 5).value = rev.isReported ? '✅ 已處理' : '⬜ 未處理'
      applyStyle(cell(r, 1), { font: { size: 10, color: { argb: DARK } }, fill: bg, align: 'center', border: hairBorder() })
      applyStyle(cell(r, 2), { font: { size: 10, color: { argb: DARK } }, fill: bg, align: 'center', border: hairBorder() })
      applyStyle(cell(r, 3), { font: { size: 10, color: { argb: DARK } }, fill: bg, align: 'center', border: hairBorder() })
      applyStyle(cell(r, 4), { font: { size: 10, color: { argb: GREEN } }, fill: bg, align: 'right', border: hairBorder(), numFmt: '#,##0' })
      applyStyle(cell(r, 5), { font: { size: 10, color: { argb: rev.isReported ? GREEN : GRAY_B } }, fill: bg, align: 'center', border: hairBorder() })
    }

    const exp = mExps[i]
    if (exp) {
      cell(r, 7).value  = exp.date
      cell(r, 8).value  = exp.type || ''
      cell(r, 9).value  = exp.note || ''
      cell(r, 10).value = exp.amount
      cell(r, 11).value = exp.isReported ? '✅ 已處理' : '⬜ 未處理'
      applyStyle(cell(r, 7),  { font: { size: 10, color: { argb: DARK } }, fill: bg, align: 'center', border: hairBorder() })
      applyStyle(cell(r, 8),  { font: { size: 10, color: { argb: DARK } }, fill: bg, align: 'center', border: hairBorder() })
      applyStyle(cell(r, 9),  { font: { size: 10, color: { argb: DARK } }, fill: bg, align: 'left',   border: hairBorder() })
      applyStyle(cell(r, 10), { font: { size: 10, color: { argb: RED } },  fill: bg, align: 'right',  border: hairBorder(), numFmt: '#,##0' })
      applyStyle(cell(r, 11), { font: { size: 10, color: { argb: exp.isReported ? GREEN : GRAY_B } }, fill: bg, align: 'center', border: hairBorder() })
    }
  }

  // ── 小計列 ───────────────────────────────────────────────
  const stRow = ws.addRow(['', '', '', '', '', '', '', '', '', '', ''])
  stRow.height = 22
  ws.mergeCells(stRow.number, 1, stRow.number, 3)
  applyStyle(cell(stRow, 1), { font: { bold: true, size: 10, color: { argb: GREEN } }, fill: GREEN_L, align: 'right', border: { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'double', color: { argb: GREEN } } } })
  cell(stRow, 1).value = '營收小計'
  applyStyle(cell(stRow, 4), { font: { bold: true, size: 11, color: { argb: GREEN } }, fill: GREEN_L, align: 'right', border: { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'double', color: { argb: GREEN } } }, numFmt: '#,##0' })
  cell(stRow, 4).value = totalRev
  applyStyle(cell(stRow, 5), { fill: GREEN_L })

  ws.mergeCells(stRow.number, 7, stRow.number, 9)
  applyStyle(cell(stRow, 7), { font: { bold: true, size: 10, color: { argb: RED } }, fill: RED_L, align: 'right', border: { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'double', color: { argb: RED } } } })
  cell(stRow, 7).value = '支出小計'
  applyStyle(cell(stRow, 10), { font: { bold: true, size: 11, color: { argb: RED } }, fill: RED_L, align: 'right', border: { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'double', color: { argb: RED } } }, numFmt: '#,##0' })
  cell(stRow, 10).value = totalExp
  applyStyle(cell(stRow, 11), { fill: RED_L })

  // ── 損益摘要區塊 ─────────────────────────────────────────
  ws.addRow([]).height = 10

  const smTitle = ws.addRow(['', '', '', '', '', '', '', '', '', '', ''])
  smTitle.height = 22
  ws.mergeCells(smTitle.number, 1, smTitle.number, 11)
  applyStyle(cell(smTitle, 1), { font: { bold: true, size: 11, color: { argb: WHITE } }, fill: DARK, align: 'center' })
  cell(smTitle, 1).value = '▌ 損益摘要'

  const npColor = netProfit >= 0 ? GREEN : RED
  const npBg    = netProfit >= 0 ? GREEN_L : RED_L
  const summaryData = [
    { label: '總營收', value: totalRev,   color: GREEN, bg: GREEN_L, numFmt: '#,##0' },
    { label: '總支出', value: totalExp,   color: RED,   bg: RED_L,   numFmt: '#,##0' },
    { label: '淨利',   value: netProfit,  color: npColor, bg: npBg,  numFmt: '#,##0' },
    { label: '利潤率', value: profitRate / 100, color: npColor, bg: npBg, numFmt: '0.0%' },
  ]

  summaryData.forEach(({ label: lbl, value, color, bg, numFmt }) => {
    const sr = ws.addRow(['', '', '', '', '', '', '', '', '', '', ''])
    sr.height = 24
    ws.mergeCells(sr.number, 1, sr.number, 5)
    applyStyle(cell(sr, 1), { font: { bold: true, size: 11, color: { argb: DARK } }, fill: GRAY_H, align: 'right', border: { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } } })
    cell(sr, 1).value = lbl
    ws.mergeCells(sr.number, 6, sr.number, 11)
    applyStyle(cell(sr, 6), { font: { bold: true, size: 13, color: { argb: color } }, fill: bg, align: 'right', border: { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } }, numFmt })
    cell(sr, 6).value = value
  })

  // 設定列印範圍
  const lastRow = ws.lastRow.number
  ws.printArea = 'A1:K' + lastRow

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
