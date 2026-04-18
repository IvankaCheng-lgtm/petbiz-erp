export const fmt = (n) =>
  new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)

export const fmtNum = (n) =>
  new Intl.NumberFormat('zh-TW').format(n)

export const CHANNEL_COLORS = { '電商': '#FFB84D', '市集': '#10B981' }

export const CATEGORY_COLORS = {
  '食品': '#FFB84D', '烘焙': '#10B981', '蛋糕': '#8B5CF6', '用品': '#3B82F6',
}

export const EXPENSE_TYPE_COLOR = {
  '進貨': 'orange', '人事': 'blue', '電費': 'purple',
  '租金': 'gray',   '耗材': 'green', '行銷': 'red',
  '攤位': 'orange', '設備': 'blue',  '雜項': 'gray',
}

/** 將 revenues 轉為近12個月趨勢資料 */
export function buildMonthlyTrend(revenues, expenses) {
  const now = new Date()
  const months = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      label: `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    })
  }
  return months.map(({ label, year, month }) => {
    const rev = revenues
      .filter(r => { const d = new Date(r.date); return d.getFullYear() === year && d.getMonth() + 1 === month })
      .reduce((s, r) => s + r.amount, 0)
    const exp = expenses
      .filter(e => { const d = new Date(e.date); return d.getFullYear() === year && d.getMonth() + 1 === month })
      .reduce((s, e) => s + e.amount, 0)
    return { label, 營收: rev, 支出: exp, 淨利: rev - exp }
  })
}
