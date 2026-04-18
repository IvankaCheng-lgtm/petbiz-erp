import { useState, useEffect, useCallback, useMemo } from 'react'

// ─── 工具函數 ────────────────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export function getElectricRate(dateStr) {
  const month = new Date(dateStr).getMonth() + 1
  return month >= 6 && month <= 9 ? 6.24 : 5.07
}

export function calcElectricityCost(watt, hours, dateStr) {
  return (watt * hours / 1000) * getElectricRate(dateStr)
}

// ─── 示範數據 ────────────────────────────────────────────────
const SEED_REVENUES = [
  { id: uid(), date: '2025-01-15', channel: '電商', category: '食品',  amount: 12400, isReported: false },
  { id: uid(), date: '2025-01-20', channel: '市集', category: '烘焙',  amount: 5800,  isReported: false },
  { id: uid(), date: '2025-02-10', channel: '電商', category: '食品',  amount: 15200, isReported: false },
  { id: uid(), date: '2025-02-22', channel: '市集', category: '蛋糕',  amount: 4200,  isReported: false },
  { id: uid(), date: '2025-03-05', channel: '電商', category: '用品',  amount: 8700,  isReported: false },
  { id: uid(), date: '2025-03-18', channel: '市集', category: '食品',  amount: 6300,  isReported: false },
  { id: uid(), date: '2025-04-12', channel: '電商', category: '烘焙',  amount: 11000, isReported: false },
  { id: uid(), date: '2025-04-25', channel: '市集', category: '蛋糕',  amount: 3900,  isReported: false },
  { id: uid(), date: '2025-05-08', channel: '電商', category: '食品',  amount: 17500, isReported: false },
  { id: uid(), date: '2025-05-30', channel: '市集', category: '烘焙',  amount: 7200,  isReported: false },
  { id: uid(), date: '2025-06-14', channel: '電商', category: '食品',  amount: 19800, isReported: false },
  { id: uid(), date: '2025-06-28', channel: '市集', category: '用品',  amount: 4500,  isReported: false },
  { id: uid(), date: '2025-07-10', channel: '電商', category: '食品',  amount: 22000, isReported: false },
  { id: uid(), date: '2025-07-20', channel: '市集', category: '蛋糕',  amount: 5100,  isReported: false },
  { id: uid(), date: '2025-08-05', channel: '電商', category: '烘焙',  amount: 13600, isReported: false },
  { id: uid(), date: '2025-08-22', channel: '市集', category: '食品',  amount: 8900,  isReported: false },
  { id: uid(), date: '2025-09-11', channel: '電商', category: '食品',  amount: 20400, isReported: false },
  { id: uid(), date: '2025-09-27', channel: '市集', category: '用品',  amount: 3700,  isReported: false },
  { id: uid(), date: '2025-10-09', channel: '電商', category: '食品',  amount: 16800, isReported: false },
  { id: uid(), date: '2025-10-19', channel: '市集', category: '烘焙',  amount: 6600,  isReported: false },
  { id: uid(), date: '2025-11-03', channel: '電商', category: '用品',  amount: 9200,  isReported: false },
  { id: uid(), date: '2025-11-23', channel: '市集', category: '蛋糕',  amount: 4800,  isReported: false },
  { id: uid(), date: '2025-12-07', channel: '電商', category: '食品',  amount: 24500, isReported: false },
  { id: uid(), date: '2025-12-21', channel: '市集', category: '烘焙',  amount: 9100,  isReported: false },
]

