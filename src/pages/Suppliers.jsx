import { useState, useMemo } from 'react'
import {
  Plus, Search, Edit2, Trash2, Truck, Printer, Store,
  MapPin, FlaskConical, Factory, Users, Phone, CreditCard, FileText, Percent, ChevronRight,
} from 'lucide-react'
import { Modal, Badge, FormRow, inputCls, btnPrimary, btnSecondary, btnDanger } from '../components/ui'

const CATEGORIES = ['生鮮食材', '包材廠商', '印刷廠', '藥劑/添加物', '代工廠', '市集主辦', '寄賣點']

const CAT_META = {
  '生鮮食材':    { icon: Truck,        color: 'green',  badge: 'green'  },
  '包材廠商':    { icon: Factory,      color: 'blue',   badge: 'blue'   },
  '印刷廠':      { icon: Printer,      color: 'purple', badge: 'purple' },
  '藥劑/添加物': { icon: FlaskConical, color: 'orange', badge: 'orange' },
  '代工廠':      { icon: Factory,      color: 'gray',   badge: 'gray'   },
  '市集主辦':    { icon: MapPin,       color: 'red',    badge: 'red'    },
  '寄賣點':      { icon: Store,        color: 'blue',   badge: 'blue'   },
}

const ICON_BG = {
  green:  'bg-emerald-100 text-emerald-600',
  blue:   'bg-blue-100 text-blue-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600',
  gray:   'bg-gray-100 text-gray-500',
  red:    'bg-red-100 text-red-500',
}

const EMPTY_FORM = {
  name: '', category: CATEGORIES[0], contact: '', phone: '',
  bankAccount: '', commissionPct: '', note: '',
}

