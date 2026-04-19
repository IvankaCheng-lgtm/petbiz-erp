import { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Zap,
  AlertTriangle,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  SectionCard,
  FormRow,
  inputCls,
  btnPrimary,
  btnSecondary,
  btnDanger,
} from "../components/ui";
import { fmt } from "../utils/format";
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

const today = () => new Date().toISOString().slice(0, 10);
const STEPS = ["食材投入", "產出設定", "電力成本", "包材選用", "成本分析"];

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
  const { inventory, production, addProductionBatch, deleteProduction } = data;

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

  // 步驟一：食材 [{ itemId, qty }]
  const [ingredients, setIngredients] = useState([]);

  // 步驟二：產出
  const [outputQty, setOutputQty]       = useState("");
  const [outputUnit, setOutputUnit]     = useState("克");
  const [packSize, setPackSize]         = useState("");
  const [targetItemId, setTargetItemId] = useState("");
  const [batchNote, setBatchNote]       = useState("");
  // 有效日期（常溫/冷藏/冷凍）
  const [shelfExpiry,  setShelfExpiry]  = useState("");
  const [fridgeExpiry, setFridgeExpiry] = useState("");
  const [frozenExpiry, setFrozenExpiry] = useState("");

  // 步驟三：電力
  const [machineWatt, setMachineWatt] = useState(1100);
  const [hours, setHours] = useState(16);

  // 步驟四：包材 [{ itemId, qty }]
  const [packaging, setPackaging] = useState([]);

  // ── 衍生計算（順序重要：resultQty 先，其他依賴它）────────
  const resultQty = useMemo(() => {
    const oq = parseFloat(outputQty) || 0;
    const ps = parseFloat(packSize) || 0;
    return ps > 0 ? Math.floor(oq / ps) : 0;
  }, [outputQty, packSize]);

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

  const electricCost = useMemo(
    () =>
      calcElectricityCost(
        parseFloat(machineWatt) || 0,
        parseFloat(hours) || 0,
        date,
      ),
    [machineWatt, hours, date],
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

  const costPerPack = useMemo(
    () => (resultQty > 0 ? Math.round((totalCost / resultQty) * 100) / 100 : 0),
    [totalCost, resultQty],
  );

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

  const allShortages = useMemo(
    () => [...ingredientShortage, ...packagingShortage],
    [ingredientShortage, packagingShortage],
  );

  const canSubmit = allShortages.length === 0 && resultQty > 0;

  // ── 步驟驗證 ─────────────────────────────────────────────
  function canNext() {
    if (step === 0)
      return (
        ingredients.length > 0 && ingredients.every((r) => r.itemId && r.qty)
      );
    if (step === 1) return outputQty && packSize && resultQty > 0;
    if (step === 2) return machineWatt && hours;
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
    setPackaging((p) => [...p, { itemId: "", qty: "" }]);
  }
  function removePackagingRow(idx) {
    setPackaging((p) => p.filter((_, i) => i !== idx));
  }
  function updatePackaging(idx, f, v) {
    setPackaging((p) => p.map((r, i) => (i === idx ? { ...r, [f]: v } : r)));
  }

  // ── 重置表單 ─────────────────────────────────────────────
  function resetForm() {
    setStep(0);
    setDate(today());
    setNote("");
    setIngredients([]);
    setOutputQty("");
    setOutputUnit("克");
    setPackSize("");
    setTargetItemId("");
    setBatchNote("");
    setShelfExpiry("");
    setFridgeExpiry("");
    setFrozenExpiry("");
    setMachineWatt(1100);
    setHours(16);
    setPackaging([]);
    setShowForm(false);
  }

  // ── 確認入庫 ─────────────────────────────────────────────
  function handleSubmit() {
    if (!canSubmit) return;

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

    addProductionBatch({
      date,
      note,
      machineWatt: parseFloat(machineWatt),
      hours: parseFloat(hours),
      usedIngredients,
      usedPackaging,
      outputQty: parseFloat(outputQty),
      outputUnit,
      packSize: parseFloat(packSize),
      resultQty,
      targetItemId: targetItemId || null,
      ingredientCost,
      electricCost: Math.round(electricCost * 100) / 100,
      packagingCost,
      totalCost: Math.round(totalCost * 100) / 100,
      costPerPack,
      // 有效期批次資訊
      expiryBatch: (shelfExpiry || fridgeExpiry || frozenExpiry) ? {
        productionDate: date,
        batchNote: batchNote || note || '',
        qty: resultQty,
        shelfExpiry:  shelfExpiry  || null,
        fridgeExpiry: fridgeExpiry || null,
        frozenExpiry: frozenExpiry || null,
      } : null,
    });

    resetForm();
  }

  const sorted = useMemo(
    () => [...production].sort((a, b) => b.date.localeCompare(a.date)),
    [production],
  );

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
                          <select
                            className={inputCls}
                            value={row.itemId}
                            onChange={(e) =>
                              updateIngredient(idx, "itemId", e.target.value)
                            }
                          >
                            <option value="">選擇食材</option>
                            {cItems.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.itemName}（庫存 {i.currentQty}
                                {i.unit}）
                              </option>
                            ))}
                          </select>
                        </div>
                        {/* 用量 */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
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
                          {item ? `$${item.unitPrice || 0}/${item.unit}` : "—"}
                        </div>
                        {/* 小計 */}
                        <div
                          className={`text-sm font-semibold text-right ${isOver ? "text-red-500" : "text-emerald-600"}`}
                        >
                          {rowCost > 0 ? fmt(rowCost) : "—"}
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
                      {fmt(ingredientCost)}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormRow label="總產出量">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        className={inputCls}
                        placeholder="例：5000"
                        value={outputQty}
                        onChange={(e) => setOutputQty(e.target.value)}
                      />
                      <select
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 shrink-0"
                        value={outputUnit}
                        onChange={(e) => setOutputUnit(e.target.value)}
                      >
                        <option>克</option>
                        <option>個</option>
                      </select>
                    </div>
                  </FormRow>

                  <FormRow label={`每包規格（${outputUnit}）`}>
                    <input
                      type="number"
                      min="1"
                      className={inputCls}
                      placeholder="例：100"
                      value={packSize}
                      onChange={(e) => setPackSize(e.target.value)}
                    />
                  </FormRow>
                </div>

                {/* 產出預覽 */}
                {resultQty > 0 && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-4 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-gray-500">總產出</p>
                      <p className="text-xl font-bold text-gray-800">
                        {outputQty} {outputUnit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">每包規格</p>
                      <p className="text-xl font-bold text-gray-800">
                        {packSize} {outputUnit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">預計包數</p>
                      <p className="text-xl font-bold text-emerald-600">
                        {resultQty} 包
                      </p>
                    </div>
                  </div>
                )}

                <FormRow label="入庫至 B食品（選填）">
                  <select
                    className={inputCls}
                    value={targetItemId}
                    onChange={(e) => setTargetItemId(e.target.value)}
                  >
                    <option value="">不更新庫存</option>
                    {bItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.itemName}
                      </option>
                    ))}
                  </select>
                </FormRow>

                {/* 批次有效日期 */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-semibold text-blue-700">📅 批次有效日期（選填，將自動寫入庫存）</p>
                  <FormRow label="批次備註">
                    <input type="text" className={inputCls} placeholder="例：凍举雞肉片 2025-07批"
                      value={batchNote} onChange={e => setBatchNote(e.target.value)} />
                  </FormRow>
                  <div className="grid grid-cols-3 gap-2">
                    <FormRow label="常溫到期">
                      <input type="date" className={inputCls}
                        value={shelfExpiry} onChange={e => setShelfExpiry(e.target.value)} />
                    </FormRow>
                    <FormRow label="冷藏到期">
                      <input type="date" className={inputCls}
                        value={fridgeExpiry} onChange={e => setFridgeExpiry(e.target.value)} />
                    </FormRow>
                    <FormRow label="冷凍到期">
                      <input type="date" className={inputCls}
                        value={frozenExpiry} onChange={e => setFrozenExpiry(e.target.value)} />
                    </FormRow>
                  </div>
                </div>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormRow label="機器瓦數（W）">
                    <input
                      type="number"
                      min="1"
                      className={inputCls}
                      value={machineWatt}
                      onChange={(e) => setMachineWatt(e.target.value)}
                    />
                  </FormRow>
                  <FormRow label="烘烤時數（h）">
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      className={inputCls}
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                    />
                  </FormRow>
                </div>

                {/* 電費計算結果 */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-50 rounded-xl py-3">
                    <p className="text-xs text-gray-400">用電量</p>
                    <p className="text-lg font-bold text-gray-700">
                      {(
                        ((parseFloat(machineWatt) || 0) *
                          (parseFloat(hours) || 0)) /
                        1000
                      ).toFixed(2)}{" "}
                      度
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
                  <div
                    className={`rounded-xl py-3 ${isSummer ? "bg-orange-50" : "bg-blue-50"}`}
                  >
                    <p className="text-xs text-gray-400">電費小計</p>
                    <p
                      className={`text-lg font-bold ${isSummer ? "text-orange-600" : "text-blue-600"}`}
                    >
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

                {/* 包材列表 */}
                <div className="space-y-2">
                  {packaging.map((row, idx) => {
                    const item = dItems.find((i) => i.id === row.itemId);
                    const rowCost = item
                      ? (item.unitPrice || 0) * (parseFloat(row.qty) || 0)
                      : 0;
                    const isOver =
                      item && (parseFloat(row.qty) || 0) > item.currentQty;
                    return (
                      <div
                        key={idx}
                        className={`grid grid-cols-[1fr_120px_100px_80px_32px] gap-2 items-center p-3 rounded-xl border
                          ${isOver ? "border-red-200 bg-red-50/40" : "border-gray-100 bg-gray-50"}`}
                      >
                        {/* 包材選擇 */}
                        <select
                          className={inputCls}
                          value={row.itemId}
                          onChange={(e) =>
                            updatePackaging(idx, "itemId", e.target.value)
                          }
                        >
                          <option value="">選擇包材</option>
                          {dItems.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.itemName}（庫存 {i.currentQty}
                              {i.unit}）
                            </option>
                          ))}
                        </select>

                        {/* 數量 */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="數量"
                            className={
                              inputCls + (isOver ? " border-red-300" : "")
                            }
                            value={row.qty}
                            onChange={(e) =>
                              updatePackaging(idx, "qty", e.target.value)
                            }
                          />
                          <span className="text-xs text-gray-400 shrink-0">
                            {item?.unit || ""}
                          </span>
                        </div>

                        {/* 單價 */}
                        <div className="text-xs text-gray-500 text-right">
                          {item ? `$${item.unitPrice || 0}/個` : "—"}
                        </div>

                        {/* 小計 */}
                        <div
                          className={`text-sm font-semibold text-right ${isOver ? "text-red-500" : "text-emerald-600"}`}
                        >
                          {rowCost > 0 ? fmt(rowCost) : "—"}
                        </div>

                        <button
                          onClick={() => removePackagingRow(idx)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
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
                      {fmt(packagingCost)}
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

                {/* 單包成本計算 */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-50 rounded-xl py-3">
                    <p className="text-xs text-gray-400">總產出</p>
                    <p className="text-lg font-bold text-gray-700">
                      {outputQty} {outputUnit}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl py-3">
                    <p className="text-xs text-gray-400">預計包數</p>
                    <p className="text-lg font-bold text-emerald-600">
                      {resultQty} 包
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-xl py-3">
                    <p className="text-xs text-gray-400">單包成本</p>
                    <p className="text-2xl font-black text-purple-600">
                      ${costPerPack}
                    </p>
                  </div>
                </div>

                {/* 公式說明 */}
                <div className="bg-blue-50 rounded-xl px-4 py-2.5 text-xs text-blue-600">
                  單包成本 = ({fmt(ingredientCost)} + {fmt(electricCost)} +{" "}
                  {fmt(packagingCost)}) ÷ {resultQty} 包 ={" "}
                  <strong>${costPerPack}</strong>
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

                {/* 入庫目標確認 */}
                {targetItemId && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-emerald-700">
                    ✅ 完成後將新增 <strong>{resultQty} 包</strong> 至「
                    {bItems.find((i) => i.id === targetItemId)?.itemName}」庫存
                  </div>
                )}
              </div>
            )}

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
              {resultQty > 0 && (
                <>
                  <span className="text-gray-400 mx-1">｜</span>
                  <span className="font-black text-purple-600 text-base">
                    單包 ${costPerPack}
                  </span>
                </>
              )}
            </div>

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
        </div>
      )}

      {/* ── 生產紀錄列表 ── */}
      <SectionCard title="生產紀錄">
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
              {sorted.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 text-gray-500 whitespace-nowrap">
                    {p.date}
                  </td>
                  <td className="py-3 text-gray-700 max-w-[140px] truncate">
                    {p.note || "—"}
                  </td>
                  <td className="py-3 text-right text-gray-600">
                    {p.ingredientCost != null ? fmt(p.ingredientCost) : "—"}
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={
                        getElectricRate(p.date) === 6.24
                          ? "text-orange-500"
                          : "text-blue-500"
                      }
                    >
                      {p.electricCost != null ? fmt(p.electricCost) : "—"}
                    </span>
                  </td>
                  <td className="py-3 text-right text-gray-600">
                    {p.packagingCost != null ? fmt(p.packagingCost) : "—"}
                  </td>
                  <td className="py-3 text-right font-semibold text-gray-800">
                    {p.totalCost != null ? fmt(p.totalCost) : "—"}
                  </td>
                  <td className="py-3 text-right font-bold text-emerald-600">
                    {p.resultQty} 包
                  </td>
                  <td className="py-3 text-right font-semibold text-purple-600">
                    {p.costPerPack != null
                      ? `$${p.costPerPack.toFixed(1)}`
                      : "—"}
                  </td>
                  <td className="py-3 text-center">
                    <button
                      onClick={() => deleteProduction(p.id)}
                      className={btnDanger}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-gray-400">
                    尚無生產紀錄
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── AI 食材比例計算助手 ── */}
      <AiRecipeAssistant cItems={cItems} production={production} />
    </div>
  );
}
