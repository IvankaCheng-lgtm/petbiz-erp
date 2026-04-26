import { useState, useMemo } from 'react'
import { Sparkles, Loader2, AlertTriangle, TrendingUp, Package } from 'lucide-react'
import { SectionCard, btnPrimary } from './ui'
import { askGemini } from '../services/geminiService'
import { fmt } from '../utils/format'

// ── 工具：計算距今天數 ────────────────────────────────────────
function daysFromNow(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
}

// ── 工具：計算近 N 天平均日銷量 ──────────────────────────────
function avgDailySales(revenues, itemId, days = 30) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const total = revenues
    .filter(r => r.items && new Date(r.date) >= cutoff)
    .flatMap(r => r.items)
    .filter(i => i.itemId === itemId)
    .reduce((s, i) => s + i.qty, 0)
  return total / days
}

export default function InventoryAI({ inventory, revenues }) {
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState('')
  const [error,   setError]   = useState('')

  // ── 1. 效期提醒：7 天內即將到期的批次 ────────────────────
  const expiringBatches = useMemo(() => {
    const alerts = []
    inventory
      .filter(i => i.category === 'B食品' && i.expiryBatches?.length > 0)
      .forEach(item => {
        item.expiryBatches.forEach(b => {
          const d = daysFromNow(b.normalExp)
          if (d !== null && d <= 7 && d >= 0) {
            alerts.push({ itemName: item.itemName, batchId: b.batchId, qty: b.qty, normalExp: b.normalExp, daysLeft: d })
          }
        })
      })
    return alerts.sort((a, b) => a.daysLeft - b.daysLeft)
  }, [inventory])

  // ── 2. 庫存健康：各 B食品的銷售速度 vs 最近到期批次 ──────
  const healthData = useMemo(() => {
    return inventory
      .filter(i => i.category === 'B食品' && i.currentQty > 0)
      .map(item => {
        const daily = avgDailySales(revenues, item.id, 30)
        const nearestExp = item.expiryBatches
          ?.filter(b => b.normalExp)
          .sort((a, b) => a.normalExp.localeCompare(b.normalExp))[0]
        const daysToExp = nearestExp ? daysFromNow(nearestExp.normalExp) : null
        const canSellOut = daily > 0 && daysToExp !== null
          ? (item.currentQty / daily) <= daysToExp
          : null
        return { id: item.id, name: item.itemName, qty: item.currentQty, daily: daily.toFixed(2), daysToExp, canSellOut }
      })
  }, [inventory, revenues])

  // ── 3. 補貨建議：近 30 天銷量 + 安全水位 ─────────────────
  const restockData = useMemo(() => {
    return inventory
      .filter(i => i.category === 'B食品' || i.category === 'A用品')
      .map(item => {
        const daily = avgDailySales(revenues, item.id, 30)
        const daysOfStock = daily > 0 ? (item.currentQty / daily).toFixed(0) : '∞'
        return { name: item.itemName, qty: item.currentQty, safetyQty: item.safetyQty, unit: item.unit, daily: daily.toFixed(2), daysOfStock }
      })
  }, [inventory, revenues])

  async function handleAnalyze() {
    setLoading(true)
    setResult('')
    setError('')

    // 組合 context
    const expiryCtx = expiringBatches.length > 0
      ? `【即將到期（7天內）】\n${expiringBatches.map(b => `- ${b.itemName}：${b.qty} 包，常溫到期 ${b.normalExp}（剩 ${b.daysLeft} 天）`).join('\n')}`
      : '【即將到期】目前無 7 天內到期批次'

    const healthCtx = healthData.length > 0
      ? `【庫存健康】\n${healthData.map(i => `- ${i.name}：庫存 ${i.qty} 包，日均銷 ${i.daily} 包，最近到期 ${i.daysToExp !== null ? `${i.daysToExp} 天後` : '無效期資料'}，${i.canSellOut === true ? '✅ 預計可在到期前售完' : i.canSellOut === false ? '⚠️ 恐無法在到期前售完' : '—'}`).join('\n')}`
      : '【庫存健康】無銷售紀錄可分析'

    const restockCtx = restockData.length > 0
      ? `【補貨建議參考】\n${restockData.map(i => `- ${i.name}：庫存 ${i.qty}，安全水位 ${i.safetyQty}，日均銷 ${i.daily} 包，可售約 ${i.daysOfStock} 天`).join('\n')}`
      : '【補貨建議】無銷售紀錄'

    const context = [expiryCtx, healthCtx, restockCtx].join('\n\n')

    const prompt = `你是「萌獸探險隊」寵物食品品牌的庫存管理顧問。請根據以上數據，用繁體中文給出：

1. **效期警示**：針對即將到期的批次，給出具體的促銷或出貨建議（如無則說明）。
2. **庫存健康診斷**：指出哪些商品有滯銷風險，建議具體行動。
3. **補貨建議**：依銷售速度，建議哪些品項需要優先補貨，建議補貨量。

請直接輸出內容，語氣簡潔專業，每點 2～3 句。`

    try {
      const res = await askGemini(prompt, context)
      setResult(res)
    } catch {
      setError('AI 分析失敗，請稍後再試。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard title="🤖 AI 庫存健康分析">
      <div className="space-y-4">

        {/* 效期警示卡片（靜態，不需 AI） */}
        {expiringBatches.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={15} className="text-red-500 shrink-0" />
              <span className="text-sm font-semibold text-red-700">
                {expiringBatches.length} 批次將在 7 天內到期
              </span>
            </div>
            {expiringBatches.map((b, i) => (
              <div key={i} className="flex justify-between items-center bg-white rounded-lg px-3 py-2 text-xs">
                <span className="font-medium text-gray-700">{b.itemName}</span>
                <div className="flex items-center gap-3 text-gray-500">
                  <span>{b.qty} 包</span>
                  <span className={b.daysLeft <= 2 ? 'text-red-600 font-bold' : 'text-orange-500'}>
                    {b.daysLeft === 0 ? '今天到期！' : `${b.daysLeft} 天後到期`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 庫存健康速覽 */}
        {healthData.filter(i => i.canSellOut === false).length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={15} className="text-amber-600 shrink-0" />
              <span className="text-sm font-semibold text-amber-700">滯銷風險品項</span>
            </div>
            {healthData.filter(i => i.canSellOut === false).map((i, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white rounded-lg px-3 py-2 text-xs">
                <span className="font-medium text-gray-700">{i.name}</span>
                <span className="text-amber-600">日均銷 {i.daily} 包，{i.daysToExp} 天後到期</span>
              </div>
            ))}
          </div>
        )}

        {/* 補貨速覽 */}
        {restockData.filter(i => i.qty <= i.safetyQty).length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-2 mb-2">
              <Package size={15} className="text-blue-600 shrink-0" />
              <span className="text-sm font-semibold text-blue-700">建議近期補貨（庫存 ≤ 安全水位）</span>
            </div>
            {restockData.filter(i => i.qty <= i.safetyQty).map((i, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white rounded-lg px-3 py-2 text-xs">
                <span className="font-medium text-gray-700">{i.name}</span>
                <span className="text-blue-600">庫存 {i.qty} / 安全水位 {i.safetyQty} {i.unit}</span>
              </div>
            ))}
          </div>
        )}

        {/* AI 分析結果 */}
        {loading && (
          <div className="flex items-center gap-2 text-orange-500 text-sm">
            <Loader2 size={16} className="animate-spin" />
            AI 正在分析庫存數據...
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {result && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {result}
          </div>
        )}

        <button onClick={handleAnalyze} disabled={loading}
          className={`${btnPrimary} flex items-center gap-2 disabled:opacity-50`}>
          <Sparkles size={15} />
          {loading ? '分析中...' : '產生 AI 庫存建議'}
        </button>
      </div>
    </SectionCard>
  )
}
