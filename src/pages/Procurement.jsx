import { useState, useMemo, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Plus, Trash2, Edit2, AlertTriangle, Package, X, Sparkles, Copy, Check, Calendar, Upload, Download } from 'lucide-react'
import { Modal, Badge, SectionCard, FormRow, inputCls, btnPrimary, btnSecondary, btnDanger } from '../components/ui'
import { fmt } from '../utils/format'
import { askGemini } from '../services/geminiService'
import InventoryAI from '../components/InventoryAI'

// ── AI 文案產生區塊 ─────────────────────────────────────────────────
// 工具：日期 + 天數 → 到期日
function addDays(dateStr, days) {
  if (!dateStr || !days) return ''
  const d = new Date(dateStr)
  d.setDate(d.getDate() + parseInt(days))
  return d.toISOString().slice(0, 10)
}

// ── 編輯品項 Modal ──────────────────────────────────────────────
function EditModal({ editForm, setEditForm, editTarget, inventory, onSubmit, onClose }) {
  const barcodeRef  = useRef(null)
  const itemNameRef = useRef(null)
  const isAB = editTarget?.category === 'A用品' || editTarget?.category === 'B食品'

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAB && barcodeRef.current) barcodeRef.current.focus()
      else if (itemNameRef.current) itemNameRef.current.focus()
    }, 80)
    return () => clearTimeout(timer)
  }, [])

  function handleBarcodeEnter(e) {
    if (e.key === 'Enter') { e.preventDefault(); itemNameRef.current?.focus() }
  }

  function handleProdDateChange(val) {
    setEditForm(p => ({
      ...p,
      prodDate:     val,
      shelfExpiry:  addDays(val, p.shelfDays),
      fridgeExpiry: addDays(val, p.fridgeDays),
      frozenExpiry: addDays(val, p.frozenDays),
    }))
  }

  return (
    <Modal title="編輯品項" size="md" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        {isAB && (
          <FormRow label="📷 國際條碼（選填，支援掃描槍）">
            <input ref={barcodeRef} type="text" className={inputCls}
              placeholder="例：4710123456789，掃描完成後自動跳轉"
              value={editForm.barcode}
              onChange={e => setEditForm(p => ({ ...p, barcode: e.target.value }))}
              onKeyDown={handleBarcodeEnter} />
          </FormRow>
        )}
        <FormRow label="品項名稱">
          <input ref={itemNameRef} type="text" className={inputCls}
            value={editForm.itemName}
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

        {editTarget?.category === 'B食品' && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-3">
            <p className="text-xs font-semibold text-blue-700">📅 標準保存天數（選填）</p>
            <div className="grid grid-cols-3 gap-2">
              <FormRow label="常溫（天）">
                <input type="number" min="0" className={inputCls} placeholder="例：30"
                  value={editForm.shelfDays ?? ''}
                  onChange={e => setEditForm(p => ({ ...p, shelfDays: e.target.value }))} />
              </FormRow>
              <FormRow label="冷藏（天）">
                <input type="number" min="0" className={inputCls} placeholder="例：180"
                  value={editForm.fridgeDays ?? ''}
                  onChange={e => setEditForm(p => ({ ...p, fridgeDays: e.target.value }))} />
              </FormRow>
              <FormRow label="冷凍（天）">
                <input type="number" min="0" className={inputCls} placeholder="例：365"
                  value={editForm.frozenDays ?? ''}
                  onChange={e => setEditForm(p => ({ ...p, frozenDays: e.target.value }))} />
              </FormRow>
            </div>
            <div className="border-t border-blue-100 pt-3 space-y-2">
              <p className="text-xs font-semibold text-blue-700">✨ 輸入生產日期，自動預測到期日</p>
              <FormRow label="生產日期">
                <input type="date" className={inputCls}
                  value={editForm.prodDate || ''}
                  onChange={e => handleProdDateChange(e.target.value)} />
              </FormRow>
              {editForm.prodDate && (
                <div className="grid grid-cols-3 gap-2">
                  <FormRow label="常溫到期">
                    <input type="date" className={inputCls} value={editForm.shelfExpiry || ''}
                      onChange={e => setEditForm(p => ({ ...p, shelfExpiry: e.target.value }))} />
                  </FormRow>
                  <FormRow label="冷藏到期">
                    <input type="date" className={inputCls} value={editForm.fridgeExpiry || ''}
                      onChange={e => setEditForm(p => ({ ...p, fridgeExpiry: e.target.value }))} />
                  </FormRow>
                  <FormRow label="冷凍到期">
                    <input type="date" className={inputCls} value={editForm.frozenExpiry || ''}
                      onChange={e => setEditForm(p => ({ ...p, frozenExpiry: e.target.value }))} />
                  </FormRow>
                </div>
              )}
            </div>
          </div>
        )}

        {isAB ? (
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

        {isAB && editForm.salePrice && editForm.cost && (
          <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-sm flex justify-between">
            <span className="text-gray-500">毛利率預覽</span>
            <span className="font-bold text-emerald-600">
              {((parseFloat(editForm.salePrice) - parseFloat(editForm.cost)) / parseFloat(editForm.salePrice) * 100).toFixed(1)}%
            </span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button type="submit" className={btnPrimary + ' flex-1'}>儲存</button>
          <button type="button" onClick={onClose} className={btnSecondary}>取消</button>
        </div>

        {isAB && (
          <AiCopywriter itemName={editForm.itemName || ''} category={editTarget?.category || ''} inventory={inventory} />
        )}
      </form>
    </Modal>
  )
}

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
  barcode: '', itemName: '', currentQty: '', safetyQty: '', unit: '個', supplier: '',
  listPrice: '', salePrice: '', cost: '', unitPrice: '',
})

