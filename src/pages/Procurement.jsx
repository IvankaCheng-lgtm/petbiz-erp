import { useState, useMemo } from 'react'
import { Plus, Trash2, Edit2, AlertTriangle, Package, X, Sparkles, Copy, Check } from 'lucide-react'
import { Modal, Badge, SectionCard, FormRow, inputCls, btnPrimary, btnSecondary, btnDanger } from '../components/ui'
import { fmt } from '../utils/format'
import { askGemini } from '../services/geminiService'

// ── AI 文案產生區塊 ─────────────────────────────────────────────────
function AiCopywriter({ itemName, category, inventory }) {
  const [loading,  setLoading]  = useState(false)
  const [copies,   setCopies]   = useState([])   // [{text, copied}]
  const [error,    setError]    = useState('')

  // 從 C食材庫存取得食材清單
  const ingredients = inventory
    .filter(i => i.category === 'C食材')
    .map(i => i.itemName)
    .join('、')

  async function handleGenerate() {
    if (!itemName.trim()) return
    setLoading(true)
    setError('')
    setCopies([])

    const prompt = `你是一位有 20 年資歷的台灣網路行銷企劃師，熟悉台灣消費者語感，文字精準有溫度，不說廢話。

商品：${itemName}（${category}）${ingredients ? `，主要食材：${ingredients}` : ''}

請產生兩段文案，格式如下，不可更改標記：
[FB_IG]
（在此寫 FB/IG 通用文案：3～5 句口語自然，帶出商品亮點與毛孩情感連結，結尾放 3 個台灣寵物社群常用 hashtag，不用條列、不堆形容詞）
[THREADS]
（在此寫 Threads 文案：1～3 句，有脆感生活化，像朋友隨手發的，可帶反差或台式幽默，不加 hashtag）`

    try {
      const result = await askGemini(prompt)
      const fbMatch  = result.match(/\[FB_IG\]\s*([\s\S]*?)(?=\[THREADS\]|$)/)
      const thMatch  = result.match(/\[THREADS\]\s*([\s\S]*?)$/)
      const fb = fbMatch?.[1]?.trim() ?? ''
      const th = thMatch?.[1]?.trim() ?? ''
      const parts = [fb, th].filter(s => s)
      if (parts.length === 0) {
        setError('文案格式解析失敗，請重新生成。')
      } else {
        setCopies(parts.map(text => ({ text, copied: false })))
      }
    } catch {
      setError('文案生成失敗，請稍後再試。')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy(idx) {
    navigator.clipboard.writeText(copies[idx].text)
    setCopies(prev => prev.map((c, i) => ({ ...c, copied: i === idx })))
    setTimeout(() => setCopies(prev => prev.map((c, i) => ({ ...c, copied: i === idx ? false : c.copied }))), 2000)
  }

  return (
    <div className="border-t border-gray-100 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">🤖 AI 推廣文案</span>
        <button type="button" onClick={handleGenerate} disabled={loading || !itemName.trim()}
          className="flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          style={{ backgroundColor: '#722927' }}
          onMouseEnter={e => !loading && (e.currentTarget.style.backgroundColor = '#5a1f1d')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#722927')}>
          <Sparkles size={13} />
          {loading ? '生成中...' : copies.length ? '重新生成' : 'AI 生成文案'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#722927', borderTopColor: 'transparent' }} />
          AI 正在為「{itemName}」撰寫文案...
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {copies.map((c, idx) => (
        <div key={idx} className="relative group">
          <div className="text-xs text-gray-400 mb-1">{idx === 0 ? 'FB / IG 通用' : 'Threads'}</div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pr-10">
            {c.text}
          </div>
          <button type="button" onClick={() => handleCopy(idx)}
            className="absolute top-7 right-2 p-1.5 rounded-lg transition-colors"
            style={{ color: c.copied ? '#10B981' : '#9CA3AF' }}
            title="複製文案">
            {c.copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      ))}
    </div>
  )
}

const CATEGORIES = ['A用品', 'B食品', 'C食材', 'D包材']
const CAT_LABEL  = {
  'A用品': '用品庫存',
  'B食品': '食品庫存（成品）',
  'C食材': '食材庫存（原料）',
  'D包材': '包材庫存',
}
const today = () => new Date().toISOString().slice(0, 10)

const emptyRow = () => ({
  _key: Math.random().toString(36).slice(2),
  itemName: '', currentQty: '', safetyQty: '', unit: '個', supplier: '',
  listPrice: '', salePrice: '', cost: '', unitPrice: '',
})

export default function Procurement({ data }) {
  const { inventory, addPurchase, addInventoryItem, updateInventoryItem, deleteInventoryItem } = data

  const [activeTab,  setActiveTab]  = useState('A用品')
  const [modal,      setModal]      = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [purchaseForm, setPurchaseForm] = useState({
    date: today(), itemId: '', itemName: '', category: 'C食材', qty: '', unitPrice: '', note: '',
  })
  const [addCategory, setAddCategory] = useState('A用品')
  const [rows, setRows] = useState([emptyRow()])
  const [editForm, setEditForm] = useState({})

  // A/B：定價/售價/成本；C/D：單價/總價
  const isAB = activeTab === 'A用品' || activeTab === 'B食品'
  const isCD = activeTab === 'C食材' || activeTab === 'D包材'

  function addRow()       { setRows(r => [...r, emptyRow()]) }
  function removeRow(key) { setRows(r => r.length > 1 ? r.filter(x => x._key !== key) : r) }
  function updateRow(key, field, val) { setRows(r => r.map(x => x._key === key ? { ...x, [field]: val } : x)) }

  function openAdd() { setAddCategory(activeTab); setRows([emptyRow()]); setModal('add') }

  function submitAdd(e) {
    e.preventDefault()
    rows.forEach(row => {
      if (!row.itemName.trim()) return
      addInventoryItem({
        category:   addCategory,
        itemName:   row.itemName.trim(),
        currentQty: parseFloat(row.currentQty) || 0,
        safetyQty:  parseFloat(row.safetyQty)  || 0,
        unit:       row.unit || '個',
        supplier:   row.supplier.trim(),
        listPrice:  parseFloat(row.listPrice)  || 0,
        salePrice:  parseFloat(row.salePrice)  || 0,
        cost:       parseFloat(row.cost)       || 0,
        unitPrice:  parseFloat(row.unitPrice)  || 0,
      })
    })
    setModal(null)
  }

  function openEdit(item) {
    setEditTarget(item)
    setEditForm({
      ...item,
      supplier:  item.supplier  || '',
      listPrice: item.listPrice || '',
      salePrice: item.salePrice || '',
      cost:      item.cost      || '',
      unitPrice: item.unitPrice || '',
    })
    setModal('edit')
  }

  function submitEdit(e) {
    e.preventDefault()
    updateInventoryItem(editTarget.id, {
      ...editForm,
      currentQty: parseFloat(editForm.currentQty),
      safetyQty:  parseFloat(editForm.safetyQty),
      supplier:   editForm.supplier.trim(),
      listPrice:  parseFloat(editForm.listPrice)  || 0,
      salePrice:  parseFloat(editForm.salePrice)  || 0,
      cost:       parseFloat(editForm.cost)       || 0,
      unitPrice:  parseFloat(editForm.unitPrice)  || 0,
    })
    setModal(null)
  }

  function openPurchase(item) {
    setPurchaseForm({ date: today(), itemId: item.id, itemName: item.itemName, category: item.category, qty: '', unitPrice: '', note: '' })
    setModal('purchase')
  }

  function submitPurchase(e) {
    e.preventDefault()
    addPurchase({ ...purchaseForm, qty: parseFloat(purchaseForm.qty), unitPrice: parseFloat(purchaseForm.unitPrice) })
    setModal(null)
  }

  const filtered = useMemo(() => inventory.filter(i => i.category === activeTab), [inventory, activeTab])

  const stockStatus = (item) => {
    if (item.currentQty <= 0)                    return { label: '缺貨', color: 'red' }
    if (item.currentQty < item.safetyQty)        return { label: '警示', color: 'red' }
    if (item.currentQty < item.safetyQty * 1.5) return { label: '偏低', color: 'orange' }
    return { label: '正常', color: 'green' }
  }

  const margin = (item) => {
    if (!item.salePrice || !item.cost) return null
    return ((item.salePrice - item.cost) / item.salePrice * 100).toFixed(1)
  }

  const colSpan = isAB ? 10 : 9

  // 新增 Modal 的欄位是否為 CD 類
  const addIsCD = addCategory === 'C食材' || addCategory === 'D包材'

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">進貨分析與庫存</h1>
        <button onClick={openAdd} className={btnPrimary + ' flex items-center gap-1 text-sm'}>
          <Plus size={15} /> 新增品項
        </button>
      </div>

      {/* Tab */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveTab(cat)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${activeTab === cat ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* 表格 */}
      <SectionCard title={CAT_LABEL[activeTab]}>
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-sm" style={{ minWidth: isAB ? '860px' : '700px' }}>
            <thead>
              <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                <th className="pb-3 text-left">品項名稱</th>
                <th className="pb-3 text-left">供應商</th>
                <th className="pb-3 text-right">庫存</th>
                <th className="pb-3 text-right">安全水位</th>
                <th className="pb-3 text-center">單位</th>
                {isAB ? (
                  <>
                    <th className="pb-3 text-right">定價</th>
                    <th className="pb-3 text-right">售價</th>
                    <th className="pb-3 text-right">成本</th>
                    <th className="pb-3 text-right">毛利率</th>
                  </>
                ) : (
                  <>
                    <th className="pb-3 text-right">單價(元)</th>
                    <th className="pb-3 text-right">庫存總價</th>
                  </>
                )}
                <th className="pb-3 text-center">狀態</th>
                <th className="pb-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(item => {
                const status = stockStatus(item)
                const mg = margin(item)
                return (
                  <tr key={item.id}
                    className={`hover:bg-gray-50 transition-colors ${item.currentQty < item.safetyQty ? 'bg-red-50/40' : ''}`}>
                    <td className="py-3 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        {item.currentQty < item.safetyQty && <AlertTriangle size={13} className="text-red-500 shrink-0" />}
                        {item.itemName}
                      </div>
                    </td>
                    <td className="py-3 text-gray-500 text-xs">{item.supplier || '—'}</td>
                    <td className={`py-3 text-right font-bold ${item.currentQty < item.safetyQty ? 'text-red-600' : 'text-gray-800'}`}>
                      {item.currentQty}
                    </td>
                    <td className="py-3 text-right text-gray-500">{item.safetyQty}</td>
                    <td className="py-3 text-center text-gray-500">{item.unit}</td>
                    {isAB ? (
                      <>
                        <td className="py-3 text-right text-gray-500">{item.listPrice ? fmt(item.listPrice) : '—'}</td>
                        <td className="py-3 text-right font-semibold text-gray-800">{item.salePrice ? fmt(item.salePrice) : '—'}</td>
                        <td className="py-3 text-right text-gray-500">{item.cost ? fmt(item.cost) : '—'}</td>
                        <td className="py-3 text-right">
                          {mg !== null
                            ? <span className={`font-semibold ${parseFloat(mg) >= 30 ? 'text-emerald-600' : parseFloat(mg) >= 15 ? 'text-orange-500' : 'text-red-500'}`}>{mg}%</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 text-right text-gray-600">{item.unitPrice ? fmt(item.unitPrice) : '—'}</td>
                        <td className="py-3 text-right font-semibold text-emerald-600">
                          {item.unitPrice ? fmt((item.unitPrice || 0) * item.currentQty) : '—'}
                        </td>
                      </>
                    )}
                    <td className="py-3 text-center"><Badge color={status.color}>{status.label}</Badge></td>
                    <td className="py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openPurchase(item)}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                          <Package size={12} /> 進貨
                        </button>
                        <button onClick={() => openEdit(item)}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-600 p-1.5 rounded-lg transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deleteInventoryItem(item.id)} className={btnDanger}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={colSpan} className="py-10 text-center text-gray-400">此分類尚無品項</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* C食材 / D包材 小計 */}
        {isCD && filtered.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 justify-end text-sm">
            <span className="text-gray-500">庫存總價：
              <span className="font-bold text-emerald-600 ml-1">
                {fmt(filtered.reduce((s, i) => s + (i.unitPrice || 0) * i.currentQty, 0))}
              </span>
            </span>
          </div>
        )}

        {/* A/B 小計 */}
        {isAB && filtered.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 justify-end text-sm">
            <span className="text-gray-500">庫存售價總值：
              <span className="font-bold text-gray-800 ml-1">
                {fmt(filtered.reduce((s, i) => s + (i.salePrice || 0) * i.currentQty, 0))}
              </span>
            </span>
            <span className="text-gray-500">庫存成本總值：
              <span className="font-bold text-orange-600 ml-1">
                {fmt(filtered.reduce((s, i) => s + (i.cost || 0) * i.currentQty, 0))}
              </span>
            </span>
          </div>
        )}
      </SectionCard>

      {/* ── 多品項新增 Modal ── */}
      {modal === 'add' && (
        <Modal title="新增庫存品項" size="lg" onClose={() => setModal(null)}>
          <form onSubmit={submitAdd} className="space-y-4">
            <FormRow label="分類">
              <select className={inputCls} value={addCategory} onChange={e => setAddCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </FormRow>

            {/* 欄位標題 */}
            {!addIsCD ? (
              <div className="grid grid-cols-[1.2fr_60px_60px_44px_72px_68px_68px_68px_24px] gap-1 text-xs font-medium text-gray-500 px-1">
                <span>品項名稱 *</span>
                <span className="text-right">庫存</span>
                <span className="text-right">安全值</span>
                <span className="text-center">單位</span>
                <span>供應商</span>
                <span className="text-right">定價</span>
                <span className="text-right">售價</span>
                <span className="text-right">成本</span>
                <span />
              </div>
            ) : (
              <div className="grid grid-cols-[1.2fr_60px_60px_44px_80px_68px_24px] gap-1 text-xs font-medium text-gray-500 px-1">
                <span>品項名稱 *</span>
                <span className="text-right">庫存</span>
                <span className="text-right">安全值</span>
                <span className="text-center">單位</span>
                <span>供應商</span>
                <span className="text-right">單價(元)</span>
                <span />
              </div>
            )}

            {/* 動態列 */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {rows.map((row, idx) => (
                !addIsCD ? (
                  <div key={row._key} className="grid grid-cols-[1.2fr_60px_60px_44px_72px_68px_68px_68px_24px] gap-1 items-center">
                    <input type="text" placeholder={`品項 ${idx + 1}`} className={inputCls + ' text-xs'} value={row.itemName}
                      onChange={e => updateRow(row._key, 'itemName', e.target.value)} required={idx === 0} />
                    <input type="number" min="0" placeholder="0" className={inputCls + ' text-xs text-right'} value={row.currentQty}
                      onChange={e => updateRow(row._key, 'currentQty', e.target.value)} />
                    <input type="number" min="0" placeholder="0" className={inputCls + ' text-xs text-right'} value={row.safetyQty}
                      onChange={e => updateRow(row._key, 'safetyQty', e.target.value)} />
                    <input type="text" placeholder="個" className={inputCls + ' text-xs text-center'} value={row.unit}
                      onChange={e => updateRow(row._key, 'unit', e.target.value)} />
                    <input type="text" placeholder="選填" className={inputCls + ' text-xs'} value={row.supplier}
                      onChange={e => updateRow(row._key, 'supplier', e.target.value)} />
                    <input type="number" min="0" step="0.01" placeholder="0" className={inputCls + ' text-xs text-right'} value={row.listPrice}
                      onChange={e => updateRow(row._key, 'listPrice', e.target.value)} />
                    <input type="number" min="0" step="0.01" placeholder="0" className={inputCls + ' text-xs text-right'} value={row.salePrice}
                      onChange={e => updateRow(row._key, 'salePrice', e.target.value)} />
                    <input type="number" min="0" step="0.01" placeholder="0" className={inputCls + ' text-xs text-right'} value={row.cost}
                      onChange={e => updateRow(row._key, 'cost', e.target.value)} />
                    <button type="button" onClick={() => removeRow(row._key)} disabled={rows.length === 1}
                      className="text-gray-300 hover:text-red-400 disabled:opacity-20 transition-colors flex items-center justify-center">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div key={row._key} className="grid grid-cols-[1.2fr_60px_60px_44px_80px_68px_24px] gap-1 items-center">
                    <input type="text" placeholder={`品項 ${idx + 1}`} className={inputCls + ' text-xs'} value={row.itemName}
                      onChange={e => updateRow(row._key, 'itemName', e.target.value)} required={idx === 0} />
                    <input type="number" min="0" placeholder="0" className={inputCls + ' text-xs text-right'} value={row.currentQty}
                      onChange={e => updateRow(row._key, 'currentQty', e.target.value)} />
                    <input type="number" min="0" placeholder="0" className={inputCls + ' text-xs text-right'} value={row.safetyQty}
                      onChange={e => updateRow(row._key, 'safetyQty', e.target.value)} />
                    <input type="text" placeholder="個" className={inputCls + ' text-xs text-center'} value={row.unit}
                      onChange={e => updateRow(row._key, 'unit', e.target.value)} />
                    <input type="text" placeholder="選填" className={inputCls + ' text-xs'} value={row.supplier}
                      onChange={e => updateRow(row._key, 'supplier', e.target.value)} />
                    <input type="number" min="0" step="0.01" placeholder="0" className={inputCls + ' text-xs text-right'} value={row.unitPrice}
                      onChange={e => updateRow(row._key, 'unitPrice', e.target.value)} />
                    <button type="button" onClick={() => removeRow(row._key)} disabled={rows.length === 1}
                      className="text-gray-300 hover:text-red-400 disabled:opacity-20 transition-colors flex items-center justify-center">
                      <X size={15} />
                    </button>
                  </div>
                )
              ))}
            </div>

            <button type="button" onClick={addRow}
              className="w-full border-2 border-dashed border-gray-200 hover:border-orange-300 hover:text-orange-500 text-gray-400 rounded-xl py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1">
              <Plus size={15} /> 新增一列
            </button>
            <div className="flex gap-2 pt-1">
              <button type="submit" className={btnPrimary + ' flex-1'}>
                確認新增（{rows.filter(r => r.itemName.trim()).length} 項）
              </button>
              <button type="button" onClick={() => setModal(null)} className={btnSecondary}>取消</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── 編輯品項 Modal ── */}
      {modal === 'edit' && (
        <Modal title="編輯品項" size="md" onClose={() => setModal(null)}>
          <form onSubmit={submitEdit} className="space-y-4">
            <FormRow label="品項名稱">
              <input type="text" className={inputCls} value={editForm.itemName}
                onChange={e => setEditForm(p => ({ ...p, itemName: e.target.value }))} required />
            </FormRow>
            <FormRow label="供應商">
              <input type="text" className={inputCls} placeholder="選填" value={editForm.supplier}
                onChange={e => setEditForm(p => ({ ...p, supplier: e.target.value }))} />
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="現有數量">
                <input type="number" min="0" className={inputCls} value={editForm.currentQty}
                  onChange={e => setEditForm(p => ({ ...p, currentQty: e.target.value }))} required />
              </FormRow>
              <FormRow label="安全水位">
                <input type="number" min="0" className={inputCls} value={editForm.safetyQty}
                  onChange={e => setEditForm(p => ({ ...p, safetyQty: e.target.value }))} required />
              </FormRow>
            </div>
            <FormRow label="單位">
              <input type="text" className={inputCls} value={editForm.unit}
                onChange={e => setEditForm(p => ({ ...p, unit: e.target.value }))} required />
            </FormRow>

            {/* A/B：定價/售價/成本；C/D：單價 */}
            {(editTarget?.category === 'A用品' || editTarget?.category === 'B食品') ? (
              <div className="grid grid-cols-3 gap-3">
                <FormRow label="定價（元）">
                  <input type="number" min="0" step="0.01" className={inputCls} placeholder="0" value={editForm.listPrice}
                    onChange={e => setEditForm(p => ({ ...p, listPrice: e.target.value }))} />
                </FormRow>
                <FormRow label="售價（元）">
                  <input type="number" min="0" step="0.01" className={inputCls} placeholder="0" value={editForm.salePrice}
                    onChange={e => setEditForm(p => ({ ...p, salePrice: e.target.value }))} />
                </FormRow>
                <FormRow label="成本（元）">
                  <input type="number" min="0" step="0.01" className={inputCls} placeholder="0" value={editForm.cost}
                    onChange={e => setEditForm(p => ({ ...p, cost: e.target.value }))} />
                </FormRow>
              </div>
            ) : (
              <FormRow label="單價（元）">
                <input type="number" min="0" step="0.01" className={inputCls} placeholder="0" value={editForm.unitPrice}
                  onChange={e => setEditForm(p => ({ ...p, unitPrice: e.target.value }))} />
              </FormRow>
            )}

            {/* A/B 毛利率預覽 */}
            {(editTarget?.category === 'A用品' || editTarget?.category === 'B食品') && editForm.salePrice && editForm.cost && (
              <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-sm flex justify-between">
                <span className="text-gray-500">毛利率預覽</span>
                <span className="font-bold text-emerald-600">
                  {((parseFloat(editForm.salePrice) - parseFloat(editForm.cost)) / parseFloat(editForm.salePrice) * 100).toFixed(1)}%
                </span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button type="submit" className={btnPrimary + ' flex-1'}>儲存</button>
              <button type="button" onClick={() => setModal(null)} className={btnSecondary}>取消</button>
            </div>

            {/* AI 文案：僅對 A用品 / B食品 顯示 */}
            {(editTarget?.category === 'A用品' || editTarget?.category === 'B食品') && (
              <AiCopywriter
                itemName={editForm.itemName || ''}
                category={editTarget?.category || ''}
                inventory={inventory}
              />
            )}
          </form>
        </Modal>
      )}

      {/* ── 進貨 Modal ── */}
      {modal === 'purchase' && (
        <Modal title={`進貨：${purchaseForm.itemName}`} size="sm" onClose={() => setModal(null)}>
          <form onSubmit={submitPurchase} className="space-y-4">
            <FormRow label="進貨日期">
              <input type="date" className={inputCls} value={purchaseForm.date}
                onChange={e => setPurchaseForm(p => ({ ...p, date: e.target.value }))} required />
            </FormRow>
            <FormRow label="進貨數量">
              <input type="number" min="1" className={inputCls} placeholder="0" value={purchaseForm.qty}
                onChange={e => setPurchaseForm(p => ({ ...p, qty: e.target.value }))} required />
            </FormRow>
            <FormRow label="進貨單價（元）">
              <input type="number" min="0" step="0.01" className={inputCls} placeholder="0" value={purchaseForm.unitPrice}
                onChange={e => setPurchaseForm(p => ({ ...p, unitPrice: e.target.value }))} required />
            </FormRow>
            {purchaseForm.qty && purchaseForm.unitPrice && (
              <div className="bg-orange-50 rounded-xl px-4 py-3 text-sm">
                <span className="text-gray-500">預計支出：</span>
                <span className="font-bold text-orange-600 ml-1">
                  {fmt(parseFloat(purchaseForm.qty) * parseFloat(purchaseForm.unitPrice))}
                </span>
              </div>
            )}
            <FormRow label="備註">
              <input type="text" className={inputCls} placeholder="選填" value={purchaseForm.note}
                onChange={e => setPurchaseForm(p => ({ ...p, note: e.target.value }))} />
            </FormRow>
            <div className="flex gap-2 pt-2">
              <button type="submit" className={btnPrimary + ' flex-1'}>確認進貨</button>
              <button type="button" onClick={() => setModal(null)} className={btnSecondary}>取消</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
