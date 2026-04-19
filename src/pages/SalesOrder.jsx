import { useState, useMemo, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { ShoppingBag, Camera, X, Plus, Minus, Sparkles, Loader2, TrendingUp } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { SectionCard, FormRow, inputCls, btnPrimary, btnSecondary } from '../components/ui'
import { fmt } from '../utils/format'
import { askGemini } from '../services/geminiService'
import { beep } from '../utils/beep'

const PLATFORMS  = ['萌獸官網', 'PChome', 'Yahoo', '蝦皮']
const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444']

// ── 平台業績分析區塊 ──────────────────────────────────────────
function PlatformAnalysis({ orders }) {
  const [aiText,    setAiText]    = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError,   setAiError]   = useState('')

  const stats = useMemo(() => {
    const total = orders.reduce((s, o) => s + o.total, 0)
    return PLATFORMS.map(p => {
      const platformOrders = orders.filter(o => o.platform === p)
      const revenue = platformOrders.reduce((s, o) => s + o.total, 0)
      const count   = platformOrders.length
      const pct     = total > 0 ? (revenue / total * 100) : 0
      return { platform: p, revenue, count, pct }
    }).filter(s => s.revenue > 0 || s.count > 0)
  }, [orders])

  const pieData = useMemo(
    () => stats.filter(s => s.revenue > 0).map(s => ({ name: s.platform, value: s.revenue })),
    [stats]
  )

  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + o.total, 0), [orders])

  async function handleAI() {
    if (stats.length === 0) return
    setAiLoading(true); setAiError(''); setAiText('')
    const context = stats.map(s =>
      `「${s.platform}」：累計營收 ${fmt(s.revenue)}（${s.pct.toFixed(1)}%）、訂單 ${s.count} 筆`
    ).join('\n')
    const prompt = `以下是「萌獸探險隊」寵物食品品牌各電商平台的銷售數據：
${context}
總營收：${fmt(totalRevenue)}

請用 200 字內繁體中文給出：
1. 各平台表現診斷（2 句）
2. 最佳平台的成功原因分析
3. 表現較差平台的具體改善建議`
    try {
      setAiText(await askGemini(prompt))
    } catch {
      setAiError('AI 分析失敗，請稍後再試。')
    } finally {
      setAiLoading(false)
    }
  }

  if (orders.length === 0) return (
    <SectionCard title="📊 平台業績分析">
      <div className="text-center py-10 text-gray-400">
        <TrendingUp size={36} className="mx-auto mb-2 opacity-20" />
        <p className="text-sm">尚無訂單資料，請先建立銷售訂單。</p>
      </div>
    </SectionCard>
  )

  return (
    <SectionCard title="📊 平台業績分析">
      <div className="space-y-5">
        {/* 統計表 */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[360px]">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                {['平台', '訂單筆數', '累計營收', '佔比'].map(h => (
                  <th key={h} className="pb-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.map(s => {
                const color = PIE_COLORS[PLATFORMS.indexOf(s.platform) % PIE_COLORS.length]
                return (
                  <tr key={s.platform} className="hover:bg-gray-50">
                    <td className="py-2.5 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        {s.platform}
                      </div>
                    </td>
                    <td className="py-2.5 text-gray-600">{s.count} 筆</td>
                    <td className="py-2.5 font-semibold text-blue-600">{fmt(s.revenue)}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{s.pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* 圓餅圖 */}
        {pieData.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`} labelLine={false}>
                  {pieData.map((d, i) => (
                    <Cell key={i} fill={PIE_COLORS[PLATFORMS.indexOf(d.name) % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={v => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center sm:justify-start shrink-0">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[PLATFORMS.indexOf(d.name) % PIE_COLORS.length] }} />
                  {d.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI 分析 */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          {aiLoading && (
            <div className="flex items-center gap-2 text-blue-500">
              <Loader2 size={15} className="animate-spin" />
              <span className="text-sm">AI 正在分析平台數據...</span>
            </div>
          )}
          {aiError && <p className="text-sm text-red-500">{aiError}</p>}
          {aiText && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {aiText}
            </div>
          )}
          <button onClick={handleAI} disabled={aiLoading}
            className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#722927' }}>
            <Sparkles size={15} />
            {aiLoading ? '分析中...' : '產生 AI 平台分析'}
          </button>
        </div>
      </div>
    </SectionCard>
  )
}

export default function SalesOrder({ data }) {
  const { inventory, processOrder, updateOrder, deleteOrder, orders = [] } = data

  const [platform,     setPlatform]     = useState(PLATFORMS[0])
  const [cart,         setCart]         = useState([])
  const [discountPct,  setDiscountPct]  = useState('')
  const [discountAmt,  setDiscountAmt]  = useState('')
  const [isScanning,   setIsScanning]   = useState(false)
  const [scanMsg,      setScanMsg]      = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [done,         setDone]         = useState(false)
  const [editOrder,    setEditOrder]    = useState(null)  // 正在編輯的訂單
  const [editForm,     setEditForm]     = useState({})   // 編輯表單暫存

  const scannerRef   = useRef(null)
  const barcodeRef   = useRef(null)
  const saleItemsRef = useRef([])

  // 頁面載入後 focus 條碼輸入框
  useEffect(() => { barcodeRef.current?.focus() }, [])

  const saleItems = useMemo(
    () => inventory.filter(i => i.category === 'A用品' || i.category === 'B食品'),
    [inventory]
  )

  // 保持 ref 與最新 saleItems 同步，讓 scanner callback 能讀到最新值
  useEffect(() => { saleItemsRef.current = saleItems }, [saleItems])

  // 相機掃碼：reader div 常駐 DOM，用 CSS 控制顯示
  useEffect(() => {
    if (!isScanning) {
      const s = scannerRef.current
      if (s) {
        scannerRef.current = null
        s.stop().catch(() => {}).finally(() => { try { s.clear() } catch {} })
      }
      return
    }
    const s = new Html5Qrcode('so-reader')
    let lastScan = 0
    s.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 400, height: 100 }, formatsToSupport: [0, 4], aspectRatio: 2.0 },
      (text) => {
        const now = Date.now()
        if (now - lastScan < 2000) return
        lastScan = now
        const matched = saleItemsRef.current.find(i => i.barcode && i.barcode === text)
        if (matched) {
          setCart(prev => {
            const idx = prev.findIndex(c => c.itemId === matched.id)
            if (idx !== -1) {
              const next = [...prev]
              next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
              return next
            }
            return [...prev, { itemId: matched.id, itemName: matched.itemName, category: matched.category, qty: 1, unitPrice: matched.salePrice || matched.listPrice || 0 }]
          })
          beep()
          setScanMsg(`✅ 已加入：${matched.itemName}`)
        } else {
          setScanMsg('⚠️ 查無此商品')
        }
        setTimeout(() => setScanMsg(''), 2500)
      },
      () => {}
    ).then(() => { scannerRef.current = s }).catch(() => {})
    return () => {
      scannerRef.current = null
      s.stop().catch(() => {}).finally(() => { try { s.clear() } catch {} })
    }
  }, [isScanning]) // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = useMemo(
    () => cart.reduce((s, c) => s + c.qty * c.unitPrice, 0),
    [cart]
  )

  const totalAmount = useMemo(() => {
    let t = subtotal
    const pct = parseFloat(discountPct)
    const amt = parseFloat(discountAmt)
    if (!isNaN(pct) && pct > 0 && pct < 100) t = t * (1 - pct / 100)
    if (!isNaN(amt) && amt > 0) t = t - amt
    return Math.max(0, Math.round(t * 100) / 100)
  }, [subtotal, discountPct, discountAmt])

  const savedAmt = subtotal - totalAmount

  function handleBarcodeMatch(val, items) {
    const matched = items.find(i => i.barcode && i.barcode === val)
    if (matched) {
      addToCart(matched)
      beep()
      setScanMsg(`✅ 已加入：${matched.itemName}`)
    } else {
      setScanMsg('⚠️ 查無此商品')
    }
    setBarcodeInput('')
    setTimeout(() => setScanMsg(''), 2500)
    barcodeRef.current?.focus()
  }

  function handleBarcodeEnter(e) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const val = barcodeInput.trim()
    if (val) handleBarcodeMatch(val, saleItemsRef.current)
  }

  function addToCart(item) {
    setCart(prev => {
      const idx = prev.findIndex(c => c.itemId === item.id)
      if (idx !== -1) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
        return next
      }
      return [...prev, {
        itemId: item.id, itemName: item.itemName,
        category: item.category, qty: 1,
        unitPrice: item.salePrice || item.listPrice || 0,
      }]
    })
  }

  function updateQty(itemId, qty) {
    if (qty <= 0) { setCart(prev => prev.filter(c => c.itemId !== itemId)); return }
    setCart(prev => prev.map(c => c.itemId === itemId ? { ...c, qty } : c))
  }

  async function handleSubmit() {
    if (cart.length === 0) return
    const discountType  = discountPct ? 'pct' : discountAmt ? 'amt' : null
    const discountValue = discountPct ? parseFloat(discountPct) : discountAmt ? parseFloat(discountAmt) : null
    await processOrder({ platform, items: cart, discountType, discountValue, totalAmount })
    setDone(true)
    setCart([])
    setDiscountPct('')
    setDiscountAmt('')
    setTimeout(() => setDone(false), 3000)
  }

  function openEdit(order) {
    setEditOrder(order)
    setEditForm({
      platform:  order.platform,
      orderDate: order.orderDate,
      total:     order.total,
      items:     order.items.map(i => ({ ...i })),
    })
  }

  function handleEditItemQty(idx, qty) {
    const items = editForm.items.map((it, i) => i === idx ? { ...it, qty: Number(qty) } : it)
    const subtotal = items.reduce((s, it) => s + it.qty * it.unitPrice, 0)
    setEditForm(p => ({ ...p, items, total: subtotal }))
  }

  function handleEditSave() {
    const subtotal = editForm.items.reduce((s, it) => s + it.qty * it.unitPrice, 0)
    updateOrder(editOrder.id, {
      platform:  editForm.platform,
      orderDate: editForm.orderDate,
      items:     editForm.items,
      subtotal,
      total:     editForm.total,
      discount:  subtotal - editForm.total,
    })
    setEditOrder(null)
  }

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => b.orderDate.localeCompare(a.orderDate)),
    [orders]
  )

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* 頁首 */}
      <div className="flex items-center gap-3">
        <div className="bg-blue-500 p-2.5 rounded-2xl text-white">
          <ShoppingBag size={22} />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">銷售訂單</h1>
          <p className="text-sm text-gray-400">電商平台出貨 · 庫存自動扣除</p>
        </div>
      </div>

      {/* 平台選擇 */}
      <SectionCard title="來源平台">
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(p => (
            <button key={p} onClick={() => setPlatform(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors
                ${platform === p
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
              {p}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* 掃碼區 */}
      <SectionCard title="條碼掃描">
        <div className="space-y-3">
          {/* 鍵盤 / 掃描槍輸入框 */}
          <div className="relative">
            <input
              ref={barcodeRef}
              type="text"
              placeholder="掃描條碼..."
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={handleBarcodeEnter}
              className="w-full border-2 border-blue-200 focus:border-blue-400 rounded-xl px-4 py-3 text-sm focus:outline-none pr-24"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">Enter 確認</span>
          </div>

          {/* 相機按鈕 */}
          <button
            onClick={() => { setIsScanning(p => !p); setScanMsg('') }}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-base font-bold border-2 transition-colors active:scale-95
              ${isScanning
                ? 'bg-red-50 text-red-600 border-red-300 hover:bg-red-100'
                : 'bg-blue-50 text-blue-600 border-blue-300 hover:bg-blue-100'}`}>
            <Camera size={20} />
            {isScanning ? '關閉相機' : '開啟相機掃碼'}
          </button>

          <div
            id="so-reader"
            className="w-full rounded-2xl overflow-hidden"
            style={{ display: isScanning ? 'block' : 'none' }}
          />

          {scanMsg && (
            <div className={`flex items-center justify-center py-3 rounded-xl text-sm font-semibold ${
              scanMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-500'
            }`}>
              {scanMsg}
            </div>
          )}
        </div>
      </SectionCard>

      {!isScanning && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 商品列表 */}
          <SectionCard title="商品列表（點擊加入）">
            <div className="grid grid-cols-2 gap-2">
              {saleItems.map(item => (
                <button key={item.id} onClick={() => addToCart(item)}
                  disabled={item.currentQty <= 0}
                  className="bg-gray-50 hover:bg-blue-50 active:bg-blue-100 border border-gray-200 hover:border-blue-300 rounded-2xl p-4 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[80px] flex flex-col justify-between">
                  <p className="text-sm font-semibold text-gray-800 leading-snug">{item.itemName}</p>
                  <div>
                    <p className="text-base text-blue-500 font-bold mt-1">{fmt(item.salePrice || item.listPrice || 0)}</p>
                    <p className="text-xs text-gray-400">庫存 {item.currentQty} {item.unit}</p>
                  </div>
                </button>
              ))}
              {saleItems.length === 0 && (
                <p className="col-span-2 text-sm text-gray-400 text-center py-4">無 A用品 / B食品 庫存</p>
              )}
            </div>
          </SectionCard>

          {/* 購物車 */}
          <SectionCard title="訂單明細">
            <div className="space-y-2 min-h-[100px]">
              {cart.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">尚未加入商品</p>
              )}
              {cart.map(c => (
                <div key={c.itemId} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-sm font-medium text-gray-700 flex-1 truncate">{c.itemName}</span>
                  <button onClick={() => updateQty(c.itemId, c.qty - 1)}
                    className="w-6 h-6 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center">
                    <Minus size={12} />
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{c.qty}</span>
                  <button onClick={() => updateQty(c.itemId, c.qty + 1)}
                    className="w-6 h-6 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center">
                    <Plus size={12} />
                  </button>
                  <span className="text-sm font-semibold text-gray-800 w-16 text-right">{fmt(c.qty * c.unitPrice)}</span>
                  <button onClick={() => updateQty(c.itemId, 0)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <>
                <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between text-sm text-gray-500">
                  <span>小計</span>
                  <span>{fmt(subtotal)}</span>
                </div>

                {/* 折扣 */}
                <div className="mt-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 space-y-2">
                  <p className="text-xs font-medium text-blue-600">折扣（選填）</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">打折 %（例：15 = 八五折）</label>
                      <input type="number" min="0" max="99" placeholder="不打折請留空"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        value={discountPct}
                        onChange={e => { setDiscountPct(e.target.value); setDiscountAmt('') }} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">折抵金額（元）</label>
                      <input type="number" min="0" placeholder="不折抵請留空"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        value={discountAmt}
                        onChange={e => { setDiscountAmt(e.target.value); setDiscountPct('') }} />
                    </div>
                  </div>
                  {savedAmt > 0 && (
                    <p className="text-xs text-emerald-600 font-medium">共折抵 {fmt(savedAmt)}</p>
                  )}
                </div>

                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm font-semibold text-gray-700">合計</span>
                  <span className="text-xl font-black text-gray-800">{fmt(totalAmount)}</span>
                </div>

                <button onClick={handleSubmit}
                  className="w-full mt-3 py-3 rounded-xl text-white font-bold text-sm transition-colors"
                  style={{ backgroundColor: '#722927' }}>
                  {done ? '✅ 訂單已成立！' : `成立訂單 · ${platform}`}
                </button>
              </>
            )}
          </SectionCard>
        </div>
      )}
      {/* 訂單紀錄 */}
      <SectionCard title="訂單紀錄">
        {sortedOrders.length === 0
          ? <p className="text-sm text-gray-400 text-center py-6">尚無訂單</p>
          : (
            <div className="space-y-2">
              {sortedOrders.map(o => (
                <div key={o.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{o.platform}</span>
                      <span className="text-xs text-gray-400">{o.orderDate}</span>
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{o.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {o.items?.map(i => `${i.itemName} x${i.qty}`).join('、')}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-blue-600 shrink-0">{fmt(o.total)}</span>
                  <button onClick={() => openEdit(o)}
                    className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg transition-colors shrink-0">編輯</button>
                  <button onClick={() => { if (window.confirm('確定刪除此訂單？')) deleteOrder(o.id) }}
                    className="text-xs bg-red-50 hover:bg-red-100 text-red-500 px-3 py-1.5 rounded-lg transition-colors shrink-0">刪除</button>
                </div>
              ))}
            </div>
          )
        }
      </SectionCard>

      {/* 平台業績分析 */}
      <PlatformAnalysis orders={orders} />

      {/* 編輯訂單 Modal */}
      {editOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">編輯訂單</h3>
              <button onClick={() => setEditOrder(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">平台</label>
                  <select className={inputCls} value={editForm.platform}
                    onChange={e => setEditForm(p => ({ ...p, platform: e.target.value }))}>
                    {PLATFORMS.map(pl => <option key={pl}>{pl}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">日期</label>
                  <input type="date" className={inputCls} value={editForm.orderDate}
                    onChange={e => setEditForm(p => ({ ...p, orderDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 block">商品明細</label>
                <div className="space-y-2">
                  {editForm.items?.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                      <span className="text-sm text-gray-700 flex-1">{it.itemName}</span>
                      <span className="text-xs text-gray-400">{fmt(it.unitPrice)}</span>
                      <input type="number" min="1"
                        className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-200"
                        value={it.qty}
                        onChange={e => handleEditItemQty(idx, e.target.value)} />
                      <span className="text-sm font-semibold text-gray-800 w-16 text-right">{fmt(it.qty * it.unitPrice)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">實收金額</label>
                <input type="number" min="0" className={inputCls} value={editForm.total}
                  onChange={e => setEditForm(p => ({ ...p, total: parseFloat(e.target.value) || 0 })) } />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleEditSave}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm"
                  style={{ backgroundColor: '#722927' }}>儲存</button>
                <button onClick={() => setEditOrder(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50">取消</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