export default function Procurement({ data }) {
  const { inventory, addPurchase, addInventoryItem, updateInventoryItem, deleteInventoryItem, revenues = [], inventoryLogs = [], adjustInventory, importInventoryItems } = data

  const [activeTab,    setActiveTab]    = useState('A用品')
  const [modal,        setModal]        = useState(null)
  const [editTarget,   setEditTarget]   = useState(null)
  const [importMsg,    setImportMsg]    = useState('')
  const [purchaseForm, setPurchaseForm] = useState({
    date: today(), itemId: '', itemName: '', category: 'C食材', qty: '', unitPrice: '', note: '',
  })
  const [addCategory, setAddCategory] = useState('A用品')
  const [rows, setRows] = useState([emptyRow()])
  const [editForm, setEditForm] = useState({})
  const [adjustForm, setAdjustForm] = useState({ change: '', reason: '' })
  const xlsxRef = useRef()
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
        barcode:    row.barcode?.trim() || '',
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
      supplier:   item.supplier   || '',
      barcode:    item.barcode    || '',
      prodDate:   '',
      shelfDays:  item.shelfDays  ?? '',
      fridgeDays: item.fridgeDays ?? '',
      frozenDays: item.frozenDays ?? '',
      shelfExpiry:  '',
      fridgeExpiry: '',
      frozenExpiry: '',
      listPrice:  item.listPrice  || '',
      salePrice:  item.salePrice  || '',
      cost:       item.cost       || '',
      unitPrice:  item.unitPrice  || '',
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
      barcode:    editForm.barcode?.trim() || '',
      shelfDays:  editForm.shelfDays  !== '' ? parseInt(editForm.shelfDays)  : null,
      fridgeDays: editForm.fridgeDays !== '' ? parseInt(editForm.fridgeDays) : null,
      frozenDays: editForm.frozenDays !== '' ? parseInt(editForm.frozenDays) : null,
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

  function openAdjust(item) {
    setEditTarget(item)
    setAdjustForm({ change: '', reason: '' })
    setModal('adjust')
  }

  function submitAdjust(e) {
    e.preventDefault()
    const change = parseInt(adjustForm.change)
    if (isNaN(change) || change === 0) return
    adjustInventory(editTarget.id, editTarget.itemName, change, adjustForm.reason || '庫存盤點')
    setModal(null)
  }

  function submitPurchase(e) {
    e.preventDefault()
    addPurchase({ ...purchaseForm, qty: parseFloat(purchaseForm.qty), unitPrice: parseFloat(purchaseForm.unitPrice) })
    setModal(null)
  }

  // 匯出盤點表格
  function exportStockCheck() {
    const abItems = inventory.filter(i => i.category === 'A用品' || i.category === 'B食品')
    const rows = abItems.map(i => ({
      '分類':     i.category,
      '品項名稱': i.itemName,
      '條碼':     i.barcode || '',
      '系統庫存': i.currentQty,
      '單位':     i.unit,
      '實盤數量': '',
      '差異':     '',
      '備註':     '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [10, 18, 16, 10, 6, 10, 8, 16].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '盤點表')
    const date = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `庫存盤點表_${date}.xlsx`)
  }
    const headers = [[
      '分類(A用品/B食品/C食材/D包材)', '品項名稱', '現有數量', '安全水位', '單位',
      '供應商', '條碼', '定價', '售價', '成本', '單價'
    ]]
    const example = [
      ['A用品', '範例用品', 100, 20, '個', '供應商A', '4710000000001', 299, 249, 80, ''],
      ['B食品', '範例食品', 50, 10, '包', '供應商B', '4710000000002', 199, 159, 60, ''],
      ['C食材', '範例食材', 30, 5, 'kg', '供應商C', '', '', '', '', 280],
      ['D包材', '範例包材', 500, 100, '個', '供應商D', '', '', '', '', 3.5],
    ]
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...example])
    ws['!cols'] = [16,16,10,10,6,14,16,8,8,8,8].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '庫存')
    XLSX.writeFile(wb, '庫存匹入範本.xlsx')
  }

  // 匹入 Excel
  function handleImportExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        const VALID_CATS = ['A用品', 'B食品', 'C食材', 'D包材']
        const items = rows
          .filter(r => VALID_CATS.includes(r['分類(A用品/B食品/C食材/D包材)']) && r['品項名稱'])
          .map(r => ({
            category:   r['分類(A用品/B食品/C食材/D包材)'],
            itemName:   String(r['品項名稱']).trim(),
            currentQty: parseFloat(r['現有數量'])  || 0,
            safetyQty:  parseFloat(r['安全水位'])  || 0,
            unit:       String(r['單位'] || '個').trim(),
            supplier:   String(r['供應商'] || '').trim(),
            barcode:    String(r['條碼']   || '').trim(),
            listPrice:  parseFloat(r['定價'])    || 0,
            salePrice:  parseFloat(r['售價'])    || 0,
            cost:       parseFloat(r['成本'])    || 0,
            unitPrice:  parseFloat(r['單價'])    || 0,
          }))
        if (items.length === 0) {
          setImportMsg('⚠️ 未讀到有效資料，請確認欄位名稱符合範本格式')
        } else {
          importInventoryItems(items)
          setImportMsg(`✅ 已匹入 ${items.length} 筆庫存（同名品項自動更新，新品項自動新增）`)
        }
      } catch {
        setImportMsg('❌ 檔案解析失敗，請確認為正確的 Excel 檔案')
      }
      setTimeout(() => setImportMsg(''), 5000)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
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

  const colSpan = isAB ? 11 : 9

  // 新增 Modal 的欄位是否為 CD 類
  const addIsCD = addCategory === 'C食材' || addCategory === 'D包材'

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">進貨分析與庫存</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium px-3 py-2 rounded-xl transition-colors">
            <Download size={15} /> 下載匹入範本
          </button>
          <button onClick={exportStockCheck}
            className="flex items-center gap-1.5 text-sm bg-orange-50 hover:bg-orange-100 text-orange-700 font-medium px-3 py-2 rounded-xl transition-colors">
            <Download size={15} /> 匯出盤點表
          </button>
          <button onClick={() => xlsxRef.current.click()}
            className="flex items-center gap-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium px-3 py-2 rounded-xl transition-colors">
            <Upload size={15} /> Excel 匹入庫存
          </button>
          <input ref={xlsxRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportExcel} />
          <button onClick={openAdd} className={btnPrimary + ' flex items-center gap-1 text-sm'}>
            <Plus size={15} /> 新增品項
          </button>
        </div>
      </div>

      {importMsg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
          importMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
        }`}>
          {importMsg}
        </div>
      )}

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
                        {(item.category === 'A用品' || item.category === 'B食品') && (
                          <button onClick={() => openAdjust(item)}
                            className="bg-orange-50 hover:bg-orange-100 text-orange-600 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                            盤點
                          </button>
                        )}
                        {item.category === 'B食品' && (
                          <button onClick={() => { setEditTarget(item); setModal('expiry') }}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                            <Calendar size={12} /> 效期
                          </button>
                        )}
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
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {rows.map((row, idx) => (
                <div key={row._key} className="space-y-1">
                  {!addIsCD ? (
                    <div className="grid grid-cols-[1.2fr_60px_60px_44px_72px_68px_68px_68px_24px] gap-1 items-center">
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
                    <div className="grid grid-cols-[1.2fr_60px_60px_44px_80px_68px_24px] gap-1 items-center">
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
                  )}
                  {/* 條碼欄：僅 A/B 類顯示 */}
                  {!addIsCD && (
                    <div className="pl-1">
                      <input
                        type="text"
                        placeholder="📷 國際條碼（選填，可用掃描槍，Enter 跳下一欄）"
                        className={inputCls + ' text-xs text-gray-500 w-full'}
                        value={row.barcode}
                        onChange={e => updateRow(row._key, 'barcode', e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            // 跳到同列的品項名稱（前一個 input）
                            const inputs = e.currentTarget.closest('.space-y-1')?.querySelectorAll('input')
                            if (inputs) inputs[0]?.focus()
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
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
        <EditModal
          editForm={editForm}
          setEditForm={setEditForm}
          editTarget={editTarget}
          inventory={inventory}
          onSubmit={submitEdit}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── 效期批次 Modal ── */}
      {modal === 'expiry' && editTarget && (
        <Modal title={`${editTarget.itemName} — 有效期批次`} size="md" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {/* 標準有效期說明 */}
            {(editTarget.shelfDays || editTarget.fridgeDays || editTarget.frozenDays) && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 flex flex-wrap gap-4">
                {editTarget.shelfDays  && <span>常溫：{editTarget.shelfDays} 天</span>}
                {editTarget.fridgeDays && <span>冷藏：{editTarget.fridgeDays} 天</span>}
                {editTarget.frozenDays && <span>冷凍：{editTarget.frozenDays} 天</span>}
              </div>
            )}

            {/* 批次列表 */}
            {(editTarget.expiryBatches?.length ?? 0) === 0
              ? <p className="text-sm text-gray-400 text-center py-6">尚無批次效期資料，可從生產批次自動寫入</p>
              : (
                <div className="space-y-2">
                  {editTarget.expiryBatches.map((b, i) => {
                    const now = new Date()
                    const shelfExp  = b.shelfExpiry  ? new Date(b.shelfExpiry)  : null
                    const fridgeExp = b.fridgeExpiry ? new Date(b.fridgeExpiry) : null
                    const frozenExp = b.frozenExpiry ? new Date(b.frozenExpiry) : null
                    const isExpired = shelfExp && shelfExp < now
                    return (
                      <div key={i} className={`rounded-xl px-4 py-3 border text-sm ${isExpired ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-gray-800">{b.batchNote || `批次 ${i + 1}`}</span>
                          <span className="text-xs text-gray-400">{b.productionDate}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs">
                          {b.qty && <span className="text-gray-600">數量：{b.qty} 包</span>}
                          {shelfExp  && <span className={shelfExp  < now ? 'text-red-500 font-bold' : 'text-gray-500'}>常溫到期：{b.shelfExpiry}</span>}
                          {fridgeExp && <span className={fridgeExp < now ? 'text-red-500 font-bold' : 'text-blue-500'}>冷藏到期：{b.fridgeExpiry}</span>}
                          {frozenExp && <span className={frozenExp < now ? 'text-red-500 font-bold' : 'text-indigo-500'}>冷凍到期：{b.frozenExpiry}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }
            <button onClick={() => setModal(null)} className={btnSecondary + ' w-full'}>關閉</button>
          </div>
        </Modal>
      )}

      {/* ── AI 庫存健康分析 ── */}
      <InventoryAI inventory={inventory} revenues={revenues} />

      {/* ── A/B 庫存異動紀錄 ── */}
      {isAB && (
        <SectionCard title="📊 庫存異動紀錄">
          {(() => {
            const abIds = new Set(inventory.filter(i => i.category === 'A用品' || i.category === 'B食品').map(i => i.id))
            const logs = inventoryLogs
              .filter(l => abIds.has(l.itemId))
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 50)
            if (logs.length === 0) return <p className="text-sm text-gray-400 text-center py-6">尚無異動紀錄</p>
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                      {['日期', '品項', '異動數量', '原因'].map(h => (
                        <th key={h} className="pb-3 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {logs.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="py-2.5 text-gray-400 text-xs">{l.date}</td>
                        <td className="py-2.5 font-medium text-gray-800">{l.itemName}</td>
                        <td className={`py-2.5 font-bold ${l.change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {l.change > 0 ? `+${l.change}` : l.change}
                        </td>
                        <td className="py-2.5 text-gray-500 text-xs">{l.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </SectionCard>
      )}

      {/* ── 盤點異動 Modal ── */}
      {modal === 'adjust' && editTarget && (
        <Modal title={`盤點異動：${editTarget.itemName}`} size="sm" onClose={() => setModal(null)}>
          <form onSubmit={submitAdjust} className="space-y-4">
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm flex justify-between">
              <span className="text-gray-500">目前庫存</span>
              <span className="font-bold text-gray-800">{editTarget.currentQty} {editTarget.unit}</span>
            </div>
            <FormRow label="異動數量">
              <div className="flex gap-2">
                <input
                  type="number"
                  className={inputCls + ' flex-1'}
                  placeholder="增加輸正數，減少輸負數（如 -3）"
                  value={adjustForm.change}
                  onChange={e => setAdjustForm(p => ({ ...p, change: e.target.value }))}
                  required
                />
              </div>
              {adjustForm.change && !isNaN(parseInt(adjustForm.change)) && (
                <p className="text-xs mt-1.5">
                  <span className="text-gray-400">異動後庫存：</span>
                  <span className={`font-bold ml-1 ${Math.max(0, editTarget.currentQty + parseInt(adjustForm.change)) < editTarget.safetyQty ? 'text-red-500' : 'text-emerald-600'}`}>
                    {Math.max(0, editTarget.currentQty + parseInt(adjustForm.change))} {editTarget.unit}
                  </span>
                </p>
              )}
            </FormRow>
            <FormRow label="異動原因">
              <input
                type="text"
                className={inputCls}
                placeholder="如：定期盤點、損壞、樣品贈送…（選填）"
                value={adjustForm.reason}
                onChange={e => setAdjustForm(p => ({ ...p, reason: e.target.value }))}
              />
            </FormRow>
            <div className="flex gap-2 pt-1">
              <button type="submit" className={btnPrimary + ' flex-1'}>確認異動</button>
              <button type="button" onClick={() => setModal(null)} className={btnSecondary}>取消</button>
            </div>
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