const SEED_EXPENSES = [
  { id: uid(), date: '2025-01-05', type: '進貨',  note: '雞胸肉原料進貨',     amount: 4200,  isProductionCost: true,  isReported: false },
  { id: uid(), date: '2025-01-05', type: '進貨',  note: '貓薄荷原料進貨',     amount: 800,   isProductionCost: true,  isReported: false },
  { id: uid(), date: '2025-01-10', type: '電費',  note: '烘乾機電費 1月',     amount: 487,   isProductionCost: true,  isReported: false },
  { id: uid(), date: '2025-01-31', type: '租金',  note: '工作室租金 1月',     amount: 8000,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-01-31', type: '人事',  note: '兼職人員薪資 1月',   amount: 6000,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-02-03', type: '進貨',  note: '羊奶片成品進貨',     amount: 5500,  isProductionCost: true,  isReported: false },
  { id: uid(), date: '2025-02-14', type: '行銷',  note: '情人節社群廣告',     amount: 1200,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-02-28', type: '租金',  note: '工作室租金 2月',     amount: 8000,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-03-01', type: '攤位',  note: '春季市集攤位費',     amount: 2500,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-03-10', type: '耗材',  note: '包裝袋、封口貼',     amount: 1800,  isProductionCost: true,  isReported: false },
  { id: uid(), date: '2025-03-31', type: '租金',  note: '工作室租金 3月',     amount: 8000,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-04-05', type: '進貨',  note: '凍乾雞肉成品進貨',   amount: 7200,  isProductionCost: true,  isReported: false },
  { id: uid(), date: '2025-04-15', type: '電費',  note: '烘乾機電費 4月',     amount: 487,   isProductionCost: true,  isReported: false },
  { id: uid(), date: '2025-04-30', type: '人事',  note: '兼職人員薪資 4月',   amount: 6000,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-05-10', type: '行銷',  note: '母親節電商廣告投放', amount: 2000,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-05-20', type: '耗材',  note: '禮盒包裝材料',       amount: 2200,  isProductionCost: true,  isReported: false },
  { id: uid(), date: '2025-06-01', type: '攤位',  note: '夏季市集攤位費',     amount: 3000,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-06-10', type: '電費',  note: '烘乾機電費 6月(夏)', amount: 598,   isProductionCost: true,  isReported: false },
  { id: uid(), date: '2025-06-30', type: '租金',  note: '工作室租金 6月',     amount: 8000,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-07-05', type: '進貨',  note: '雞胸肉原料進貨',     amount: 5100,  isProductionCost: true,  isReported: false },
  { id: uid(), date: '2025-07-15', type: '電費',  note: '烘乾機電費 7月(夏)', amount: 598,   isProductionCost: true,  isReported: false },
  { id: uid(), date: '2025-07-31', type: '人事',  note: '兼職人員薪資 7月',   amount: 7500,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-08-10', type: '設備',  note: '烘乾機維修費',       amount: 3500,  isProductionCost: true,  isReported: false },
  { id: uid(), date: '2025-08-31', type: '租金',  note: '工作室租金 8月',     amount: 8000,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-09-05', type: '行銷',  note: '中秋節禮盒廣告',     amount: 2800,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-09-15', type: '電費',  note: '烘乾機電費 9月(夏)', amount: 598,   isProductionCost: true,  isReported: false },
  { id: uid(), date: '2025-10-01', type: '攤位',  note: '秋季市集攤位費',     amount: 2500,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-10-10', type: '進貨',  note: '羊奶片成品進貨',     amount: 6300,  isProductionCost: true,  isReported: false },
  { id: uid(), date: '2025-11-11', type: '行銷',  note: '雙11電商廣告投放',   amount: 3500,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-11-30', type: '雜項',  note: '辦公耗材雜支',       amount: 450,   isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-12-01', type: '攤位',  note: '耶誕市集攤位費',     amount: 3500,  isProductionCost: false, isReported: false },
  { id: uid(), date: '2025-12-10', type: '耗材',  note: '耶誕禮盒包裝材料',   amount: 3200,  isProductionCost: true,  isReported: false },
  { id: uid(), date: '2025-12-31', type: '人事',  note: '年終獎金',           amount: 10000, isProductionCost: false, isReported: false },
]

const SEED_INVENTORY = [
  // A 用品
  { id: uid(), category: 'A用品', itemName: '陶瓷寵物碗', currentQty: 45, safetyQty: 10, unit: '個', supplier: '台灣陶藝坊',     listPrice: 380,  salePrice: 320, cost: 180 },
  { id: uid(), category: 'A用品', itemName: '貓咪小木屋', currentQty: 8,  safetyQty: 5,  unit: '個', supplier: '木質生活工坊',   listPrice: 1200, salePrice: 980, cost: 550 },
  { id: uid(), category: 'A用品', itemName: '寵物牽繩',   currentQty: 30, safetyQty: 10, unit: '條', supplier: '寵物用品批發',   listPrice: 280,  salePrice: 240, cost: 120 },
  // B 食品（成品）
  { id: uid(), category: 'B食品', itemName: '凍乾雞肉片', currentQty: 120, safetyQty: 30, unit: '包', supplier: '自製',             listPrice: 320, salePrice: 280, cost: 95  },
  { id: uid(), category: 'B食品', itemName: '羊奶片',     currentQty: 85,  safetyQty: 30, unit: '包', supplier: '紐西蘭羊奶進口商', listPrice: 450, salePrice: 390, cost: 210 },
  { id: uid(), category: 'B食品', itemName: '鮭魚凍乾',   currentQty: 18,  safetyQty: 25, unit: '包', supplier: '自製',             listPrice: 360, salePrice: 310, cost: 110 },
  // C 食材（原料）
  { id: uid(), category: 'C食材', itemName: '雞胸肉', currentQty: 15, safetyQty: 20, unit: 'kg', supplier: '彰化生鮮肉品',     unitPrice: 280 },
  { id: uid(), category: 'C食材', itemName: '貓薄荷', currentQty: 8,  safetyQty: 5,  unit: 'kg', supplier: '有機香草農場',     unitPrice: 450 },
  { id: uid(), category: 'C食材', itemName: '鮭魚',   currentQty: 6,  safetyQty: 10, unit: 'kg', supplier: '基隆海鮮批發',     unitPrice: 320 },
  { id: uid(), category: 'C食材', itemName: '羊奶粉', currentQty: 12, safetyQty: 8,  unit: 'kg', supplier: '紐西蘭羊奶進口商', unitPrice: 680 },
  // D 包材
  { id: uid(), category: 'D包材', itemName: '夾鏈袋(100g)', currentQty: 500, safetyQty: 100, unit: '個', supplier: '包裝材料商', unitPrice: 3.5 },
  { id: uid(), category: 'D包材', itemName: '夾鏈袋(50g)',  currentQty: 300, safetyQty: 80,  unit: '個', supplier: '包裝材料商', unitPrice: 2.5 },
  { id: uid(), category: 'D包材', itemName: '品牌標籤',     currentQty: 800, safetyQty: 200, unit: '張', supplier: '印刷廠',     unitPrice: 1.2 },
  { id: uid(), category: 'D包材', itemName: '乾燥劑',       currentQty: 600, safetyQty: 150, unit: '個', supplier: '食品包裝批發', unitPrice: 0.8 },
  { id: uid(), category: 'D包材', itemName: '封口貼紙',     currentQty: 300, safetyQty: 80,  unit: '張', supplier: '包裝材料商', unitPrice: 2.0 },
  { id: uid(), category: 'D包材', itemName: '包裝紙盒',     currentQty: 150, safetyQty: 50,  unit: '個', supplier: '印刷廠',     unitPrice: 8.0 },
]

// 新版生產紀錄 schema
// { id, date, note, machineWatt, hours,
//   usedIngredients: [{ itemId, itemName, qty, unitPrice, cost }],
//   usedPackaging:   [{ itemId, itemName, qty, unitPrice, cost }],
//   outputQty, outputUnit, packSize, resultQty, targetItemId,
//   ingredientCost, electricCost, packagingCost, totalCost, costPerPack }
const SEED_PRODUCTION = [
  {
    id: uid(), date: '2025-01-10', note: '凍乾雞肉片批次生產',
    machineWatt: 1100, hours: 16,
    usedIngredients: [{ itemId: '', itemName: '雞胸肉', qty: 5, unitPrice: 280, cost: 1400 }],
    usedPackaging:   [{ itemId: '', itemName: '夾鏈袋(100g)', qty: 80, unitPrice: 3.5, cost: 280 }, { itemId: '', itemName: '品牌標籤', qty: 80, unitPrice: 1.2, cost: 96 }],
    outputQty: 8000, outputUnit: '克', packSize: 100,
    resultQty: 80, targetItemId: '',
    ingredientCost: 1400, electricCost: 97.5, packagingCost: 376, totalCost: 1873.5, costPerPack: 23.4,
  },
  {
    id: uid(), date: '2025-06-20', note: '夏季大批次凍乾生產',
    machineWatt: 1100, hours: 20,
    usedIngredients: [{ itemId: '', itemName: '雞胸肉', qty: 8, unitPrice: 280, cost: 2240 }],
    usedPackaging:   [{ itemId: '', itemName: '夾鏈袋(100g)', qty: 100, unitPrice: 3.5, cost: 350 }, { itemId: '', itemName: '品牌標籤', qty: 100, unitPrice: 1.2, cost: 120 }],
    outputQty: 10000, outputUnit: '克', packSize: 100,
    resultQty: 100, targetItemId: '',
    ingredientCost: 2240, electricCost: 136.8, packagingCost: 470, totalCost: 2846.8, costPerPack: 28.5,
  },
]

// ─── localStorage ────────────────────────────────────────────
const LS_KEYS = {
  revenues:   'petbiz_revenues',
  expenses:   'petbiz_expenses',
  inventory:  'petbiz_inventory',
  production: 'petbiz_production',
}

function loadFromLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function saveToLS(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

// ─── Hook ────────────────────────────────────────────────────
export default function usePetBusiness() {
  const [revenues,   setRevenues]   = useState(() => loadFromLS(LS_KEYS.revenues,   SEED_REVENUES))
  const [expenses,   setExpenses]   = useState(() => loadFromLS(LS_KEYS.expenses,   SEED_EXPENSES))
  const [inventory,  setInventory]  = useState(() => loadFromLS(LS_KEYS.inventory,  SEED_INVENTORY))
  const [production, setProduction] = useState(() => loadFromLS(LS_KEYS.production, SEED_PRODUCTION))

  useEffect(() => saveToLS(LS_KEYS.revenues,   revenues),   [revenues])
  useEffect(() => saveToLS(LS_KEYS.expenses,   expenses),   [expenses])
  useEffect(() => saveToLS(LS_KEYS.inventory,  inventory),  [inventory])
  useEffect(() => saveToLS(LS_KEYS.production, production), [production])

  // ── KPI ──────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0)
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0)
    const netProfit    = totalRevenue - totalExpense
    const profitRate   = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    return { totalRevenue, totalExpense, netProfit, profitRate }
  }, [revenues, expenses])

  const inventoryAlerts = useMemo(
    () => inventory.filter(i =>
      (i.category === 'C食材' || i.category === 'D包材') && i.currentQty < i.safetyQty
    ),
    [inventory]
  )

  // ── 營收 CRUD ────────────────────────────────────────────
  const addRevenue = useCallback((data) => {
    setRevenues(prev => [...prev, { id: uid(), isReported: false, ...data }])
  }, [])
  const deleteRevenue = useCallback((id) => {
    setRevenues(prev => prev.filter(r => r.id !== id))
  }, [])
  const toggleRevenueReported = useCallback((id) => {
    setRevenues(prev => prev.map(r => r.id === id ? { ...r, isReported: !r.isReported } : r))
  }, [])

  // ── 支出 CRUD ────────────────────────────────────────────
  const addExpense = useCallback((data) => {
    setExpenses(prev => [...prev, { id: uid(), isReported: false, ...data }])
  }, [])
  const deleteExpense = useCallback((id) => {
    setExpenses(prev => prev.filter(e => e.id !== id))
  }, [])
  const toggleExpenseReported = useCallback((id) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, isReported: !e.isReported } : e))
  }, [])

  // ── 進貨聯動 ─────────────────────────────────────────────
  const addPurchase = useCallback(({ date, itemId, itemName, category, qty, unitPrice, note }) => {
    const amount = qty * unitPrice
    setExpenses(prev => [...prev, {
      id: uid(), date, type: '進貨',
      note: note || `進貨：${itemName}`,
      amount, isProductionCost: true, isReported: false,
    }])
    setInventory(prev => {
      const idx = prev.findIndex(i => i.id === itemId)
      if (idx !== -1) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], currentQty: updated[idx].currentQty + qty }
        return updated
      }
      return [...prev, { id: uid(), category, itemName, currentQty: qty, safetyQty: 0, unit: '個' }]
    })
  }, [])

  // ── 庫存 CRUD ────────────────────────────────────────────
  const addInventoryItem = useCallback((data) => {
    setInventory(prev => [...prev, { id: uid(), ...data }])
  }, [])
  const updateInventoryItem = useCallback((id, data) => {
    setInventory(prev => prev.map(i => i.id === id ? { ...i, ...data } : i))
  }, [])
  const deleteInventoryItem = useCallback((id) => {
    setInventory(prev => prev.filter(i => i.id !== id))
  }, [])

  // ── 生產批次入庫（新版）──────────────────────────────────
  // params: { date, note, machineWatt, hours,
  //   usedIngredients, usedPackaging,
  //   outputQty, outputUnit, packSize, resultQty, targetItemId,
  //   ingredientCost, electricCost, packagingCost, totalCost, costPerPack }
  const addProductionBatch = useCallback((params) => {
    const {
      date, note, machineWatt, hours,
      usedIngredients, usedPackaging,
      outputQty, outputUnit, packSize, resultQty, targetItemId,
      ingredientCost, electricCost, packagingCost, totalCost, costPerPack,
    } = params

    // 1. 新增生產紀錄
    setProduction(prev => [...prev, {
      id: uid(), date, note: note || '',
      machineWatt, hours,
      usedIngredients, usedPackaging,
      outputQty, outputUnit, packSize,
      resultQty, targetItemId,
      ingredientCost, electricCost, packagingCost, totalCost, costPerPack,
    }])

    // 2. 電費支出
    setExpenses(prev => [...prev, {
      id: uid(), date, type: '電費',
      note: `生產電費：${note || '烘乾機'}（${hours}h @ ${getElectricRate(date)}元/度）`,
      amount: Math.round(electricCost * 100) / 100,
      isProductionCost: true, isReported: false,
    }])

    // 3. 扣減食材庫存
    setInventory(prev => {
      let next = [...prev]
      usedIngredients.forEach(({ itemId, qty }) => {
        const idx = next.findIndex(i => i.id === itemId)
        if (idx !== -1) next[idx] = { ...next[idx], currentQty: Math.max(0, next[idx].currentQty - qty) }
      })
      // 扣減包材庫存
      usedPackaging.forEach(({ itemId, qty }) => {
        const idx = next.findIndex(i => i.id === itemId)
        if (idx !== -1) next[idx] = { ...next[idx], currentQty: Math.max(0, next[idx].currentQty - qty) }
      })
      // 增加 B食品成品庫存
      if (targetItemId) {
        const idx = next.findIndex(i => i.id === targetItemId)
        if (idx !== -1) next[idx] = { ...next[idx], currentQty: next[idx].currentQty + resultQty }
      }
      return next
    })
  }, [])

  // 重置庫存為 SEED（用於解決 localStorage 舊資料沒有 D包材的問題）
  const resetInventoryToSeed = useCallback(() => {
    setInventory(SEED_INVENTORY)
  }, [])

  // ── 配方儲存 CRUD ─────────────────────────────────────────────────
  const [savedFormulas, setSavedFormulas] = useState(() => loadFromLS('petbiz_formulas', []))
  useEffect(() => saveToLS('petbiz_formulas', savedFormulas), [savedFormulas])

  const saveFormula = useCallback((name, mode, inputs, results) => {
    setSavedFormulas(prev => [
      ...prev.filter(f => f.name !== name),
      { id: uid(), name, mode, inputs, results, savedAt: new Date().toISOString() },
    ])
  }, [])

  const deleteFormula = useCallback((id) => {
    setSavedFormulas(prev => prev.filter(f => f.id !== id))
  }, [])

  const deleteProduction = useCallback((id) => {
    setProduction(prev => prev.filter(p => p.id !== id))
  }, [])

  // ── 系統 ─────────────────────────────────────────────────
  const clearAllData = useCallback(() => {
    setRevenues([]); setExpenses([]); setInventory([]); setProduction([])
  }, [])

  const exportData = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({ revenues, expenses, inventory, production }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `petbiz-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [revenues, expenses, inventory, production])

  const importData = useCallback((jsonStr) => {
    try {
      const { revenues: r, expenses: e, inventory: i, production: p } = JSON.parse(jsonStr)
      if (r) setRevenues(r); if (e) setExpenses(e)
      if (i) setInventory(i); if (p) setProduction(p)
      return true
    } catch { return false }
  }, [])

  return {
    revenues, expenses, inventory, production,
    kpi, inventoryAlerts,
    addRevenue, deleteRevenue, toggleRevenueReported,
    addExpense, deleteExpense, toggleExpenseReported,
    addPurchase,
    addInventoryItem, updateInventoryItem, deleteInventoryItem, resetInventoryToSeed,
    addProductionBatch, deleteProduction,
    savedFormulas, saveFormula, deleteFormula,
    clearAllData, exportData, importData,
  }
}
