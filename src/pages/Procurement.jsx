import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import ExcelJS from 'exceljs'
import { Plus, Trash2, Edit2, AlertTriangle, Package, X, Sparkles, Copy, Check, Calendar, Upload, Download, Search } from 'lucide-react'
import { Modal, Badge, SectionCard, FormRow, inputCls, btnPrimary, btnSecondary, btnDanger } from '../components/ui'
import { fmt, fmtPrice } from '../utils/format'
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
  const barcodeRef    = useRef(null)
  const itemNameRef   = useRef(null)
  const currentQtyRef = useRef(null)
  const isAB = editTarget?.category === 'A用品' || editTarget?.category === 'B食品'

  // Modal 開啟時自動 focus：A/B 類先跳到條碼，其他跳到品項名稱
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAB && barcodeRef.current) barcodeRef.current.focus()
      else if (itemNameRef.current) itemNameRef.current.focus()
    }, 80)
    return () => clearTimeout(timer)
  }, [])

  // 條碼 Enter → 跳到品項名稱
  function handleBarcodeEnter(e) {
    if (e.key === 'Enter') { e.preventDefault(); itemNameRef.current?.focus() }
  }

  // 品項名稱 Enter → 跳到現有數量
  function handleItemNameEnter(e) {
    if (e.key === 'Enter') { e.preventDefault(); currentQtyRef.current?.focus() }
  }

  // 生產日期變更：自動計算到期日
  function handleProdDateChange(val) {
    setEditForm(p => ({
      ...p,
      prodDate:     val,
      shelfExpiry:  addDays(val, p.shelfDays),
      fridgeExpiry: addDays(val, p.fridgeDays),
      frozenExpiry: addDays(val, p.frozenDays),
    }))
  }

  // 保存天數變更：若已有生產日期，即時重新計算到期日
  function handleDaysChange(field, val) {
    setEditForm(p => {
      const next = { ...p, [field]: val }
      if (p.prodDate) {
        next.shelfExpiry  = addDays(p.prodDate, field === 'shelfDays'  ? val : p.shelfDays)
        next.fridgeExpiry = addDays(p.prodDate, field === 'fridgeDays' ? val : p.fridgeDays)
        next.frozenExpiry = addDays(p.prodDate, field === 'frozenDays' ? val : p.frozenDays)
      }
      return next
    })
  }

  return (
    <Modal title="編輯品項" size="md" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        {isAB && (
          <>
          <FormRow label="📷 國際條碼（選填，支援掃描槍）">
            <input ref={barcodeRef} type="text" className={inputCls}
              placeholder="例：4710123456789，掃描完成後自動跳轉"
              value={editForm.barcode}
              onChange={e => setEditForm(p => ({ ...p, barcode: e.target.value }))}
              onKeyDown={handleBarcodeEnter} />
          </FormRow>
          <FormRow label="📄 商品貨號（選填）">
            <input type="text" className={inputCls}
              placeholder="例：SKU-001"
              value={editForm.sku || ''}
              onChange={e => setEditForm(p => ({ ...p, sku: e.target.value }))} />
          </FormRow>
          </>
        )}
        <FormRow label="品項名稱">
          <input ref={itemNameRef} type="text" className={inputCls}
            value={editForm.itemName}
            onChange={e => setEditForm(p => ({ ...p, itemName: e.target.value }))}
            onKeyDown={handleItemNameEnter} required />
        </FormRow>
        <FormRow label="供應商">
          <input type="text" className={inputCls} placeholder="選填" value={editForm.supplier}
            onChange={e => setEditForm(p => ({ ...p, supplier: e.target.value }))} />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="現有數量">
            <input ref={currentQtyRef} type="number" min="0"
              step={editTarget?.category === 'C食材' ? '0.1' : '1'}
              className={inputCls} value={editForm.currentQty}
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
                  onChange={e => handleDaysChange('shelfDays', e.target.value)} />
              </FormRow>
              <FormRow label="冷藏（天）">
                <input type="number" min="0" className={inputCls} placeholder="例：180"
                  value={editForm.fridgeDays ?? ''}
                  onChange={e => handleDaysChange('fridgeDays', e.target.value)} />
              </FormRow>
              <FormRow label="冷凍（天）">
                <input type="number" min="0" className={inputCls} placeholder="例：365"
                  value={editForm.frozenDays ?? ''}
                  onChange={e => handleDaysChange('frozenDays', e.target.value)} />
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
  const { inventory, addPurchase, addInventoryItem, addInventoryItems, updateInventoryItem, deleteInventoryItem, revenues = [], inventoryLogs = [], adjustInventory, importInventoryItems, suppliers = [], addExpense } = data

  const [activeTab,    setActiveTab]    = useState('A用品')
  const [modal,        setModal]        = useState(null)
  const [editTarget,   setEditTarget]   = useState(null)
  const [importMsg,    setImportMsg]    = useState('')
  const [purchaseForm, setPurchaseForm] = useState({
    date: today(), itemId: '', itemName: '', category: 'C食材', qty: '', unitPrice: '', note: '', supplierId: '', supplierName: '', recordExpense: true,
  })
  const [addCategory,      setAddCategory]      = useState('A用品')
  const [addRecordExpense, setAddRecordExpense] = useState(false)
  const [rows, setRows] = useState([emptyRow()])
  const [editForm, setEditForm] = useState({})
  const [adjustForm, setAdjustForm] = useState({ change: '', reason: '' })
  const [logPage, setLogPage] = useState(1)
  const [logItem, setLogItem] = useState(null) // 點選查看異動紀錄的品項
  const LOG_PAGE_SIZE = 15
  const xlsxRef = useRef()
  // A/B：定價/售價/成本；C/D：單價/總價
  const isAB = activeTab === 'A用品' || activeTab === 'B食品'
  const isCD = activeTab === 'C食材' || activeTab === 'D包材'

  function addRow()       { setRows(r => [...r, emptyRow()]) }
  function removeRow(key) { setRows(r => r.length > 1 ? r.filter(x => x._key !== key) : r) }
  function updateRow(key, field, val) { setRows(r => r.map(x => x._key === key ? { ...x, [field]: val } : x)) }

  function openAdd() { setAddCategory(activeTab); setRows([emptyRow()]); setAddRecordExpense(false); setModal('add') }

  function submitAdd(e) {
    e.preventDefault()
    const validRows = rows.filter(row => row.itemName.trim())
    addInventoryItems(validRows.map(row => ({
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
    })))
    if (addRecordExpense && addExpense) {
      const isABCat = addCategory === 'A用品' || addCategory === 'B食品'
      const total = validRows.reduce((s, row) => {
        const qty   = parseFloat(row.currentQty) || 0
        const price = isABCat ? (parseFloat(row.cost) || 0) : (parseFloat(row.unitPrice) || 0)
        return s + qty * price
      }, 0)
      if (total > 0) {
        const names = validRows.map(r => r.itemName.trim()).join('、')
        addExpense({
          date:             today(),
          type:             '進貨',
          note:             names,
          amount:           total,
          isProductionCost: addCategory === 'C食材',
          supplierId:       null,
          customSupplierName: '',
          supplierName:     '',
        })
      }
    }
    setModal(null)
  }

  function openEdit(item) {
    setEditTarget(item)
    setEditForm({
      ...item,
      supplier:   item.supplier   || '',
      barcode:    item.barcode    || '',
      sku:        item.sku        || '',
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
      sku:        editForm.sku?.trim()    || '',
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
    setPurchaseForm({
      date: today(), itemId: item.id, itemName: item.itemName, category: item.category,
      qty: '', unitPrice: '', note: '', supplierId: '', supplierName: '',
      recordExpense: true,
      // 效期欄位（僅 B食品使用）
      prodDate: '', shelfExpiry: '', fridgeExpiry: '', frozenExpiry: '',
      // 帶入品項已設定的標準保存天數
      shelfDays: item.shelfDays ?? '', fridgeDays: item.fridgeDays ?? '', frozenDays: item.frozenDays ?? '',
    })
    setModal('purchase')
  }

  function openAdjust(item) {
    setEditTarget(item)
    setAdjustForm({ change: '', reason: '' })
    setModal('adjust')
  }

  function submitAdjust(e) {
    e.preventDefault()
    const change = parseFloat(adjustForm.change)
    if (isNaN(change) || change === 0) return
    adjustInventory(editTarget.id, editTarget.itemName, change, adjustForm.reason || '庫存盤點')
    setModal(null)
  }

  function submitPurchase(e) {
    e.preventDefault()
    const hasExpiry = purchaseForm.category === 'B食品' && purchaseForm.prodDate
    addPurchase({
      ...purchaseForm,
      qty:       parseFloat(purchaseForm.qty),
      unitPrice: parseFloat(purchaseForm.unitPrice),
      expiryBatch: hasExpiry ? {
        prodDate:     purchaseForm.prodDate,
        shelfExpiry:  purchaseForm.shelfExpiry  || null,
        fridgeExpiry: purchaseForm.fridgeExpiry || null,
        frozenExpiry: purchaseForm.frozenExpiry || null,
      } : null,
    })
    setModal(null)
  }

  // 匯出盤點表格
  async function exportStockCheck() {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('盤點表')
    ws.columns = [
      { header: '分類',     key: 'cat',      width: 10 },
      { header: '品項名稱', key: 'itemName', width: 18 },
      { header: '條碼',     key: 'barcode',  width: 16 },
      { header: '系統庫存', key: 'qty',      width: 10 },
      { header: '單位',     key: 'unit',     width: 6  },
      { header: '實盤數量', key: 'actual',   width: 10 },
      { header: '差異',     key: 'diff',     width: 8  },
      { header: '備註',     key: 'note',     width: 16 },
    ]
    inventory
      .filter(i => i.category === 'A用品' || i.category === 'B食品')
      .forEach(i => ws.addRow({ cat: i.category, itemName: i.itemName, barcode: i.barcode || '', qty: i.currentQty, unit: i.unit, actual: '', diff: '', note: '' }))
    const buf = await wb.xlsx.writeBuffer()
    const date = new Date().toISOString().slice(0, 10)
    triggerDownload(buf, `庫存盤點表_${date}.xlsx`)
  }

  // 下載範本 Excel
  async function downloadTemplate() {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('庫存')
    ws.columns = [
      { header: '分類(A用品/B食品/C食材/D包材)', key: 'cat',       width: 16 },
      { header: '品項名稱',                      key: 'itemName',  width: 16 },
      { header: '貨號',                          key: 'sku',       width: 10 },
      { header: '現有數量',                      key: 'qty',       width: 10 },
      { header: '安全水位',                      key: 'safety',    width: 10 },
      { header: '單位',                          key: 'unit',      width: 6  },
      { header: '供應商',                        key: 'supplier',  width: 14 },
      { header: '條碼',                          key: 'barcode',   width: 16 },
      { header: '定價',                          key: 'listPrice', width: 8  },
      { header: '售價',                          key: 'salePrice', width: 8  },
      { header: '成本',                          key: 'cost',      width: 8  },
      { header: '單價',                          key: 'unitPrice', width: 8  },
    ]
    ws.addRow({ cat: 'A用品', itemName: '範例用品', sku: 'SKU-001', qty: 100, safety: 20, unit: '個', supplier: '供應商A', barcode: '4710000000001', listPrice: 299, salePrice: 249, cost: 80, unitPrice: '' })
    ws.addRow({ cat: 'B食品', itemName: '範例食品', sku: 'SKU-002', qty: 50,  safety: 10, unit: '包', supplier: '供應商B', barcode: '4710000000002', listPrice: 199, salePrice: 159, cost: 60, unitPrice: '' })
    ws.addRow({ cat: 'C食材', itemName: '範例食材', sku: '',        qty: 30,  safety: 5,  unit: 'kg', supplier: '供應商C', barcode: '',             listPrice: '',  salePrice: '',  cost: '',  unitPrice: 280 })
    ws.addRow({ cat: 'D包材', itemName: '範例包材', sku: '',        qty: 500, safety: 100,unit: '個', supplier: '供應商D', barcode: '',             listPrice: '',  salePrice: '',  cost: '',  unitPrice: 3.5 })
    const buf = await wb.xlsx.writeBuffer()
    triggerDownload(buf, '庫存匹入範本.xlsx')
  }

  // 觸發瀏覽器下載
  function triggerDownload(buffer, filename) {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  // 匹入 Excel
  async function handleImportExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    const ALLOWED_TYPES = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ]
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
      setImportMsg('❌ 僅支援 .xlsx 或 .xls 格式的 Excel 檔案')
      setTimeout(() => setImportMsg(''), 5000)
      e.target.value = ''
      return
    }
    const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
    if (file.size > MAX_FILE_SIZE) {
      setImportMsg('❌ 檔案大小不可超過 5MB')
      setTimeout(() => setImportMsg(''), 5000)
      e.target.value = ''
      return
    }
    try {
      const buf = await file.arrayBuffer()
      // 驗證 XLSX 檔案魔術字節 (PK header)
      const header = new Uint8Array(buf.slice(0, 4))
      const isPK = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04
      if (!isPK) {
        setImportMsg('❌ 檔案格式不正確，請使用正確的 Excel 檔案')
        setTimeout(() => setImportMsg(''), 5000)
        e.target.value = ''
        return
      }
      const wb  = new ExcelJS.Workbook()
      await wb.xlsx.load(buf)
      if (!wb.worksheets || wb.worksheets.length === 0) {
        setImportMsg('❌ Excel 檔案中找不到工作表')
        setTimeout(() => setImportMsg(''), 5000)
        e.target.value = ''
        return
      }
      const ws  = wb.worksheets[0]
      const headers = ws.getRow(1).values.slice(1) // index 0 是空的
      const VALID_CATS = ['A用品', 'B食品', 'C食材', 'D包材']
      const items = []
      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return
        const r = {}
        headers.forEach((h, i) => { r[h] = row.getCell(i + 1).value ?? '' })
        if (!VALID_CATS.includes(r['分類(A用品/B食品/C食材/D包材)']) || !r['品項名稱']) return
        items.push({
          category:   r['分類(A用品/B食品/C食材/D包材)'],
          itemName:   String(r['品項名稱']).trim(),
          currentQty: parseFloat(r['現有數量'])  || 0,
          safetyQty:  parseFloat(r['安全水位'])  || 0,
          unit:       String(r['單位'] || '個').trim(),
          supplier:   String(r['供應商'] || '').trim(),
          barcode:    String(r['條碼']   || '').trim(),
          sku:        String(r['貨號']   || '').trim(),
          listPrice:  parseFloat(r['定價'])    || 0,
          salePrice:  parseFloat(r['售價'])    || 0,
          cost:       parseFloat(r['成本'])    || 0,
          unitPrice:  parseFloat(r['單價'])    || 0,
        })
      })
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
    e.target.value = ''
  }

  const handleFileClick = useCallback(() => xlsxRef.current.click(), [])

  const purchaseSuppliers = useMemo(
    () => suppliers.filter(s => s.category !== '寄賣點'),
    [suppliers]
  )

  const [searchQuery, setSearchQuery] = useState('')

  const [sortAZ, setSortAZ] = useState(false);

  const filtered = useMemo(() => {
    const base = inventory.filter(i => i.category === activeTab)
    const q = searchQuery.trim().toLowerCase()
    const result = !q ? base : base.filter(i =>
      i.itemName?.toLowerCase().includes(q) ||
      i.sku?.toLowerCase().includes(q) ||
      i.supplier?.toLowerCase().includes(q) ||
      i.barcode?.toLowerCase().includes(q)
    )
    if (sortAZ) return [...result].sort((a, b) => (a.itemName || '').localeCompare(b.itemName || '', 'zh-Hant'))
    return result
  }, [inventory, activeTab, searchQuery, sortAZ])

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
          <button onClick={handleFileClick}
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

      {/* Tab + 搜尋 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => { setActiveTab(cat); setSearchQuery('') }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors
                ${activeTab === cat ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜尋品項、貨號、供應商…"
            className={inputCls + ' pl-8 text-sm'}
          />
        </div>
        <button
          onClick={() => setSortAZ(v => !v)}
          className={`flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-xl border transition-colors ${
            sortAZ
              ? 'bg-blue-50 border-blue-200 text-blue-600'
              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}>
          A→Z
        </button>
      </div>

      {/* 表格 */}
      <SectionCard title={CAT_LABEL[activeTab]}>
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-sm" style={{ minWidth: isAB ? '860px' : '700px' }}>
            <thead>
              <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                <th className="pb-3 text-left">品項名稱</th>
                <th className="pb-3 text-left">貨號</th>
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
                    onClick={() => setLogItem(item)}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${item.currentQty < item.safetyQty ? 'bg-red-50/40' : ''}`}>
                    <td className="py-3 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        {item.currentQty < item.safetyQty && <AlertTriangle size={13} className="text-red-500 shrink-0" />}
                        {item.itemName}
                      </div>
                    </td>
                    <td className="py-3 text-xs text-gray-500">{item.sku || '—'}</td>
                    <td className="py-3 text-gray-500 text-xs">{item.supplier || '—'}</td>
                    <td className={`py-3 text-right font-bold ${item.currentQty < item.safetyQty ? 'text-red-600' : 'text-gray-800'}`}>
                      {item.category === 'C食材'
                        ? (Math.round(item.currentQty * 10) / 10).toFixed(1)
                        : item.currentQty}
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
                        <td className="py-3 text-right text-gray-600">{item.unitPrice ? fmtPrice(item.unitPrice) : '—'}</td>
                        <td className="py-3 text-right font-semibold text-emerald-600">
                          {item.unitPrice ? fmtPrice(Math.ceil((item.unitPrice || 0) * item.currentQty * 100) / 100) : '—'}
                        </td>
                      </>
                    )}
                    <td className="py-3 text-center"><Badge color={status.color}>{status.label}</Badge></td>
                    <td className="py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={e => { e.stopPropagation(); openPurchase(item) }}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                          <Package size={12} /> 進貨
                        </button>
                        {(item.category === 'A用品' || item.category === 'B食品') && (
                          <button onClick={e => { e.stopPropagation(); openAdjust(item) }}
                            className="bg-orange-50 hover:bg-orange-100 text-orange-600 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                            盤點
                          </button>
                        )}
                        {item.category === 'B食品' && (
                          <button onClick={e => { e.stopPropagation(); setEditTarget(item); setModal('expiry') }}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                            <Calendar size={12} /> 效期
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); openEdit(item) }}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-600 p-1.5 rounded-lg transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); deleteInventoryItem(item.id) }} className={btnDanger}>
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
                {fmtPrice(filtered.reduce((s, i) => Math.ceil((s + (i.unitPrice || 0) * i.currentQty) * 100) / 100, 0))}
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
                      <input list="add-supplier-options" placeholder="選填" className={inputCls + ' text-xs'} value={row.supplier}
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
                      <input type="number" min="0" step={addCategory === 'C食材' ? '0.1' : '1'} placeholder="0" className={inputCls + ' text-xs text-right'} value={row.currentQty}
                        onChange={e => updateRow(row._key, 'currentQty', e.target.value)} />
                      <input type="number" min="0" placeholder="0" className={inputCls + ' text-xs text-right'} value={row.safetyQty}
                        onChange={e => updateRow(row._key, 'safetyQty', e.target.value)} />
                      <input type="text" placeholder="個" className={inputCls + ' text-xs text-center'} value={row.unit}
                        onChange={e => updateRow(row._key, 'unit', e.target.value)} />
                      <input list="add-supplier-options" placeholder="選填" className={inputCls + ' text-xs'} value={row.supplier}
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

            <datalist id="add-supplier-options">
              {suppliers.map(s => <option key={s.id} value={s.name} />)}
            </datalist>

            {/* 記入支出 */}
            {(() => {
              const isABCat = addCategory === 'A用品' || addCategory === 'B食品'
              const total = rows.filter(r => r.itemName.trim()).reduce((s, row) => {
                const qty   = parseFloat(row.currentQty) || 0
                const price = isABCat ? (parseFloat(row.cost) || 0) : (parseFloat(row.unitPrice) || 0)
                return s + qty * price
              }, 0)
              return (
                <label className="flex items-center justify-between gap-2 text-sm text-gray-600 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={addRecordExpense}
                      onChange={e => setAddRecordExpense(e.target.checked)}
                      className="accent-orange-400" />
                    記入支出（類型：進貨）
                  </div>
                  {total > 0 && (
                    <span className="text-xs font-semibold text-orange-600">
                      總計 {fmt(total)}
                    </span>
                  )}
                </label>
              )
            })()}

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
                    const shelfExp  = (b.normalExp  || b.shelfExpiry)  ? new Date(b.normalExp  || b.shelfExpiry)  : null
                    const fridgeExp = (b.fridgeExp  || b.fridgeExpiry) ? new Date(b.fridgeExp  || b.fridgeExpiry) : null
                    const frozenExp = (b.freezerExp || b.frozenExpiry) ? new Date(b.freezerExp || b.frozenExpiry) : null
                    const shelfStr  = b.normalExp  || b.shelfExpiry  || null
                    const fridgeStr = b.fridgeExp  || b.fridgeExpiry || null
                    const frozenStr = b.freezerExp || b.frozenExpiry || null
                    const isExpired = shelfExp && shelfExp < now
                    return (
                      <div key={i} className={`rounded-xl px-4 py-3 border text-sm ${isExpired ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-gray-800">{b.batchNote || `批次 ${i + 1}`}</span>
                          <span className="text-xs text-gray-400">{b.productionDate}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs">
                          {b.qty && <span className="text-gray-600">數量：{b.qty} 包</span>}
                          {shelfExp  && <span className={shelfExp  < now ? 'text-red-500 font-bold' : 'text-gray-500'}>常溫到期：{shelfStr}</span>}
                          {fridgeExp && <span className={fridgeExp < now ? 'text-red-500 font-bold' : 'text-blue-500'}>冷藏到期：{fridgeStr}</span>}
                          {frozenExp && <span className={frozenExp < now ? 'text-red-500 font-bold' : 'text-indigo-500'}>冷凍到期：{frozenStr}</span>}
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
            if (logs.length === 0) return <p className="text-sm text-gray-400 text-center py-6">尚無異動紀錄</p>
            const totalPages = Math.ceil(logs.length / LOG_PAGE_SIZE)
            const pageLogs = logs.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE)
            return (
              <>
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
                      {pageLogs.map(l => (
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
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400">共 {logs.length} 筆，第 {logPage} / {totalPages} 頁</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setLogPage(p => Math.max(1, p - 1))}
                        disabled={logPage === 1}
                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                        上一頁
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setLogPage(p)}
                          className={`w-8 h-8 text-xs rounded-lg border transition-colors ${
                            p === logPage ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 hover:bg-gray-50'
                          }`}>
                          {p}
                        </button>
                      ))}
                      <button
                        onClick={() => setLogPage(p => Math.min(totalPages, p + 1))}
                        disabled={logPage === totalPages}
                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                        下一頁
                      </button>
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </SectionCard>
      )}

      {/* ── 品項異動紀錄 Modal ── */}
      {logItem && (
        <Modal title={`${logItem.itemName} — 異動紀錄`} size="md" onClose={() => setLogItem(null)}>
          {(() => {
            const logs = inventoryLogs
              .filter(l => l.itemId === logItem.id)
              .sort((a, b) => b.date.localeCompare(a.date))
            if (logs.length === 0) return <p className="text-sm text-gray-400 text-center py-8">尚無異動紀錄</p>
            return (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {logs.map(l => (
                  <div key={l.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 text-sm">
                    <div>
                      <span className="text-gray-400 text-xs">{l.date}</span>
                      <p className="text-gray-500 text-xs mt-0.5">{l.reason}</p>
                    </div>
                    <span className={`font-bold text-base ${l.change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {l.change > 0 ? `+${l.change}` : l.change}
                    </span>
                  </div>
                ))}
              </div>
            )
          })()}
          <button onClick={() => setLogItem(null)} className={btnSecondary + ' w-full mt-4'}>關閉</button>
        </Modal>
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
                  step={editTarget?.category === 'C食材' ? '0.1' : '1'}
                  className={inputCls + ' flex-1'}
                  placeholder={editTarget?.category === 'C食材' ? '增加輸正數，減少輸負數（如 -1.5）' : '增加輸正數，減少輸負數（如 -3）'}
                  value={adjustForm.change}
                  onChange={e => setAdjustForm(p => ({ ...p, change: e.target.value }))}
                  required
                />
              </div>
              {adjustForm.change && !isNaN(parseFloat(adjustForm.change)) && (
                <p className="text-xs mt-1.5">
                  <span className="text-gray-400">異動後庫存：</span>
                  <span className={`font-bold ml-1 ${Math.max(0, editTarget.currentQty + parseFloat(adjustForm.change)) < editTarget.safetyQty ? 'text-red-500' : 'text-emerald-600'}`}>
                    {(Math.round(Math.max(0, editTarget.currentQty + parseFloat(adjustForm.change)) * 10) / 10).toFixed(
                      editTarget.category === 'C食材' ? 1 : 0
                    )} {editTarget.unit}
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
              <input type="number"
                min="0.1"
                step={purchaseForm.category === 'C食材' ? '0.1' : '1'}
                className={inputCls} placeholder="0" value={purchaseForm.qty}
                onChange={e => setPurchaseForm(p => ({ ...p, qty: e.target.value }))} required />
            </FormRow>
            <FormRow label="進貨單價（元）">
              <input type="number" min="0" step="0.01" className={inputCls} placeholder="0" value={purchaseForm.unitPrice}
                onChange={e => setPurchaseForm(p => ({ ...p, unitPrice: e.target.value }))} required />
            </FormRow>
            <FormRow label="來源廠商">
              <select
                className={inputCls}
                value={purchaseForm.supplierId}
                onChange={e => {
                  const s = purchaseSuppliers.find(x => x.id === e.target.value)
                  setPurchaseForm(p => ({ ...p, supplierId: e.target.value, supplierName: s?.name || '' }))
                }}
              >
                <option value="">— 不指定 —</option>
                {purchaseSuppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}（{s.category}）</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="備註">
              <input type="text" className={inputCls} placeholder="選填" value={purchaseForm.note}
                onChange={e => setPurchaseForm(p => ({ ...p, note: e.target.value }))} />
            </FormRow>
            <label className="flex items-center gap-2 text-sm text-gray-600 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={purchaseForm.recordExpense}
                onChange={e => setPurchaseForm(p => ({ ...p, recordExpense: e.target.checked }))}
                className="accent-orange-400 w-4 h-4" />
              <span>同時記入支出項目（類型：進貨）</span>
              {purchaseForm.recordExpense && purchaseForm.qty && purchaseForm.unitPrice && (
                <span className="ml-auto text-xs font-semibold text-orange-600">
                  {fmt(parseFloat(purchaseForm.qty) * parseFloat(purchaseForm.unitPrice))}
                </span>
              )}
            </label>
            {purchaseForm.category === 'B食品' && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-3">
                <p className="text-xs font-semibold text-blue-700">📅 此批次效期（選填）</p>
                <FormRow label="生產日期">
                  <input type="date" className={inputCls}
                    value={purchaseForm.prodDate}
                    onChange={e => {
                      const val = e.target.value
                      setPurchaseForm(p => ({
                        ...p,
                        prodDate:     val,
                        shelfExpiry:  addDays(val, p.shelfDays),
                        fridgeExpiry: addDays(val, p.fridgeDays),
                        frozenExpiry: addDays(val, p.frozenDays),
                      }))
                    }} />
                </FormRow>
                {purchaseForm.prodDate && (
                  <div className="grid grid-cols-3 gap-2">
                    <FormRow label="常溫到期">
                      <input type="date" className={inputCls}
                        value={purchaseForm.shelfExpiry}
                        onChange={e => setPurchaseForm(p => ({ ...p, shelfExpiry: e.target.value }))} />
                    </FormRow>
                    <FormRow label="冷藏到期">
                      <input type="date" className={inputCls}
                        value={purchaseForm.fridgeExpiry}
                        onChange={e => setPurchaseForm(p => ({ ...p, fridgeExpiry: e.target.value }))} />
                    </FormRow>
                    <FormRow label="冷凍到期">
                      <input type="date" className={inputCls}
                        value={purchaseForm.frozenExpiry}
                        onChange={e => setPurchaseForm(p => ({ ...p, frozenExpiry: e.target.value }))} />
                    </FormRow>
                  </div>
                )}
              </div>
            )}
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
