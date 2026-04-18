import { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "../firebase"; // 確保路徑正確
import { doc, onSnapshot, setDoc } from "firebase/firestore";

// ─── 工具函數 ────────────────────────────────────────────────
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function getElectricRate(dateStr) {
  const month = new Date(dateStr).getMonth() + 1;
  return month >= 6 && month <= 9 ? 6.24 : 5.07;
}

export function calcElectricityCost(watt, hours, dateStr) {
  return ((watt * hours) / 1000) * getElectricRate(dateStr);
}

// ─── 示範數據 (僅在雲端完全沒資料時載入一次) ─────────────────────
const SEED_REVENUES = [
  {
    id: uid(),
    date: "2025-01-15",
    channel: "電商",
    category: "食品",
    amount: 12400,
    isReported: false,
  },
  {
    id: uid(),
    date: "2025-01-20",
    channel: "市集",
    category: "烘焙",
    amount: 5800,
    isReported: false,
  },
  {
    id: uid(),
    date: "2025-02-10",
    channel: "電商",
    category: "食品",
    amount: 15200,
    isReported: false,
  },
];
const SEED_EXPENSES = [
  {
    id: uid(),
    date: "2025-01-05",
    type: "進貨",
    note: "雞胸肉原料進貨",
    amount: 4200,
    isProductionCost: true,
    isReported: false,
  },
  {
    id: uid(),
    date: "2025-01-31",
    type: "租金",
    note: "工作室租金 1月",
    amount: 8000,
    isProductionCost: false,
    isReported: false,
  },
];
const SEED_INVENTORY = [
  {
    id: uid(),
    category: "C食材",
    itemName: "雞胸肉",
    currentQty: 15,
    safetyQty: 20,
    unit: "kg",
    supplier: "彰化生鮮肉品",
    unitPrice: 280,
  },
  {
    id: uid(),
    category: "D包材",
    itemName: "夾鏈袋(100g)",
    currentQty: 500,
    safetyQty: 100,
    unit: "個",
    supplier: "包裝材料商",
    unitPrice: 3.5,
  },
];

// Firebase 文件路徑
const ERP_DOC_REF = doc(db, "moe_beast_erp", "main_record");

export default function usePetBusiness() {
  const [revenues, setRevenues] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [production, setProduction] = useState([]);
  const [savedFormulas, setSavedFormulas] = useState([]);
  const [loading, setLoading] = useState(true);

  // 【1. 雲端同步核心】：資料變動時寫入 Firebase
  const syncToCloud = useCallback(async (updates) => {
    try {
      await setDoc(ERP_DOC_REF, updates, { merge: true });
    } catch (err) {
      console.error("Firebase Sync Error:", err);
    }
  }, []);

  // 【2. 即時監聽】：從 Firebase 抓取資料 (跨裝置同步)
  useEffect(() => {
    const unsub = onSnapshot(
      ERP_DOC_REF,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setRevenues(data.revenues || []);
          setExpenses(data.expenses || []);
          setInventory(data.inventory || []);
          setProduction(data.production || []);
          setSavedFormulas(data.savedFormulas || []);
        } else {
          // 第一次使用且文件不存在：載入示範數據
          syncToCloud({
            revenues: SEED_REVENUES,
            expenses: SEED_EXPENSES,
            inventory: SEED_INVENTORY,
            production: [],
            savedFormulas: [],
            isInitialized: true,
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error('[Firebase] onSnapshot error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [syncToCloud]);

  // ── KPI 計算 (保持不變) ───────────────────────────────────────
  const kpi = useMemo(() => {
    const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = totalRevenue - totalExpense;
    const profitRate = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    return { totalRevenue, totalExpense, netProfit, profitRate };
  }, [revenues, expenses]);

  const inventoryAlerts = useMemo(
    () =>
      inventory.filter(
        (i) =>
          (i.category === "C食材" || i.category === "D包材") &&
          i.currentQty < i.safetyQty,
      ),
    [inventory],
  );

  // ── 營收動作 ────────────────────────────────────────────
  const addRevenue = useCallback(
    (data) => {
      const newList = [...revenues, { id: uid(), isReported: false, ...data }];
      setRevenues(newList);
      syncToCloud({ revenues: newList });
    },
    [revenues, syncToCloud],
  );

  const deleteRevenue = useCallback(
    (id) => {
      const newList = revenues.filter((r) => r.id !== id);
      setRevenues(newList);
      syncToCloud({ revenues: newList });
    },
    [revenues, syncToCloud],
  );

  const toggleRevenueReported = useCallback(
    (id) => {
      const newList = revenues.map((r) =>
        r.id === id ? { ...r, isReported: !r.isReported } : r,
      );
      setRevenues(newList);
      syncToCloud({ revenues: newList });
    },
    [revenues, syncToCloud],
  );

  // ── 支出動作 ────────────────────────────────────────────
  const addExpense = useCallback(
    (data) => {
      const newList = [...expenses, { id: uid(), isReported: false, ...data }];
      setExpenses(newList);
      syncToCloud({ expenses: newList });
    },
    [expenses, syncToCloud],
  );

  const deleteExpense = useCallback(
    (id) => {
      const newList = expenses.filter((e) => e.id !== id);
      setExpenses(newList);
      syncToCloud({ expenses: newList });
    },
    [expenses, syncToCloud],
  );

  const toggleExpenseReported = useCallback(
    (id) => {
      const newList = expenses.map((e) =>
        e.id === id ? { ...e, isReported: !e.isReported } : e,
      );
      setExpenses(newList);
      syncToCloud({ expenses: newList });
    },
    [expenses, syncToCloud],
  );

  const addPurchase = useCallback(
    ({ date, itemId, itemName, category, qty, unitPrice, note }) => {
      const amount = qty * unitPrice;
      const newExpenses = [
        ...expenses,
        {
          id: uid(),
          date,
          type: "進貨",
          note: note || `進貨：${itemName}`,
          amount,
          isProductionCost: true,
          isReported: false,
        },
      ];

      let newInventory = [...inventory];
      const idx = newInventory.findIndex((i) => i.id === itemId);
      if (idx !== -1) {
        newInventory[idx] = {
          ...newInventory[idx],
          currentQty: newInventory[idx].currentQty + qty,
        };
      } else {
        newInventory.push({
          id: uid(),
          category,
          itemName,
          currentQty: qty,
          safetyQty: 0,
          unit: "個",
        });
      }

      setExpenses(newExpenses);
      setInventory(newInventory);
      syncToCloud({ expenses: newExpenses, inventory: newInventory });
    },
    [expenses, inventory, syncToCloud],
  );

  // ── 庫存動作 ────────────────────────────────────────────
  const addInventoryItem = useCallback(
    (data) => {
      const newList = [...inventory, { id: uid(), ...data }];
      setInventory(newList);
      syncToCloud({ inventory: newList });
    },
    [inventory, syncToCloud],
  );

  const updateInventoryItem = useCallback(
    (id, data) => {
      const newList = inventory.map((i) =>
        i.id === id ? { ...i, ...data } : i,
      );
      setInventory(newList);
      syncToCloud({ inventory: newList });
    },
    [inventory, syncToCloud],
  );

  const deleteInventoryItem = useCallback(
    (id) => {
      const newList = inventory.filter((i) => i.id !== id);
      setInventory(newList);
      syncToCloud({ inventory: newList });
    },
    [inventory, syncToCloud],
  );

  const resetInventoryToSeed = useCallback(() => {
    setInventory(SEED_INVENTORY);
    syncToCloud({ inventory: SEED_INVENTORY });
  }, [syncToCloud]);

  // ── 生產動作 ────────────────────────────────────────────
  const addProductionBatch = useCallback(
    (params) => {
      const { date, note, hours, usedIngredients, usedPackaging, resultQty, targetItemId, electricCost } = params;

      const newProduction = [...production, { id: uid(), ...params }];
      const newExpenses = [
        ...expenses,
        {
          id: uid(),
          date,
          type: "電費",
          note: `生產電費：${note || "烘乾機"}（${hours}h）`,
          amount: Math.round(electricCost * 100) / 100,
          isProductionCost: true,
          isReported: false,
        },
      ];

      let newInventory = [...inventory];
      usedIngredients.forEach(({ itemId, qty }) => {
        const idx = newInventory.findIndex((i) => i.id === itemId);
        if (idx !== -1)
          newInventory[idx] = {
            ...newInventory[idx],
            currentQty: Math.max(0, newInventory[idx].currentQty - qty),
          };
      });
      usedPackaging.forEach(({ itemId, qty }) => {
        const idx = newInventory.findIndex((i) => i.id === itemId);
        if (idx !== -1)
          newInventory[idx] = {
            ...newInventory[idx],
            currentQty: Math.max(0, newInventory[idx].currentQty - qty),
          };
      });
      if (targetItemId) {
        const idx = newInventory.findIndex((i) => i.id === targetItemId);
        if (idx !== -1)
          newInventory[idx] = {
            ...newInventory[idx],
            currentQty: newInventory[idx].currentQty + resultQty,
          };
      }

      setProduction(newProduction);
      setExpenses(newExpenses);
      setInventory(newInventory);
      syncToCloud({
        production: newProduction,
        expenses: newExpenses,
        inventory: newInventory,
      });
    },
    [production, expenses, inventory, syncToCloud],
  );

  const deleteProduction = useCallback(
    (id) => {
      const newList = production.filter((p) => p.id !== id);
      setProduction(newList);
      syncToCloud({ production: newList });
    },
    [production, syncToCloud],
  );

  // ── 配方儲存 ────────────────────────────────────────────
  const saveFormula = useCallback(
    (name, mode, inputs, results) => {
      const newList = [
        ...savedFormulas.filter((f) => f.name !== name),
        {
          id: uid(),
          name,
          mode,
          inputs,
          results,
          savedAt: new Date().toISOString(),
        },
      ];
      setSavedFormulas(newList);
      syncToCloud({ savedFormulas: newList });
    },
    [savedFormulas, syncToCloud],
  );

  const deleteFormula = useCallback(
    (id) => {
      const newList = savedFormulas.filter((f) => f.id !== id);
      setSavedFormulas(newList);
      syncToCloud({ savedFormulas: newList });
    },
    [savedFormulas, syncToCloud],
  );

  // ── 系統功能 ────────────────────────────────────────────
  const clearAllData = useCallback(async () => {
    // 加上確認視窗，避免手滑
    if (
      !window.confirm(
        "確定要清空「萌獸探險隊」所有雲端帳務資料嗎？此動作無法復原。",
      )
    )
      return;

    const empty = {
      revenues: [],
      expenses: [],
      inventory: [],
      production: [],
      savedFormulas: [],
      isInitialized: true, // 【關鍵】：加一個旗標，告訴程式「這不是新帳號，這是清空後的狀態」
    };

    // 先更新本地 UI
    setRevenues([]);
    setExpenses([]);
    setInventory([]);
    setProduction([]);
    setSavedFormulas([]);

    // 同步到雲端
    await syncToCloud(empty);
    alert("雲端資料已全數清空");
  }, [syncToCloud]);

  const importData = useCallback(
    async (jsonStr) => {
      try {
        const data = JSON.parse(jsonStr);
        const updatedData = {
          revenues: data.revenues || [],
          expenses: data.expenses || [],
          inventory: data.inventory || [],
          production: data.production || [],
          savedFormulas: data.savedFormulas || [],
          isInitialized: true, // 匯入後也標記為已初始化
        };

        setRevenues(updatedData.revenues);
        setExpenses(updatedData.expenses);
        setInventory(updatedData.inventory);
        setProduction(updatedData.production);
        setSavedFormulas(updatedData.savedFormulas);

        await syncToCloud(updatedData);
        return true;
      } catch (err) {
        console.error("匯入失敗:", err);
        return false;
      }
    },
    [syncToCloud],
  );

  const exportData = useCallback(() => {
    const blob = new Blob(
      [
        JSON.stringify(
          { revenues, expenses, inventory, production, savedFormulas },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `petbiz-cloud-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [revenues, expenses, inventory, production, savedFormulas]);

  return {
    revenues,
    expenses,
    inventory,
    production,
    loading,
    kpi,
    inventoryAlerts,
    addRevenue,
    deleteRevenue,
    toggleRevenueReported,
    addExpense,
    deleteExpense,
    toggleExpenseReported,
    addPurchase,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    resetInventoryToSeed,
    addProductionBatch,
    deleteProduction,
    savedFormulas,
    saveFormula,
    deleteFormula,
    clearAllData,
    exportData,
    importData,
  };
}
