import { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "../firebase";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function getElectricRate(dateStr) {
  const month = new Date(dateStr).getMonth() + 1;
  return month >= 6 && month <= 9 ? 6.24 : 5.07;
}

export function calcElectricityCost(watt, hours, dateStr) {
  return ((watt * hours) / 1000) * getElectricRate(dateStr);
}

const SEED_REVENUES = [
  { id: uid(), date: "2025-01-15", channel: "電商", category: "食品",  amount: 12400, isReported: false },
  { id: uid(), date: "2025-01-20", channel: "市集", category: "烘焙",  amount: 5800,  isReported: false },
  { id: uid(), date: "2025-02-10", channel: "電商", category: "食品",  amount: 15200, isReported: false },
];
const SEED_EXPENSES = [
  { id: uid(), date: "2025-01-05", type: "進貨", note: "雞胸肉原料進貨", amount: 4200, isProductionCost: true,  isReported: false },
  { id: uid(), date: "2025-01-31", type: "租金", note: "工作室租金 1月",  amount: 8000, isProductionCost: false, isReported: false },
];
const SEED_INVENTORY = [
  { id: uid(), category: "C食材", itemName: "雞胸肉",      currentQty: 15,  safetyQty: 20,  unit: "kg", supplier: "彰化生鮮肉品", unitPrice: 280 },
  { id: uid(), category: "D包材", itemName: "夾鏈袋(100g)", currentQty: 500, safetyQty: 100, unit: "個", supplier: "包裝材料商",   unitPrice: 3.5 },
];

const ERP_DOC_REF = doc(db, "moe_beast_erp", "main_record");

export default function usePetBusiness() {
  const [revenues,      setRevenues]      = useState([]);
  const [expenses,      setExpenses]      = useState([]);
  const [inventory,     setInventory]     = useState([]);
  const [production,    setProduction]    = useState([]);
  const [savedFormulas, setSavedFormulas] = useState([]);
  const [marketEvents,  setMarketEvents]  = useState([]);
  const [loading,       setLoading]       = useState(true);

  // 核心：先 getDoc 取最新值再修改寫回，避免 stale closure
  const cloudUpdate = useCallback(async (field, updater) => {
    try {
      const snap = await getDoc(ERP_DOC_REF);
      const current = snap.exists() ? (snap.data()[field] ?? []) : [];
      const updated = updater(current);
      await setDoc(ERP_DOC_REF, { [field]: updated }, { merge: true });
    } catch (err) {
      console.error("[Firebase] cloudUpdate error:", err);
    }
  }, []);

  // 即時監聽
  useEffect(() => {
    const unsub = onSnapshot(
      ERP_DOC_REF,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setRevenues(d.revenues       ?? []);
          setExpenses(d.expenses       ?? []);
          setInventory(d.inventory     ?? []);
          setProduction(d.production   ?? []);
          setSavedFormulas(d.savedFormulas ?? []);
          setMarketEvents(d.marketEvents   ?? []);
        } else {
          setDoc(ERP_DOC_REF, {
            revenues: SEED_REVENUES, expenses: SEED_EXPENSES,
            inventory: SEED_INVENTORY, production: [],
            savedFormulas: [], marketEvents: [], isInitialized: true,
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error("[Firebase] onSnapshot error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ── KPI ──────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
    const netProfit    = totalRevenue - totalExpense;
    const profitRate   = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    return { totalRevenue, totalExpense, netProfit, profitRate };
  }, [revenues, expenses]);

  const inventoryAlerts = useMemo(
    () => inventory.filter(i => (i.category === "C食材" || i.category === "D包材") && i.currentQty < i.safetyQty),
    [inventory]
  );

  // 未來 7 天即將出攤的市集
  const upcomingEvents = useMemo(() => {
    const now  = new Date(); now.setHours(0, 0, 0, 0);
    const in7  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return marketEvents
      .filter(e => { const s = new Date(e.startDate); return e.status === "已報名" && s >= now && s <= in7; })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [marketEvents]);

  // ── 營收 ──────────────────────────────────────────────────────
  const addRevenue = useCallback((data) => {
    const item = { id: uid(), isReported: false, ...data };
    setRevenues(prev => [...prev, item]);
    cloudUpdate("revenues", list => [...list, item]);
  }, [cloudUpdate]);

  const deleteRevenue = useCallback((id) => {
    setRevenues(prev => prev.filter(r => r.id !== id));
    cloudUpdate("revenues", list => list.filter(r => r.id !== id));
  }, [cloudUpdate]);

  const toggleRevenueReported = useCallback((id) => {
    setRevenues(prev => prev.map(r => r.id === id ? { ...r, isReported: !r.isReported } : r));
    cloudUpdate("revenues", list => list.map(r => r.id === id ? { ...r, isReported: !r.isReported } : r));
  }, [cloudUpdate]);

  // ── 支出 ──────────────────────────────────────────────────────
  const addExpense = useCallback((data) => {
    const item = { id: uid(), isReported: false, ...data };
    setExpenses(prev => [...prev, item]);
    cloudUpdate("expenses", list => [...list, item]);
  }, [cloudUpdate]);

  const deleteExpense = useCallback((id) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    cloudUpdate("expenses", list => list.filter(e => e.id !== id));
  }, [cloudUpdate]);

  const toggleExpenseReported = useCallback((id) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, isReported: !e.isReported } : e));
    cloudUpdate("expenses", list => list.map(e => e.id === id ? { ...e, isReported: !e.isReported } : e));
  }, [cloudUpdate]);

  const addPurchase = useCallback(async ({ date, itemId, itemName, category, qty, unitPrice, note }) => {
    const amount = qty * unitPrice;
    const newExp = { id: uid(), date, type: "進貨", note: note || `進貨：${itemName}`, amount, isProductionCost: true, isReported: false };
    setExpenses(prev => [...prev, newExp]);
    setInventory(prev => {
      const idx = prev.findIndex(i => i.id === itemId);
      if (idx !== -1) { const n = [...prev]; n[idx] = { ...n[idx], currentQty: n[idx].currentQty + qty }; return n; }
      return [...prev, { id: uid(), category, itemName, currentQty: qty, safetyQty: 0, unit: "個" }];
    });
    await cloudUpdate("expenses", list => [...list, newExp]);
    await cloudUpdate("inventory", list => {
      const idx = list.findIndex(i => i.id === itemId);
      if (idx !== -1) { const n = [...list]; n[idx] = { ...n[idx], currentQty: n[idx].currentQty + qty }; return n; }
      return [...list, { id: uid(), category, itemName, currentQty: qty, safetyQty: 0, unit: "個" }];
    });
  }, [cloudUpdate]);

  // ── 庫存 ──────────────────────────────────────────────────────
  const addInventoryItem = useCallback((data) => {
    const item = { id: uid(), ...data };
    setInventory(prev => [...prev, item]);
    cloudUpdate("inventory", list => [...list, item]);
  }, [cloudUpdate]);

  const updateInventoryItem = useCallback((id, data) => {
    setInventory(prev => prev.map(i => i.id === id ? { ...i, ...data } : i));
    cloudUpdate("inventory", list => list.map(i => i.id === id ? { ...i, ...data } : i));
  }, [cloudUpdate]);

  const deleteInventoryItem = useCallback((id) => {
    setInventory(prev => prev.filter(i => i.id !== id));
    cloudUpdate("inventory", list => list.filter(i => i.id !== id));
  }, [cloudUpdate]);

  const resetInventoryToSeed = useCallback(() => {
    setInventory(SEED_INVENTORY);
    cloudUpdate("inventory", () => SEED_INVENTORY);
  }, [cloudUpdate]);

  // ── 生產 ──────────────────────────────────────────────────────
  const addProductionBatch = useCallback(async (params) => {
    const { date, note, hours, usedIngredients, usedPackaging, resultQty, targetItemId, electricCost } = params;
    const newBatch = { id: uid(), ...params };
    const newExp   = {
      id: uid(), date, type: "電費",
      note: `生產電費：${note || "烘乾機"}（${hours}h）`,
      amount: Math.round(electricCost * 100) / 100,
      isProductionCost: true, isReported: false,
    };
    const applyInv = (list) => {
      let next = [...list];
      usedIngredients.forEach(({ itemId, qty }) => {
        const idx = next.findIndex(i => i.id === itemId);
        if (idx !== -1) next[idx] = { ...next[idx], currentQty: Math.max(0, next[idx].currentQty - qty) };
      });
      usedPackaging.forEach(({ itemId, qty }) => {
        const idx = next.findIndex(i => i.id === itemId);
        if (idx !== -1) next[idx] = { ...next[idx], currentQty: Math.max(0, next[idx].currentQty - qty) };
      });
      if (targetItemId) {
        const idx = next.findIndex(i => i.id === targetItemId);
        if (idx !== -1) next[idx] = { ...next[idx], currentQty: next[idx].currentQty + resultQty };
      }
      return next;
    };
    setProduction(prev => [...prev, newBatch]);
    setExpenses(prev => [...prev, newExp]);
    setInventory(applyInv);
    await cloudUpdate("production", list => [...list, newBatch]);
    await cloudUpdate("expenses",   list => [...list, newExp]);
    await cloudUpdate("inventory",  applyInv);
  }, [cloudUpdate]);

  const deleteProduction = useCallback((id) => {
    setProduction(prev => prev.filter(p => p.id !== id));
    cloudUpdate("production", list => list.filter(p => p.id !== id));
  }, [cloudUpdate]);

  // ── 配方 ──────────────────────────────────────────────────────
  const saveFormula = useCallback((name, mode, inputs, results) => {
    const item = { id: uid(), name, mode, inputs, results, savedAt: new Date().toISOString() };
    setSavedFormulas(prev => [...prev.filter(f => f.name !== name), item]);
    cloudUpdate("savedFormulas", list => [...list.filter(f => f.name !== name), item]);
  }, [cloudUpdate]);

  const deleteFormula = useCallback((id) => {
    setSavedFormulas(prev => prev.filter(f => f.id !== id));
    cloudUpdate("savedFormulas", list => list.filter(f => f.id !== id));
  }, [cloudUpdate]);

  // ── 市集活動 CRUD ─────────────────────────────────────────────
  const addMarketEvent = useCallback((data) => {
    const item = { id: uid(), ...data };
    setMarketEvents(prev => [...prev, item]);
    cloudUpdate("marketEvents", list => [...list, item]);
  }, [cloudUpdate]);

  const updateMarketEvent = useCallback((id, data) => {
    setMarketEvents(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
    cloudUpdate("marketEvents", list => list.map(e => e.id === id ? { ...e, ...data } : e));
  }, [cloudUpdate]);

  const deleteMarketEvent = useCallback((id) => {
    setMarketEvents(prev => prev.filter(e => e.id !== id));
    cloudUpdate("marketEvents", list => list.filter(e => e.id !== id));
  }, [cloudUpdate]);

  // ── 市集現場收款 ──────────────────────────────────────────────
  // items: [{ itemId, itemName, qty, unitPrice }]
  const processMarketSale = useCallback(async ({ items, paymentMethod, totalAmount, eventId }) => {
    const today = new Date().toISOString().slice(0, 10);
    const revenueItem = {
      id: uid(), date: today, channel: "市集", category: "食品",
      amount: totalAmount, isReported: false, paymentMethod, eventId,
    };
    setRevenues(prev => [...prev, revenueItem]);
    setInventory(prev => {
      let next = [...prev];
      items.forEach(({ itemId, qty }) => {
        const idx = next.findIndex(i => i.id === itemId);
        if (idx !== -1) next[idx] = { ...next[idx], currentQty: Math.max(0, next[idx].currentQty - qty) };
      });
      return next;
    });
    await cloudUpdate("revenues", list => [...list, revenueItem]);
    await cloudUpdate("inventory", list => {
      let next = [...list];
      items.forEach(({ itemId, qty }) => {
        const idx = next.findIndex(i => i.id === itemId);
        if (idx !== -1) next[idx] = { ...next[idx], currentQty: Math.max(0, next[idx].currentQty - qty) };
      });
      return next;
    });
  }, [cloudUpdate]);

  // ── 系統 ──────────────────────────────────────────────────────
  const clearAllData = useCallback(async () => {
    if (!window.confirm("確定要清空所有雲端帳務資料嗎？此動作無法復原。")) return;
    const empty = { revenues: [], expenses: [], inventory: [], production: [], savedFormulas: [], marketEvents: [], isInitialized: true };
    setRevenues([]); setExpenses([]); setInventory([]); setProduction([]); setSavedFormulas([]); setMarketEvents([]);
    await setDoc(ERP_DOC_REF, empty);
    alert("雲端資料已全數清空");
  }, []);

  const exportData = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({ revenues, expenses, inventory, production, savedFormulas, marketEvents }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `petbiz-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [revenues, expenses, inventory, production, savedFormulas, marketEvents]);

  const importData = useCallback(async (jsonStr) => {
    try {
      const d = JSON.parse(jsonStr);
      const data = {
        revenues:      d.revenues      ?? [],
        expenses:      d.expenses      ?? [],
        inventory:     d.inventory     ?? [],
        production:    d.production    ?? [],
        savedFormulas: d.savedFormulas ?? [],
        marketEvents:  d.marketEvents  ?? [],
        isInitialized: true,
      };
      setRevenues(data.revenues); setExpenses(data.expenses);
      setInventory(data.inventory); setProduction(data.production);
      setSavedFormulas(data.savedFormulas); setMarketEvents(data.marketEvents);
      await setDoc(ERP_DOC_REF, data);
      return true;
    } catch (err) {
      console.error("匯入失敗:", err);
      return false;
    }
  }, []);

  return {
    revenues, expenses, inventory, production, savedFormulas, marketEvents, loading,
    kpi, inventoryAlerts, upcomingEvents,
    addRevenue, deleteRevenue, toggleRevenueReported,
    addExpense, deleteExpense, toggleExpenseReported,
    addPurchase,
    addInventoryItem, updateInventoryItem, deleteInventoryItem, resetInventoryToSeed,
    addProductionBatch, deleteProduction,
    saveFormula, deleteFormula,
    addMarketEvent, updateMarketEvent, deleteMarketEvent,
    processMarketSale,
    clearAllData, exportData, importData,
  };
}
