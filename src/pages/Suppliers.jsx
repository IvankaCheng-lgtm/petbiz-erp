import { useState, useMemo } from 'react'
import {
  Plus, Search, Edit2, Trash2, Truck, Printer, Store,
  MapPin, FlaskConical, Factory, Users, Phone, CreditCard, FileText, Percent,
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
  const { suppliers = [], addSupplier, updateSupplier, deleteSupplier } = data

  const [activeTab,  setActiveTab]  = useState('全部')
  const [search,     setSearch]     = useState('')
  const [modal,      setModal]      = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)

  const tabs = ['全部', ...CATEGORIES]

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return suppliers
      .filter(s => activeTab === '全部' || s.category === activeTab)
      .filter(s => !kw || s.name?.toLowerCase().includes(kw) || s.contact?.toLowerCase().includes(kw))
      .sort((a, b) => a.name?.localeCompare(b.name, 'zh-TW'))
  }, [suppliers, activeTab, search])

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
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${iconBg}`}><Icon size={18} /></div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{s.name}</p>
                      <Badge color={badge}>{s.category}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 transition-colors">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className={btnDanger + ' p-1.5'}>
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
              </div>
            )
          })}
        </div>
      )}

      {modal && (
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
