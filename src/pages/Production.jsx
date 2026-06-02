import { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Zap,
  AlertTriangle,
  Sparkles,
  Loader2,
  Search,
  Copy,
} from "lucide-react";
import {
  SectionCard,
  FormRow,
  Modal,
  inputCls,
  btnPrimary,
  btnSecondary,
  btnDanger,
} from "../components/ui";
import { fmt, fmtPrice } from "../utils/format";
import { calcElectricityCost, getElectricRate } from "../hooks/usePetBusiness";
import { askGemini } from "../services/geminiService";

// ── AI 食材比例計算助手 ──────────────────────────────────────────────
function AiRecipeAssistant({ cItems, production }) {
  const [question, setQuestion] = useState('')
  const [answer,   setAnswer]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleAsk() {
    if (!question.trim() || loading) return
    setLoading(true)
    setAnswer('')
    setError('')
    const lastBatch = [...production].sort((a, b) => b.date.localeCompare(a.date))[0]
    const ingredientList = cItems.length > 0
      ? cItems.map(i => `${i.itemName}（庫存 ${i.currentQty}${i.unit}，單價 $${i.unitPrice}/${i.unit}）`).join('\n')
      : '目前無食材庫存'
    const lastBatchInfo = lastBatch
      ? `最近一次生產（${lastBatch.date}）：${lastBatch.note || '無備註'}，產出 ${lastBatch.resultQty} 包。食材：${lastBatch.usedIngredients?.map(i => `${i.itemName} ${i.qty}${cItems.find(c => c.id === i.itemId)?.unit || ''}`).join('、') || '無'}`
      : '尚無生產紀錄'
    const context = `目前 C食材庫存：
${ingredientList}

${lastBatchInfo}

你是寵物食品生產配方專家。請根據使用者的問題幫助計算食材比例調整。回答請：1.明確列出每種食材調整後用量（含單位） 2.說明比例公式 3.如果庫存不足請提醒。用繁體中文簡潔回答。`
    try {
      const result = await askGemini(question, context)
      setAnswer(result)
    } catch {
      setError('AI 回答失敗，請稍後再試。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard title="🤖 AI 食材比例計算助手">
      <div className="space-y-4">
        <p className="text-xs text-gray-400">
          可詢問比例調整，例如：「原本配方用 100g 雞胸肉，這次有 300g，其餘食材要改多少？」
          或「原本產出 100g，這次想產出 500g，食材要改為多少？」
        </p>
        <div className="flex gap-2">
          <input type="text" className={inputCls + ' flex-1'}
            placeholder="輸入比例調整問題..."
            value={question} disabled={loading}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && question.trim() && handleAsk()} />
          <button onClick={handleAsk} disabled={loading || !question.trim()}
            className="flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#722927' }}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? '計算中...' : 'AI 計算'}
          </button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {answer && (
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {answer}
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ── 可搜尋下拉元件 ───────────────────────────────────────────
function SearchableSelect({ value, onChange, options, placeholder = '請選擇' }) {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const ref                 = useRef(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options
  }, [options, query])

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button type="button"
        onClick={() => { setOpen(v => !v); setQuery('') }}
        className={inputCls + ' w-full text-left flex items-center justify-between gap-2 ' + (!value ? 'text-gray-400' : 'text-gray-800')}>
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <Search size={13} className="shrink-0 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus type="text" value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜尋..."
              className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300" />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button type="button"
              onClick={() => { onChange(''); setOpen(false); setQuery('') }}
              className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50">
              {placeholder}
            </button>
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-400">查無結果</p>
            )}
            {filtered.map(o => (
              <button type="button" key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 transition-colors ${
                  o.value === value ? 'bg-orange-50 text-orange-600 font-medium' : 'text-gray-700'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const STEPS = ["食材投入", "產出設定", "電力成本", "包材選用", "成本分析"];
const today = () => new Date().toISOString().slice(0, 10);

function addDays(dateStr, days) {
  if (!dateStr || !days) return ''
  const d = new Date(dateStr)
  d.setDate(d.getDate() + parseInt(days))
  return d.toISOString().slice(0, 10)
}

// ── 步驟條 ────────────────────────────────────────────────────
function StepBar({ current }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "text-white"
                      : "bg-gray-200 text-gray-400"
                }`}
                style={active ? { backgroundColor: "#722927" } : {}}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs whitespace-nowrap hidden sm:block
                ${active ? "font-semibold text-gray-800" : "text-gray-400"}`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-8 sm:w-12 mx-1 mb-4 transition-colors
                ${i < current ? "bg-emerald-400" : "bg-gray-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 主組件 ───────────────────────────────────────────────────
export default function Production({ data }) {
  const { inventory, production, addProductionBatch, addProductionBatches, deleteProduction, deleteProductionGroup, addInventoryItem, updateInventoryItem } = data;

  // ── 庫存篩選 ─────────────────────────────────────────────
  const cItems = useMemo(
    () => inventory.filter((i) => i.category === "C食材"),
    [inventory],
  );
  const bItems = useMemo(
    () => inventory.filter((i) => i.category === "B食品"),
    [inventory],
  );
  const dItems = useMemo(
    () => inventory.filter((i) => i.category === "D包材"),
    [inventory],
  );

  // ── 表單狀態 ─────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [details, setDetails] = useState("");

  // 步驟一：食材 [{ itemId, qty }]
  const [ingredients, setIngredients] = useState([]);

  // 步驟二：產出（多規格）[{ targetItemId, newItemName, packSize, packQty, batchNote, shelfExpiry, fridgeExpiry, frozenExpiry }]
  const [outputs, setOutputs] = useState([]);
  const [outputUnit, setOutputUnit] = useState("克");
  const [totalOutputQty, setTotalOutputQty] = useState(""); // 手動輸入總產出量（僅供紀錄）

  // 步驟三：電力（支援多台機器）
  const [machines, setMachines] = useState([{ watt: 1100, hours: 16, label: '' }]);
  const [elecRatio, setElecRatio] = useState(100);

  // 步驟四：包材 [{ itemId, qty }]
  const [packaging, setPackaging] = useState([]);
  // 步驟五：成本覆寫
  const [overwriteCost, setOverwriteCost] = useState(false);

  // ── 衍生計算 ────────────────────────────────────────────
  // 總產出重量
  const totalOutputWeight = useMemo(() => {
    return outputs.reduce((sum, row) => {
      const ps = parseFloat(row.packSize) || 0;
      const pq = parseFloat(row.packQty) || 0;
      return sum + ps * pq;
    }, 0);
  }, [outputs]);

  // 總包數
  const totalPackQty = useMemo(() => {
    return outputs.reduce((sum, row) => sum + (parseFloat(row.packQty) || 0), 0);
  }, [outputs]);

  const ingredientCost = useMemo(
    () =>
      ingredients.reduce((s, row) => {
        const item = cItems.find((i) => i.id === row.itemId);
        return (
          s + (item ? (item.unitPrice || 0) * (parseFloat(row.qty) || 0) : 0)
        );
      }, 0),
    [ingredients, cItems],
  );

  const electricCostFull = useMemo(
    () => machines.reduce((s, m) => s + calcElectricityCost(parseFloat(m.watt) || 0, parseFloat(m.hours) || 0, date), 0),
    [machines, date],
  );

  const electricCost = useMemo(
    () => electricCostFull * ((parseFloat(elecRatio) || 0) / 100),
    [electricCostFull, elecRatio],
  );

  const packagingCost = useMemo(
    () =>
      packaging.reduce((s, row) => {
        const item = dItems.find((i) => i.id === row.itemId);
        return (
          s + (item ? (item.unitPrice || 0) * (parseFloat(row.qty) || 0) : 0)
        );
      }, 0),
    [packaging, dItems],
  );

  const totalCost = useMemo(
    () => ingredientCost + electricCost + packagingCost,
    [ingredientCost, electricCost, packagingCost],
  );

  // 包材成本：分為「指定規格」和「共用（按重量平攤）」
  const packagingCostByOutput = useMemo(() => {
    // 各規格的指定包材成本
    const direct = outputs.map((_, oi) =>
      packaging
        .filter(r => r.outputIdx === oi)
        .reduce((s, r) => {
          const item = dItems.find(i => i.id === r.itemId);
          return s + (item ? (item.unitPrice || 0) * (parseFloat(r.qty) || 0) : 0);
        }, 0)
    );
    // 共用包材成本（outputIdx === null）
    const shared = packaging
      .filter(r => r.outputIdx === null)
      .reduce((s, r) => {
        const item = dItems.find(i => i.id === r.itemId);
        return s + (item ? (item.unitPrice || 0) * (parseFloat(r.qty) || 0) : 0);
      }, 0);
    return { direct, shared };
  }, [packaging, outputs, dItems]);

  // 各規格成本（食材+電費按重量比例，包材依指定/共用分別計算）
  const outputsWithCost = useMemo(() => {
    if (totalOutputWeight === 0) return outputs.map(o => ({ ...o, cost: 0, costPerPack: 0, ratio: 0, weight: 0 }));
    return outputs.map((row, oi) => {
      const ps = parseFloat(row.packSize) || 0;
      const pq = parseFloat(row.packQty) || 0;
      const weight = ps * pq;
      const ratio = weight / totalOutputWeight;
      // 食材 + 電費 按重量比例
      const ingElecCost = (ingredientCost + electricCost) * ratio;
      // 包材：直接指定 + 共用按比例
      const pkgCost = packagingCostByOutput.direct[oi] + packagingCostByOutput.shared * ratio;
      const cost = ingElecCost + pkgCost;
      const costPerPack = pq > 0 ? Math.round((cost / pq) * 10000) / 10000 : 0;
      return { ...row, cost, costPerPack, weight, ratio, pkgCost };
    });
  }, [outputs, totalOutputWeight, ingredientCost, electricCost, packagingCostByOutput]);

  const rate = useMemo(() => getElectricRate(date), [date]);
  const isSummer = rate === 6.24;

  // ── 防呆：庫存不足檢查 ───────────────────────────────────
  const ingredientShortage = useMemo(
    () =>
      ingredients
        .filter((row) => {
          const item = cItems.find((i) => i.id === row.itemId);
          return item && (parseFloat(row.qty) || 0) > item.currentQty;
        })
        .map((row) => cItems.find((i) => i.id === row.itemId)?.itemName),
    [ingredients, cItems],
  );

  const packagingShortage = useMemo(
    () =>
      packaging
        .filter((row) => {
          const item = dItems.find((i) => i.id === row.itemId);
          return item && (parseFloat(row.qty) || 0) > item.currentQty;
        })
        .map((row) => dItems.find((i) => i.id === row.itemId)?.itemName),
    [packaging, dItems],
  );

  // 各規格的包材列表（用於步驟四顯示）
  const outputLabels = useMemo(() =>
    outputs.map((row, idx) => {
      if (row.targetItemId === '__new__') return row.newItemName || `新品項 ${idx + 1}`;
      return bItems.find(i => i.id === row.targetItemId)?.itemName || `規格 ${idx + 1}`;
    })
  , [outputs, bItems]);

  const allShortages = useMemo(
    () => [...ingredientShortage, ...packagingShortage],
    [ingredientShortage, packagingShortage],
  );

  const canSubmit = allShortages.length === 0 && totalPackQty > 0;

  // ── 步驟驗證 ─────────────────────────────────────────────
  function canNext() {
    if (step === 0)
      return (
        ingredients.length > 0 && ingredients.every((r) => r.itemId && r.qty)
      );
    if (step === 1) return outputs.length > 0 && outputs.every(o => o.packSize && o.packQty);
    if (step === 2) return machines.every(m => m.watt && m.hours);
    return true;
  }

  // ── 食材操作 ─────────────────────────────────────────────
  function addIngredientRow() {
    setIngredients((p) => [...p, { itemId: "", qty: "" }]);
  }
  function removeIngredientRow(idx) {
    setIngredients((p) => p.filter((_, i) => i !== idx));
  }
  function updateIngredient(idx, f, v) {
    setIngredients((p) => p.map((r, i) => (i === idx ? { ...r, [f]: v } : r)));
  }

  // ── 包材操作 ─────────────────────────────────────────────
  function addPackagingRow() {
    setPackaging((p) => [...p, { itemId: "", qty: "", outputIdx: null }]);
  }
  function removePackagingRow(idx) {
    setPackaging((p) => p.filter((_, i) => i !== idx));
  }
  function updatePackaging(idx, f, v) {
    setPackaging((p) => p.map((r, i) => (i === idx ? { ...r, [f]: v } : r)));
  }

  // ── 產出操作 ─────────────────────────────────────────────
  function addOutputRow() {
    setOutputs(p => [...p, { targetItemId: '', newItemName: '', packSize: '', packQty: '', batchNote: '', shelfExpiry: '', fridgeExpiry: '', frozenExpiry: '' }]);
  }
  function removeOutputRow(idx) {
    setOutputs(p => p.filter((_, i) => i !== idx));
  }
  function updateOutput(idx, f, v) {
    setOutputs(p => p.map((r, i) => (i === idx ? { ...r, [f]: v } : r)));
  }

  // ── 重置表單 ─────────────────────────────────────────────
  // 載入舊批次到表單（方案 3：複製修改）
  function loadBatchToForm(batches) {
    // batches 為同一 batchGroupId 的所有規格，取第一筆的共用資料
    const first = batches[0];
    setDate(first.date);
    setNote(first.note?.split(' - ')[0] || '');
    setDetails(first.details || '');
    setIngredients(
      (first.usedIngredients ?? []).map(i => ({ itemId: i.itemId, qty: String(i.qty) }))
    );
    setOutputUnit(first.outputUnit || '克');
    setTotalOutputQty(String(first.outputQty || ''));
    setMachines(
      first.machines ?? [{ watt: first.machineWatt || 1100, hours: first.hours || 16, label: '' }]
    );
    setElecRatio(first.elecRatio ?? 100);
    setPackaging(
      (first.usedPackaging ?? []).map(i => ({ itemId: i.itemId, qty: String(i.qty), outputIdx: null }))
    );
    setOutputs(
      batches.map(b => ({
        targetItemId: b.targetItemId || '',
        newItemName: '',
        packSize: String(b.packSize || ''),
        packQty: String(b.resultQty || ''),
        batchNote: b.batchNote || '',
        shelfExpiry: '',
        fridgeExpiry: '',
        frozenExpiry: '',
      }))
    );
    setOverwriteCost(false);
    setStep(0);
    setShowForm(true);
  }

  function resetForm() {
    setStep(0);
    setDate(today());
    setNote("");
    setDetails("");
    setIngredients([]);
    setOutputs([]);
    setOutputUnit("克");
    setTotalOutputQty("");
    setMachines([{ watt: 1100, hours: 16, label: '' }]);
    setElecRatio(100);
    setPackaging([]);
    setOverwriteCost(false);
    setShowForm(false);
  }

  // ── 確認入庫 ─────────────────────────────────────────────
  async function handleSubmit() {
    if (!canSubmit) return;

    // 處理多規格產出：為每個新品項建立庫存
    const resolvedOutputs = await Promise.all(outputsWithCost.map(async (output) => {
      let resolvedId = (output.targetItemId && output.targetItemId !== '__new__') ? output.targetItemId : null;
      if (output.targetItemId === '__new__' && output.newItemName?.trim()) {
        const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        addInventoryItem({
          id:         newId,
          category:   'B食品',
          itemName:   output.newItemName.trim(),
          currentQty: 0,
          safetyQty:  0,
          unit:       '包',
          cost:       output.costPerPack,
        });
        resolvedId = newId;
      }
      return { ...output, resolvedId };
    }));

    const usedIngredients = ingredients
      .filter((r) => r.itemId && r.qty)
      .map((r) => {
        const item = cItems.find((i) => i.id === r.itemId);
        return {
          itemId: r.itemId,
          itemName: item?.itemName || "",
          qty: parseFloat(r.qty),
          unitPrice: item?.unitPrice || 0,
          cost: (item?.unitPrice || 0) * parseFloat(r.qty),
        };
      });

    const usedPackaging = packaging
      .filter((r) => r.itemId && r.qty)
      .map((r) => {
        const item = dItems.find((i) => i.id === r.itemId);
        return {
          itemId: r.itemId,
          itemName: item?.itemName || "",
          qty: parseFloat(r.qty),
          unitPrice: item?.unitPrice || 0,
          cost: (item?.unitPrice || 0) * parseFloat(r.qty),
        };
      });

    // 為每個規格建立生產批次記錄，一次送出避免 state 競爭
    const batchGroupId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const batchParamsList = resolvedOutputs.map((output, outputIdx) => {
      const targetItem = output.resolvedId ? bItems.find(i => i.id === output.resolvedId) : null;
      const itemName = targetItem?.itemName || output.newItemName?.trim() || '';
      const isFirst = outputIdx === 0;
      return {
        batchGroupId,
        date,
        note: `${note}${output.batchNote ? ` - ${output.batchNote}` : ''}`,
        details,
        machines,
        machineWatt: machines.reduce((s, m) => s + (parseFloat(m.watt) || 0), 0),
        hours: machines[0]?.hours ?? 0,
        elecRatio: parseFloat(elecRatio),
        usedIngredients: isFirst ? usedIngredients : [],
        usedPackaging: isFirst ? usedPackaging : [],
        outputQty: parseFloat(totalOutputQty) || output.weight,
        outputUnit,
        packSize: parseFloat(output.packSize),
        resultQty: parseFloat(output.packQty),
        targetItemId: output.resolvedId,
        targetItemName: itemName,
        ingredientCost: Math.round(ingredientCost * output.ratio * 10000) / 10000,
        electricCost: Math.round(electricCost * output.ratio * 10000) / 10000,
        packagingCost: Math.round(packagingCost * output.ratio * 10000) / 10000,
        totalCost: Math.round(output.cost * 10000) / 10000,
        costPerPack: output.costPerPack,
        overwriteCost,
        expiryBatch: (output.shelfExpiry || output.fridgeExpiry || output.frozenExpiry) ? {
          productionDate: date,
          batchNote: output.batchNote || note || '',
          qty: parseFloat(output.packQty),
          shelfExpiry:  output.shelfExpiry  || null,
          fridgeExpiry: output.fridgeExpiry || null,
          frozenExpiry: output.frozenExpiry || null,
        } : null,
      };
    });
    await addProductionBatches(batchParamsList);

    resetForm();
  }

  const [detailBatch, setDetailBatch] = useState(null);
  const [prodSearch,  setProdSearch]  = useState('');
  const [prodPage,    setProdPage]    = useState(1);
  const PROD_PAGE_SIZE = 15;

  const sorted = useMemo(
    () => [...production].sort((a, b) => b.date.localeCompare(a.date)),
    [production],
  );

  const filteredProd = useMemo(() => {
    const q = prodSearch.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(p =>
      p.date?.includes(q) ||
      p.note?.toLowerCase().includes(q) ||
      p.usedIngredients?.some(i => i.itemName?.toLowerCase().includes(q)) ||
      p.usedPackaging?.some(i => i.itemName?.toLowerCase().includes(q))
    )
  }, [sorted, prodSearch]);

  // 依 batchGroupId 分組，沒有 batchGroupId 的則自成一組
  const groupedProd = useMemo(() => {
    const groups = [];
    const seen = new Map();
    filteredProd.forEach(p => {
      // 有 batchGroupId 用它，否則用 date+note 作為備用分組 key
      const key = p.batchGroupId || (p.date + '__' + (p.note || ''));
      if (seen.has(key)) {
        seen.get(key).items.push(p);
      } else {
        const group = { key, items: [p] };
        seen.set(key, group);
        groups.push(group);
      }
    });
    return groups;
  }, [filteredProd]);

  const [expandedGroups, setExpandedGroups] = useState(new Set());
  function toggleGroup(key) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const totalPages = Math.ceil(groupedProd.length / PROD_PAGE_SIZE);
  const pagedGroups = groupedProd.slice((prodPage - 1) * PROD_PAGE_SIZE, prodPage * PROD_PAGE_SIZE);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* 頁首 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            批次生產紀錄
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            夏季（6~9月）$6.24/度 · 非夏季 $5.07/度
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className={btnPrimary + " flex items-center gap-1 text-sm"}
          >
            <Plus size={15} /> 新增生產批次
          </button>
        )}
      </div>

      {/* ── 生產表單 ── */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          {/* 表單頂部：步驟條 + 基本資訊 */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <StepBar current={step} />
              <button onClick={resetForm} className={btnSecondary + " text-xs"}>
                取消
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormRow label="生產日期">
                <input
                  type="date"
                  className={inputCls}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </FormRow>
              <FormRow label="批次備註">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="例：凍乾雞肉片批次"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </FormRow>
            </div>
            <FormRow label="生產細節（選填）">
              <textarea
                className={inputCls + ' resize-none'}
                rows={3}
                placeholder="例：大烘乾機 62度 16小時；步驟1 先醃製30分鐘…"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </FormRow>
          </div>

          <div className="p-6 space-y-6">
            {/* ── 步驟一：食材投入 ── */}
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold"
                    style={{ backgroundColor: "#722927" }}
                  >
                    1
                  </span>
                  食材投入
                </h2>

                {/* 食材列表 */}
                <div className="space-y-2">
                  {ingredients.map((row, idx) => {
                    const item = cItems.find((i) => i.id === row.itemId);
                    const rowCost = item
                      ? (item.unitPrice || 0) * (parseFloat(row.qty) || 0)
                      : 0;
                    const isOver =
                      item && (parseFloat(row.qty) || 0) > item.currentQty;
                    return (
                      <div
                        key={idx}
                        className={`grid grid-cols-[1fr_120px_100px_80px_32px] gap-2 items-center p-3 rounded-xl border ${isOver ? "border-red-200 bg-red-50/40" : "border-gray-100 bg-gray-50"}`}
                      >
                        {/* 食材選擇 */}
                        <div>
                          <SearchableSelect
                            value={row.itemId}
                            onChange={v => updateIngredient(idx, 'itemId', v)}
                            placeholder="選擇食材"
                            options={cItems.map(i => ({
                              value: i.id,
                              label: `${i.itemName}（庫存 ${i.currentQty}${i.unit}）`
                            }))}
                          />
                        </div>
                        {/* 用量 */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="用量"
                            className={
                              inputCls + (isOver ? " border-red-300" : "")
                            }
                            value={row.qty}
                            onChange={(e) =>
                              updateIngredient(idx, "qty", e.target.value)
                            }
                          />
                          <span className="text-xs text-gray-400 shrink-0">
                            {item?.unit || ""}
                          </span>
                        </div>
                        {/* 單價 */}
                        <div className="text-xs text-gray-500 text-right">
                          {item ? `${fmtPrice(item.unitPrice || 0)}/${item.unit}` : "—"}
                        </div>
                        {/* 小計 */}
                        <div
                          className={`text-sm font-semibold text-right ${isOver ? "text-red-500" : "text-emerald-600"}`}
                        >
                          {rowCost > 0 ? fmtPrice(rowCost) : "—"}
                        </div>
                        <button
                          onClick={() => removeIngredientRow(idx)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={addIngredientRow}
                  className="w-full border-2 border-dashed border-gray-200 hover:border-orange-300 hover:text-orange-500 text-gray-400 rounded-xl py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={15} /> 新增食材
                </button>

                {/* 食材成本小計 */}
                {ingredients.length > 0 && (
                  <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center">
                    <span className="text-sm text-gray-500">食材總成本</span>
                    <span className="text-lg font-bold text-gray-800">
                      {fmtPrice(ingredientCost)}
                    </span>
                  </div>
                )}

                {/* 庫存不足警示 */}
                {ingredientShortage.length > 0 && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>
                      庫存不足：<strong>{ingredientShortage.join("、")}</strong>
                      ，請確認用量
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── 步驟二：產出設定 ── */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold"
                    style={{ backgroundColor: "#722927" }}
                  >
                    2
                  </span>
                  產出設定
                </h2>

                {/* 產出單位 + 總產出量 */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-gray-600">產出單位</span>
                  <select
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    value={outputUnit}
                    onChange={(e) => setOutputUnit(e.target.value)}
                  >
                    <option>克</option>
                    <option>個</option>
                  </select>
                  <span className="text-sm text-gray-600 ml-2">總產出量</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" step="0.1"
                      className={inputCls + ' w-28'}
                      placeholder="例：5000"
                      value={totalOutputQty}
                      onChange={e => setTotalOutputQty(e.target.value)}
                    />
                    <span className="text-sm text-gray-400">{outputUnit}</span>
                  </div>
                  {totalOutputWeight > 0 && totalOutputQty && (
                    <span className="text-xs text-gray-400">
                      （各規格合計：{totalOutputWeight}{outputUnit}）
                    </span>
                  )}
                </div>

                {/* 規格列表標題 */}
                {outputs.length > 0 && (
                  <div className="grid grid-cols-[1.2fr_80px_80px_1.2fr_32px] gap-2 text-xs font-medium text-gray-400 px-1">
                    <span>入庫至 B食品（選填）</span>
                    <span className="text-right">每包規格（{outputUnit}）</span>
                    <span className="text-right">包數</span>
                    <span>批次備註</span>
                    <span />
                  </div>
                )}

                {/* 規格列 */}
                <div className="space-y-3">
                  {outputs.map((row, idx) => {
                    const targetItem = bItems.find(i => i.id === row.targetItemId);
                    const weight = (parseFloat(row.packSize) || 0) * (parseFloat(row.packQty) || 0);
                    return (
                      <div key={idx} className="border border-gray-100 bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="grid grid-cols-[1.2fr_80px_80px_1.2fr_32px] gap-2 items-center">
                          {/* 品項選擇 */}
                          <SearchableSelect
                            value={row.targetItemId === '__new__' ? '' : row.targetItemId}
                            onChange={v => {
                              updateOutput(idx, 'targetItemId', v);
                              const item = bItems.find(i => i.id === v);
                              if (item) {
                                updateOutput(idx, 'shelfExpiry', addDays(date, item.shelfDays));
                                updateOutput(idx, 'fridgeExpiry', addDays(date, item.fridgeDays));
                                updateOutput(idx, 'frozenExpiry', addDays(date, item.frozenDays));
                              }
                            }}
                            placeholder="不更新庫存"
                            options={bItems.map(i => ({ value: i.id, label: i.itemName }))}
                          />
                          {/* 每包規格 */}
                          <input type="number" min="1" className={inputCls + ' text-right'}
                            placeholder="例：100"
                            value={row.packSize}
                            onChange={e => updateOutput(idx, 'packSize', e.target.value)} />
                          {/* 包數 */}
                          <input type="number" min="1" step="1" className={inputCls + ' text-right'}
                            placeholder="包數"
                            value={row.packQty}
                            onChange={e => updateOutput(idx, 'packQty', e.target.value)} />
                          {/* 批次備註 */}
                          <input type="text" className={inputCls}
                            placeholder="例：凍乾雞胸肉片 100g"
                            value={row.batchNote}
                            onChange={e => updateOutput(idx, 'batchNote', e.target.value)} />
                          <button onClick={() => removeOutputRow(idx)}
                            className="text-gray-300 hover:text-red-400 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {/* 新增品項 */}
                        <div className="flex items-center gap-2">
                          <button type="button"
                            onClick={() => updateOutput(idx, 'targetItemId', row.targetItemId === '__new__' ? '' : '__new__')}
                            className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                            <Plus size={12} />
                            {row.targetItemId === '__new__' ? '取消新增' : '庫存中沒有此品項？直接新增'}
                          </button>
                          {weight > 0 && (
                            <span className="text-xs text-gray-400 ml-auto">產出重量：{weight}{outputUnit}</span>
                          )}
                        </div>
                        {row.targetItemId === '__new__' && (
                          <input autoFocus type="text" className={inputCls}
                            placeholder="輸入新品項名稱（分類為 B食品）"
                            value={row.newItemName}
                            onChange={e => updateOutput(idx, 'newItemName', e.target.value)} />
                        )}

                        {/* 批次有效日期 */}
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 space-y-2">
                          <p className="text-xs font-semibold text-blue-700">📅 批次有效日期（選填）</p>
                          <div className="grid grid-cols-3 gap-2">
                            <FormRow label={`常溫到期${targetItem?.shelfDays ? `（${targetItem.shelfDays}天）` : ''}`}>
                              <input type="date" className={inputCls}
                                value={row.shelfExpiry}
                                onChange={e => updateOutput(idx, 'shelfExpiry', e.target.value)} />
                            </FormRow>
                            <FormRow label={`冷藏到期${targetItem?.fridgeDays ? `（${targetItem.fridgeDays}天）` : ''}`}>
                              <input type="date" className={inputCls}
                                value={row.fridgeExpiry}
                                onChange={e => updateOutput(idx, 'fridgeExpiry', e.target.value)} />
                            </FormRow>
                            <FormRow label={`冷凍到期${targetItem?.frozenDays ? `（${targetItem.frozenDays}天）` : ''}`}>
                              <input type="date" className={inputCls}
                                value={row.frozenExpiry}
                                onChange={e => updateOutput(idx, 'frozenExpiry', e.target.value)} />
                            </FormRow>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={addOutputRow}
                  className="w-full border-2 border-dashed border-gray-200 hover:border-orange-300 hover:text-orange-500 text-gray-400 rounded-xl py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={15} /> 新增規格
                </button>

                {/* 產出預覽 */}
                {totalPackQty > 0 && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-4 space-y-2">
                    <p className="text-xs font-semibold text-emerald-700">📦 產出預覽</p>
                    <div className="space-y-1">
                      {outputs.map((row, idx) => {
                        const ps = parseFloat(row.packSize) || 0;
                        const pq = parseFloat(row.packQty) || 0;
                        if (!ps || !pq) return null;
                        const weight = ps * pq;
                        const ratio = totalOutputWeight > 0 ? weight / totalOutputWeight : 0;
                        const label = row.targetItemId === '__new__'
                          ? (row.newItemName || `新品項 ${idx + 1}`)
                          : (bItems.find(i => i.id === row.targetItemId)?.itemName || `規格 ${idx + 1}`);
                        return (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-gray-700">{label}</span>
                            <span className="text-gray-500">{ps}{outputUnit}/包 × {pq}包 = {weight}{outputUnit}</span>
                            <span className="text-emerald-600 font-semibold w-16 text-right">{(ratio * 100).toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t border-emerald-200 pt-2 flex justify-between text-sm font-bold text-emerald-700">
                      <span>共計</span>
                      <span>{totalOutputWeight}{outputUnit} / {totalPackQty}包</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── 步驟三：電力成本 ── */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold"
                    style={{ backgroundColor: "#722927" }}
                  >
                    3
                  </span>
                  電力成本
                </h2>

                {/* 電價提示 */}
                <div
                  className={`rounded-xl px-4 py-3 flex items-center gap-3 ${isSummer ? "bg-orange-50 border border-orange-100" : "bg-blue-50 border border-blue-100"}`}
                >
                  <Zap
                    size={18}
                    className={isSummer ? "text-orange-400" : "text-blue-400"}
                  />
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">
                      {isSummer ? "☀️ 夏季電價" : "❄️ 非夏季電價"}：${rate}/度
                    </span>
                    <span className="text-gray-400 ml-2 text-xs">
                      （依生產日期自動套用）
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_100px_100px_32px] gap-1 text-xs font-medium text-gray-400 px-1 mb-1">
                  <span>機器名稱（選填）</span><span className="text-right">瓦數(W)</span><span className="text-right">時數(h)</span><span/>
                </div>
                <div className="space-y-2">
                  {machines.map((m, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_100px_100px_32px] gap-2 items-center bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <input type="text" placeholder="如：烘乾機、冷凍乾燥機"
                        className={inputCls + ' text-sm'}
                        value={m.label}
                        onChange={e => setMachines(prev => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} />
                      <input type="number" min="1" placeholder="W"
                        className={inputCls + ' text-right text-sm'}
                        value={m.watt}
                        onChange={e => setMachines(prev => prev.map((x, i) => i === idx ? { ...x, watt: e.target.value } : x))} />
                      <input type="number" min="0.5" step="0.5" placeholder="h"
                        className={inputCls + ' text-right text-sm'}
                        value={m.hours}
                        onChange={e => setMachines(prev => prev.map((x, i) => i === idx ? { ...x, hours: e.target.value } : x))} />
                      <button onClick={() => setMachines(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}
                        disabled={machines.length === 1}
                        className="text-gray-300 hover:text-red-400 disabled:opacity-20 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                {machines.length > 1 && (
                  <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-xs text-gray-500 space-y-1">
                    {machines.map((m, idx) => {
                      const kw = ((parseFloat(m.watt)||0)*(parseFloat(m.hours)||0)/1000).toFixed(2)
                      const cost = calcElectricityCost(parseFloat(m.watt)||0, parseFloat(m.hours)||0, date)
                      return <div key={idx} className="flex justify-between"><span>{m.label || `機器 ${idx+1}`}（{m.watt}W × {m.hours}h = {kw}度）</span><span>{fmt(cost)}</span></div>
                    })}
                    <div className="flex justify-between font-semibold text-gray-700 border-t border-gray-200 pt-1"><span>合計用電</span><span>{fmt(electricCostFull)}</span></div>
                  </div>
                )}
                <button onClick={() => setMachines(prev => [...prev, { watt: '', hours: '', label: '' }])}
                  className="w-full border-2 border-dashed border-gray-200 hover:border-orange-300 hover:text-orange-500 text-gray-400 rounded-xl py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1">
                  <Plus size={14} /> 新增機器
                </button>

                {/* 電費分擔佔比 */}
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-amber-800">⚡ 本批電費佔比</span>
                    <span className="text-xs text-amber-500">同機同時生產多品項時使用</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number" min="1" max="100" step="1"
                      className={inputCls + ' w-24 text-center font-bold'}
                      value={elecRatio}
                      onChange={e => setElecRatio(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                    />
                    <span className="text-sm font-bold text-amber-700">%</span>
                    <div className="flex gap-1.5">
                      {[100, 50, 33, 25].map(p => (
                        <button key={p} type="button"
                          onClick={() => setElecRatio(p)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                            elecRatio === p
                              ? 'bg-amber-400 text-white border-amber-400'
                              : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'
                          }`}>
                          {p === 100 ? '全部' : p === 50 ? '1/2' : p === 33 ? '1/3' : '1/4'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {elecRatio < 100 && (
                    <p className="text-xs text-amber-600">
                      總電費 {fmt(electricCostFull)} × {elecRatio}% = 本批分擔 <strong>{fmt(electricCost)}</strong>
                    </p>
                  )}
                </div>

                {/* 電費計算結果 */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-50 rounded-xl py-3">
                    <p className="text-xs text-gray-400">用電量</p>
                    <p className="text-lg font-bold text-gray-700">
                      {(machines.reduce((s,m)=>s+(parseFloat(m.watt)||0)*(parseFloat(m.hours)||0),0)/1000).toFixed(2)} 度
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl py-3">
                    <p className="text-xs text-gray-400">電價</p>
                    <p
                      className={`text-lg font-bold ${isSummer ? "text-orange-500" : "text-blue-500"}`}
                    >
                      ${rate}/度
                    </p>
                  </div>
                  <div className={`rounded-xl py-3 ${isSummer ? "bg-orange-50" : "bg-blue-50"}`}>
                    <p className="text-xs text-gray-400">電費{elecRatio < 100 ? `（${elecRatio}%）` : ''}</p>
                    <p className={`text-lg font-bold ${isSummer ? "text-orange-600" : "text-blue-600"}`}>
                      {fmt(electricCost)}
                    </p>
                  </div>
                </div>

                {/* 目前累計成本預覽 */}
                <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>食材成本</span>
                    <span>{fmt(ingredientCost)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>電費</span>
                    <span>{fmt(electricCost)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-800 pt-1 border-t border-gray-200">
                    <span>目前小計</span>
                    <span>{fmt(ingredientCost + electricCost)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── 步驟四：包材選用 ── */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold"
                    style={{ backgroundColor: "#722927" }}
                  >
                    4
                  </span>
                  包材選用
                </h2>

                {dItems.length === 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
                    ⚠️ 尚無 D包材庫存資料，請先到『進貨與庫存』新增 D包材品項。
                  </div>
                )}

                {/* 有多規格時顯示說明 */}
                {outputs.length > 1 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-700">
                    💡 可為每項包材指定歸屬規格，未指定則按產出重量比例自動平攤
                  </div>
                )}

                {/* 包材列表 */}
                <div className="space-y-2">
                  {packaging.map((row, idx) => {
                    const item = dItems.find((i) => i.id === row.itemId);
                    const rowCost = item
                      ? (item.unitPrice || 0) * (parseFloat(row.qty) || 0)
                      : 0;
                    const isOver = item && (parseFloat(row.qty) || 0) > item.currentQty;
                    return (
                      <div key={idx} className={`p-3 rounded-xl border space-y-2 ${
                        isOver ? "border-red-200 bg-red-50/40" : "border-gray-100 bg-gray-50"
                      }`}>
                        <div className="grid grid-cols-[1fr_120px_100px_80px_32px] gap-2 items-center">
                          {/* 包材選擇 */}
                          <SearchableSelect
                            value={row.itemId}
                            onChange={v => updatePackaging(idx, 'itemId', v)}
                            placeholder="選擇包材"
                            options={dItems.map(i => ({
                              value: i.id,
                              label: `${i.itemName}（庫存 ${i.currentQty}${i.unit}）`
                            }))}
                          />
                          {/* 數量 */}
                          <div className="flex items-center gap-1">
                            <input type="number" min="1" step="1" placeholder="數量"
                              className={inputCls + (isOver ? " border-red-300" : "")}
                              value={row.qty}
                              onChange={e => updatePackaging(idx, "qty", e.target.value)} />
                            <span className="text-xs text-gray-400 shrink-0">{item?.unit || ""}</span>
                          </div>
                          {/* 單價 */}
                          <div className="text-xs text-gray-500 text-right">
                            {item ? `${fmtPrice(item.unitPrice || 0)}/個` : "—"}
                          </div>
                          {/* 小計 */}
                          <div className={`text-sm font-semibold text-right ${
                            isOver ? "text-red-500" : "text-emerald-600"
                          }`}>
                            {rowCost > 0 ? fmtPrice(rowCost) : "—"}
                          </div>
                          <button onClick={() => removePackagingRow(idx)}
                            className="text-gray-300 hover:text-red-400 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {/* 歸屬規格（有多規格時才顯示） */}
                        {outputs.length > 1 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 shrink-0">歸屬規格：</span>
                            <select
                              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-300"
                              value={row.outputIdx === null ? '' : String(row.outputIdx)}
                              onChange={e => updatePackaging(idx, 'outputIdx', e.target.value === '' ? null : parseInt(e.target.value))}
                            >
                              <option value="">共用（按重量比例平攤）</option>
                              {outputLabels.map((label, oi) => (
                                <option key={oi} value={String(oi)}>{label || `規格 ${oi + 1}`}</option>
                              ))}
                            </select>
                            {row.outputIdx !== null && (
                              <span className="text-xs font-medium text-orange-600 shrink-0">
                                → 直接計入
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={addPackagingRow}
                  className="w-full border-2 border-dashed border-gray-200 hover:border-orange-300 hover:text-orange-500 text-gray-400 rounded-xl py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={15} /> 新增包材
                </button>

                {/* 包材成本小計 */}
                {packaging.length > 0 && (
                  <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center">
                    <span className="text-sm text-gray-500">包材總成本</span>
                    <span className="text-lg font-bold text-gray-800">
                      {fmtPrice(packagingCost)}
                    </span>
                  </div>
                )}

                {/* 庫存不足警示 */}
                {packagingShortage.length > 0 && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>
                      包材庫存不足：
                      <strong>{packagingShortage.join("、")}</strong>
                      ，請確認數量
                    </span>
                  </div>
                )}

                {/* 目前累計成本預覽 */}
                <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>食材成本</span>
                    <span>{fmt(ingredientCost)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>電費</span>
                    <span>{fmt(electricCost)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>包材成本</span>
                    <span>{fmt(packagingCost)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-800 pt-1 border-t border-gray-200">
                    <span>目前小計</span>
                    <span>
                      {fmt(ingredientCost + electricCost + packagingCost)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {/* ── 步驟五：成本分析 ── */}
            {step === 4 && (
              <div className="space-y-4">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold"
                    style={{ backgroundColor: "#722927" }}
                  >
                    5
                  </span>
                  單位成本分析
                </h2>

                {/* 成本明細 */}
                <div className="bg-gray-50 rounded-xl px-4 py-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>食材成本</span>
                    <span>{fmt(ingredientCost)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>
                      電費（{isSummer ? "☀️夏季" : "❄️非夏季"} ${rate}/度）
                    </span>
                    <span>{fmt(electricCost)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>包材成本</span>
                    <span>{fmt(packagingCost)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-800 pt-2 border-t border-gray-200 text-base">
                    <span>總成本</span>
                    <span>{fmt(totalCost)}</span>
                  </div>
                </div>

                {/* 多規格成本平攤 */}
                {outputsWithCost.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">各規格成本平攤</p>
                    {outputsWithCost.map((row, idx) => {
                      const label = row.targetItemId === '__new__'
                        ? (row.newItemName || `新品項 ${idx + 1}`)
                        : (bItems.find(i => i.id === row.targetItemId)?.itemName || `規格 ${idx + 1}`);
                      const pq = parseFloat(row.packQty) || 0;
                      const directPkg = packagingCostByOutput.direct[idx] || 0;
                      const sharedPkg = packagingCostByOutput.shared * row.ratio;
                      return (
                        <div key={idx} className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-800 text-sm">{label}</span>
                            <span className="text-xs text-gray-400">{row.packSize}{outputUnit}/包 × {pq}包 · 占比 {row.ratio != null ? (row.ratio * 100).toFixed(1) : 0}%</span>
                          </div>
                          <div className="text-xs text-gray-400 space-y-0.5 pl-1">
                            <div className="flex justify-between">
                              <span>食材+電費（按重量{(row.ratio * 100).toFixed(1)}%）</span>
                              <span>{fmt((ingredientCost + electricCost) * row.ratio)}</span>
                            </div>
                            {directPkg > 0 && (
                              <div className="flex justify-between text-orange-500">
                                <span>包材（指定）</span>
                                <span>{fmt(directPkg)}</span>
                              </div>
                            )}
                            {sharedPkg > 0 && (
                              <div className="flex justify-between">
                                <span>包材（共用平攤）</span>
                                <span>{fmt(sharedPkg)}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex justify-between text-sm pt-1 border-t border-purple-100">
                            <span className="text-gray-500">分攤成本</span>
                            <span className="text-gray-700">{fmt(row.cost)}</span>
                          </div>
                          <div className="flex justify-between text-base font-black">
                            <span className="text-gray-600">單包成本</span>
                            <span className="text-purple-600">${row.costPerPack}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 入庫確認 */}
                {outputsWithCost.some(o => o.resolvedId || o.targetItemId === '__new__') && (
                  <div className="space-y-2">
                    {outputsWithCost.map((row, idx) => {
                      const targetItem = row.resolvedId ? bItems.find(i => i.id === row.resolvedId) : null;
                      const label = row.targetItemId === '__new__'
                        ? (row.newItemName || `新品項 ${idx + 1}`)
                        : targetItem?.itemName;
                      if (!label) return null;
                      const existingCost = targetItem?.cost ?? null;
                      return (
                        <div key={idx} className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-emerald-700">
                          ✅ 將新增 <strong>{row.packQty} 包</strong> 至「{label}」，單包成本 ${row.costPerPack}
                          {existingCost != null && existingCost !== row.costPerPack && (
                            <span className="text-amber-600 ml-2">（現有成本 ${existingCost}）</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 成本覆寫 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={overwriteCost}
                    onChange={e => setOverwriteCost(e.target.checked)}
                    className="accent-purple-500 w-4 h-4" />
                  <span className="text-sm text-gray-700">以本批單包成本覆寫入庫存表「成本」欄</span>
                </label>
                {overwriteCost && outputsWithCost.some(o => o.targetItemId && o.targetItemId !== '__new__') && (
                  <div className="space-y-1 pl-6">
                    {outputsWithCost
                      .filter(o => o.targetItemId && o.targetItemId !== '__new__')
                      .map((o, idx) => {
                        const existing = bItems.find(i => i.id === o.targetItemId)?.cost
                        const label = bItems.find(i => i.id === o.targetItemId)?.itemName || `規格 ${idx + 1}`
                        return existing != null ? (
                          <div key={idx} className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">
                            「{label}」：${existing} → ${o.costPerPack}
                          </div>
                        ) : null
                      })
                    }
                  </div>
                )}

                {/* 平攤公式說明 */}
                <div className="bg-blue-50 rounded-xl px-4 py-2.5 text-xs text-blue-600">
                  成本平攤公式：總成本 {fmt(totalCost)} × （規格產出重量 / 總產出重量 {totalOutputWeight}{outputUnit}）
                </div>

                {/* 防呆警示 */}
                {allShortages.length > 0 && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>
                      庫存不足（<strong>{allShortages.join("、")}</strong>
                      ），無法完成生產
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── 步驟導航按鈕 ── */}
            <div className="flex justify-between pt-2 border-t border-gray-100">
              <button
                onClick={() => setStep((s) => s - 1)}
                disabled={step === 0}
                className={
                  btnSecondary + " flex items-center gap-1 disabled:opacity-30"
                }
              >
                <ChevronLeft size={16} /> 上一步
              </button>
              {step < 4 && (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canNext()}
                  className={
                    btnPrimary + " flex items-center gap-1 disabled:opacity-40"
                  }
                >
                  下一步 <ChevronRight size={16} />
                </button>
              )}
              {step === 4 && (
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`flex items-center gap-2 font-semibold px-5 py-2 rounded-lg text-sm transition-colors ${
                    canSubmit
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  ✅ 確認入庫
                </button>
              )}
            </div>
          </div>
          {/* ── 常駐底部成本列 ── */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 rounded-b-2xl flex flex-wrap items-center gap-4 text-sm">
            <span className="text-gray-400 font-medium">即時成本</span>
            <span className="text-gray-600">
              食材 <strong>{fmt(ingredientCost)}</strong>
            </span>
            <span className="text-gray-400">+</span>
            <span className="text-gray-600">
              電費 <strong>{fmt(electricCost)}</strong>
            </span>
            <span className="text-gray-400">+</span>
            <span className="text-gray-600">
              包材 <strong>{fmt(packagingCost)}</strong>
            </span>
            <span className="text-gray-400">=</span>
            <span className="font-bold text-gray-800">
              總計 {fmt(totalCost)}
            </span>
            {totalPackQty > 0 && (
              <>
                <span className="text-gray-400 mx-1">｜</span>
                <span className="font-black text-purple-600 text-base">
                  {outputs.length === 1
                    ? `單包 $${outputsWithCost[0]?.costPerPack ?? 0}`
                    : `${outputs.length} 規格 / ${totalPackQty}包`
                  }
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 生產紀錄列表 ── */}
      <SectionCard title="生產紀錄">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={prodSearch}
              onChange={e => { setProdSearch(e.target.value); setProdPage(1); }}
              placeholder="搜尋日期、備註、食材名稱…"
              className={inputCls + ' pl-8 text-sm'}
            />
          </div>
          {prodSearch && (
            <span className="text-xs text-gray-400">找到 {filteredProd.length} 筆</span>
          )}
        </div>
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                <th className="pb-3 text-left">日期</th>
                <th className="pb-3 text-left">批次備註</th>
                <th className="pb-3 text-right">食材成本</th>
                <th className="pb-3 text-right">電費</th>
                <th className="pb-3 text-right">包材成本</th>
                <th className="pb-3 text-right">總成本</th>
                <th className="pb-3 text-right">產出</th>
                <th className="pb-3 text-right">單包成本</th>
                <th className="pb-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagedGroups.map(({ key, items: groupItems }) => {
                const first = groupItems[0];
                const isMulti = groupItems.length > 1;
                const expanded = expandedGroups.has(key);
                const groupTotalCost = groupItems.reduce((s, p) => s + (p.totalCost ?? 0), 0);
                const groupResultQty = groupItems.reduce((s, p) => s + (p.resultQty ?? 0), 0);
                return (
                  <>
                    {/* 主列 */}
                    <tr key={key}
                      onClick={() => isMulti ? setDetailBatch({ key, items: groupItems }) : setDetailBatch({ key, items: [first] })}
                      className="hover:bg-orange-50/40 transition-colors cursor-pointer">
                      <td className="py-3 text-gray-500 whitespace-nowrap">{first.date}</td>
                      <td className="py-3 text-gray-700 max-w-[140px]">
                        <div className="flex items-center gap-1">
                          {isMulti && (
                            <span className="text-orange-400">{expanded ? '▾' : '▸'}</span>
                          )}
                          <span className="truncate">{first.note || '—'}</span>
                          {isMulti && (
                            <span className="ml-1 text-xs bg-orange-100 text-orange-600 font-semibold px-1.5 py-0.5 rounded-full shrink-0">
                              {groupItems.length} 規格
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-right text-gray-600">{first.ingredientCost != null ? fmt(first.ingredientCost) : '—'}</td>
                      <td className="py-3 text-right">
                        <span className={getElectricRate(first.date) === 6.24 ? 'text-orange-500' : 'text-blue-500'}>
                          {first.electricCost != null ? fmt(first.electricCost) : '—'}
                        </span>
                      </td>
                      <td className="py-3 text-right text-gray-600">{first.packagingCost != null ? fmt(first.packagingCost) : '—'}</td>
                      <td className="py-3 text-right font-semibold text-gray-800">
                        {isMulti ? fmt(groupTotalCost) : (first.totalCost != null ? fmt(first.totalCost) : '—')}
                      </td>
                      <td className="py-3 text-right font-bold text-emerald-600">
                        {isMulti ? `${groupResultQty} 包` : `${first.resultQty} 包`}
                      </td>
                      <td className="py-3 text-right font-semibold text-purple-600">
                        {isMulti ? '—' : (first.costPerPack != null ? `$${first.costPerPack.toFixed(1)}` : '—')}
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={e => { e.stopPropagation(); loadBatchToForm(groupItems); }}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-500 p-1.5 rounded-lg transition-colors"
                            title="複製此批次到新增表單">
                            <Copy size={14} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); deleteProductionGroup(groupItems); }}
                            className={btnDanger}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* 展開的規格子列 */}
                    {isMulti && expanded && groupItems.map((p, si) => (
                      <tr key={p.id}
                        onClick={() => setDetailBatch({ key, items: [p] })}
                        className="bg-orange-50/30 hover:bg-orange-50/60 transition-colors cursor-pointer">
                        <td className="py-2 pl-6 text-gray-400 text-xs">└ 規格 {si + 1}</td>
                        <td className="py-2 text-gray-600 text-xs max-w-[140px] truncate">
                          {p.targetItemName || p.note || '—'}
                          {p.packSize && <span className="ml-1 text-gray-400">{p.packSize}{p.outputUnit}/包</span>}
                        </td>
                        <td className="py-2 text-right text-xs text-gray-500">{p.ingredientCost != null ? fmt(p.ingredientCost) : '—'}</td>
                        <td className="py-2 text-right text-xs">
                          <span className={getElectricRate(p.date) === 6.24 ? 'text-orange-400' : 'text-blue-400'}>
                            {p.electricCost != null ? fmt(p.electricCost) : '—'}
                          </span>
                        </td>
                        <td className="py-2 text-right text-xs text-gray-500">{p.packagingCost != null ? fmt(p.packagingCost) : '—'}</td>
                        <td className="py-2 text-right text-xs font-semibold text-gray-700">{p.totalCost != null ? fmt(p.totalCost) : '—'}</td>
                        <td className="py-2 text-right text-xs font-bold text-emerald-600">{p.resultQty} 包</td>
                        <td className="py-2 text-right text-xs font-semibold text-purple-600">
                          {p.costPerPack != null ? `$${p.costPerPack.toFixed(1)}` : '—'}
                        </td>
                        <td className="py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={e => { e.stopPropagation(); loadBatchToForm([p]); }}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-500 p-1.5 rounded-lg transition-colors"
                              title="複製此規格到新增表單">
                              <Copy size={14} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); deleteProduction(p.id); }}
                              className={btnDanger}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-gray-400">尚無生產紀錄</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 分頁控制 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">共 {groupedProd.length} 筆，第 {prodPage} / {totalPages} 頁</span>
            <div className="flex gap-1">
              <button onClick={() => setProdPage(p => Math.max(1, p - 1))} disabled={prodPage === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                上一頁
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setProdPage(p)}
                  className={`w-8 h-8 text-xs rounded-lg border transition-colors ${
                    p === prodPage ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setProdPage(p => Math.min(totalPages, p + 1))} disabled={prodPage === totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                下一頁
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── 批次詳細 Modal ── */}
      {detailBatch && (() => {
        const items = detailBatch.items;
        const first = items[0];
        const isMulti = items.length > 1;
        const totalCostAll = items.reduce((s, p) => s + (p.totalCost ?? 0), 0);
        const totalQtyAll  = items.reduce((s, p) => s + (p.resultQty ?? 0), 0);
        return (
          <Modal
            title={`批次詳細：${first.date}${first.note ? ` — ${first.note}` : ''}`}
            size="md"
            onClose={() => setDetailBatch(null)}
          >
            <div className="space-y-4 text-sm">

              {/* 生產細節 */}
              {first.details && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">生產細節</p>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                    {first.details}
                  </div>
                </div>
              )}

              {/* 食材投入（共用，取第一筆） */}
              {first.usedIngredients?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">食材投入</p>
                  <div className="space-y-1">
                    {first.usedIngredients.map((ing, i) => (
                      <div key={i} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-700">{ing.itemName}</span>
                        <div className="flex items-center gap-4 text-right">
                          <span className="text-gray-500">{ing.qty} {ing.unit ?? ''}</span>
                          <span className="text-gray-400 text-xs w-20">${ing.unitPrice ?? 0}/單位</span>
                          <span className="font-semibold text-emerald-600 w-16">{fmt(ing.cost ?? 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 包材使用（共用，取第一筆） */}
              {first.usedPackaging?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">包材使用</p>
                  <div className="space-y-1">
                    {first.usedPackaging.map((pkg, i) => (
                      <div key={i} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-gray-700">{pkg.itemName}</span>
                        <div className="flex items-center gap-4 text-right">
                          <span className="text-gray-500">{pkg.qty} {pkg.unit ?? ''}</span>
                          <span className="text-gray-400 text-xs w-20">${pkg.unitPrice ?? 0}/單位</span>
                          <span className="font-semibold text-emerald-600 w-16">{fmt(pkg.cost ?? 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 電力（共用，取第一筆） */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">電力</p>
                <div className="flex gap-3">
                  <div className="bg-gray-50 rounded-lg px-3 py-2 flex-1 text-center">
                    <p className="text-xs text-gray-400">機器</p>
                    <p className="font-semibold text-gray-700 text-xs">
                      {first.machines ? first.machines.map(m => `${m.label||'機器'} ${m.watt}W`).join('、') : `${first.machineWatt ?? '—'}W`}
                    </p>
                  </div>
                  {first.elecRatio != null && first.elecRatio < 100 && (
                    <div className="bg-amber-50 rounded-lg px-3 py-2 flex-1 text-center">
                      <p className="text-xs text-gray-400">分擔佔比</p>
                      <p className="font-semibold text-amber-600">{first.elecRatio}%</p>
                    </div>
                  )}
                  <div className={`rounded-lg px-3 py-2 flex-1 text-center ${getElectricRate(first.date) === 6.24 ? 'bg-orange-50' : 'bg-blue-50'}`}>
                    <p className="text-xs text-gray-400">電費</p>
                    <p className={`font-semibold ${getElectricRate(first.date) === 6.24 ? 'text-orange-600' : 'text-blue-600'}`}>
                      {first.electricCost != null ? fmt(first.electricCost) : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 各規格產出 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {isMulti ? `各規格產出（共 ${items.length} 規格）` : '產出資訊'}
                </p>
                <div className="space-y-2">
                  {items.map((p, idx) => (
                    <div key={p.id} className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 space-y-1.5">
                      {isMulti && (
                        <p className="text-xs font-semibold text-purple-700">
                          規格 {idx + 1}：{p.targetItemName || p.batchNote || `規格 ${idx + 1}`}
                          {p.packSize && <span className="ml-1 font-normal text-gray-500">（{p.packSize}{p.outputUnit}/包）</span>}
                        </p>
                      )}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white rounded-lg py-2">
                          <p className="text-xs text-gray-400">產出重量</p>
                          <p className="font-bold text-gray-800">{p.outputQty ?? '—'} {p.outputUnit ?? ''}</p>
                        </div>
                        <div className="bg-white rounded-lg py-2">
                          <p className="text-xs text-gray-400">每包規格</p>
                          <p className="font-bold text-gray-800">{p.packSize ?? '—'} {p.outputUnit ?? ''}</p>
                        </div>
                        <div className="bg-white rounded-lg py-2">
                          <p className="text-xs text-gray-400">產出包數</p>
                          <p className="font-bold text-emerald-600">{p.resultQty} 包</p>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 pt-1 border-t border-purple-100">
                        <span>分攤成本 {fmt(p.totalCost ?? 0)}</span>
                        <span className="font-black text-purple-600 text-sm">${p.costPerPack != null ? p.costPerPack.toFixed(2) : '—'}/包</span>
                      </div>
                      {p.expiryBatch && (
                        <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700 space-y-0.5">
                          <p className="font-semibold">📅 有效期</p>
                          <div className="flex flex-wrap gap-2">
                            {p.expiryBatch.shelfExpiry  && <span>常溫：{p.expiryBatch.shelfExpiry}</span>}
                            {p.expiryBatch.fridgeExpiry && <span>冷藏：{p.expiryBatch.fridgeExpiry}</span>}
                            {p.expiryBatch.frozenExpiry && <span>冷凍：{p.expiryBatch.frozenExpiry}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 總成本彙總 */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-gray-500">
                  <span>食材成本</span><span>{fmt(first.ingredientCost ?? 0)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>電費</span><span>{fmt(first.electricCost ?? 0)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>包材成本</span><span>{fmt(first.packagingCost ?? 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-800 pt-1.5 border-t border-gray-200">
                  <span>總成本</span><span>{fmt(isMulti ? totalCostAll : (first.totalCost ?? 0))}</span>
                </div>
                {isMulti && (
                  <div className="flex justify-between text-gray-500">
                    <span>總產出包數</span><span className="font-semibold text-emerald-600">{totalQtyAll} 包</span>
                  </div>
                )}
                {!isMulti && (
                  <div className="flex justify-between font-black text-purple-600 text-base pt-0.5">
                    <span>單包成本</span>
                    <span>${first.costPerPack != null ? first.costPerPack.toFixed(2) : '—'}</span>
                  </div>
                )}
              </div>

              <button onClick={() => setDetailBatch(null)} className={btnSecondary + ' w-full'}>
                關閉
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* ── AI 食材比例計算助手 ── */}
      <AiRecipeAssistant cItems={cItems} production={production} />
    </div>
  );
}
