import { useState, useMemo, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Plus, Trash2, ShoppingCart, X, Calendar, BarChart2, Store, Sparkles, Loader2, TrendingUp, Camera } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Modal, Badge, SectionCard, FormRow, inputCls, btnPrimary, btnSecondary, btnDanger } from '../components/ui'
import { fmt } from '../utils/format'
import { askGemini } from '../services/geminiService'
import { beep } from '../utils/beep'

const STATUS_COLOR = { '已報名': 'green', '待報名': 'orange', '已結束': 'gray' }
const today = () => new Date().toISOString().slice(0, 10)

// ── 行事曆分頁 ────────────────────────────────────────────────
function CalendarTab({ marketEvents, addMarketEvent, updateMarketEvent, deleteMarketEvent, addExpense }) {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', startDate: today(), endDate: today(), status: '待報名', boothFee: '', addToExpense: false })
  const [editId, setEditId] = useState(null)

  const sorted = useMemo(() => [...marketEvents].sort((a, b) => b.startDate.localeCompare(a.startDate)), [marketEvents])

  function openAdd() {
    setForm({ name: '', startDate: today(), endDate: today(), status: '待報名', boothFee: '', addToExpense: false })
    setEditId(null)
    setModal(true)
  }

  function openEdit(ev) {
    setForm({ name: ev.name, startDate: ev.startDate, endDate: ev.endDate, status: ev.status, boothFee: ev.boothFee ?? '', addToExpense: false })
    setEditId(ev.id)
    setModal(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const fee = parseFloat(form.boothFee) || 0
    const data = { name: form.name, startDate: form.startDate, endDate: form.endDate, status: form.status, boothFee: fee }
    if (editId) updateMarketEvent(editId, data)
    else addMarketEvent(data)
    if (form.addToExpense && fee > 0) {
      addExpense({
        date: form.startDate,
        type: '攤位',
        note: `市集費用：${form.name}`,
        amount: fee,
        isProductionCost: false,
      })
    }
    setModal(false)
  }

  // 本月日曆格
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const calCells = Array.from({ length: firstDay }, () => null)
    .concat(Array.from({ length: daysInMonth }, (_, i) => i + 1))

  function eventsOnDay(day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return marketEvents.filter(e => e.startDate <= dateStr && e.endDate >= dateStr)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">市集行事曆</h2>
        <button onClick={openAdd} className={btnPrimary + ' flex items-center gap-1 text-sm'}>
          <Plus size={15} /> 新增市集
        </button>
      </div>

      {/* 月曆 */}
      <SectionCard title={`${year} 年 ${month + 1} 月`}>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-400 mb-2">
          {['日','一','二','三','四','五','六'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calCells.map((day, i) => {
            const evs = day ? eventsOnDay(day) : []
            const isToday = day === now.getDate()
            return (
              <div key={i} className={`min-h-[52px] rounded-xl p-1 text-xs ${day ? 'bg-gray-50' : ''} ${isToday ? 'ring-2 ring-orange-400' : ''}`}>
                {day && (
                  <>
                    <div className={`font-semibold mb-0.5 ${isToday ? 'text-orange-500' : 'text-gray-600'}`}>{day}</div>
                    {evs.map(ev => (
                      <div key={ev.id} onClick={() => openEdit(ev)}
                        className={`truncate rounded px-1 py-0.5 cursor-pointer mb-0.5 text-[10px] font-medium
                          ${ev.status === '已報名' ? 'bg-emerald-100 text-emerald-700' :
                            ev.status === '待報名' ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-500'}`}>
                        {ev.name}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </SectionCard>

      {/* 清單 */}
      <SectionCard title="所有市集活動">
        <div className="space-y-2">
          {sorted.length === 0 && <p className="text-sm text-gray-400 text-center py-6">尚無市集活動</p>}
          {sorted.map(ev => (
            <div key={ev.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm">{ev.name}</span>
                  <Badge color={STATUS_COLOR[ev.status]}>{ev.status}</Badge>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {ev.startDate} {ev.endDate !== ev.startDate ? `～ ${ev.endDate}` : ''}
                  {ev.boothFee > 0 && ` · 攤位費 ${fmt(ev.boothFee)}`}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(ev)} className="bg-blue-50 hover:bg-blue-100 text-blue-600 p-1.5 rounded-lg transition-colors text-xs">編輯</button>
                <button onClick={() => deleteMarketEvent(ev.id)} className={btnDanger}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {modal && (
        <Modal title={editId ? '編輯市集' : '新增市集'} size="sm" onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormRow label="市集名稱">
              <input type="text" className={inputCls} required value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="開始日期">
                <input type="date" className={inputCls} required value={form.startDate}
                  onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
              </FormRow>
              <FormRow label="結束日期">
                <input type="date" className={inputCls} required value={form.endDate}
                  onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
              </FormRow>
            </div>
            <FormRow label="狀態">
              <select className={inputCls} value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {['已報名', '待報名', '已結束'].map(s => <option key={s}>{s}</option>)}
              </select>
            </FormRow>
            <FormRow label="攤位費用（元）">
              <input type="number" min="0" className={inputCls} placeholder="0" value={form.boothFee}
                onChange={e => setForm(p => ({ ...p, boothFee: e.target.value }))} />
            </FormRow>
            {!editId && parseFloat(form.boothFee) > 0 && (
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={form.addToExpense}
                  onChange={e => setForm(p => ({ ...p, addToExpense: e.target.checked }))}
                  className="accent-orange-500 w-4 h-4" />
                同時計入支出費用
              </label>
            )}
            <div className="flex gap-2 pt-1">
              <button type="submit" className={btnPrimary + ' flex-1'}>{editId ? '儲存' : '新增'}</button>
              <button type="button" onClick={() => setModal(false)} className={btnSecondary}>取消</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ── POS 現場記帳分頁 ──────────────────────────────────────────
function POSTab({ marketEvents, inventory, processMarketSale }) {
  const [selectedEventId, setSelectedEventId] = useState('')
  const [cart, setCart]               = useState([])
  const [paymentMethod, setPaymentMethod] = useState('現金')
  const [done, setDone]               = useState(false)
  const [discountPct, setDiscountPct] = useState('')
  const [discountAmt, setDiscountAmt] = useState('')
  const [isScanning,  setIsScanning]  = useState(false)
  const [scanMsg,     setScanMsg]     = useState('')   // 成功/查無訊息
  const [barcodeInput, setBarcodeInput] = useState('')
  const scannerRef   = useRef(null)
  const barcodeRef   = useRef(null)
  const inventoryRef = useRef(inventory)

  // 保持 ref 與最新 inventory 同步
  useEffect(() => { inventoryRef.current = inventory }, [inventory])

  // 頁面載入後自動 focus 條碼輸入框
  useEffect(() => { barcodeRef.current?.focus() }, [])

  useEffect(() => {
    if (!isScanning) {
      const s = scannerRef.current
      if (s) {
        scannerRef.current = null
        s.stop().catch(() => {}).finally(() => { try { s.clear() } catch {} })
      }
      return
    }
    const s = new Html5Qrcode('reader')
    let lastScan = 0
    s.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 400, height: 100 }, formatsToSupport: [0, 4], aspectRatio: 2.0 },
      (decodedText) => {
        const now = Date.now()
        if (now - lastScan < 2000) return
        lastScan = now
        const matched = inventoryRef.current.find(
          i => i.barcode && i.barcode === decodedText &&
               (i.category === 'A用品' || i.category === 'B食品')
        )
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

  const activeEvents = useMemo(
    () => marketEvents.filter(e => e.status === '已報名'),
    [marketEvents]
  )
  const saleItems = useMemo(
    () => inventory.filter(i => i.category === 'A用品' || i.category === 'B食品'),
    [inventory]
  )
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

  function handleBarcodeEnter(e) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const val = barcodeInput.trim()
    if (!val) return
    const matched = inventoryRef.current.find(
      i => i.barcode && i.barcode === val &&
           (i.category === 'A用品' || i.category === 'B食品')
    )
    if (matched) {
      beep()
      addToCart(matched)
      setScanMsg(`✅ 已加入：${matched.itemName}`)
    } else {
      setScanMsg('⚠️ 查無此商品')
    }
    setBarcodeInput('')
    setTimeout(() => setScanMsg(''), 2500)
    barcodeRef.current?.focus()
  }

  function addToCart(item) {  // 同時被掃碼回調呼叫，需定義在 useEffect 之後
    setCart(prev => {
      const idx = prev.findIndex(c => c.itemId === item.id)
      if (idx !== -1) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
        return next
      }
      return [...prev, { itemId: item.id, itemName: item.itemName, category: item.category, qty: 1, unitPrice: item.salePrice || item.listPrice || 0 }]
    })
  }

  function updateQty(itemId, qty) {
    if (qty <= 0) { setCart(prev => prev.filter(c => c.itemId !== itemId)); return }
    setCart(prev => prev.map(c => c.itemId === itemId ? { ...c, qty } : c))
  }

  async function handleCheckout() {
    if (cart.length === 0 || !selectedEventId) return
    await processMarketSale({ items: cart, paymentMethod, totalAmount, eventId: selectedEventId })
    setDone(true)
    setCart([])
    setDiscountPct('')
    setDiscountAmt('')
    setTimeout(() => setDone(false), 2500)
  }

  return (
    <div className="space-y-5">
      <h2 className="font-bold text-gray-800">現場即時記帳</h2>

      {/* 掃碼區 */}
      <SectionCard title="條碼掃描">
        <div className="space-y-3">
          {/* 掃描槍 / 鍵盤輸入框 */}
          <div className="relative">
            <input
              ref={barcodeRef}
              type="text"
              placeholder="掃描條碼..."
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={handleBarcodeEnter}
              className="w-full border-2 border-emerald-200 focus:border-emerald-400 rounded-xl px-4 py-3 text-sm focus:outline-none pr-24"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">Enter 確認</span>
          </div>
          <button
            onClick={() => { setIsScanning(p => !p); setScanMsg('') }}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold border-2 transition-colors active:scale-95
              ${isScanning
                ? 'bg-red-50 text-red-600 border-red-300 hover:bg-red-100'
                : 'bg-emerald-50 text-emerald-600 border-emerald-300 hover:bg-emerald-100'}`}>
            <Camera size={20} />
            {isScanning ? '關閉相機' : '開啟相機掃碼'}
          </button>

          <div
            id="reader"
            className="w-full rounded-2xl overflow-hidden"
            style={{ display: isScanning ? 'block' : 'none', maxWidth: '100%' }}
          />

          {scanMsg && (
            <div className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold ${
              scanMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-500'
            }`}>
              {scanMsg}
            </div>
          )}
        </div>
      </SectionCard>

      {isScanning && (
        <p className="text-xs text-center text-gray-400">掃描完成或關閉相機後，商品列表與購物車將重新顯示。</p>
      )}

      {!isScanning && (
      <>
      {/* 選擇市集 */}
      <SectionCard title="選擇今日市集">
        {activeEvents.length === 0
          ? <p className="text-sm text-gray-400">目前無「已報名」的市集活動，請先在行事曆新增。</p>
          : (
            <div className="flex flex-wrap gap-2">
              {activeEvents.map(ev => (
                <button key={ev.id} onClick={() => setSelectedEventId(ev.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors
                    ${selectedEventId === ev.id
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400'}`}>
                  {ev.name} · {ev.startDate}
                </button>
              ))}
            </div>
          )
        }
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 商品選擇 */}
        <SectionCard title="商品列表（點擊加入）">
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {saleItems.map(item => (
              <button key={item.id} onClick={() => addToCart(item)}
                disabled={item.currentQty <= 0}
                className="bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-xl p-3 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <p className="text-sm font-semibold text-gray-800 truncate">{item.itemName}</p>
                <p className="text-xs text-orange-500 font-bold mt-0.5">{fmt(item.salePrice || item.listPrice || 0)}</p>
                <p className="text-xs text-gray-400">庫存 {item.currentQty} {item.unit}</p>
              </button>
            ))}
            {saleItems.length === 0 && <p className="col-span-2 text-sm text-gray-400 text-center py-4">無 A用品 / B食品 庫存</p>}
          </div>
        </SectionCard>

        {/* 購物車 */}
        <SectionCard title="購物車">
          <div className="space-y-2 min-h-[120px]">
            {cart.length === 0 && <p className="text-sm text-gray-400 text-center py-6">點擊左側商品加入</p>}
            {cart.map(c => (
              <div key={c.itemId} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                <span className="text-sm font-medium text-gray-700 flex-1 truncate">{c.itemName}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(c.itemId, c.qty - 1)}
                    className="w-6 h-6 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold flex items-center justify-center">−</button>
                  <span className="w-6 text-center text-sm font-bold">{c.qty}</span>
                  <button onClick={() => updateQty(c.itemId, c.qty + 1)}
                    className="w-6 h-6 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold flex items-center justify-center">+</button>
                </div>
                <span className="text-sm font-semibold text-gray-800 w-16 text-right">{fmt(c.qty * c.unitPrice)}</span>
                <button onClick={() => updateQty(c.itemId, 0)} className="text-gray-300 hover:text-red-400 transition-colors"><X size={14} /></button>
              </div>
            ))}
          </div>

          {cart.length > 0 && (
            <>
              {/* 小計 */}
              <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between text-sm text-gray-500">
                <span>小計</span>
                <span>{fmt(subtotal)}</span>
              </div>

              {/* 折扣輸入（選填） */}
              <div className="mt-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5 space-y-2">
                <p className="text-xs font-medium text-orange-600">折扣（選填）</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">打折 %（例：15 = 八五折）</label>
                    <input type="number" min="0" max="99" placeholder="不打折請留空"
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                      value={discountPct}
                      onChange={e => setDiscountPct(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">折抄金額（元）</label>
                    <input type="number" min="0" placeholder="不折抄請留空"
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                      value={discountAmt}
                      onChange={e => setDiscountAmt(e.target.value)} />
                  </div>
                </div>
                {savedAmt > 0 && (
                  <p className="text-xs text-emerald-600 font-medium">共省 {fmt(savedAmt)}</p>
                )}
              </div>

              {/* 合計 */}
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm font-semibold text-gray-700">合計</span>
                <span className="text-xl font-black text-gray-800">{fmt(totalAmount)}</span>
              </div>

              {/* 付款方式 */}
              <div className="flex gap-2 mt-3">
                {['現金', 'LINE Pay'].map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors
                      ${paymentMethod === m
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                    {m === '現金' ? '💵 現金' : '💚 LINE Pay'}
                  </button>
                ))}
              </div>

              <button onClick={handleCheckout} disabled={!selectedEventId}
                className="w-full mt-3 py-3 rounded-xl text-white font-bold text-sm transition-colors disabled:opacity-40"
                style={{ backgroundColor: '#722927' }}>
                {done ? '✅ 交易完成！' : `完成交易 · ${paymentMethod}`}
              </button>
              {!selectedEventId && <p className="text-xs text-red-400 text-center mt-1">請先選擇今日市集</p>}
            </>
          )}
        </SectionCard>
      </div>
      </>
      )}
    </div>
  )
}

// ── 結算統計分頁 ──────────────────────────────────────────────
function StatsTab({ marketEvents, revenues, expenses, inventory, deleteMarketSale }) {
  const [selectedEventId, setSelectedEventId] = useState(marketEvents[0]?.id ?? '')

  const selectedEvent = useMemo(
    () => marketEvents.find(e => e.id === selectedEventId),
    [marketEvents, selectedEventId]
  )

  const eventRevenues = useMemo(() => {
    if (!selectedEvent) return []
    return revenues.filter(r =>
      r.eventId === selectedEventId ||
      (r.channel === '市集' && r.date >= selectedEvent.startDate && r.date <= selectedEvent.endDate)
    )
  }, [revenues, selectedEvent, selectedEventId])

  const totalRev   = eventRevenues.reduce((s, r) => s + r.amount, 0)
  const boothFee   = selectedEvent?.boothFee ?? 0
  const netProfit  = totalRev - boothFee

  // 購買商品成本：各筆交易的商品數量 × 庫存成本
  const goodsCost = useMemo(() => {
    return eventRevenues.reduce((total, r) => {
      if (!r.items) return total
      return total + r.items.reduce((s, item) => {
        const inv = inventory.find(i => i.id === item.itemId)
        return s + (inv?.cost || 0) * item.qty
      }, 0)
    }, 0)
  }, [eventRevenues, inventory])

  const trueProfit = netProfit - goodsCost

  const cashRev    = eventRevenues.filter(r => r.paymentMethod === '現金').reduce((s, r) => s + r.amount, 0)
  const linePayRev = eventRevenues.filter(r => r.paymentMethod === 'LINE Pay').reduce((s, r) => s + r.amount, 0)
  const cashPct    = totalRev > 0 ? (cashRev / totalRev * 100).toFixed(0) : 0
  const linePayPct = totalRev > 0 ? (linePayRev / totalRev * 100).toFixed(0) : 0

  return (
    <div className="space-y-5">
      <h2 className="font-bold text-gray-800">市集結算統計</h2>

      {/* 選擇市集 */}
      <SectionCard title="選擇市集活動">
        {marketEvents.length === 0
          ? <p className="text-sm text-gray-400">尚無市集活動</p>
          : (
            <select className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200`}
              value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
              {marketEvents.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.name} · {ev.startDate}</option>
              ))}
            </select>
          )
        }
      </SectionCard>

      {selectedEvent && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '總營收', value: fmt(totalRev), color: 'text-emerald-600' },
              { label: '攤位費', value: fmt(boothFee), color: 'text-orange-500' },
              { label: '扣費純利', value: fmt(netProfit), color: netProfit >= 0 ? 'text-emerald-600' : 'text-red-500' },
              { label: '淨利（扣商品成本）', value: fmt(trueProfit), color: trueProfit >= 0 ? 'text-purple-600' : 'text-red-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className={`text-xl font-black ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* 付款佔比 */}
          <SectionCard title="付款方式佔比">
            {totalRev === 0
              ? <p className="text-sm text-gray-400 text-center py-4">此市集尚無收款紀錄</p>
              : (() => {
                  // 依日期分組
                  const dateMap = {}
                  eventRevenues.forEach(r => {
                    const d = r.date
                    if (!dateMap[d]) dateMap[d] = { cash: 0, linePay: 0 }
                    if (r.paymentMethod === '現金') dateMap[d].cash += r.amount
                    else if (r.paymentMethod === 'LINE Pay') dateMap[d].linePay += r.amount
                    else dateMap[d].cash += r.amount // 未標記視為現金
                  })
                  const dates = Object.keys(dateMap).sort()
                  const isMultiDay = dates.length > 1
                  return (
                    <div className="space-y-4">
                      {/* 整場合計 */}
                      <div className="space-y-2">
                        {isMultiDay && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">整場合計</p>}
                        {[
                          { label: '💵 現金', amount: cashRev, pct: cashPct, color: 'bg-amber-400' },
                          { label: '💚 LINE Pay', amount: linePayRev, pct: linePayPct, color: 'bg-emerald-400' },
                        ].map(({ label, amount, pct, color }) => (
                          <div key={label}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium text-gray-700">{label}</span>
                              <span className="text-gray-500">{fmt(amount)} ({pct}%)</span>
                            </div>
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* 各日明細 */}
                      {isMultiDay && (
                        <div className="space-y-3 border-t border-gray-100 pt-3">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">各日明細</p>
                          {dates.map(date => {
                            const { cash, linePay } = dateMap[date]
                            const dayTotal = cash + linePay
                            const cashP  = dayTotal > 0 ? (cash / dayTotal * 100).toFixed(0) : 0
                            const lineP  = dayTotal > 0 ? (linePay / dayTotal * 100).toFixed(0) : 0
                            return (
                              <div key={date} className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-semibold text-gray-600">{date}</span>
                                  <span className="text-xs text-gray-400">合計 {fmt(dayTotal)}</span>
                                </div>
                                {[
                                  { label: '💵 現金', amount: cash, pct: cashP, color: 'bg-amber-400' },
                                  { label: '💚 LINE Pay', amount: linePay, pct: lineP, color: 'bg-emerald-400' },
                                ].map(({ label, amount, pct, color }) => (
                                  <div key={label}>
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="text-gray-600">{label}</span>
                                      <span className="text-gray-500">{fmt(amount)} ({pct}%)</span>
                                    </div>
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()
            }
          </SectionCard>

          {/* 交易明細 */}
          <SectionCard title="交易明細">
            {eventRevenues.length === 0
              ? <p className="text-sm text-gray-400 text-center py-4">尚無交易紀錄</p>
              : (
                <div className="space-y-1.5">
                  {eventRevenues.map(r => {
                    const subtotal = r.items?.reduce((s, i) => s + i.qty * i.unitPrice, 0) ?? r.amount
                    const hasDiscount = subtotal > r.amount
                    return (
                      <details key={r.id} className="group bg-gray-50 rounded-xl overflow-hidden">
                        <summary className="flex items-center justify-between px-4 py-2.5 cursor-pointer list-none select-none">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 select-none group-open:rotate-90 transition-transform inline-block">▶</span>
                            <span className="text-sm font-medium text-gray-700">{r.date}</span>
                            {r.paymentMethod && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                ${r.paymentMethod === '現金' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {r.paymentMethod}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800">{fmt(r.amount)}</span>
                            <button
                              onClick={e => { e.preventDefault(); if (window.confirm('確定刪除此筆交易？庫存將自動補回。')) deleteMarketSale(r.id) }}
                              className="text-xs bg-red-50 hover:bg-red-100 text-red-400 px-2 py-1 rounded-lg transition-colors shrink-0">
                              刪除
                            </button>
                          </div>
                        </summary>

                        {/* 展開內容 */}
                        <div className="px-4 pb-3 pt-1 border-t border-gray-100 space-y-1">
                          {r.items && r.items.length > 0 ? (
                            r.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-xs text-gray-600">
                                <span>{item.itemName} × {item.qty}</span>
                                <span>{fmt(item.qty * item.unitPrice)}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-gray-400">無商品明細</p>
                          )}
                          {hasDiscount && (
                            <div className="flex justify-between text-xs pt-1 border-t border-dashed border-gray-200">
                              <span className="text-gray-400">小計</span>
                              <span className="text-gray-400">{fmt(subtotal)}</span>
                            </div>
                          )}
                          {hasDiscount && (
                            <div className="flex justify-between text-xs text-emerald-600 font-medium">
                              <span>折扣</span>
                              <span>-{fmt(subtotal - r.amount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs font-bold pt-0.5">
                            <span className="text-gray-700">實收</span>
                            <span className="text-gray-800">{fmt(r.amount)}</span>
                          </div>
                        </div>
                      </details>
                    )
                  })}
                </div>
              )
            }
          </SectionCard>
        </>
      )}
    </div>
  )
}

// ── 數據分析分頁 ──────────────────────────────────────────────
const PIE_COLORS = ['#10B981','#F59E0B','#3B82F6','#8B5CF6','#EF4444','#EC4899','#14B8A6','#F97316']

function AnalysisTab({ marketEvents, revenues, inventory }) {
  const [aiText,    setAiText]    = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError,   setAiError]   = useState('')

  const stats = useMemo(() => {
    return marketEvents.map(ev => {
      const evRevs = revenues.filter(r =>
        r.eventId === ev.id ||
        (r.channel === '市集' && r.date >= ev.startDate && r.date <= ev.endDate)
      )
      const totalRev  = evRevs.reduce((s, r) => s + r.amount, 0)
      const boothFee  = ev.boothFee ?? 0
      const netProfit = totalRev - boothFee
      const goodsCost = evRevs.reduce((total, r) => {
        if (!r.items) return total
        return total + r.items.reduce((s, item) => {
          const inv = inventory.find(i => i.id === item.itemId)
          return s + (inv?.cost || 0) * item.qty
        }, 0)
      }, 0)
      const trueProfit = netProfit - goodsCost
      const days      = Math.max(1, Math.ceil((new Date(ev.endDate) - new Date(ev.startDate)) / 86400000) + 1)
      const avgDaily  = totalRev / days
      const roi       = boothFee > 0 ? ((netProfit / boothFee) * 100) : null
      return { id: ev.id, name: ev.name, totalRev, boothFee, netProfit, goodsCost, trueProfit, avgDaily, roi, days }
    }).filter(s => s.totalRev > 0 || s.boothFee > 0)
  }, [marketEvents, revenues, inventory])

  // 圓餅圖資料：各市集累計營收佔比
  const pieData = useMemo(() => {
    const total = stats.reduce((s, e) => s + e.totalRev, 0)
    return stats
      .filter(e => e.totalRev > 0)
      .map(e => ({ name: e.name, value: e.totalRev, pct: total > 0 ? (e.totalRev / total * 100).toFixed(1) : 0 }))
  }, [stats])

  // 長條圖資料：各場次營收 vs 攤位費
  const barData = useMemo(() =>
    stats.map(e => ({ name: e.name.length > 8 ? e.name.slice(0, 8) + '…' : e.name, 營收: e.totalRev, 攤位費: e.boothFee, 純利: e.netProfit }))
  , [stats])

  async function handleAI() {
    if (stats.length === 0) return
    setAiLoading(true)
    setAiError('')
    setAiText('')

    const context = stats.map(e => {
      const roiStr = e.roi !== null ? `${e.roi.toFixed(1)}%` : '無攤位費'
      return `「${e.name}」：累計營收 ${fmt(e.totalRev)}、攤位費 ${fmt(e.boothFee)}、純利 ${fmt(e.netProfit)}、平均日營 ${fmt(Math.round(e.avgDaily))}、ROI ${roiStr}`
    }).join('\n')

    const prompt = `以下是「萌獸探險隊」寵物食品品牌各市集場地的出攞數據：
${context}

請根據以上數據，給出一份 200 字內的繁體中文出攞建議，指出表現最佳與最差的場地，並說明原因（例如：攤位費過高、客單價低、ROI 低等）。`

    try {
      const result = await askGemini(prompt)
      setAiText(result)
    } catch {
      setAiError('AI 分析失敗，請稍後再試。')
    } finally {
      setAiLoading(false)
    }
  }

  if (stats.length === 0) return (
    <div className="space-y-5">
      <h2 className="font-bold text-gray-800">數據分析</h2>
      <div className="bg-gray-50 rounded-2xl p-12 text-center text-gray-400">
        <TrendingUp size={40} className="mx-auto mb-3 opacity-20" />
        <p>尚無市集營收資料，請先新增市集並進行現場記帳。</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <h2 className="font-bold text-gray-800">數據分析</h2>

      {/* ROI 表格 */}
      <SectionCard title="各市集績效概覽">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                {['市集名稱','累計營收','攤位費','純利','商品成本','淨利','平均日營','ROI'].map(h => (
                  <th key={h} className="pb-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="py-2.5 font-medium text-gray-800">{e.name}</td>
                  <td className="py-2.5 text-emerald-600 font-semibold">{fmt(e.totalRev)}</td>
                  <td className="py-2.5 text-orange-500">{fmt(e.boothFee)}</td>
                  <td className={`py-2.5 font-semibold ${e.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(e.netProfit)}</td>
                  <td className="py-2.5 text-orange-400">{fmt(Math.round(e.goodsCost))}</td>
                  <td className={`py-2.5 font-bold ${e.trueProfit >= 0 ? 'text-purple-600' : 'text-red-500'}`}>{fmt(Math.round(e.trueProfit))}</td>
                  <td className="py-2.5 text-gray-600">{fmt(Math.round(e.avgDaily))}</td>
                  <td className="py-2.5">
                    {e.roi !== null
                      ? <span className={`font-bold ${e.roi >= 100 ? 'text-emerald-600' : e.roi >= 0 ? 'text-orange-500' : 'text-red-500'}`}>{e.roi.toFixed(1)}%</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 圓餅圖 */}
        <SectionCard title="營收佔比（圓餅圖）">
          {pieData.length === 0
            ? <p className="text-sm text-gray-400 text-center py-6">尚無營收資料</p>
            : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, pct }) => `${name} ${pct}%`} labelLine={false}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {d.name}
                    </div>
                  ))}
                </div>
              </>
            )
          }
        </SectionCard>

        {/* 長條圖 */}
        <SectionCard title="營收 vs 攤位費（長條圖）">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={36} />
              <Tooltip formatter={v => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="營收" fill="#10B981" radius={[4,4,0,0]} />
              <Bar dataKey="攤位費" fill="#F59E0B" radius={[4,4,0,0]} />
              <Bar dataKey="純利" fill="#3B82F6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* AI 分析 */}
      <SectionCard title="🤖 AI 出攞建議">
        <div className="space-y-3">
          {!aiText && !aiLoading && (
            <p className="text-sm text-gray-400">點擊下方按鈕，AI 將根據各市集的 ROI、平均日營與攤位費進行分析。</p>
          )}
          {aiLoading && (
            <div className="flex items-center gap-2 text-emerald-500">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">AI 正在分析市集數據...</span>
            </div>
          )}
          {aiError && <p className="text-sm text-red-500">{aiError}</p>}
          {aiText && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {aiText}
            </div>
          )}
          <button onClick={handleAI} disabled={aiLoading}
            className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#722927' }}>
            <Sparkles size={15} />
            {aiLoading ? '分析中...' : '產生 AI 出攞建議'}
          </button>
        </div>
      </SectionCard>
    </div>
  )
}

// ── 主頁面 ────────────────────────────────────────────────────
const TABS = [
  { key: 'calendar', label: '行事曆',   icon: <Calendar size={16} /> },
  { key: 'pos',      label: '現場記帳', icon: <ShoppingCart size={16} /> },
  { key: 'stats',    label: '結算統計', icon: <BarChart2 size={16} /> },
  { key: 'analysis', label: '數據分析', icon: <TrendingUp size={16} /> },
]

export default function MarketDiary({ data }) {
  const { marketEvents, inventory, revenues, expenses,
          addMarketEvent, updateMarketEvent, deleteMarketEvent,
          processMarketSale, addExpense, deleteMarketSale } = data
  const [tab, setTab] = useState('calendar')

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* 頁首 */}
      <div className="flex items-center gap-3">
        <div className="bg-emerald-500 p-2.5 rounded-2xl text-white">
          <Store size={22} />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">市集出攤日記</h1>
          <p className="text-sm text-gray-400">行事曆 · 現場記帳 · 結算統計</p>
        </div>
      </div>

      {/* Tab */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab === t.key ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'calendar' && (
        <CalendarTab
          marketEvents={marketEvents}
          addMarketEvent={addMarketEvent}
          updateMarketEvent={updateMarketEvent}
          deleteMarketEvent={deleteMarketEvent}
          addExpense={addExpense}
        />
      )}
      {tab === 'pos' && (
        <POSTab
          marketEvents={marketEvents}
          inventory={inventory}
          processMarketSale={processMarketSale}
        />
      )}
      {tab === 'stats' && (
        <StatsTab
          marketEvents={marketEvents}
          revenues={revenues}
          expenses={expenses}
          inventory={inventory}
          deleteMarketSale={deleteMarketSale}
        />
      )}
      {tab === 'analysis' && (
        <AnalysisTab
          marketEvents={marketEvents}
          revenues={revenues}
          inventory={inventory}
        />
      )}
    </div>
  )
}
