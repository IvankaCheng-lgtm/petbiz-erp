export async function getAIInsight({ kpi, inventoryAlerts, revenues, expenses }) {
  await new Promise(r => setTimeout(r, 1200))

  const { totalRevenue, netProfit, profitRate } = kpi
  const insights = []

  if (profitRate < 15) {
    insights.push('⚠️ 利潤率低於 15%，建議立即檢視進貨成本與攤位費用，考慮調整定價策略或縮減低效通路。')
  } else if (profitRate < 25) {
    insights.push('📉 利潤率介於 15~25%，目前市集通路獲利偏低，建議檢視攤位費佔比，評估是否轉移資源至電商。')
  } else if (profitRate >= 40) {
    insights.push('🚀 利潤率超過 40%，營運狀況優異！建議此時擴大行銷投入，加速品牌曝光。')
  } else {
    insights.push('✅ 利潤率健康（25~40%），維持現有策略，可小幅增加高毛利品類（烘焙/蛋糕）的備貨量。')
  }

  if (inventoryAlerts.length > 0) {
    const names = inventoryAlerts.map(i => i.itemName).join('、')
    insights.push(`🔴 食材庫存警示：${names} 已低於安全水位，建議本週內安排補貨，避免影響生產排程。`)
  }

  const ecRevenue = revenues.filter(r => r.channel === '電商').reduce((s, r) => s + r.amount, 0)
  const mktRevenue = revenues.filter(r => r.channel === '市集').reduce((s, r) => s + r.amount, 0)
  const ecRatio = totalRevenue > 0 ? (ecRevenue / totalRevenue * 100).toFixed(0) : 0
  if (ecRevenue > mktRevenue * 2) {
    insights.push(`📦 電商佔總營收 ${ecRatio}%，依賴度偏高。建議強化市集品牌體驗，分散通路風險。`)
  } else if (mktRevenue > ecRevenue) {
    insights.push('🏪 市集營收超越電商，線下品牌力強勁。建議同步優化電商頁面，將線下流量導入線上。')
  }

  const mktExpense = expenses.filter(e => e.type === '行銷').reduce((s, e) => s + e.amount, 0)
  const mktRatio = totalRevenue > 0 ? (mktExpense / totalRevenue * 100).toFixed(1) : 0
  if (parseFloat(mktRatio) > 10) {
    insights.push(`💸 行銷費用佔營收 ${mktRatio}%，高於建議值（10%）。建議評估各廣告渠道 ROI，優化投放策略。`)
  }

  return insights.join('\n\n')
}
