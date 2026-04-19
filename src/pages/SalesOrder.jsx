import { useState, useEffect, useRef, useMemo } from "react";
import { ShoppingBag, Camera, CameraOff } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

const PLATFORMS_ECOMMERCE = ["萌獸官網", "PChome", "Yahoo", "蝦皮"];
const PLATFORMS_OFFLINE = ["私訊訂購", "LINE訂購"];

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 1200;
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.15);
  } catch {}
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      {title && <h2 className="text-sm font-semibold text-gray-500 mb-3">{title}</h2>}
      {children}
    </div>
  );
}

export default function SalesOrder({ data }) {
  const { inventory = [], processOrder, updateOrder, deleteOrder, orders = [] } = data || {};

  const [platform, setPlatform] = useState(PLATFORMS_ECOMMERCE[0]);
  const [cart, setCart] = useState([]);
  const [discountPct, setDiscountPct] = useState("");
  const [discountAmt, setDiscountAmt] = useState("");
  const [platformCost, setPlatformCost] = useState("");
  const [costMode, setCostMode] = useState("pct");
  const [note, setNote] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [done, setDone] = useState(false);

  const scannerRef = useRef(null);
  const barcodeRef = useRef(null);
  const saleItemsRef = useRef([]);

  useEffect(() => { barcodeRef.current?.focus(); }, []);

  const saleItems = useMemo(
    () => inventory.filter((i) => i.category === "A用品" || i.category === "B食品"),
    [inventory]
  );

  useEffect(() => { saleItemsRef.current = saleItems; }, [saleItems]);

  // 相機掃碼
  useEffect(() => {
    if (!isScanning) {
      const s = scannerRef.current;
      if (s) {
        scannerRef.current = null;
        s.stop().catch(() => {}).finally(() => { try { s.clear(); } catch {} });
      }
      return;
    }
    const s = new Html5Qrcode("so-reader");
    let lastScan = 0;
    s.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 400, height: 100 }, formatsToSupport: [0, 4], aspectRatio: 2.0 },
      (text) => {
        const now = Date.now();
        if (now - lastScan < 2000) return;
        lastScan = now;
        const matched = saleItemsRef.current.find((i) => i.barcode && i.barcode === text);
        if (matched) {
          addToCart(matched);
          beep();
          setScanMsg(`✅ 已加入：${matched.itemName}`);
        } else {
          setScanMsg("⚠️ 查無此商品");
        }
        setTimeout(() => setScanMsg(""), 2500);
      },
      () => {}
    )
      .then(() => { scannerRef.current = s; })
      .catch(() => {});
    return () => {
      scannerRef.current = null;
      s.stop().catch(() => {}).finally(() => { try { s.clear(); } catch {} });
    };
  }, [isScanning]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = useMemo(() => cart.reduce((s, c) => s + c.qty * c.unitPrice, 0), [cart]);

  const totalAmount = useMemo(() => {
    let t = subtotal;
    const pct = parseFloat(discountPct);
    const amt = parseFloat(discountAmt);
    if (!isNaN(pct) && pct > 0 && pct < 100) t = t * (1 - pct / 100);
    if (!isNaN(amt) && amt > 0) t = t - amt;
    return Math.max(0, Math.round(t * 100) / 100);
  }, [subtotal, discountPct, discountAmt]);

  function addToCart(item) {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.itemId === item.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { itemId: item.id, itemName: item.itemName, category: item.category, qty: 1, unitPrice: item.salePrice || item.listPrice || 0 }];
    });
  }

  function updateQty(itemId, qty) {
    if (qty <= 0) { setCart((prev) => prev.filter((c) => c.itemId !== itemId)); return; }
    setCart((prev) => prev.map((c) => (c.itemId === itemId ? { ...c, qty } : c)));
  }

  function handleBarcodeEnter(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const val = barcodeInput.trim();
    if (!val) return;
    const matched = saleItemsRef.current.find((i) => i.barcode && i.barcode === val);
    if (matched) { addToCart(matched); beep(); setScanMsg(`✅ 已加入：${matched.itemName}`); }
    else { setScanMsg("⚠️ 查無此商品"); }
    setBarcodeInput("");
    setTimeout(() => setScanMsg(""), 2500);
    barcodeRef.current?.focus();
  }

  async function handleSubmit() {
    if (cart.length === 0) return;
    const computedCost =
      costMode === "pct"
        ? Math.round((totalAmount * (parseFloat(platformCost) || 0)) / 100)
        : parseFloat(platformCost) || 0;
    await processOrder?.({
      platform,
      items: cart,
      discountType: discountPct ? "pct" : discountAmt ? "amt" : null,
      discountValue: discountPct ? parseFloat(discountPct) : discountAmt ? parseFloat(discountAmt) : null,
      totalAmount,
      platformCost: computedCost,
      note,
    });
    setDone(true);
    setCart([]);
    setDiscountPct("");
    setDiscountAmt("");
    setPlatformCost("");
    setNote("");
    setTimeout(() => setDone(false), 3000);
  }

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => b.orderDate?.localeCompare(a.orderDate)),
    [orders]
  );

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* 頁首 */}
      <div className="flex items-center gap-3">
        <div className="bg-blue-500 p-2.5 rounded-2xl text-white">
          <ShoppingBag size={22} />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">銷售訂單</h1>
          <p className="text-sm text-gray-400">電商平台出貨 · 庫存自動扣除</p>
        </div>
      </div>

      {/* 來源平台 */}
      <SectionCard title="來源平台">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-1.5">電商通路</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS_ECOMMERCE.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    platform === p
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1.5">非電商通路</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS_OFFLINE.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    platform === p
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 成交手續費 */}
      <SectionCard title="成交手續費 / 廣告費（選填）">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            <button
              type="button"
              onClick={() => setCostMode("pct")}
              className={`px-3 py-2 transition-colors ${costMode === "pct" ? "bg-blue-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              %
            </button>
            <button
              type="button"
              onClick={() => setCostMode("amt")}
              className={`px-3 py-2 transition-colors ${costMode === "amt" ? "bg-blue-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              $
            </button>
          </div>
          <input
            type="number"
            min="0"
            value={platformCost}
            onChange={(e) => setPlatformCost(e.target.value)}
            placeholder={costMode === "pct" ? "例：5（%）" : "例：50（元）"}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        {platformCost && (
          <p className="text-xs text-gray-400 mt-1">
            預估手續費：
            {costMode === "pct"
              ? `${Math.round((totalAmount * (parseFloat(platformCost) || 0)) / 100)} 元`
              : `${parseFloat(platformCost) || 0} 元`}
          </p>
        )}
      </SectionCard>

      {/* 商品列表 */}
      <SectionCard title="選擇商品">
        <input
          type="text"
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
          placeholder="搜尋商品名稱…"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {saleItems
            .filter((i) => !itemSearch || i.itemName?.includes(itemSearch))
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addToCart(item)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-blue-50 transition-colors text-sm text-left"
              >
                <span className="text-gray-700 flex-1">{item.itemName}</span>
                <span className="text-xs text-gray-400 mr-3">{item.category}</span>
                <span className="text-blue-600 font-medium">${item.salePrice || item.listPrice || 0}</span>
              </button>
            ))}
          {saleItems.filter((i) => !itemSearch || i.itemName?.includes(itemSearch)).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">查無符合商品</p>
          )}
        </div>
      </SectionCard>

      {/* 條碼掃描 */}
      <SectionCard title="條碼掃描">
        <div className="space-y-3">
          <input
            ref={barcodeRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={handleBarcodeEnter}
            placeholder="掃描條碼或手動輸入後按 Enter"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            type="button"
            onClick={() => setIsScanning((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              isScanning
                ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
            }`}
          >
            {isScanning ? <CameraOff size={16} /> : <Camera size={16} />}
            {isScanning ? "關閉相機" : "開啟相機掃碼"}
          </button>
          <div
            id="so-reader"
            className={`rounded-xl overflow-hidden ${isScanning ? "block" : "hidden"}`}
            style={{ width: "100%", maxWidth: 480 }}
          />
          {scanMsg && (
            <p className={`text-sm font-medium ${scanMsg.startsWith("✅") ? "text-green-600" : "text-orange-500"}`}>
              {scanMsg}
            </p>
          )}
        </div>
      </SectionCard>

      {/* 購物車 */}
      {cart.length > 0 && (
        <SectionCard title="購物車">
          <div className="space-y-2">
            {cart.map((c) => (
              <div key={c.itemId} className="flex items-center gap-3 text-sm">
                <span className="flex-1 text-gray-700">{c.itemName}</span>
                <span className="text-gray-400 w-16 text-right">${c.unitPrice}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(c.itemId, c.qty - 1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold">−</button>
                  <span className="w-8 text-center">{c.qty}</span>
                  <button onClick={() => updateQty(c.itemId, c.qty + 1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold">+</button>
                </div>
                <span className="w-20 text-right font-medium text-gray-800">${c.qty * c.unitPrice}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                max="99"
                value={discountPct}
                onChange={(e) => { setDiscountPct(e.target.value); setDiscountAmt(""); }}
                placeholder="折扣 %"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <input
                type="number"
                min="0"
                value={discountAmt}
                onChange={(e) => { setDiscountAmt(e.target.value); setDiscountPct(""); }}
                placeholder="折扣金額 $"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>小計</span><span>${subtotal}</span>
            </div>
            {subtotal !== totalAmount && (
              <div className="flex justify-between text-sm text-green-600">
                <span>折扣</span><span>−${subtotal - totalAmount}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-800">
              <span>合計</span><span>${totalAmount}</span>
            </div>
          </div>
        </SectionCard>
      )}

      {/* 訂單備註 */}
      <SectionCard title="訂單備註">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="輸入備註（買家要求、特殊包裝、發票資訊…）"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
        />
      </SectionCard>

      {/* 送出 */}
      <button
        onClick={handleSubmit}
        disabled={cart.length === 0}
        className="w-full py-3 rounded-2xl text-white font-semibold text-sm transition-colors disabled:opacity-40 bg-blue-500 hover:bg-blue-600"
      >
        {done ? "✅ 訂單已建立" : "建立訂單"}
      </button>

      {/* 歷史訂單 */}
      {sortedOrders.length > 0 && (
        <SectionCard title="歷史訂單">
          <div className="space-y-3">
            {sortedOrders.map((o) => (
              <div key={o.id} className="border border-gray-100 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between font-medium text-gray-700">
                  <span>{o.platform}</span>
                  <span>${o.total ?? o.totalAmount}</span>
                </div>
                <div className="text-xs text-gray-400">{o.orderDate}</div>
                {o.note && <div className="text-xs text-gray-500 italic">{o.note}</div>}
                <div className="flex gap-2 pt-1">
                  {updateOrder && (
                    <button onClick={() => updateOrder(o.id, {})} className="text-xs text-blue-500 hover:underline">編輯</button>
                  )}
                  {deleteOrder && (
                    <button onClick={() => deleteOrder(o.id)} className="text-xs text-red-400 hover:underline">刪除</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