export default function Suppliers({ data }) {
  const { suppliers = [], addSupplier, updateSupplier, deleteSupplier, expenses = [], orders = [], inventory = [] } = data

  const [activeTab,  setActiveTab]  = useState('全部')
  const [search,     setSearch]     = useState('')
  const [modal,      setModal]      = useState(null)  // 'add' | 'edit' | 'detail'
  const [editTarget, setEditTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)

  const tabs = ['全部', ...CATEGORIES]

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return suppliers
      .filter(s => activeTab === '全部' || s.category === activeTab)
      .filter(s => !kw || s.name?.toLowerCase().includes(kw) || s.contact?.toLowerCase().includes(kw))
      .sort((a, b) => a.name?.localeCompare(b.name, 'zh-TW'))
  }, [suppliers, activeTab, search])

  function openDetail(s) {
    setDetailTarget(s)
    setModal('detail')
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditTarget(null)
    setModal('add')
  }

  function openEdit(s) {
    setForm({
      name: s.name || '', category: s.category || CATEGORIES[0],
      contact: s.contact || '', phone: s.phone || '',
      bankAccount: s.bankAccount || '', commissionPct: s.commissionPct ?? '',
      note: s.note || '',
    })
    setEditTarget(s)
    setModal('edit')
  }

  function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      ...form,
      commissionPct: form.category === '寄賣點' && form.commissionPct !== ''
        ? parseFloat(form.commissionPct) : null,
    }
    if (modal === 'add') addSupplier(payload)
    else updateSupplier(editTarget.id, payload)
    setModal(null)
  }

  function handleDelete(id) {
    if (!window.confirm('確定刪除此供應商？')) return
    deleteSupplier(id)
  }

  // 一般廠商：從 expenses 查詢進貨紀錄（支援 supplierId 、supplierName 、庫存品項 supplier 文字比對）
  const supplierExpenses = useMemo(() => {
    if (!detailTarget || detailTarget.category === '寄賣點') return []
    const sid  = detailTarget.id
    const name = detailTarget.name
    // 庫存中該廠商的品項名稱集合（用於比對舊資料）
    const itemNames = new Set(
      inventory.filter(i => i.supplier === name).map(i => i.itemName)
    )
    return expenses
      .filter(e => {
        if (e.supplierId && e.supplierId === sid) return true
        if (e.supplierName && e.supplierName === name) return true
        // 舊資料 fallback： note 內容包含該廠商的品項名稱
        if (itemNames.size > 0 && e.type === '進貨') {
          return [...itemNames].some(n => e.note?.includes(n))
        }
        return false
      })
      .sort((a, b) => b.date?.localeCompare(a.date))
  }, [detailTarget, expenses, inventory])

  // 寄賣點：從 orders 查詢出貨訂單
  const consignOrders = useMemo(() => {
    if (!detailTarget || detailTarget.category !== '寄賣點') return []
    return orders
      .filter(o => o.supplierId === detailTarget.id)
      .sort((a, b) => b.orderDate?.localeCompare(a.orderDate))
  }, [detailTarget, orders])

  const meta = (cat) => CAT_META[cat] ?? CAT_META['代工廠']

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">供應商管理</h1>
          <p className="text-sm text-gray-400 mt-0.5">共 {suppliers.length} 家供應商</p>
        </div>
        <button onClick={openAdd} className={btnPrimary + ' flex items-center gap-1.5'}>
          <Plus size={15} /> 新增供應商
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜尋供應商名稱或聯繫窗口…" className={inputCls + ' pl-9'} />
      </div>

      <div className="flex gap-1 flex-wrap bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t}
            {t !== '全部' && (
              <span className="ml-1 text-gray-400">({suppliers.filter(s => s.category === t).length})</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">尚無供應商資料</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => {
            const { icon: Icon, badge } = meta(s.category)
            const iconBg = ICON_BG[meta(s.category).color]
            return (
              <div key={s.id}
                onClick={() => openDetail(s)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${iconBg}`}><Icon size={18} /></div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{s.name}</p>
                      <Badge color={badge}>{s.category}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={e => { e.stopPropagation(); openEdit(s) }} className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 transition-colors">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(s.id) }} className={btnDanger + ' p-1.5'}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-gray-500">
                  {s.contact && <div className="flex items-center gap-2"><Users size={12} className="shrink-0 text-gray-400" /><span>{s.contact}</span></div>}
                  {s.phone && <div className="flex items-center gap-2"><Phone size={12} className="shrink-0 text-gray-400" /><span>{s.phone}</span></div>}
                  {s.bankAccount && <div className="flex items-center gap-2"><CreditCard size={12} className="shrink-0 text-gray-400" /><span className="truncate">{s.bankAccount}</span></div>}
                  {s.category === '寄賣點' && s.commissionPct != null && (
                    <div className="flex items-center gap-2">
                      <Percent size={12} className="shrink-0 text-orange-400" />
                      <span className="text-orange-600 font-medium">拆帳 {s.commissionPct}%（您實得 {(100 - s.commissionPct).toFixed(1)}%）</span>
                    </div>
                  )}
                  {s.note && <div className="flex items-start gap-2"><FileText size={12} className="shrink-0 text-gray-400 mt-0.5" /><span className="line-clamp-2 text-gray-400 italic">{s.note}</span></div>}
                </div>
                <div className="flex items-center justify-end text-xs text-gray-300 gap-1">
                  <span>點擊查看交易紀錄</span><ChevronRight size={12} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal === 'detail' && detailTarget && (
        <Modal title={detailTarget.name} size="md" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {/* 基本資訊 */}
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-gray-500">
              <Badge color={meta(detailTarget.category).badge}>{detailTarget.category}</Badge>
              {detailTarget.contact && <span>👤 {detailTarget.contact}</span>}
              {detailTarget.phone   && <span>📞 {detailTarget.phone}</span>}
              {detailTarget.category === '寄賣點' && detailTarget.commissionPct != null && (
                <span className="text-orange-600 font-medium">拆帳 {detailTarget.commissionPct}%（實得 {(100 - detailTarget.commissionPct).toFixed(1)}%）</span>
              )}
            </div>

            {detailTarget.category === '寄賣點' ? (
              /* 寄賣點：出貨訂單 */
              consignOrders.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">尚無出貨紀錄</p>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {consignOrders.map(o => (
                    <div key={o.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-center text-xs text-gray-400">
                        <span>{o.orderDate}</span>
                        <span className="font-semibold text-gray-700">合計 ${o.total ?? o.totalAmount}</span>
                      </div>
                      <div className="space-y-1">
                        {(o.items ?? []).map((it, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-700">{it.itemName}</span>
                            <span className="text-gray-500 text-xs">×{it.qty} &nbsp; ${it.qty * it.unitPrice}</span>
                          </div>
                        ))}
                      </div>
                      {o.skipRevenue && (
                        <span className="text-xs text-purple-500">僅扣庫存，未計入收入</span>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* 一般廠商：進貨紀錄 */
              supplierExpenses.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">尚無進貨紀錄</p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {supplierExpenses.map(e => (
                    <div key={e.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 text-sm">
                      <div>
                        <p className="text-gray-700 font-medium">{e.note}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{e.date} &nbsp;·&nbsp; {e.type}</p>
                      </div>
                      <span className="font-semibold text-orange-600 shrink-0 ml-4">${e.amount}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold">
                    <span className="text-gray-500">累計支出</span>
                    <span className="text-orange-600">${supplierExpenses.reduce((s, e) => s + (e.amount || 0), 0).toLocaleString()}</span>
                  </div>
                </div>
              )
            )}

            <button onClick={() => setModal(null)} className={btnSecondary + ' w-full'}>關閉</button>
          </div>
        </Modal>
      )}

      {modal && modal !== 'detail' && (
        <Modal title={modal === 'add' ? '新增供應商' : `編輯：${editTarget?.name}`} size="sm" onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormRow label="供應商名稱 *">
              <input type="text" className={inputCls} required
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </FormRow>
            <FormRow label="分類 *">
              <select className={inputCls} value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value, commissionPct: '' }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="聯繫窗口">
                <input type="text" className={inputCls} placeholder="姓名"
                  value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} />
              </FormRow>
              <FormRow label="電話">
                <input type="text" className={inputCls} placeholder="0912-345-678"
                  value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </FormRow>
            </div>
            <FormRow label="匯款帳號">
              <input type="text" className={inputCls} placeholder="銀行代碼 + 帳號"
                value={form.bankAccount} onChange={e => setForm(p => ({ ...p, bankAccount: e.target.value }))} />
            </FormRow>
            {form.category === '寄賣點' && (
              <FormRow label="拆帳比例（寄賣點抽成 %）">
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="100" step="0.1" className={inputCls}
                    placeholder="例：30（即寄賣點抽取 30%）"
                    value={form.commissionPct}
                    onChange={e => setForm(p => ({ ...p, commissionPct: e.target.value }))} />
                  <span className="text-sm text-gray-500 shrink-0">%</span>
                </div>
                {form.commissionPct !== '' && (
                  <p className="text-xs text-emerald-600 mt-1">
                    您實得：{(100 - parseFloat(form.commissionPct || 0)).toFixed(1)}%
                  </p>
                )}
              </FormRow>
            )}
            <FormRow label="備註">
              <textarea rows={3} className={inputCls + ' resize-none'} placeholder="付款條件、最低訂量…"
                value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
            </FormRow>
            <div className="flex gap-2 pt-1">
              <button type="submit" className={btnPrimary + ' flex-1'}>{modal === 'add' ? '新增' : '儲存'}</button>
              <button type="button" onClick={() => setModal(null)} className={btnSecondary}>取消</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
