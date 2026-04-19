import { useState, useMemo } from 'react'
import { Plus, Trash2, ShoppingCart, X, CheckCircle, Calendar, BarChart2, Store } from 'lucide-react'
import { Modal, Badge, SectionCard, FormRow, inputCls, btnPrimary, btnSecondary, btnDanger } from '../components/ui'
import { fmt } from '../utils/format'

const STATUS_COLOR = { '已報名': 'green', '待報名': 'orange', '已結束': 'gray' }
const today = () => new Date().toISOString().slice(0, 10)

// ── 行事曆分頁 ────────────────────────────────────────────────
function CalendarTab({ marketEvents, addMarketEvent, updateMarketEvent, deleteMarketEvent }) {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', startDate: today(), endDate: today(), status: '待報名', boothFee: '' })
  const [editId, setEditId] = useState(null)

  const sorted = useMemo(() => [...marketEvents].sort((a, b) => b.startDate.localeCompare(a.startDate)), [marketEvents])

  function openAdd() {
    setForm({ name: '', startDate: today(), endDate: today(), status: '待報名', boothFee: '' })
    setEditId(null)
    setModal(true)
  }

  function openEdit(ev) {
    setForm({ name: ev.name, startDate: ev.startDate, endDate: ev.endDate, status: ev.status, boothFee: ev.boothFee ?? '' })
    setEditId(ev.id)
    setModal(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const data = { ...form, boothFee: parseFloat(form.boothFee) || 0 }
    if (editId) updateMarketEvent(editId, data)
    else addMarketEvent(data)
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
  const [cart, setCart] = useState([])   // [{ itemId, itemName, qty, unitPrice }]
  const [paymentMethod, setPaymentMethod] = useState('現金')
  const [done, setDone] = useState(false)

  const activeEvents = useMemo(
    () => marketEvents.filter(e => e.status === '已報名'),
    [marketEvents]
  )
  const saleItems = useMemo(
    () => inventory.filter(i => i.category === 'A用品' || i.category === 'B食品'),
    [inventory]
  )
  const totalAmount = useMemo(
    () => cart.reduce((s, c) => s + c.qty * c.unitPrice, 0),
    [cart]
  )

  function addToCart(item) {
    setCart(prev => {
      const idx = prev.findIndex(c => c.itemId === item.id)
      if (idx !== -1) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
        return next
      }
      return [...prev, { itemId: item.id, itemName: item.itemName, qty: 1, unitPrice: item.salePrice || item.listPrice || 0 }]
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
    setTimeout(() => setDone(false), 2500)
  }

  return (
    <div className="space-y-5">
      <h2 className="font-bold text-gray-800">現場即時記帳</h2>

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
          <div className="grid grid-cols-2 gap-2">
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
              <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between items-center">
                <span className="text-sm text-gray-500">合計</span>
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
    </div>
  )
}

// ── 結算統計分頁 ──────────────────────────────────────────────
function StatsTab({ marketEvents, revenues, expenses }) {
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: '總營收', value: fmt(totalRev), color: 'text-emerald-600' },
              { label: '攤位費', value: fmt(boothFee), color: 'text-orange-500' },
              { label: '扣費純利', value: fmt(netProfit), color: netProfit >= 0 ? 'text-emerald-600' : 'text-red-500' },
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
              : (
                <div className="space-y-3">
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
              )
            }
          </SectionCard>

          {/* 交易明細 */}
          <SectionCard title="交易明細">
            {eventRevenues.length === 0
              ? <p className="text-sm text-gray-400 text-center py-4">尚無交易紀錄</p>
              : (
                <div className="space-y-1.5">
                  {eventRevenues.map(r => (
                    <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                      <div>
                        <span className="text-sm font-medium text-gray-700">{r.date}</span>
                        {r.paymentMethod && (
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium
                            ${r.paymentMethod === '現金' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {r.paymentMethod}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-gray-800">{fmt(r.amount)}</span>
                    </div>
                  ))}
                </div>
              )
            }
          </SectionCard>
        </>
      )}
    </div>
  )
}

// ── 主頁面 ────────────────────────────────────────────────────
const TABS = [
  { key: 'calendar', label: '行事曆', icon: <Calendar size={16} /> },
  { key: 'pos',      label: '現場記帳', icon: <ShoppingCart size={16} /> },
  { key: 'stats',    label: '結算統計', icon: <BarChart2 size={16} /> },
]

export default function MarketDiary({ data }) {
  const { marketEvents, inventory, revenues, expenses,
          addMarketEvent, updateMarketEvent, deleteMarketEvent, processMarketSale } = data
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
        />
      )}
    </div>
  )
}
