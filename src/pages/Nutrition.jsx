import { useState, useMemo } from 'react'
import { Plus, Trash2, Save, BookOpen, ChevronDown, ChevronUp, Calculator } from 'lucide-react'
import { SectionCard, inputCls, btnPrimary, btnSecondary, btnDanger } from '../components/ui'

const BRAND_DARK = '#722927'
const DRY_LABELS = {
  before: '烘乾前重量 (g)',
  after:  '烘乾後重量 (g)',
}
const uid = () => Math.random().toString(36).slice(2, 8)

// 空白食材列
const emptyIngredient = () => ({
  _key: uid(), name: '', amount: '',
  protein: '', fat: '', satFat: '', transFat: '',
  carb: '', sugar: '', fiber: '', moisture: '', ash: '', sodium: '',
  fatModifier: false, fatModPct: 50,
})

// 小數欄位輸入
function N({ value, onChange, placeholder = '0' }) {
  return (
    <input type="number" min="0" step="0.01" placeholder={placeholder}
      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-orange-300 transition"
      value={value}
      onChange={e => onChange(e.target.value)} />
  )
}

export default function Nutrition({ data }) {
  const { savedFormulas, saveFormula, deleteFormula, ingredientLibrary = [], addIngredient, updateIngredient, deleteIngredient } = data

  const [mode,        setMode]        = useState('general')
  const [formulaName, setFormulaName] = useState('')
  const [showSaved,   setShowSaved]   = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [libForm,     setLibForm]     = useState(null)
  const [fiberConvert, setFiberConvert] = useState(false)
  const emptyLibForm = () => ({
    name: '',
    protein: '', fat: '', fiber: '', moisture: '', ash: '',
    satFat: '', transFat: '', carb: '', sugar: '', sodium: '',
  })

  // ── 烘乾換算器 ─────────────────────────────────────────────────
  const [dryBefore,  setDryBefore]  = useState('')
  const [dryAfter,   setDryAfter]   = useState('')

  const dryCalc = useMemo(() => {
    const before = parseFloat(dryBefore)
    const after  = parseFloat(dryAfter)
    if (!before || !after || after >= before) return null
    const lossRatio  = (before - after) / before
    const concFactor = before / after
    return {
      lossRatio:   Math.round(lossRatio * 1000) / 10,
      concFactor:  Math.round(concFactor * 100) / 100,
      adjust: (v) => Math.min(100, Math.round(v * concFactor * 100) / 100),
    }
  }, [dryBefore, dryAfter])

  // 食材列表
  const [ingredients, setIngredients] = useState([emptyIngredient()])

  // 計算結果（點「計算」後才更新）
  const [result, setResult] = useState(null)

  // ── 食材庫操作 ───────────────────────────────────────────
  function addFromLibrary(item) {
    const newRow = {
      ...emptyIngredient(),
      name: item.name,
      protein: item.protein, fat: item.fat,
      fiber: item.fiber, moisture: item.moisture, ash: item.ash,
      satFat: item.satFat || '', transFat: item.transFat || '',
      carb: item.carb || '', sugar: item.sugar || '', sodium: item.sodium || '',
    }
    setIngredients(prev => {
      const last = prev[prev.length - 1]
      const isEmpty = !last.name && !last.amount && !last.protein
      return isEmpty ? [...prev.slice(0, -1), newRow] : [...prev, newRow]
    })
  }
  function saveLibForm() {
    if (!libForm?.name?.trim()) return
    if (libForm.id) { updateIngredient(libForm.id, libForm) } else { addIngredient(libForm) }
    setLibForm(null)
  }

  // ── 食材操作 ─────────────────────────────────────────────
  function addRow() { setIngredients(p => [...p, emptyIngredient()]) }
  function removeRow(key) { setIngredients(p => p.length > 1 ? p.filter(r => r._key !== key) : p) }
  function updateRow(key, field, val) {
    setIngredients(p => p.map(r => r._key === key ? { ...r, [field]: val } : r))
  }

  // ── 加總所有食材（考慮去脂） ─────────────────────────────
  // 依實際使用量加權：標示值為每100g含量，實際 = 標示 × (amount/100)
  function sumField(field) {
    return ingredients.reduce((s, r) => {
      const v      = parseFloat(r[field])  || 0
      const amount = parseFloat(r.amount)  || 0
      const scale  = amount / 100
      let actual   = v * scale
      if (field === 'fat') {
        actual = r.fatModifier ? actual * (1 - (parseFloat(r.fatModPct) || 50) / 100) : actual
      }
      if ((field === 'satFat' || field === 'transFat') && r.fatModifier) {
        actual = actual * (1 - (parseFloat(r.fatModPct) || 50) / 100)
      }
      return s + actual
    }, 0)
  }

  // ── 計算 ─────────────────────────────────────────────────
  function handleCalculate() {
    if (mode === 'general') {
      const totalAmount = ingredients.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
      if (totalAmount === 0) return

      const protein  = sumField('protein')
      const fat      = sumField('fat')
      const satFat   = sumField('satFat')
      const transFat = sumField('transFat')
      const carb     = sumField('carb')
      const sugar    = sumField('sugar')
      const sodium   = sumField('sodium')
      const moistureG = sumField('moisture')
      const moisture  = moistureG / totalAmount * 100

      const calcCal  = protein * 4 + fat * 9 + carb * 4
      const calPer100g = totalAmount > 0 ? Math.round(calcCal / totalAmount * 100) : 0
      const proteinPct = protein / totalAmount * 100
      const fatPct     = fat     / totalAmount * 100
      const carbPct    = carb    / totalAmount * 100
      const dm = (pct) => moisture < 100 ? Math.round(pct / (100 - moisture) * 100 * 10) / 10 : 0
      // 每100g含量
      const p100 = (v) => Math.round(v / totalAmount * 100 * 100) / 100
      setResult({
        mode: 'general',
        protein:  p100(protein),
        fat:      p100(fat),
        satFat:   p100(satFat),
        transFat: p100(transFat),
        carb:     p100(carb),
        sugar:    p100(sugar),
        sodium:   p100(sodium),
        moisture: Math.round(moisture * 100) / 100,
        calcCal: Math.round(calcCal),
        calPer100g,
        dmProtein: dm(proteinPct),
        dmFat:     dm(fatPct),
        dmCarb:    dm(carbPct),
        totalAmount: Math.round(totalAmount),
      })
    } else {
      const totalAmount = ingredients.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
      if (totalAmount === 0) return

      // 絕對克數
      const proteinG  = sumField('protein')
      const fatG      = sumField('fat')
      const rawFiberG = sumField('fiber')
      const moistureG = sumField('moisture')
      const ashG      = sumField('ash')

      const fiberG = fiberConvert
        ? Math.round(rawFiberG * 0.6 * 1000) / 1000
        : rawFiberG

      // NFE（可利用碳水，纖維不計入熱量）
      const nfeG = Math.max(0, totalAmount - proteinG - fatG - fiberG - moistureG - ashG)

      // 絕對克數法計算總熱量
      const totalKcal = proteinG * 3.5 + fatG * 8.5 + nfeG * 3.5
      const calPer100g = totalAmount > 0 ? Math.round(totalKcal / totalAmount * 100) : 0
      const me = Math.round(totalKcal / totalAmount * 1000) // kcal/kg

      // 換算成百分比（用於保證分析顯示）
      const protein  = proteinG  / totalAmount * 100
      const fat      = fatG      / totalAmount * 100
      const rawFiber = rawFiberG / totalAmount * 100
      const fiber    = fiberG    / totalAmount * 100
      const moisture = moistureG / totalAmount * 100
      const ash      = ashG      / totalAmount * 100
      const carb     = nfeG      / totalAmount * 100

      const dm = (v) => moisture < 100 ? Math.round(v / (100 - moisture) * 100 * 10) / 10 : 0

      setResult({
        mode: 'aafco',
        protein:   Math.round(protein * 100) / 100,
        fat:       Math.round(fat * 100) / 100,
        fiber:     Math.round(fiber * 100) / 100,
        rawFiber:  Math.round(rawFiber * 100) / 100,
        moisture:  Math.round(moisture * 100) / 100,
        ash:       Math.round(ash * 100) / 100,
        carb:      Math.round(carb * 100) / 100,
        // 絕對克數（供烘乾後熱量計算用）
        proteinG:  Math.round(proteinG * 1000) / 1000,
        fatG:      Math.round(fatG * 1000) / 1000,
        nfeG:      Math.round(nfeG * 1000) / 1000,
        totalAmount,
        me, calPer100g,
        dmProtein: dm(protein),
        dmFat:     dm(fat),
        dmFiber:   dm(fiber),
        dmCarb:    dm(carb),
      })
    }
  }

  // ── 儲存配方 ─────────────────────────────────────────────
  function handleSave() {
    if (!formulaName.trim() || !result) return
    const dryData = dryCalc && dryBefore && dryAfter
      ? { dryBefore, dryAfter, concFactor: dryCalc.concFactor, lossRatio: dryCalc.lossRatio }
      : null
    saveFormula(formulaName.trim(), mode, ingredients, { ...result, dryData })
    setFormulaName('')
  }

  function loadFormula(f) {
    setMode(f.mode)
    setIngredients(f.inputs)
    setResult(f.results)
    if (f.results?.dryData) {
      setDryBefore(f.results.dryData.dryBefore)
      setDryAfter(f.results.dryData.dryAfter)
    } else {
      setDryBefore('')
      setDryAfter('')
    }
    setShowSaved(false)
  }

  // 一般模式欄位定義
  const generalCols = [
    { key: 'protein',  label: '蛋白質(g)' },
    { key: 'fat',      label: '脂肪(g)' },
    { key: 'satFat',   label: '飽和脂肪(g)' },
    { key: 'transFat', label: '反式脂肪(g)' },
    { key: 'carb',     label: '碳水(g)' },
    { key: 'sugar',    label: '糖(g)' },
    { key: 'sodium',   label: '鈉(mg)' },
    { key: 'moisture', label: '水分(%)' },
  ]

  // AAFCO 模式欄位定義
  const aafcoCols = [
    { key: 'protein',  label: '粗蛋白(g/100g)' },
    { key: 'fat',      label: '粗脂肪(g/100g)' },
    { key: 'fiber',    label: fiberConvert ? '總膳食纖維(g/100g)' : '粗纖維(g/100g)' },
    { key: 'moisture', label: '水分(g/100g)' },
    { key: 'ash',      label: '灰分(g/100g)' },
  ]

  const cols = mode === 'general' ? generalCols : aafcoCols

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* 頁首 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">🧪 營養計算室</h1>
          <p className="text-sm text-gray-400 mt-0.5">一般營養標示 · AAFCO 寵物食品規範</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowSaved(v => !v)}
            className={btnSecondary + ' flex items-center gap-2 text-sm'}>
            <BookOpen size={15} />
            已儲存配方（{savedFormulas.length}）
            {showSaved ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={() => setShowLibrary(v => !v)}
            className={btnSecondary + ' flex items-center gap-2 text-sm'}>
            🦴 食材庫（{ingredientLibrary.length}）
            {showLibrary ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* 食材庫 */}
      {showLibrary && (
        <SectionCard title="🦴 常用食材庫">
          <div className="space-y-2">
            {ingredientLibrary.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                  <div className="flex flex-wrap gap-x-3 mt-0.5">
                    <span className="text-xs text-gray-400">蛋白 {item.protein||'—'} 脂肪 {item.fat||'—'} 纖維 {item.fiber||'—'} 水分 {item.moisture||'—'} 灰分 {item.ash||'—'}</span>
                    {(item.carb || item.sugar || item.sodium || item.satFat || item.transFat) && (
                      <span className="text-xs text-blue-400">碳水 {item.carb||'—'} 糖 {item.sugar||'—'} 鈉 {item.sodium||'—'} 飽和脂 {item.satFat||'—'} 反式脂 {item.transFat||'—'}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => addFromLibrary(item)} className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-3 py-1.5 rounded-lg transition-colors">加入配方</button>
                  <button onClick={() => setLibForm({ ...item })} className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg transition-colors">編輯</button>
                  <button onClick={() => deleteIngredient(item.id)} className={btnDanger}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
            {ingredientLibrary.length === 0 && <p className="text-sm text-gray-400">尚無常用食材，點擊下方新增</p>}
            {libForm === null ? (
              <button onClick={() => setLibForm(emptyLibForm())}
                className="flex items-center gap-1 border-2 border-dashed border-gray-200 hover:border-orange-300 hover:text-orange-500 text-gray-400 rounded-xl px-4 py-2 text-sm font-medium transition-colors w-full justify-center">
                <Plus size={14} /> 新增食材
              </button>
            ) : (
              <div className="border border-orange-200 rounded-xl p-3 space-y-3 bg-orange-50/30">
                <input type="text" placeholder="食材名稱" value={libForm.name || ''}
                  onChange={e => setLibForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-300" />
                <p className="text-xs font-semibold text-gray-500">AAFCO / 寵物鮮食欄位</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[['protein','粗蛋白'],['fat','粗脂肪'],['fiber','纖維'],['moisture','水分'],['ash','灰分']].map(([key, label]) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 mb-1 block">{label} (g/100g)</label>
                      <input type="number" min="0" step="0.01" value={libForm[key] || ''}
                        onChange={e => setLibForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-300" />
                    </div>
                  ))}
                </div>
                <p className="text-xs font-semibold text-gray-500">一般營養標示欄位（選填）</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[['satFat','飽和脂肪(g)'],['transFat','反式脂肪(g)'],['carb','碳水(g)'],['sugar','糖(g)'],['sodium','鈉(mg)']].map(([key, label]) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                      <input type="number" min="0" step="0.01" value={libForm[key] || ''}
                        onChange={e => setLibForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-300" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={saveLibForm} className={btnPrimary + ' text-sm'}>儲存</button>
                  <button onClick={() => setLibForm(null)} className={btnSecondary + ' text-sm'}>取消</button>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* 已儲存配方 */}
      {showSaved && (
        <SectionCard title="已儲存配方">
          {savedFormulas.length === 0
            ? <p className="text-sm text-gray-400">尚無儲存配方</p>
            : (
              <div className="space-y-2">
                {savedFormulas.map(f => (
                  <div key={f.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                    <div>
                      <span className="text-sm font-semibold text-gray-800">{f.name}</span>
                      <span className="ml-2 text-xs text-gray-400">{f.mode === 'general' ? '一般' : 'AAFCO'}</span>
                      <span className="ml-2 text-xs text-gray-400">{f.savedAt?.slice(0, 10)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => loadFormula(f)}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg transition-colors">
                        載入
                      </button>
                      <button onClick={() => deleteFormula(f.id)} className={btnDanger}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </SectionCard>
      )}

      {/* 模式切換 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[['general', '一般營養'], ['aafco', '寵物 AAFCO']].map(([key, label]) => (
          <button key={key} onClick={() => { setMode(key); setResult(null) }}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors
              ${mode === key ? 'bg-white shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
            style={mode === key ? { color: BRAND_DARK } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 食材輸入區 ── */}
      <SectionCard title="🥩 食材輸入">
        <div className="space-y-3">

          {/* 修飾器選項 */}
          <div className="flex flex-wrap gap-4 pb-2 border-b border-gray-100">
            {mode === 'aafco' && (
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={fiberConvert}
                  onChange={e => setFiberConvert(e.target.checked)}
                  className="accent-orange-400" />
                纖維換算（衛福部總膳食纖維 × 0.6 → 粗纖維）
              </label>
            )}
          </div>

          {/* 欄位標題列 */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: mode === 'general' ? '900px' : '680px' }}>
              <thead>
                <tr className="text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="pb-2 text-left font-medium w-28">食材名稱</th>
                  <th className="pb-2 text-right font-medium px-1 w-20">使用量(g)</th>
                  {cols.map(c => (
                    <th key={c.key} className="pb-2 text-right font-medium px-1">{c.label}</th>
                  ))}
                  <th className="pb-2 text-center font-medium w-20">去脂處理</th>
                  <th className="pb-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ingredients.map((row, idx) => (
                  <tr key={row._key} className="hover:bg-gray-50/50">
                    {/* 食材名稱 */}
                    <td className="py-2 pr-2">
                      <input type="text" placeholder={`食材 ${idx + 1}`}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-300 transition"
                        value={row.name}
                        onChange={e => updateRow(row._key, 'name', e.target.value)} />
                    </td>
                    {/* 實際使用量 */}
                    <td className="py-2 px-1">
                      <div className="relative">
                        <N value={row.amount} onChange={v => updateRow(row._key, 'amount', v)} placeholder="g" />
                        {row.amount && (
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-orange-400 pointer-events-none">g</span>
                        )}
                      </div>
                    </td>
                    {/* 營養素欄位 */}
                    {cols.map(c => (
                      <td key={c.key} className="py-2 px-1">
                        <N value={row[c.key]} onChange={v => updateRow(row._key, c.key, v)} />
                      </td>
                    ))}
                    {/* 去脂處理 */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <input type="checkbox" checked={row.fatModifier}
                          onChange={e => updateRow(row._key, 'fatModifier', e.target.checked)}
                          className="accent-orange-400" />
                        {row.fatModifier && (
                          <div className="flex items-center gap-1">
                            <input type="number" min="1" max="99"
                              className="w-12 border border-gray-200 rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-300"
                              value={row.fatModPct}
                              onChange={e => updateRow(row._key, 'fatModPct', parseFloat(e.target.value) || 50)} />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        )}
                      </div>
                    </td>
                    {/* 刪除 */}
                    <td className="py-2 text-center">
                      <button onClick={() => removeRow(row._key)}
                        disabled={ingredients.length === 1}
                        className="text-gray-300 hover:text-red-400 disabled:opacity-20 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 新增食材 + 計算按鈕 */}
          <div className="flex gap-2 pt-1">
            <button onClick={addRow}
              className="flex items-center gap-1 border-2 border-dashed border-gray-200 hover:border-orange-300 hover:text-orange-500 text-gray-400 rounded-xl px-4 py-2 text-sm font-medium transition-colors">
              <Plus size={14} /> 新增食材
            </button>
            <button onClick={handleCalculate}
              className="flex items-center gap-2 text-white font-semibold px-6 py-2 rounded-xl text-sm transition-colors ml-auto"
              style={{ backgroundColor: BRAND_DARK }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#5a1f1d'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = BRAND_DARK}>
              <Calculator size={16} /> 計算
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── 結果區（點計算後才顯示）── */}
      {result && (
        <div className="space-y-4">
          {result.mode === 'general' ? (
            <>
              {/* 營養標示表 */}
              <SectionCard title="📊 營養標示結果">
                <div className="border border-gray-200 rounded-xl overflow-hidden text-sm">
                  <div className="bg-gray-800 text-white px-4 py-2 font-bold text-base">營養標示（每 100g）</div>
                  <div className="px-4 py-2 border-b border-gray-200 flex justify-between bg-orange-50">
                    <span className="font-bold text-base text-orange-700">熱量</span>
                    <span className="font-bold text-base text-orange-700">{result.calPer100g} 大卡</span>
                  </div>
                  {[
                    ['蛋白質', result.protein, 'g'],
                    ['脂肪', result.fat, 'g'],
                    ['　飽和脂肪', result.satFat, 'g'],
                    ['　反式脂肪', result.transFat, 'g'],
                    ['碳水化合物', result.carb, 'g'],
                    ['　糖', result.sugar, 'g'],
                    ['鈉', result.sodium, 'mg'],
                  ].map(([label, val, unit]) => (
                    <div key={label} className="px-4 py-1.5 border-b border-gray-100 flex justify-between">
                      <span className="text-gray-700">{label}</span>
                      <span className="font-medium">{val} {unit}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 bg-blue-50 rounded-xl px-4 py-2.5 text-xs text-blue-600">
                  熱量 = 蛋白質({result.protein}g)×4 + 脂肪({result.fat}g)×9 + 碳水({result.carb}g)×4 = <strong>{result.calPer100g} kcal/100g</strong>
                  <span className="ml-2 text-gray-400">（整批總熱量 {result.calcCal} kcal）</span>
                </div>
              </SectionCard>

              {/* 乾物比 */}
              {result.moisture > 0 && (
                <SectionCard title="💧 乾物比分析 (Dry Matter)">
                  <p className="text-xs text-gray-400 mb-3">公式：乾物% = 標示% ÷ (100% - 水分{result.moisture}%) × 100%</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[['蛋白質', result.dmProtein], ['脂肪', result.dmFat], ['碳水', result.dmCarb]].map(([label, val]) => (
                      <div key={label} className="bg-blue-50 rounded-xl px-3 py-2.5 text-center">
                        <p className="text-xs text-gray-500">{label} 乾物比</p>
                        <p className="text-xl font-bold text-blue-600">{val}%</p>
                      </div>
                    ))}
                    <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
                      <p className="text-xs text-gray-500">水分</p>
                      <p className="text-xl font-bold text-gray-600">{result.moisture}%</p>
                    </div>
                  </div>
                </SectionCard>
              )}
            </>
          ) : (
            <>
              {/* AAFCO 保證分析 */}
              <SectionCard title="🐾 保證分析 (Guaranteed Analysis)">
                <div className="space-y-2 text-sm">
                  {[
                    ['粗蛋白 Crude Protein', `${result.protein}%`, 'Min', 'emerald'],
                    ['粗脂肪 Crude Fat',     `${result.fat}%`,     'Min', 'emerald'],
                    ['粗纖維 Crude Fiber',   `${result.fiber}%`, 'Max', 'orange'],
                    ['水分 Moisture',        `${result.moisture}%`, 'Max', 'orange'],
                    ['灰分 Ash',             `${result.ash}%`,      '',    'gray'],
                    ['碳水化合物 (計算值)',   `${result.carb}%`,     '',    'blue'],
                  ].map(([label, val, tag, color]) => (
                    <div key={label} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-gray-700">{label}</span>
                      <div className="flex items-center gap-2">
                        {tag && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                            ${color === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                            {tag}
                          </span>
                        )}
                        <span className="font-bold text-gray-800">{val}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* 纖維換算說明 */}
              {result.rawFiber !== result.fiber && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5 text-xs text-orange-600">
                  💡 纖維換算：總膨食纖維 <strong>{result.rawFiber}%</strong> × 0.6 = 粗纖維 <strong>{result.fiber}%</strong>
                </div>
              )}

              {/* 代謝能 */}
              <SectionCard title="⚡ 代謝能 (Modified Atwater)">
                <div className="text-center py-2">
                  <p className="text-xs text-gray-400 mb-1">
                    公式：蛋白質({result.proteinG}g)×3.5 + 脂肪({result.fatG}g)×8.5 + NFE({result.nfeG}g)×3.5
                  </p>
                  <p className="text-xs text-orange-400 mb-3">NFE = 總重 - 蛋白 - 脂肪 - 纖維 - 水分 - 灰分（纖維不計入熱量）</p>
                  <p className="text-4xl font-black" style={{ color: BRAND_DARK }}>{result.me}</p>
                  <p className="text-sm text-gray-500 mt-1">kcal / kg（烘乾前）</p>
                  <div className="mt-3 bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5 inline-flex items-center gap-3">
                    <span className="text-sm text-orange-700 font-medium">烘乾前每 100g 熱量</span>
                    <span className="text-2xl font-black text-orange-600">{result.calPer100g} kcal</span>
                  </div>
                </div>
              </SectionCard>

              {/* 乾物比 */}
              {result.moisture > 0 && (
                <SectionCard title="💧 乾物比分析 (Dry Matter Basis)">
                  <p className="text-xs text-gray-400 mb-3">幫助比較凍乾與鮮食的真實營養濃度</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[['粗蛋白', result.dmProtein], ['粗脂肪', result.dmFat], ['粗纖維', result.dmFiber], ['碳水', result.dmCarb]].map(([label, val]) => (
                      <div key={label} className="bg-blue-50 rounded-xl px-3 py-2.5 text-center">
                        <p className="text-xs text-gray-500">{label} 乾物比</p>
                        <p className="text-xl font-bold text-blue-600">{val}%</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </>
          )}

          {/* 儲存配方 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex gap-2">
            <input type="text" className={inputCls} placeholder="輸入配方名稱後儲存..."
              value={formulaName} onChange={e => setFormulaName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()} />
            <button onClick={handleSave} disabled={!formulaName.trim()}
              className={btnPrimary + ' flex items-center gap-1 shrink-0 disabled:opacity-40'}>
              <Save size={15} /> 儲存配方
            </button>
          </div>
        </div>
      )}

      {/* 尚未計算提示 */}
      {!result && (
        <div className="bg-gray-50 border border-gray-100 rounded-2xl px-6 py-10 text-center text-gray-400">
          <Calculator size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">輸入食材營養成分後，點擊「計算」按鈕查看結果</p>
        </div>
      )}

      {/* ── 烘乾換算器 ── */}
      <SectionCard title="🔥 烘乾換算器">
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            輸入烘乾前後的重量，自動計算水分流失比例與濃縮倍數，並校正 AAFCO 百分比標示。
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">{DRY_LABELS.before}</label>
              <input type="number" min="0" step="0.1" className={inputCls + ' text-sm'}
                placeholder="例：1000"
                value={dryBefore} onChange={e => setDryBefore(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">{DRY_LABELS.after}</label>
              <input type="number" min="0" step="0.1" className={inputCls + ' text-sm'}
                placeholder="例：250"
                value={dryAfter} onChange={e => setDryAfter(e.target.value)} />
            </div>
            {dryCalc ? (
              <>
                <div className="bg-orange-50 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-xs text-gray-500">水分流失</p>
                  <p className="text-xl font-bold text-orange-500">{dryCalc.lossRatio}%</p>
                </div>
                <div className="bg-purple-50 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-xs text-gray-500">濃縮倍數</p>
                  <p className="text-xl font-bold text-purple-600">{dryCalc.concFactor}x</p>
                </div>
              </>
            ) : (
              <div className="col-span-2 bg-gray-50 rounded-xl px-4 py-2.5 text-xs text-gray-400 flex items-center">
                輸入烘乾前後重量即可計算
              </div>
            )}
          </div>
          {dryCalc && result && (
            <div className="mt-2 border border-purple-100 rounded-xl overflow-hidden">
              <div className="bg-purple-50 px-4 py-2 text-xs font-semibold text-purple-700">
                📊 烘乾後校正{result.mode === 'general' ? '（每100g含量）' : '百分比'}（原始 × {dryCalc.concFactor}x）
              </div>
              <div className="divide-y divide-gray-100">
                {result.mode === 'general' ? (
                  [
                    ['蛋白質', result.protein, 'g'],
                    ['脂肪',     result.fat,     'g'],
                    ['飽和脂肪', result.satFat,  'g'],
                    ['反式脂肪', result.transFat,'g'],
                    ['碳水化合物', result.carb,   'g'],
                    ['糖',       result.sugar,   'g'],
                    ['鈉',       result.sodium,  'mg'],
                  ]
                    .filter(([, per100g]) => per100g > 0)
                    .map(([label, per100g, unit]) => {
                      const adjusted = Math.round(per100g * dryCalc.concFactor * 100) / 100
                      return (
                        <div key={label} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span className="text-gray-600">{label}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400 text-xs">{per100g}{unit}/100g</span>
                            <span className="text-gray-400 text-xs">→</span>
                            <span className="font-bold text-purple-700">{adjusted}{unit}/100g</span>
                          </div>
                        </div>
                      )
                    })
                ) : (
                  [['粗蛋白', result.protein], ['粗脂肪', result.fat],
                   ['粗纖維', result.fiber], ['灰分', result.ash], ['碳水化合物(NFE)', result.carb]]
                    .map(([label, val]) => (
                      <div key={label} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span className="text-gray-600">{label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 text-xs">{val}%</span>
                          <span className="text-gray-400 text-xs">→</span>
                          <span className="font-bold text-purple-700">{dryCalc.adjust(val)}%</span>
                        </div>
                      </div>
                    ))
                )}
                <div className="flex items-center justify-between px-4 py-2 text-sm bg-blue-50">
                  <span className="text-gray-600">水分（烘乾後估算）</span>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-xs">{result.moisture}{result.mode === 'general' ? '%' : '%'}</span>
                    <span className="text-gray-400 text-xs">→</span>
                    <span className="font-bold text-blue-600">
                      {Math.max(0, Math.round((result.moisture - dryCalc.lossRatio) * 10) / 10)}%
                    </span>
                  </div>
                </div>
                {/* 烘乾後熱量 */}
                <div className="flex items-center justify-between px-4 py-2 text-sm bg-orange-50">
                  <div>
                    <span className="text-orange-700 font-semibold">烘乾後每 100g 熱量</span>
                    {result.mode === 'aafco' && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        總熱量 {Math.round(result.proteinG * 3.5 + result.fatG * 8.5 + result.nfeG * 3.5)} kcal ÷ 烘乾後 {parseFloat(dryAfter)}g × 100
                      </p>
                    )}
                    {result.mode === 'general' && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        總熱量 {result.calcCal} kcal ÷ 烘乾後 {parseFloat(dryAfter)}g × 100
                      </p>
                    )}
                  </div>
                  <span className="text-2xl font-black text-orange-600">
                    {result.mode === 'aafco'
                      ? Math.round((result.proteinG * 3.5 + result.fatG * 8.5 + result.nfeG * 3.5) / parseFloat(dryAfter) * 100)
                      : Math.round(result.calcCal / parseFloat(dryAfter) * 100)
                    } kcal
                  </span>
                </div>
              </div>
            </div>
          )}
          {dryCalc && !result && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              ⚠️ 請先輸入食材並點擊「計算」，才能顯示校正結果。
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
