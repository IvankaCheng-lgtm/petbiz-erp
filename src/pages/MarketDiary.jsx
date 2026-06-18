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
function CalendarTab({ marketEvents, addMarketEvent, updateMarketEvent, deleteMarketEvent, addExpense, suppliers, addSupplier }) {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', startDate: today(), endDate: today(), status: '待報名', boothFee: '', note: '', addToExpense: false, supplierId: '', newSupplierName: '' })
  const [editId, setEditId] = useState(null)

  // 市集類供應商（寄賣點）
  const marketSuppliers = useMemo(
    () => (suppliers || []).filter(s => s.category === '市集主辦'),
    [suppliers]
  )

  const sorted = useMemo(() => [...marketEvents].sort((a, b) => b.startDate.localeCompare(a.startDate)), [marketEvents])

  function openAdd() {
    setForm({ name: '', startDate: today(), endDate: today(), status: '待報名', boothFee: '', note: '', addToExpense: false, supplierId: '', newSupplierName: '' })
    setEditId(null)
    setModal(true)
  }

  function openEdit(ev) {
    setForm({ name: ev.name, startDate: ev.startDate, endDate: ev.endDate, status: ev.status, boothFee: ev.boothFee ?? '', note: ev.note || '', addToExpense: false, supplierId: ev.supplierId || '', newSupplierName: '' })
    setEditId(ev.id)
    setModal(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const fee = parseFloat(form.boothFee) || 0
    let resolvedSupplierId = form.supplierId || null
    if (form.supplierId === '__new__' && form.newSupplierName.trim()) {
      const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
      addSupplier({ id: newId, name: form.newSupplierName.trim(), category: '市集主辦', contact: '', phone: '', note: '' })
      resolvedSupplierId = newId
    }
    const supplierName = form.supplierId === '__new__'
      ? form.newSupplierName.trim()
      : (marketSuppliers.find(s => s.id === form.supplierId)?.name || '')
    const data = { name: form.name, startDate: form.startDate, endDate: form.endDate, status: form.status, boothFee: fee, note: form.note || '', supplierId: resolvedSupplierId, supplierName }
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

  // 行事曆檢視月份
  const [calYear,  setCalYear]  = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth())

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }
  function goToday() {
    setCalYear(new Date().getFullYear())
    setCalMonth(new Date().getMonth())
  }

  // 本月日曆格
  const year = calYear
  const month = calMonth
  const now = new Date()
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
      <SectionCard title={
        <div className="flex items-center justify-between w-full">
          <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">&#8249;</button>
          <div className="flex items-center gap-2">
            <span>{year} 年 {month + 1} 月</span>
            {(year !== new Date().getFullYear() || month !== new Date().getMonth()) && (
              <button onClick={goToday} className="text-xs text-orange-500 hover:text-orange-600 font-medium px-2 py-0.5 rounded-lg border border-orange-200 hover:bg-orange-50 transition-colors">回本月</button>
            )}
          </div>
          <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">&#8250;</button>
        </div>
      }>
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
                {ev.note && <p className="text-xs text-gray-400 mt-0.5 truncate">{ev.note}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                {ev.status === '待報名' && (
                  <button
                    onClick={() => {
                      updateMarketEvent(ev.id, { ...ev, status: '已報名' })
                      if (ev.boothFee > 0) {
                        addExpense({
                          date: ev.startDate,
                          type: '攤位',
                          note: `市集費用：${ev.name}`,
                          amount: ev.boothFee,
                          isProductionCost: false,
                        })
                      }
                    }}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-2 py-1.5 rounded-lg transition-colors text-xs font-medium whitespace-nowrap">
                    ✅ 確認出攤
                  </button>
                )}
                <button onClick={() => openEdit(ev)} className="bg-blue-50 hover:bg-blue-100 text-blue-600 p-1.5 rounded-lg transition-colors text-xs">編輯</button>
                <button onClick={() => { if (window.confirm('確定刪除此市集活動？')) deleteMarketEvent(ev.id) }} className={btnDanger}><Trash2 size={13} /></button>
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
            <FormRow label="備註（選填）">
              <input type="text" className={inputCls} placeholder="備註說明" value={form.note}
                onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
            </FormRow>
            <FormRow label="市集場地（選填）">
              <select className={inputCls} value={form.supplierId}
                onChange={e => setForm(p => ({ ...p, supplierId: e.target.value, newSupplierName: '' }))}>
                <option value="">— 不指定 —</option>
                {marketSuppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="__new__">＋ 新增寄賣點</option>
              </select>
              {form.supplierId === '__new__' && (
                <input autoFocus type="text" className={inputCls + ' mt-2'}
                  placeholder="輸入寄賣點名稱"
                  value={form.newSupplierName}
                  onChange={e => setForm(p => ({ ...p, newSupplierName: e.target.value }))} />
              )}
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
  const [itemSearch,   setItemSearch]   = useState('')
  const [itemCat,      setItemCat]      = useState('all') // 'all' | 'B食品' | 'A用品'
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
  const filteredSaleItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    const byCat = itemCat === 'all' ? saleItems : saleItems.filter(i => i.category === itemCat)
    if (!q) return byCat
    return byCat.filter(i => i.itemName?.toLowerCase().includes(q) || i.barcode?.includes(q))
  }, [saleItems, itemSearch, itemCat])
  const subtotal = useMemo(
    () => cart.filter(c => !c.isGift).reduce((s, c) => s + c.qty * c.unitPrice, 0),
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
      return [...prev, { itemId: item.id, itemName: item.itemName, category: item.category, qty: 1, unitPrice: item.salePrice || item.listPrice || 0, cost: item.cost || 0, isGift: false }]
    })
  }

  function updateQty(itemId, qty) {
    if (qty <= 0) { setCart(prev => prev.filter(c => c.itemId !== itemId)); return }
    setCart(prev => prev.map(c => c.itemId === itemId ? { ...c, qty } : c))
  }

  async function handleCheckout() {
    if (cart.length === 0 || !selectedEventId) return
    const saleItems = cart.filter(c => !c.isGift)
    const giftItems = cart.filter(c => c.isGift)
    try {
      await processMarketSale({ items: saleItems, giftItems, paymentMethod, totalAmount, eventId: selectedEventId })
      setDone(true)
      setCart([])
      setDiscountPct('')
      setDiscountAmt('')
      setTimeout(() => setDone(false), 2500)
    } catch (err) {
      alert('交易失敗：' + (err?.message || '未知錯誤'))
    }
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
          <div className="relative mb-2">
            <input
              type="text"
              placeholder="搜尋商品..."
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 pr-8"
            />
            {itemSearch && (
              <button onClick={() => setItemSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-1 mb-2">
            {[['all','全部'],['B食品','食品'],['A用品','用品']].map(([val, label]) => (
              <button key={val} onClick={() => setItemCat(val)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  itemCat === val ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300'
                }`}>
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {filteredSaleItems.map(item => (
              <button key={item.id} onClick={() => addToCart(item)}
                disabled={item.currentQty <= 0}
                className="bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-xl p-3 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <p className="text-sm font-semibold text-gray-800 truncate">{item.itemName}</p>
                <p className="text-xs text-orange-500 font-bold mt-0.5">{fmt(item.salePrice || item.listPrice || 0)}</p>
                <p className="text-xs text-gray-400">庫存 {item.currentQty} {item.unit}</p>
              </button>
            ))}
            {filteredSaleItems.length === 0 && <p className="col-span-2 text-sm text-gray-400 text-center py-4">{itemSearch ? '查無符合的商品' : '無 A用品 / B食品 庫存'}</p>}
          </div>
        </SectionCard>

        {/* 購物車 */}
        <SectionCard title="購物車">
          <div className="space-y-2 min-h-[120px]">
            {cart.length === 0 && <p className="text-sm text-gray-400 text-center py-6">點擊左側商品加入</p>}
            {cart.map(c => (
              <div key={c.itemId} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                c.isGift ? 'bg-pink-50 border border-pink-200' : 'bg-gray-50'
              }`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {c.isGift && <span className="text-xs bg-pink-200 text-pink-700 font-semibold px-1.5 py-0.5 rounded-full shrink-0">贈</span>}
                    <span className="text-sm font-medium text-gray-700 truncate">{c.itemName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(c.itemId, c.qty - 1)}
                    className="w-6 h-6 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold flex items-center justify-center">−</button>
                  <span className="w-6 text-center text-sm font-bold">{c.qty}</span>
                  <button onClick={() => updateQty(c.itemId, c.qty + 1)}
                    className="w-6 h-6 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold flex items-center justify-center">+</button>
                </div>
                <span className={`text-sm font-semibold w-16 text-right ${
                  c.isGift ? 'text-pink-400 line-through' : 'text-gray-800'
                }`}>{fmt(c.qty * c.unitPrice)}</span>
                <button
                  onClick={() => setCart(prev => prev.map(x => x.itemId === c.itemId ? { ...x, isGift: !x.isGift } : x))}
                  className={`text-xs px-2 py-1 rounded-lg border font-medium transition-colors shrink-0 ${
                    c.isGift
                      ? 'bg-pink-100 text-pink-600 border-pink-300'
                      : 'bg-white text-gray-400 border-gray-200 hover:border-pink-300 hover:text-pink-500'
                  }`}>
                  贈品
                </button>
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
              {cart.some(c => c.isGift) && (
                <div className="flex justify-between text-xs text-pink-500 mt-1">
                  <span>🎁 贈品（不列入營收）</span>
                  <span>{cart.filter(c => c.isGift).map(c => `${c.itemName}×${c.qty}`).join('、')}</span>
                </div>
              )}

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

  // marketEvents 更新時，若目前選擇無效則自動 fallback 到第一筆
  const [rangeMode, setRangeMode] = useState('3m') // 'today'|'month'|'3m'|'6m'|'all'|'custom'
  const [customStart, setCustomStart] = useState('')
  const [customEnd,   setCustomEnd]   = useState('')

  const filteredEvents = useMemo(() => {
    const todayStr = today()
    if (rangeMode === 'today') return marketEvents.filter(ev => ev.startDate <= todayStr && ev.endDate >= todayStr)
    if (rangeMode === 'month') {
      const ym = todayStr.slice(0, 7)
      return marketEvents.filter(ev => ev.startDate.slice(0, 7) === ym || ev.endDate.slice(0, 7) === ym)
    }
    if (rangeMode === 'all') return marketEvents
    if (rangeMode === 'custom') {
      if (!customStart && !customEnd) return marketEvents
      return marketEvents.filter(ev =>
        (!customStart || ev.endDate >= customStart) &&
        (!customEnd   || ev.startDate <= customEnd)
      )
    }
    const months = rangeMode === '3m' ? 3 : 6
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return marketEvents.filter(ev => ev.endDate >= cutoffStr && ev.startDate <= todayStr)
  }, [marketEvents, rangeMode, customStart, customEnd])

  const effectiveEventId = filteredEvents.find(e => e.id === selectedEventId)
    ? selectedEventId
    : (filteredEvents[0]?.id ?? marketEvents[0]?.id ?? '')

  const selectedEvent = useMemo(
    () => marketEvents.find(e => e.id === effectiveEventId),
    [marketEvents, effectiveEventId]
  )

  const eventRevenues = useMemo(() => {
    if (!selectedEvent) return []
    return revenues.filter(r =>
      r.eventId === effectiveEventId ||
      (r.channel === '市集' && r.date >= selectedEvent.startDate && r.date <= selectedEvent.endDate)
    )
  }, [revenues, selectedEvent, effectiveEventId])

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
        {/* 篩選模式 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {[['today','當天'],['month','當月'],['3m','近3個月'],['6m','近6個月'],['all','全部'],['custom','自訂']].map(([val, label]) => (
            <button key={val} onClick={() => setRangeMode(val)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                rangeMode === val ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-500 border-gray-200 hover:border-emerald-400'
              }`}>
              {label}
            </button>
          ))}
        </div>
        {rangeMode === 'custom' && (
          <div className="flex gap-2 mb-3 items-center">
            <input type="date" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span className="text-gray-400 text-xs">～</span>
            <input type="date" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          </div>
        )}
        {filteredEvents.length === 0
          ? <p className="text-sm text-gray-400">此區間無市集活動</p>
          : (
            <select className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200`}
              value={effectiveEventId} onChange={e => setSelectedEventId(e.target.value)}>
              {filteredEvents.map(ev => (
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
                            {r.isPending && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-600">待入帳</span>
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
  const [rangeMode,    setRangeMode]    = useState('3m')
  const [customStart,  setCustomStart]  = useState('')
  const [customEnd,    setCustomEnd]    = useState('')
  const [groupMode,    setGroupMode]    = useState('event') // 'event' | 'venue'

  const filteredEvents = useMemo(() => {
    const todayStr = today()
    if (rangeMode === 'all') return marketEvents
    if (rangeMode === 'custom') {
      if (!customStart && !customEnd) return marketEvents
      return marketEvents.filter(ev =>
        (!customStart || ev.endDate >= customStart) &&
        (!customEnd   || ev.startDate <= customEnd)
      )
    }
    const months = rangeMode === '3m' ? 3 : 6
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return marketEvents.filter(ev => ev.endDate >= cutoffStr && ev.startDate <= todayStr)
  }, [marketEvents, rangeMode, customStart, customEnd])

  const stats = useMemo(() => {
    return filteredEvents.map(ev => {
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
      return { id: ev.id, name: ev.name, startDate: ev.startDate, totalRev, boothFee, netProfit, goodsCost, trueProfit, avgDaily, roi, days }
    }).filter(s => {
      // 只分析已開始的市集（startDate ≤ 今天）
      const ev = marketEvents.find(e => e.id === s.id)
      return ev && ev.startDate <= today() && (s.totalRev > 0 || s.boothFee > 0)
    })
  }, [filteredEvents, revenues, inventory])

  // 依場地合併統計
  const venueStats = useMemo(() => {
    const map = {}
    stats.forEach(e => {
      const ev = marketEvents.find(m => m.id === e.id)
      const venue = ev?.supplierName || '未指定場地'
      if (!map[venue]) map[venue] = { name: venue, totalRev: 0, boothFee: 0, netProfit: 0, goodsCost: 0, trueProfit: 0, avgDaily: 0, roi: null, days: 0, count: 0 }
      map[venue].totalRev   += e.totalRev
      map[venue].boothFee   += e.boothFee
      map[venue].goodsCost  += e.goodsCost
      map[venue].days       += e.days
      map[venue].count      += 1
    })
    return Object.values(map).map(v => ({
      ...v,
      netProfit:  v.totalRev - v.boothFee,
      trueProfit: v.totalRev - v.boothFee - v.goodsCost,
      avgDaily:   v.days > 0 ? v.totalRev / v.days : 0,
      roi:        v.boothFee > 0 ? ((v.totalRev - v.boothFee) / v.boothFee * 100) : null,
    })).sort((a, b) => b.totalRev - a.totalRev)
  }, [stats, marketEvents])

  const displayStats = groupMode === 'venue' ? venueStats : stats

  // 圓餅圖固定依場地合併（場次太多圓餅圖會太亂）
  const pieData = useMemo(() => {
    const total = venueStats.reduce((s, e) => s + e.totalRev, 0)
    return venueStats
      .filter(e => e.totalRev > 0)
      .map(e => ({ name: e.name, value: e.totalRev, pct: total > 0 ? (e.totalRev / total * 100).toFixed(1) : 0 }))
  }, [venueStats])

  // 長條圖：依場次時 X 軸顯示「名稱縮寫 + 月/日」，超過 8 場改折線圖
  const barData = useMemo(() =>
    displayStats.map(e => ({
      name: groupMode === 'event' && e.startDate
        ? e.name.slice(0, 4) + ' ' + e.startDate.slice(5)
        : (e.name.length > 8 ? e.name.slice(0, 8) + '…' : e.name),
      '營收': e.totalRev, '攤位費': e.boothFee, '純利': e.netProfit, '淨利': e.trueProfit
    }))
  , [displayStats, groupMode])

  async function handleAI() {
    if (displayStats.length === 0) return
    setAiLoading(true)
    setAiError('')
    setAiText('')

    const context = displayStats.map(e => {
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

      {/* 區間筛選 */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {[['3m','近3個月'],['6m','近6個月'],['all','全部'],['custom','自訂']].map(([val, label]) => (
          <button key={val} onClick={() => setRangeMode(val)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              rangeMode === val ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-500 border-gray-200 hover:border-emerald-400'
            }`}>
            {label}
          </button>
        ))}
        {rangeMode === 'custom' && (
          <>
            <input type="date" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span className="text-gray-400 text-xs">～</span>
            <input type="date" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          </>
        )}
      </div>
      <div className="flex gap-1.5">
        {[['event','依場次'],['venue','依場地']].map(([val,label]) => (
          <button key={val} onClick={() => setGroupMode(val)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              groupMode === val ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-400'
            }`}>{label}</button>
        ))}
      </div>
      <SectionCard title="各市集績效概覽">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                {['市集名稱', groupMode === 'event' ? '日期' : '場次數', '累計營收','攤位費','純利','商品成本','淨利','平均日營','ROI'].map(h => (
                  <th key={h} className="pb-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayStats.map(e => (
                <tr key={e.id ?? e.name} className="hover:bg-gray-50">
                  <td className="py-2.5 font-medium text-gray-800">{e.name}</td>
                  <td className="py-2.5 text-xs text-gray-400">
                    {groupMode === 'event' ? (e.startDate || '—') : `${e.count} 場`}
                  </td>
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
        <SectionCard title="營收佔比（依場地）">
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
              <Bar dataKey="淨利" fill="#8B5CF6" radius={[4,4,0,0]} />
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
          processMarketSale, addExpense, deleteMarketSale,
          suppliers, addSupplier } = data
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
          suppliers={suppliers}
          addSupplier={addSupplier}
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
