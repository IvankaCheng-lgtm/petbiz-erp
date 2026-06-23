import { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "../firebase";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const nowStr = () => new Date().toISOString();

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

/**
 * FIFO 批次扣除：依 normalExp 升冪排序，從最快過期的批次開始扣。
 * 回傳更新後的 item（currentQty 和 expiryBatches 均已更新）。
 * 批次格式：{ batchId, normalExp, fridgeExp, freezerExp, qty }
 */
function deductFIFO(item, qtyToDeduct) {
  const batches = item.expiryBatches;

  if (!batches || batches.length === 0) {
    return { ...item, currentQty: Math.max(0, item.currentQty - qtyToDeduct) };
  }

  // 支援 normalExp 和舊欄位名 shelfExpiry
  const getExp = (b) => b.normalExp || b.shelfExpiry || null

  const sorted = [...batches].sort((a, b) => {
    const ea = getExp(a), eb = getExp(b)
    if (!ea && !eb) return 0;
    if (!ea) return 1;
    if (!eb) return -1;
    return ea.localeCompare(eb);
  });

  let remaining = qtyToDeduct;
  const updatedBatches = [];

  for (const batch of sorted) {
    if (remaining <= 0) { updatedBatches.push(batch); continue; }
    const deduct = Math.min(batch.qty, remaining);
    remaining -= deduct;
    const newQty = batch.qty - deduct;
    if (newQty > 0) updatedBatches.push({ ...batch, qty: newQty });
  }

  return {
    ...item,
    currentQty:    Math.max(0, item.currentQty - qtyToDeduct),
    expiryBatches: updatedBatches,
  };
}

/**
 * 將進貨/生產的效期資料標準化為統一批次格式
 * 輸入可能來自不同來源（進貨/生產），統一輸出 { batchId, normalExp, fridgeExp, freezerExp, qty }
 */
function normalizeBatch({ batchId, qty,
  normalExp, fridgeExp, freezerExp,       // 生產來源欄位
  shelfExpiry, fridgeExpiry, frozenExpiry, // 進貨來源欄位
  productionDate, prodDate,
}) {
  return {
    batchId:    batchId || uid(),
    normalExp:  normalExp  || shelfExpiry  || null,
    fridgeExp:  fridgeExp  || fridgeExpiry || null,
    freezerExp: freezerExp || frozenExpiry || null,
    productionDate: productionDate || prodDate || null,
    qty,
  };
}

export default function usePetBusiness() {
  const [revenues,      setRevenues]      = useState([]);
  const [expenses,      setExpenses]      = useState([]);
  const [inventory,     setInventory]     = useState([]);
  const [production,    setProduction]    = useState([]);
  const [savedFormulas, setSavedFormulas] = useState([]);
  const [marketEvents,  setMarketEvents]  = useState([]);
  const [orders,        setOrders]        = useState([]);
  const [inventoryLogs, setInventoryLogs] = useState([]);
  const [marketSales,   setMarketSales]   = useState([]);
  const [suppliers,     setSuppliers]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('petbiz_suppliers') || '[]'); } catch { return []; }
  });
  const [ingredientLibrary, setIngredientLibrary] = useState([]);
  const [loading,       setLoading]       = useState(true);

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
          const loadedEvents = d.marketEvents ?? [];
          const todayStr = new Date().toISOString().slice(0, 10);
          const expiredIds = loadedEvents
            .filter(e => e.status === '已報名' && e.endDate < todayStr)
            .map(e => e.id);
          if (expiredIds.length > 0) {
            const updated = loadedEvents.map(e =>
              expiredIds.includes(e.id) ? { ...e, status: '已結束' } : e
            );
            setMarketEvents(updated);
            setDoc(ERP_DOC_REF, { marketEvents: updated }, { merge: true });
          } else {
            setMarketEvents(loadedEvents);
          }
          setOrders(d.orders               ?? []);
          setInventoryLogs(d.inventoryLogs ?? []);
          setMarketSales(d.marketSales     ?? []);
          setIngredientLibrary(d.ingredientLibrary ?? []);
          const cloudSuppliers = d.suppliers ?? [];
          setSuppliers(cloudSuppliers);
          try { localStorage.setItem('petbiz_suppliers', JSON.stringify(cloudSuppliers)); } catch {}
        } else {
          setDoc(ERP_DOC_REF, {
            revenues: SEED_REVENUES, expenses: SEED_EXPENSES,
            inventory: SEED_INVENTORY, production: [],
            savedFormulas: [], marketEvents: [], inventoryLogs: [], isInitialized: true,
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
    const totalRevenue = revenues.filter(r => !r.isPending).reduce((s, r) => s + r.amount, 0);
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
    const netProfit    = totalRevenue - totalExpense;
    const profitRate   = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    return { totalRevenue, totalExpense, netProfit, profitRate };
  }, [revenues, expenses]);

  const inventoryAlerts = useMemo(
    () => inventory.filter(i => (i.category === "C食材" || i.category === "D包材") && i.currentQty < i.safetyQty),
    [inventory]
  );

  const upcomingEvents = useMemo(() => {
    const now  = new Date(); now.setHours(0, 0, 0, 0);
    const in7  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return marketEvents
      .filter(e => { const s = new Date(e.startDate); return e.status === "已報名" && s >= now && s <= in7; })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [marketEvents]);

  // ── 營收 ──────────────────────────────────────────────────────
  const addRevenue = useCallback(({ supplierId = null, customSupplierName = '', ...rest }) => {
    const item = {
      id: uid(),
      isReported: false,
      supplierId: supplierId || null,
      customSupplierName: supplierId ? '' : (customSupplierName || ''),
      ...rest,
    };
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
  const addExpense = useCallback(({ supplierId = null, customSupplierName = '', ...rest }) => {
    const item = {
      id: uid(),
      isReported: false,
      supplierId: supplierId || null,
      customSupplierName: supplierId ? '' : (customSupplierName || ''),
      ...rest,
    };
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

  const addPurchase = useCallback(async ({ date, itemId, itemName, category, qty, unitPrice, note, supplierId = null, supplierName = '', expiryBatch = null, recordExpense = true }) => {
    const amount = Math.ceil(qty * unitPrice);
    const resolvedSupplierId = supplierId || null;
    const newExp = recordExpense ? {
      id: uid(), date, type: "進貨",
      note: note || `進貨：${itemName}`,
      amount, isProductionCost: true, isReported: false,
      inventoryCategory: category,
      supplierId: resolvedSupplierId,
      supplierName: supplierName || '',
    } : null;
    const applyInv = (list) => {
      const idx = list.findIndex(i => i.id === itemId);
      if (idx !== -1) {
        const item = list[idx];
        const prevBatches = item.expiryBatches ?? [];
        const newBatches = expiryBatch
          ? [...prevBatches, normalizeBatch({ ...expiryBatch, qty })]
          : prevBatches;
        const oldQty = item.currentQty ?? 0;
        const oldCost = item.unitPrice ?? item.cost ?? unitPrice;
        const newAvgCost = oldQty + qty > 0
          ? Math.round(((oldQty * oldCost) + (qty * unitPrice)) / (oldQty + qty) * 1000) / 1000
          : unitPrice;
        const n = [...list];
        n[idx] = { ...item, currentQty: oldQty + qty, cost: newAvgCost, unitPrice: newAvgCost, expiryBatches: newBatches };
        return n;
      }
      return [...list, { id: uid(), category, itemName, currentQty: qty, cost: unitPrice, unitPrice, safetyQty: 0, unit: '個' }];
    };
    const log = { id: uid(), date, itemId, itemName, change: +qty, reason: `進貨${note ? `（${note}）` : ''}` };
    if (newExp) setExpenses(prev => [...prev, newExp]);
    setInventory(prev => {
      const updated = applyInv(prev);
      cloudUpdate("inventory", () => updated);
      return updated;
    });
    setInventoryLogs(prev => [...prev, log]);
    if (newExp) await cloudUpdate("expenses", list => [...list, newExp]);
    await cloudUpdate("inventoryLogs", list => [...list, log]);
  }, [cloudUpdate]);

  // ── 庫存 ──────────────────────────────────────────────────────
  const addInventoryItem = useCallback((data) => {
    const item = { id: uid(), ...data };
    setInventory(prev => [...prev, item]);
    cloudUpdate("inventory", list => [...list, item]);
  }, [cloudUpdate]);

  const addInventoryItems = useCallback((dataList) => {
    const items = dataList.map(data => ({ id: uid(), ...data }));
    setInventory(prev => [...prev, ...items]);
    cloudUpdate("inventory", list => [...list, ...items]);
  }, [cloudUpdate]);

  // 支援 barcode、shelfLifeNormal/Fridge/Freezer 欄位
  const updateInventoryItem = useCallback((id, data) => {
    const cleaned = {
      ...data,
      barcode:          data.barcode          || null,
      shelfLifeNormal:  data.shelfLifeNormal  ?? null,
      shelfLifeFridge:  data.shelfLifeFridge  ?? null,
      shelfLifeFreezer: data.shelfLifeFreezer ?? null,
    };
    setInventory(prev => prev.map(i => i.id === id ? { ...i, ...cleaned } : i));
    cloudUpdate("inventory", list => list.map(i => i.id === id ? { ...i, ...cleaned } : i));
  }, [cloudUpdate]);

  const deleteInventoryItem = useCallback((id) => {
    setInventory(prev => prev.filter(i => i.id !== id));
    cloudUpdate("inventory", list => list.filter(i => i.id !== id));
  }, [cloudUpdate]);

  const resetInventoryToSeed = useCallback(() => {
    setInventory(SEED_INVENTORY);
    cloudUpdate("inventory", () => SEED_INVENTORY);
  }, [cloudUpdate]);

  const importInventoryItems = useCallback((items) => {
    setInventory(prev => {
      const next = [...prev];
      items.forEach(item => {
        const idx = next.findIndex(i => i.itemName === item.itemName && i.category === item.category);
        if (idx !== -1) {
          next[idx] = { ...next[idx], ...item };
        } else {
          next.push({ id: uid(), ...item });
        }
      });
      cloudUpdate("inventory", () => next);
      return next;
    });
  }, [cloudUpdate]);

  // ── 生產 ──────────────────────────────────────────────────────
  // 多規格批次一次入庫，避免多次 setInventory 造成 state 競爭
  const addProductionBatches = useCallback(async (batchParamsList) => {
    if (!batchParamsList || batchParamsList.length === 0) return;

    // 為每筆建立 newBatch 物件（含 expiryBatchId）
    const newBatches = batchParamsList.map(params => {
      const batchExpiry = params.expiryBatch || params.expiryData || null;
      const expiryBatchId = batchExpiry ? uid() : null;
      return { newBatch: { id: uid(), ...params, expiryBatchId }, batchExpiry, expiryBatchId };
    });

    // 一次性計算所有庫存變更（含成本覆寫）
    const applyInv = (list) => {
      let next = [...list];
      const first = batchParamsList[0];
      const allIngredients = first.usedIngredients ?? [];
      const allPackaging   = first.usedPackaging   ?? [];

      // 共用食材（outputIdx === null）一次扣除
      allIngredients.filter(r => r.outputIdx === null || r.outputIdx === undefined)
        .forEach(({ itemId, qty }) => {
          const idx = next.findIndex(i => i.id === itemId);
          if (idx !== -1) next[idx] = deductFIFO(next[idx], qty);
        });
      // 指定規格的食材，依規格 index 扣除
      batchParamsList.forEach((_, oi) => {
        allIngredients.filter(r => r.outputIdx === oi)
          .forEach(({ itemId, qty }) => {
            const idx = next.findIndex(i => i.id === itemId);
            if (idx !== -1) next[idx] = deductFIFO(next[idx], qty);
          });
      });
      // 包材一次扣除（共用 + 指定）
      allPackaging.forEach(({ itemId, qty }) => {
        const idx = next.findIndex(i => i.id === itemId);
        if (idx !== -1) next[idx] = deductFIFO(next[idx], qty);
      });
      // 每個規格的 B食品產出 + 成本覆寫
      newBatches.forEach(({ newBatch: nb, batchExpiry, expiryBatchId }) => {
        const { targetItemId, resultQty, date, overwriteCost, costPerPack } = nb;
        if (!targetItemId) return;
        const idx = next.findIndex(i => i.id === targetItemId);
        if (idx === -1) return;
        const prevBatches = next[idx].expiryBatches ?? [];
        const updatedBatches = batchExpiry
          ? [...prevBatches, normalizeBatch({
              batchId:    expiryBatchId,
              normalExp:  batchExpiry.normalExp  || batchExpiry.shelfExpiry  || null,
              fridgeExp:  batchExpiry.fridgeExp  || batchExpiry.fridgeExpiry || null,
              freezerExp: batchExpiry.freezerExp || batchExpiry.frozenExpiry || null,
              productionDate: batchExpiry.productionDate || date,
              qty: resultQty,
            })]
          : prevBatches;
        next[idx] = {
          ...next[idx],
          currentQty: next[idx].currentQty + resultQty,
          expiryBatches: updatedBatches,
          ...(overwriteCost && costPerPack ? { cost: costPerPack } : {}),
        };
      });
      return next;
    };

    // 寫入 production
    const batchDocs = newBatches.map(b => b.newBatch);
    setProduction(prev => [...prev, ...batchDocs]);
    await cloudUpdate('production', list => [...list, ...batchDocs]);

    // 一次更新庫存（含成本覆寫）
    setInventory(prev => {
      const updated = applyInv(prev);
      cloudUpdate('inventory', () => updated);
      return updated;
    });

    // 寫入異動紀錄
    const logs = [];
    for (const { newBatch: nb } of newBatches) {
      const { date, note, targetItemId, resultQty, targetItemName } = nb;
      if (targetItemId && resultQty) {
        logs.push({
          id: uid(), date, itemId: targetItemId,
          itemName: targetItemName ?? note ?? '',
          change: +resultQty,
          reason: `生產入庫（${note || '批次生產'}）`,
        });
      }
    }
    if (logs.length > 0) {
      setInventoryLogs(prev => [...prev, ...logs]);
      cloudUpdate('inventoryLogs', list => [...list, ...logs]);
    }
  }, [cloudUpdate]);

  // 保留單筆版本供其他地方使用（內部委派給 addProductionBatches）
  const addProductionBatch = useCallback(async (params) => {
    await addProductionBatches([params]);
  }, [addProductionBatches]);

  const deleteProduction = useCallback((id) => {
    setProduction(prev => {
      const batch = prev.find(p => p.id === id);
      if (batch) {
        const restoreInv = (list) => {
          const next = [...list];
          (batch.usedIngredients ?? []).forEach(({ itemId, qty }) => {
            const idx = next.findIndex(i => i.id === itemId);
            if (idx !== -1) next[idx] = { ...next[idx], currentQty: next[idx].currentQty + qty };
          });
          (batch.usedPackaging ?? []).forEach(({ itemId, qty }) => {
            const idx = next.findIndex(i => i.id === itemId);
            if (idx !== -1) next[idx] = { ...next[idx], currentQty: next[idx].currentQty + qty };
          });
          if (batch.targetItemId && batch.resultQty) {
            const idx = next.findIndex(i => i.id === batch.targetItemId);
            if (idx !== -1) {
              const prevBatches = next[idx].expiryBatches ?? [];
              next[idx] = {
                ...next[idx],
                currentQty: Math.max(0, next[idx].currentQty - batch.resultQty),
                expiryBatches: batch.expiryBatchId
                  ? prevBatches.filter(b => b.batchId !== batch.expiryBatchId)
                  : prevBatches,
              };
            }
          }
          return next;
        };
        setInventory(prev => {
          const updated = restoreInv(prev);
          cloudUpdate('inventory', () => updated);
          return updated;
        });
        if (batch.targetItemId && batch.resultQty) {
          const log = {
            id: uid(), date: new Date().toISOString().slice(0, 10),
            itemId: batch.targetItemId,
            itemName: batch.targetItemName ?? batch.note ?? '',
            change: -batch.resultQty,
            reason: `刪除生產批次（${batch.date}${batch.note ? ' ' + batch.note : ''}）`,
          };
          setInventoryLogs(prev => [...prev, log]);
          cloudUpdate('inventoryLogs', list => [...list, log]);
        }
        if (batch.expenseId) {
          setExpenses(e => e.filter(x => x.id !== batch.expenseId));
          cloudUpdate('expenses', list => list.filter(x => x.id !== batch.expenseId));
        }
      }
      return prev.filter(p => p.id !== id);
    });
    cloudUpdate('production', list => list.filter(p => p.id !== id));
  }, [cloudUpdate]);

  // 刪除同批次所有規格：食材/包材只補回一次，各規格的 B食品產出分別扣回
  const deleteProductionGroup = useCallback((batches) => {
    if (!batches || batches.length === 0) return;
    const ids = new Set(batches.map(b => b.id));
    const first = batches[0];

    const restoreInv = (list) => {
      const next = [...list];
      // 食材與包材只補回一次（取第一筆，各規格共用同一份）
      (first.usedIngredients ?? []).forEach(({ itemId, qty }) => {
        const idx = next.findIndex(i => i.id === itemId);
        if (idx !== -1) next[idx] = { ...next[idx], currentQty: next[idx].currentQty + qty };
      });
      (first.usedPackaging ?? []).forEach(({ itemId, qty }) => {
        const idx = next.findIndex(i => i.id === itemId);
        if (idx !== -1) next[idx] = { ...next[idx], currentQty: next[idx].currentQty + qty };
      });
      // 各規格的 B食品產出分別扣回
      batches.forEach(batch => {
        if (batch.targetItemId && batch.resultQty) {
          const idx = next.findIndex(i => i.id === batch.targetItemId);
          if (idx !== -1) {
            const prevBatches = next[idx].expiryBatches ?? [];
            next[idx] = {
              ...next[idx],
              currentQty: Math.max(0, next[idx].currentQty - batch.resultQty),
              expiryBatches: batch.expiryBatchId
                ? prevBatches.filter(b => b.batchId !== batch.expiryBatchId)
                : prevBatches,
            };
          }
        }
      });
      return next;
    };

    setInventory(prev => {
      const updated = restoreInv(prev);
      cloudUpdate('inventory', () => updated);
      return updated;
    });

    // 寫入異動紀錄
    const date = new Date().toISOString().slice(0, 10);
    const logs = batches
      .filter(b => b.targetItemId && b.resultQty)
      .map(b => ({
        id: uid(), date,
        itemId: b.targetItemId,
        itemName: b.targetItemName ?? b.note ?? '',
        change: -b.resultQty,
        reason: `刪除生產批次（${b.date}${b.note ? ' ' + b.note : ''}）`,
      }));
    if (logs.length > 0) {
      setInventoryLogs(prev => [...prev, ...logs]);
      cloudUpdate('inventoryLogs', list => [...list, ...logs]);
    }

    setProduction(prev => prev.filter(p => !ids.has(p.id)));
    cloudUpdate('production', list => list.filter(p => !ids.has(p.id)));
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

  // ── 食材庫 ────────────────────────────────────────────────────
  const addIngredient = useCallback((data) => {
    const item = { id: uid(), ...data };
    setIngredientLibrary(prev => [...prev, item]);
    cloudUpdate('ingredientLibrary', list => [...list, item]);
  }, [cloudUpdate]);

  const updateIngredient = useCallback((id, data) => {
    setIngredientLibrary(prev => prev.map(i => i.id === id ? { ...i, ...data } : i));
    cloudUpdate('ingredientLibrary', list => list.map(i => i.id === id ? { ...i, ...data } : i));
  }, [cloudUpdate]);

  const deleteIngredient = useCallback((id) => {
    setIngredientLibrary(prev => prev.filter(i => i.id !== id));
    cloudUpdate('ingredientLibrary', list => list.filter(i => i.id !== id));
  }, [cloudUpdate]);

  // ── 銷售訂單 ──────────────────────────────────────────────────
  const updateOrder = useCallback((id, data) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...data } : o));
    cloudUpdate("orders", list => list.map(o => o.id === id ? { ...o, ...data } : o));
    if (data.total !== undefined || data.platform !== undefined) {
      setRevenues(prev => prev.map(r => r.orderId === id
        ? { ...r, ...(data.total !== undefined && { amount: data.total }), ...(data.platform !== undefined && { channel: data.platform }) }
        : r
      ));
      cloudUpdate("revenues", list => list.map(r => r.orderId === id
        ? { ...r, ...(data.total !== undefined && { amount: data.total }), ...(data.platform !== undefined && { channel: data.platform }) }
        : r
      ));
    }
  }, [cloudUpdate]);

  const addInventoryLog = useCallback((logs) => {
    setInventoryLogs(prev => [...prev, ...logs]);
    cloudUpdate("inventoryLogs", list => [...list, ...logs]);
  }, [cloudUpdate]);

  const adjustInventory = useCallback((itemId, itemName, change, reason) => {
    const date = new Date().toISOString().slice(0, 10);
    const log = { id: uid(), date, itemId, itemName, change, reason: reason || '庫存盤點' };
    setInventory(prev => {
      const item = prev.find(i => i.id === itemId);
      const raw = Math.round(Math.max(0, (item?.currentQty ?? 0) + change) * 10) / 10;
      let updated;
      if (change < 0) {
        updated = prev.map(i => i.id === itemId ? deductFIFO(i, -change) : i);
      } else {
        updated = prev.map(i => i.id === itemId ? { ...i, currentQty: raw } : i);
      }
      cloudUpdate('inventory', () => updated);
      return updated;
    });
    setInventoryLogs(prev => [...prev, log]);
    cloudUpdate('inventoryLogs', list => [...list, log]);
  }, [cloudUpdate]);

  const deleteOrder = useCallback((id) => {
    setOrders(prev => {
      const order = prev.find(o => o.id === id);
      // 只有已出貨的訂單才補回庫存
      if (order?.items && order.shipped) {
        const date = new Date().toISOString().slice(0, 10);
        const allItems = [...(order.items ?? []), ...(order.giftItems ?? [])];
        const logs = allItems.map(it => ({
          id: uid(), date, itemId: it.itemId, itemName: it.itemName,
          change: +it.qty, reason: `刪除銷售訂單（${order.platform} ${order.orderDate}）`,
        }));
        setInventoryLogs(p => [...p, ...logs]);
        cloudUpdate("inventoryLogs", list => [...list, ...logs]);
        setInventory(inv => {
          const next = [...inv];
          allItems.forEach(({ itemId, qty }) => {
            const idx = next.findIndex(i => i.id === itemId);
            if (idx !== -1) next[idx] = { ...next[idx], currentQty: next[idx].currentQty + qty };
          });
          cloudUpdate("inventory", () => next);
          return next;
        });
      }
      return prev.filter(o => o.id !== id);
    });
    cloudUpdate("orders", list => list.filter(o => o.id !== id));
    setRevenues(prev => prev.filter(r => r.orderId !== id));
    cloudUpdate("revenues", list => list.filter(r => r.orderId !== id));
    setExpenses(prev => prev.filter(e => e.orderId !== id));
    cloudUpdate("expenses", list => list.filter(e => e.orderId !== id));
  }, [cloudUpdate]);

  const processOrder = useCallback(async ({ platform, items, giftItems = [], discountType, discountValue, totalAmount, platformCost, supplierId = null, skipRevenue = false, pendingRevenue = false, linePayRevenue = false, note = '', withShipment = true }) => {
    const today = new Date().toISOString().slice(0, 10);
    const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    const discount = subtotal - totalAmount;
    const cost = parseFloat(platformCost) || 0;

    const order = {
      id: uid(), platform, items, giftItems, subtotal, discount, total: totalAmount,
      orderDate: today,
      status: withShipment ? "已完成" : "待出貨",
      shipped: withShipment,
      discountType: discountType ?? null,
      discountValue: discountValue ?? null,
      platformCost: cost,
      supplierId: supplierId || null,
      skipRevenue,
      pendingRevenue,
      linePayRevenue,
      note: note || '',
    };

    setOrders(prev => [...prev, order]);
    await cloudUpdate("orders", list => [...list, order]);

    if (withShipment) {
      const allItems = [...items, ...giftItems];
      const applyInv = (list) => {
        let next = [...list];
        allItems.forEach(({ itemId, qty }) => {
          const idx = next.findIndex(i => i.id === itemId);
          if (idx !== -1) next[idx] = deductFIFO(next[idx], qty);
        });
        return next;
      };
      const logs = [
        ...items.map(it => ({ id: uid(), date: today, itemId: it.itemId, itemName: it.itemName, change: -it.qty, reason: `銷售訂單（${platform}）` })),
        ...giftItems.map(it => ({ id: uid(), date: today, itemId: it.itemId, itemName: it.itemName, change: -it.qty, reason: `贈品（${platform}）` })),
      ];
      const costExp = cost > 0 ? {
        id: uid(), date: today,
        type: supplierId ? '寄賣抽成' : '行銷',
        note: supplierId
          ? `寄賣點抽成：${platform}（訂單 ${order.id.slice(-4)}）`
          : `平台手續費：${platform}（訂單 ${order.id.slice(-4)}）`,
        amount: cost, isProductionCost: false, isReported: false,
        orderId: order.id, supplierId: supplierId || null,
      } : null;
      setInventory(prev => {
        const updated = applyInv(prev);
        cloudUpdate("inventory", () => updated);
        return updated;
      });
      setInventoryLogs(prev => [...prev, ...logs]);
      if (costExp) setExpenses(prev => [...prev, costExp]);
      await cloudUpdate("inventoryLogs", list => [...list, ...logs]);
      if (costExp) await cloudUpdate("expenses", list => [...list, costExp]);
      if (!skipRevenue) {
        if (linePayRevenue) {
          // LINE Pay：存入 marketSales，不寫 revenues（撥款後再人工入帳）
          const saleRecord = {
            id: uid(), date: today, channel: platform, category: '電商銷售',
            amount: totalAmount, paymentMethod: 'LINE Pay',
            items: items.map(({ itemId, itemName, category, qty, unitPrice }) => ({ itemId, itemName, category, qty, unitPrice })),
            giftItems: [],
          };
          setMarketSales(prev => [...prev, saleRecord]);
          await cloudUpdate('marketSales', list => [...list, saleRecord]);
        } else {
          const revenueItem = {
            id: uid(), date: today, channel: platform, category: "電商銷售",
            amount: totalAmount, isReported: false, orderId: order.id, items,
            platformCost: cost, supplierId: supplierId || null,
            isPending: pendingRevenue,
          };
          setRevenues(prev => [...prev, revenueItem]);
          await cloudUpdate("revenues", list => [...list, revenueItem]);
        }
      }
    }
  }, [cloudUpdate]);

  // ── 供應商 CRUD ──────────────────────────────────────────────
  const addSupplier = useCallback((data) => {
    const item = { id: uid(), ...data };
    setSuppliers(prev => {
      const next = [...prev, item];
      try { localStorage.setItem('petbiz_suppliers', JSON.stringify(next)); } catch {}
      return next;
    });
    cloudUpdate('suppliers', list => [...list, item]);
  }, [cloudUpdate]);

  const updateSupplier = useCallback((id, data) => {
    setSuppliers(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...data } : s);
      try { localStorage.setItem('petbiz_suppliers', JSON.stringify(next)); } catch {}
      return next;
    });
    cloudUpdate('suppliers', list => list.map(s => s.id === id ? { ...s, ...data } : s));
  }, [cloudUpdate]);

  const deleteSupplier = useCallback((id) => {
    setSuppliers(prev => {
      const next = prev.filter(s => s.id !== id);
      try { localStorage.setItem('petbiz_suppliers', JSON.stringify(next)); } catch {}
      return next;
    });
    cloudUpdate('suppliers', list => list.filter(s => s.id !== id));
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

  const deleteMarketSale = useCallback((revenueId) => {
    setRevenues(prev => {
      const rev = prev.find(r => r.id === revenueId);
      if (rev?.items) {
        const date = new Date().toISOString().slice(0, 10);
        const logs = rev.items.map(it => ({
          id: uid(), date, itemId: it.itemId, itemName: it.itemName,
          change: +it.qty, reason: `刪除市集銷售紀錄（${rev.date}）`,
        }));
        setInventoryLogs(p => [...p, ...logs]);
        cloudUpdate("inventoryLogs", list => [...list, ...logs]);
        setInventory(inv => {
          const next = [...inv];
          rev.items.forEach(({ itemId, qty }) => {
            const idx = next.findIndex(i => i.id === itemId);
            if (idx !== -1) next[idx] = { ...next[idx], currentQty: next[idx].currentQty + qty };
          });
          return next;
        });
        cloudUpdate("inventory", list => {
          const next = [...list];
          rev.items.forEach(({ itemId, qty }) => {
            const idx = next.findIndex(i => i.id === itemId);
            if (idx !== -1) next[idx] = { ...next[idx], currentQty: next[idx].currentQty + qty };
          });
          return next;
        });
      }
      return prev.filter(r => r.id !== revenueId);
    });
    cloudUpdate("revenues", list => list.filter(r => r.id !== revenueId));
  }, [cloudUpdate]);

  // ── 市集現場收款 ──────────────────────────────────────────────
  const processMarketSale = useCallback(async ({ items, giftItems = [], paymentMethod, totalAmount, eventId, overrideDate, note }) => {
    const today = overrideDate || new Date().toISOString().slice(0, 10);
    const allItems = [...items, ...giftItems];
    const catMap = { "A用品": "用品", "B食品": "食品" };
    const allForCat = (items.length > 0 ? items : giftItems).filter(Boolean);
    const cats = [...new Set(allForCat.map(i => catMap[i?.category] ?? "食品"))];
    const category = cats.length === 1 ? cats[0] : "食品";
    const isLinePay = paymentMethod === 'LINE Pay';

    const saleRecord = {
      id: uid(), date: today, channel: "市集", category,
      amount: totalAmount, paymentMethod, eventId,
      items: items.map(({ itemId, itemName, category, qty, unitPrice }) => ({ itemId, itemName, category, qty, unitPrice })),
      giftItems: giftItems.map(({ itemId, itemName, category, qty, unitPrice, cost }) => ({ itemId, itemName, category, qty, unitPrice, cost: cost || 0 })),
    };

    const applyInv = (list) => {
      let next = [...list];
      allItems.forEach(({ itemId, qty }) => {
        const idx = next.findIndex(i => i.id === itemId);
        if (idx !== -1) next[idx] = deductFIFO(next[idx], qty);
      });
      return next;
    };

    const logs = [
      ...items.map(it => ({
        id: uid(), date: today, itemId: it.itemId, itemName: it.itemName,
        change: -it.qty, reason: `市集銷售（${paymentMethod}）`,
        saleId: saleRecord.id,
      })),
      ...giftItems.map(it => ({
        id: uid(), date: today, itemId: it.itemId, itemName: it.itemName,
        change: -it.qty, reason: `市集贈品`,
        saleId: saleRecord.id,
      })),
    ];

    const giftCost = giftItems.reduce((s, it) => s + (it.cost || 0) * it.qty, 0);
    // giftCost 只存入 saleRecord 供結算統計計算淨利，不另開支出（食材成本已在進貨時記錄）
    const saleRecordWithCost = { ...saleRecord, giftCost };

    if (isLinePay) {
      const revenueItem = { ...saleRecordWithCost, isReported: false, isPending: true };
      setRevenues(prev => [...prev, revenueItem]);
      setMarketSales(prev => [...prev, saleRecordWithCost]);
      setInventory(applyInv);
      setInventoryLogs(prev => [...prev, ...logs]);
      await cloudUpdate("revenues",      list => [...list, revenueItem]);
      await cloudUpdate("marketSales",   list => [...list, saleRecordWithCost]);
      await cloudUpdate("inventory",     applyInv);
      await cloudUpdate("inventoryLogs", list => [...list, ...logs]);
    } else {
      const revenueItem = { ...saleRecordWithCost, isReported: false };
      setRevenues(prev => [...prev, revenueItem]);
      setInventory(applyInv);
      setInventoryLogs(prev => [...prev, ...logs]);
      await cloudUpdate("revenues",      list => [...list, revenueItem]);
      await cloudUpdate("inventory",     applyInv);
      await cloudUpdate("inventoryLogs", list => [...list, ...logs]);
    }
  }, [cloudUpdate]);

  const shipOrder = useCallback(async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.shipped) return;
    const today = new Date().toISOString().slice(0, 10);
    const cost = order.platformCost || 0;
    const allItems = [...(order.items ?? []), ...(order.giftItems ?? [])];
    const applyInv = (list) => {
      let next = [...list];
      allItems.forEach(({ itemId, qty }) => {
        const idx = next.findIndex(i => i.id === itemId);
        if (idx !== -1) next[idx] = deductFIFO(next[idx], qty);
      });
      return next;
    };
    const logs = [
      ...(order.items ?? []).map(it => ({ id: uid(), date: today, itemId: it.itemId, itemName: it.itemName, change: -it.qty, reason: `出貨（${order.platform}）` })),
      ...(order.giftItems ?? []).map(it => ({ id: uid(), date: today, itemId: it.itemId, itemName: it.itemName, change: -it.qty, reason: `贈品出貨（${order.platform}）` })),
    ];
    const costExp = cost > 0 ? {
      id: uid(), date: today,
      type: order.supplierId ? '寄賣抽成' : '行銷',
      note: order.supplierId
        ? `寄賣點抽成：${order.platform}（訂單 ${orderId.slice(-4)}）`
        : `平台手續費：${order.platform}（訂單 ${orderId.slice(-4)}）`,
      amount: cost, isProductionCost: false, isReported: false,
      orderId, supplierId: order.supplierId || null,
    } : null;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, shipped: true, status: '已出貨', shippedAt: today } : o));
    setInventory(prev => {
      const updated = applyInv(prev);
      cloudUpdate('inventory', () => updated);
      return updated;
    });
    setInventoryLogs(prev => [...prev, ...logs]);
    if (costExp) setExpenses(prev => [...prev, costExp]);
    await cloudUpdate('orders', list => list.map(o => o.id === orderId ? { ...o, shipped: true, status: '已出貨', shippedAt: today } : o));
    await cloudUpdate('inventoryLogs', list => [...list, ...logs]);
    if (costExp) await cloudUpdate('expenses', list => [...list, costExp]);
    if (!order.skipRevenue) {
      const revenueItem = {
        id: uid(), date: today, channel: order.platform, category: "電商銷售",
        amount: order.total, isReported: false, orderId, items: order.items,
        platformCost: cost, supplierId: order.supplierId || null,
      };
      setRevenues(prev => [...prev, revenueItem]);
      await cloudUpdate('revenues', list => [...list, revenueItem]);
    }
  }, [cloudUpdate, orders]);

  // ── 系統 ──────────────────────────────────────────────────────────────
  const clearAllData = useCallback(async () => {
    if (!window.confirm("確定要清空所有雲端帳務資料嗎？此動作無法復原。")) return;
    const empty = { revenues: [], expenses: [], inventory: [], production: [], savedFormulas: [], marketEvents: [], orders: [], inventoryLogs: [], isInitialized: true };
    setRevenues([]); setExpenses([]); setInventory([]); setProduction([]); setSavedFormulas([]); setMarketEvents([]); setOrders([]); setInventoryLogs([]);
    await setDoc(ERP_DOC_REF, empty);
    alert("雲端資料已全數清空");
  }, []);

  const exportData = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({ revenues, expenses, inventory, production, savedFormulas, marketEvents, orders }, null, 2)],
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
        orders:        d.orders        ?? [],
        isInitialized: true,
      };
      setRevenues(data.revenues); setExpenses(data.expenses);
      setInventory(data.inventory); setProduction(data.production);
      setSavedFormulas(data.savedFormulas); setMarketEvents(data.marketEvents);
      setOrders(data.orders);
      await setDoc(ERP_DOC_REF, data);
      return true;
    } catch (err) {
      console.error("匯入失敗:", err);
      return false;
    }
  }, []);

  return {
    revenues, expenses, inventory, production, savedFormulas, marketEvents, orders, inventoryLogs, marketSales, suppliers, ingredientLibrary, loading,
    kpi, inventoryAlerts, upcomingEvents,
    addRevenue, deleteRevenue, toggleRevenueReported,
    addExpense, deleteExpense, toggleExpenseReported,
    addPurchase,
    addInventoryItem, addInventoryItems, updateInventoryItem, deleteInventoryItem, resetInventoryToSeed, importInventoryItems,
    addProductionBatch, addProductionBatches, deleteProduction, deleteProductionGroup,
    saveFormula, deleteFormula,
    addSupplier, updateSupplier, deleteSupplier,
    addMarketEvent, updateMarketEvent, deleteMarketEvent, deleteMarketSale,
    processMarketSale, processOrder, shipOrder, updateOrder, deleteOrder, addInventoryLog, adjustInventory,
    addIngredient, updateIngredient, deleteIngredient,
    clearAllData, exportData, importData,
  };
}
