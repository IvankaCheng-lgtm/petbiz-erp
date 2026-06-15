import { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { SectionCard } from "../components/ui";
import { Download } from "lucide-react";
import { fmt } from "../utils/format";

const PIE_COLORS = ["#FFB84D", "#10B981", "#8B5CF6", "#3B82F6"];

export default function Performance({ data }) {
  const {
    revenues,
    expenses,
    orders = [],
    inventory = [],
    marketEvents = [],
  } = data;

  const EC_PLATFORMS = ["萌獸官網", "PChome", "Yahoo", "蝦皮"];
  const OFFLINE_PLATFORMS = ["私訊訂購", "LINE訂購"];
  const [itemTab, setItemTab] = useState("ec");
  const [expandedItem, setExpandedItem] = useState(null);
  const [expandedMarginItem, setExpandedMarginItem] = useState(null);
  const [selectedMarketEvent, setSelectedMarketEvent] = useState("all");
  const [pageAll, setPageAll] = useState(1);
  const [pageMargin, setPageMargin] = useState(1);
  const [pageTurnover, setPageTurnover] = useState(1);
  const [riskFilter, setRiskFilter] = useState("all");
  const [pageChannel, setPageChannel] = useState(1);
  const [pageMarket, setPageMarket] = useState(1);
  const PAGE_SIZE = 10;

  const now2 = new Date();
  const [rangeType, setRangeType] = useState("month");
  const [rangeYear, setRangeYear] = useState(now2.getFullYear());
  const [rangeMonth, setRangeMonth] = useState(now2.getMonth() + 1);
  const [rangeQ, setRangeQ] = useState(Math.ceil((now2.getMonth() + 1) / 3));

  const availableYears = useMemo(() => {
    const s = new Set(revenues.map((r) => r.date.slice(0, 4)));
    orders.forEach((o) => {
      if (o.orderDate) s.add(o.orderDate.slice(0, 4));
    });
    const arr = [...s].sort((a, b) => b - a);
    return arr.length > 0 ? arr : [String(now2.getFullYear())];
  }, [revenues, orders]);

  const rangeLabel = useMemo(() => {
    if (rangeType === "month") return rangeYear + " 年 " + rangeMonth + " 月";
    if (rangeType === "quarter") return rangeYear + " 年 Q" + rangeQ;
    return rangeYear + " 年";
  }, [rangeType, rangeYear, rangeMonth, rangeQ]);

  function inRange(dateStr) {
    if (!dateStr) return false;
    if (rangeType === "month")
      return dateStr.startsWith(
        rangeYear + "-" + String(rangeMonth).padStart(2, "0"),
      );
    if (rangeType === "quarter") {
      const m = parseInt(dateStr.slice(5, 7));
      return (
        dateStr.startsWith(String(rangeYear)) && Math.ceil(m / 3) === rangeQ
      );
    }
    return dateStr.startsWith(String(rangeYear));
  }

  function Pagination({ page, setPage, total }) {
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) return null;
    return (
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
        <span className="text-xs text-gray-400">
          共 {total} 筆，第 {page} / {pages} 頁
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            上一頁
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-7 h-7 text-xs rounded-lg border transition-colors ${
                p === page
                  ? "bg-orange-400 text-white border-orange-400"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            下一頁
          </button>
        </div>
      </div>
    );
  }

  const filteredOrders = useMemo(
    () => orders.filter((o) => inRange(o.orderDate)),
    [orders, rangeType, rangeYear, rangeMonth, rangeQ],
  );
  const filteredRevenues = useMemo(
    () => revenues.filter((r) => inRange(r.date)),
    [revenues, rangeType, rangeYear, rangeMonth, rangeQ],
  );
  const marketItemPerEvent = useMemo(() => {
    const mktRevs = filteredRevenues.filter(
      (r) => r.channel === "市集" && r.items,
    );
    const allMap = {};
    mktRevs.forEach((r) => {
      (r.items || []).forEach((it) => {
        if (!allMap[it.itemId])
          allMap[it.itemId] = {
            name: it.itemName,
            qty: 0,
            amount: 0,
            byEvent: {},
          };
        allMap[it.itemId].qty += it.qty;
        allMap[it.itemId].amount += it.qty * it.unitPrice;
        const eid = r.eventId || "unknown";
        allMap[it.itemId].byEvent[eid] =
          (allMap[it.itemId].byEvent[eid] || 0) + it.qty;
      });
    });
    const byEvent = {};
    mktRevs.forEach((r) => {
      const eid = r.eventId || "unknown";
      if (!byEvent[eid]) byEvent[eid] = {};
      (r.items || []).forEach((it) => {
        if (!byEvent[eid][it.itemId])
          byEvent[eid][it.itemId] = { name: it.itemName, qty: 0, amount: 0 };
        byEvent[eid][it.itemId].qty += it.qty;
        byEvent[eid][it.itemId].amount += it.qty * it.unitPrice;
      });
    });
    return {
      byEvent,
      allItems: Object.values(allMap).sort((a, b) => b.qty - a.qty),
    };
  }, [filteredRevenues, rangeType, rangeYear, rangeMonth, rangeQ]);

  const allItemStats = useMemo(() => {
    const map = {};
    filteredOrders.forEach((o) => {
      const ch = EC_PLATFORMS.includes(o.platform) ? "電商" : "實體";
      (o.items || []).forEach((it) => {
        if (!map[it.itemId])
          map[it.itemId] = {
            name: it.itemName,
            total: 0,
            amount: 0,
            ec: 0,
            market: 0,
            offline: 0,
            byPlatform: {},
          };
        map[it.itemId].total += it.qty;
        map[it.itemId].amount += it.qty * it.unitPrice;
        if (ch === "電商") map[it.itemId].ec += it.qty;
        else map[it.itemId].offline += it.qty;
        map[it.itemId].byPlatform[o.platform] =
          (map[it.itemId].byPlatform[o.platform] || 0) + it.qty;
      });
    });
    filteredRevenues
      .filter((r) => r.channel === "市集" && r.items)
      .forEach((r) => {
        (r.items || []).forEach((it) => {
          if (!map[it.itemId])
            map[it.itemId] = {
              name: it.itemName,
              total: 0,
              amount: 0,
              ec: 0,
              market: 0,
              offline: 0,
              byPlatform: {},
            };
          map[it.itemId].total += it.qty;
          map[it.itemId].amount += it.qty * it.unitPrice;
          map[it.itemId].market += it.qty;
          map[it.itemId].byPlatform["市集"] =
            (map[it.itemId].byPlatform["市集"] || 0) + it.qty;
        });
      });
    return Object.values(map)
      .map((item) => {
        const inv = inventory.find((i) => i.itemName === item.name);
        const stock = inv?.currentQty ?? null;
        const turnover =
          stock !== null && item.total > 0
            ? +((item.total / (item.total + stock)) * 100).toFixed(1)
            : null;
        return { ...item, stock, turnover };
      })
      .sort((a, b) => b.total - a.total);
  }, [
    filteredOrders,
    filteredRevenues,
    inventory,
    rangeType,
    rangeYear,
    rangeMonth,
    rangeQ,
  ]);

  const turnoverStats = useMemo(() => {
    const now = new Date();
    const days30ago = new Date(now.getTime() - 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    const days90ago = new Date(now.getTime() - 90 * 86400000)
      .toISOString()
      .slice(0, 10);
    const salesMap = {};
    const countSales = (items, date) => {
      if (!items) return;
      items.forEach((it) => {
        if (!salesMap[it.itemId])
          salesMap[it.itemId] = { name: it.itemName, qty30: 0, qty90: 0 };
        if (date >= days30ago) salesMap[it.itemId].qty30 += it.qty;
        if (date >= days90ago) salesMap[it.itemId].qty90 += it.qty;
      });
    };
    orders.forEach((o) => countSales(o.items, o.orderDate));
    revenues
      .filter((r) => r.channel === "市集" && r.items)
      .forEach((r) => countSales(r.items, r.date));
    return inventory
      .filter((i) => i.category === "A用品" || i.category === "B食品")
      .map((item) => {
        const s = salesMap[item.id] || { qty30: 0, qty90: 0 };
        const dailyRate30 = s.qty30 / 30;
        const daysLeft =
          dailyRate30 > 0 ? Math.round(item.currentQty / dailyRate30) : null;
        const risk =
          s.qty30 === 0 && item.currentQty > 0
            ? "dead"
            : daysLeft !== null && daysLeft > 90
              ? "slow"
              : daysLeft !== null && daysLeft < 14
                ? "urgent"
                : "normal";
        return { ...item, qty30: s.qty30, qty90: s.qty90, daysLeft, risk };
      })
      .sort((a, b) => {
        const order = { dead: 0, slow: 1, urgent: 2, normal: 3 };
        return order[a.risk] - order[b.risk] || b.currentQty - a.currentQty;
      });
  }, [orders, revenues, inventory]);

  const itemMarginStats = useMemo(() => {
    return allItemStats
      .map((item) => {
        const inv = inventory.find((i) => i.itemName === item.name);
        const salePrice = inv?.salePrice || 0;
        const cost = inv?.cost || 0;
        const margin = salePrice > 0 ? salePrice - cost : null;
        const marginRate =
          salePrice > 0 && cost > 0
            ? +(((salePrice - cost) / salePrice) * 100).toFixed(1)
            : null;
        const totalProfit =
          margin !== null ? Math.round(margin * item.total) : null;
        return { ...item, salePrice, cost, margin, marginRate, totalProfit };
      })
      .filter((i) => i.salePrice > 0)
      .sort(
        (a, b) => (b.totalProfit ?? -Infinity) - (a.totalProfit ?? -Infinity),
      );
  }, [allItemStats, inventory]);

  const ecItemStats = useMemo(() => {
    const map = {};
    filteredOrders
      .filter((o) => EC_PLATFORMS.includes(o.platform))
      .forEach((o) => {
        (o.items || []).forEach((it) => {
          if (!map[it.itemId])
            map[it.itemId] = {
              name: it.itemName,
              qty: 0,
              amount: 0,
              platforms: {},
            };
          map[it.itemId].qty += it.qty;
          map[it.itemId].amount += it.qty * it.unitPrice;
          map[it.itemId].platforms[o.platform] =
            (map[it.itemId].platforms[o.platform] || 0) + it.qty;
        });
      });
    return Object.values(map).sort((a, b) => b.qty - a.qty);
  }, [filteredOrders, rangeType, rangeYear, rangeMonth, rangeQ]);

  const marketItemStats = useMemo(() => {
    const map = {};
    filteredRevenues
      .filter((r) => r.channel === "市集" && r.items)
      .forEach((r) => {
        (r.items || []).forEach((it) => {
          if (!map[it.itemId])
            map[it.itemId] = { name: it.itemName, qty: 0, amount: 0 };
          map[it.itemId].qty += it.qty;
          map[it.itemId].amount += it.qty * it.unitPrice;
        });
      });
    return Object.values(map).sort((a, b) => b.qty - a.qty);
  }, [filteredRevenues, rangeType, rangeYear, rangeMonth, rangeQ]);

  const offlineItemStats = useMemo(() => {
    const map = {};
    filteredOrders
      .filter(
        (o) =>
          OFFLINE_PLATFORMS.includes(o.platform) ||
          (!EC_PLATFORMS.includes(o.platform) && o.platform !== "市集"),
      )
      .forEach((o) => {
        (o.items || []).forEach((it) => {
          if (!map[it.itemId])
            map[it.itemId] = {
              name: it.itemName,
              qty: 0,
              amount: 0,
              platforms: {},
            };
          map[it.itemId].qty += it.qty;
          map[it.itemId].amount += it.qty * it.unitPrice;
          map[it.itemId].platforms[o.platform] =
            (map[it.itemId].platforms[o.platform] || 0) + it.qty;
        });
      });
    return Object.values(map).sort((a, b) => b.qty - a.qty);
  }, [filteredOrders, rangeType, rangeYear, rangeMonth, rangeQ]);

  const inventoryCostMap = useMemo(() => {
    const map = {};
    inventory.forEach((i) => {
      map[i.id] = i.cost || 0;
    });
    return map;
  }, [inventory]);

  const actualCogs = useMemo(
    () =>
      filteredOrders.reduce(
        (s, o) =>
          s +
          (o.items || []).reduce(
            (ss, it) => ss + it.qty * (inventoryCostMap[it.itemId] || 0),
            0,
          ),
        0,
      ),
    [
      filteredOrders,
      inventoryCostMap,
      rangeType,
      rangeYear,
      rangeMonth,
      rangeQ,
    ],
  );

  const purchaseCogs = useMemo(
    () =>
      expenses
        .filter((e) => e.type === "進貨" && inRange(e.date))
        .reduce((s, e) => s + e.amount, 0),
    [expenses, rangeType, rangeYear, rangeMonth, rangeQ],
  );

  const totalCogs = useMemo(
    () => Math.max(actualCogs, purchaseCogs),
    [actualCogs, purchaseCogs],
  );

  const categoryData = useMemo(() => {
    const cats = ["食品", "烘焙", "蛋糕", "用品"];
    const manualCats = cats.map((cat) => ({
      name: cat,
      value: revenues
        .filter((r) => r.category === cat)
        .reduce((s, r) => s + r.amount, 0),
    }));
    const orderCatMap = {};
    revenues
      .filter((r) => EC_PLATFORMS.includes(r.channel) && r.items)
      .forEach((r) => {
        r.items.forEach((it) => {
          const cat = it.category === "A用品" ? "用品" : "食品";
          orderCatMap[cat] = (orderCatMap[cat] || 0) + it.qty * it.unitPrice;
        });
      });
    return cats
      .map((cat, i) => ({
        name: cat,
        value: (manualCats[i].value || 0) + (orderCatMap[cat] || 0),
      }))
      .filter((d) => d.value > 0);
  }, [revenues]);

  const channelData = useMemo(() => {
    const ecRev = filteredRevenues
      .filter((r) => r.channel === "電商" || EC_PLATFORMS.includes(r.channel))
      .reduce((s, r) => s + r.amount, 0);
    const mktRev = filteredRevenues
      .filter((r) => r.channel === "市集")
      .reduce((s, r) => s + r.amount, 0);
    const totalRev = ecRev + mktRev;
    const cogsRatio = totalRev > 0 ? totalCogs / totalRev : 0;
    const boothCost = expenses
      .filter((e) => e.type === "攤位")
      .reduce((s, e) => s + e.amount, 0);
    const ecGross = ecRev - ecRev * cogsRatio;
    const mktGross = mktRev - mktRev * cogsRatio - boothCost;
    return [
      {
        name: "電商",
        營收: ecRev,
        毛利: Math.round(ecGross),
        毛利率: ecRev > 0 ? +((ecGross / ecRev) * 100).toFixed(1) : 0,
      },
      {
        name: "市集",
        營收: mktRev,
        毛利: Math.round(mktGross),
        毛利率: mktRev > 0 ? +((mktGross / mktRev) * 100).toFixed(1) : 0,
      },
    ];
  }, [
    filteredRevenues,
    expenses,
    totalCogs,
    rangeType,
    rangeYear,
    rangeMonth,
    rangeQ,
  ]);

  const monthlyChannel = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const label = `${d.getMonth() + 1}月`;
      const y = d.getFullYear(),
        m = d.getMonth() + 1;
      const inMonth = (r) => {
        const rd = new Date(r.date);
        return rd.getFullYear() === y && rd.getMonth() + 1 === m;
      };
      const ec = revenues
        .filter(
          (r) =>
            inMonth(r) &&
            (r.channel === "電商" || EC_PLATFORMS.includes(r.channel)),
        )
        .reduce((s, r) => s + r.amount, 0);
      const mkt = revenues
        .filter((r) => inMonth(r) && r.channel === "市集")
        .reduce((s, r) => s + r.amount, 0);
      return { label, 電商: ec, 市集: mkt };
    });
  }, [revenues]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: p.color }}
            />
            <span className="text-gray-600">{p.name}：</span>
            <span className="font-semibold">{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  function handlePerformancePrint() {
    const date = new Date().toLocaleDateString("zh-TW");
    const channelRows = channelData
      .map(
        (ch) =>
          '<tr><td style="padding:8px 12px;font-weight:600">' +
          ch.name +
          "</td>" +
          '<td style="padding:8px 12px;text-align:right">' +
          fmt(ch["營收"]) +
          "</td>" +
          '<td style="padding:8px 12px;text-align:right;color:' +
          (ch["毛利"] >= 0 ? "#059669" : "#dc2626") +
          ';font-weight:700">' +
          fmt(ch["毛利"]) +
          "</td>" +
          '<td style="padding:8px 12px;text-align:right;color:' +
          (ch["毛利率"] >= 25 ? "#059669" : "#f97316") +
          '">' +
          ch["毛利率"] +
          "%</td></tr>",
      )
      .join("");
    const itemRows = allItemStats
      .slice(0, 20)
      .map(
        (item, i) =>
          '<tr style="background:' +
          (i % 2 === 0 ? "#fff" : "#f9fafb") +
          '">' +
          '<td style="padding:7px 10px;color:#9ca3af;font-size:12px">' +
          (i + 1) +
          "</td>" +
          '<td style="padding:7px 10px;font-weight:600">' +
          item.name +
          "</td>" +
          '<td style="padding:7px 10px;text-align:right;color:#f97316">' +
          (item.ec || "—") +
          "</td>" +
          '<td style="padding:7px 10px;text-align:right;color:#059669">' +
          (item.market || "—") +
          "</td>" +
          '<td style="padding:7px 10px;text-align:right;color:#8b5cf6">' +
          (item.offline || "—") +
          "</td>" +
          '<td style="padding:7px 10px;text-align:right;font-weight:700">' +
          item.total +
          "</td>" +
          '<td style="padding:7px 10px;text-align:right;color:#6b7280">' +
          fmt(item.amount) +
          "</td></tr>",
      )
      .join("");
    const marginRows = itemMarginStats
      .slice(0, 20)
      .map(
        (item, i) =>
          '<tr style="background:' +
          (i % 2 === 0 ? "#fff" : "#f9fafb") +
          '">' +
          '<td style="padding:7px 10px;color:#9ca3af;font-size:12px">' +
          (i + 1) +
          "</td>" +
          '<td style="padding:7px 10px;font-weight:600">' +
          item.name +
          "</td>" +
          '<td style="padding:7px 10px;text-align:right">$' +
          item.salePrice +
          "</td>" +
          '<td style="padding:7px 10px;text-align:right;color:#9ca3af">$' +
          item.cost +
          "</td>" +
          '<td style="padding:7px 10px;text-align:right;font-weight:600;color:' +
          (item.marginRate >= 30
            ? "#059669"
            : item.marginRate >= 20
              ? "#f97316"
              : "#dc2626") +
          '">' +
          (item.marginRate !== null ? item.marginRate + "%" : "—") +
          "</td>" +
          '<td style="padding:7px 10px;text-align:right;font-weight:700;color:#059669">' +
          (item.totalProfit !== null ? fmt(item.totalProfit) : "—") +
          "</td></tr>",
      )
      .join("");
    const html = [
      '<html><head><meta charset="utf-8"><title>通路表現分析 ' +
        rangeLabel +
        "</title>",
      "<style>body{font-family:sans-serif;padding:28px;color:#1f2937;font-size:13px}h1{font-size:20px;font-weight:900;margin:0 0 4px}.sub{font-size:11px;color:#6b7280;margin-bottom:24px}.sec{margin-bottom:24px}.sec-title{font-size:14px;font-weight:700;border-left:4px solid #f97316;padding-left:9px;margin-bottom:10px}table{width:100%;border-collapse:collapse;font-size:12px}thead tr{background:#f3f4f6}th{text-align:left;padding:8px 10px;font-size:11px;font-weight:600}th:not(:first-child){text-align:right}tbody tr{border-bottom:1px solid #f3f4f6}.footer{margin-top:32px;font-size:10px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:10px}@media print{body{padding:12px}@page{size:A4;margin:1.2cm}}</style></head><body>",
      "<h1>萌獸探險隊 · 商品／通路表現分析</h1>",
      '<div class="sub">報表範圍：' +
        rangeLabel +
        "　　列印日期：" +
        date +
        "</div>",
      '<div class="sec"><div class="sec-title">📊 通路毛利對比</div><table><thead><tr><th>通路</th><th>營收</th><th>毛利</th><th>毛利率</th></tr></thead><tbody>' +
        channelRows +
        "</tbody></table></div>",
      allItemStats.length > 0
        ? '<div class="sec"><div class="sec-title">🏆 品項全通路銷售總覽（Top 20）</div><table><thead><tr><th>#</th><th>品項</th><th>電商</th><th>市集</th><th>實體</th><th>總計</th><th>銷售額</th></tr></thead><tbody>' +
          itemRows +
          "</tbody></table></div>"
        : "",
      itemMarginStats.length > 0
        ? '<div class="sec"><div class="sec-title">💰 品項毛利分析（Top 20）</div><table><thead><tr><th>#</th><th>品項</th><th>售價</th><th>成本</th><th>毛利率</th><th>總獲利</th></tr></thead><tbody>' +
          marginRows +
          "</tbody></table></div>"
        : "",
      '<div class="footer">萌獸探險隊 ERP · 商品／通路表現分析 · ' +
        rangeLabel +
        "</div>",
      "</body></html>",
    ].join("");
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
  }
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">商品／通路表現</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { k: "month", l: "月" },
              { k: "quarter", l: "季" },
              { k: "year", l: "年" },
            ].map(({ k, l }) => (
              <button
                key={k}
                onClick={() => setRangeType(k)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${rangeType === k ? "bg-white text-orange-500 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <select
            value={rangeYear}
            onChange={(e) => setRangeYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y} 年
              </option>
            ))}
          </select>
          {rangeType === "month" && (
            <select
              value={rangeMonth}
              onChange={(e) => setRangeMonth(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m} 月
                </option>
              ))}
            </select>
          )}
          {rangeType === "quarter" && (
            <select
              value={rangeQ}
              onChange={(e) => setRangeQ(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
            >
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  Q{q}
                </option>
              ))}
            </select>
          )}
          <span className="text-sm text-gray-400">{rangeLabel}</span>
          <button
            onClick={handlePerformancePrint}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <Download size={15} /> 匯出 PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="產品線營收佔比">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="通路毛利對比">
          {totalCogs === 0 && (
            <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
              ⚠️ 未找到商品成本資料，請確認庫存品項已填寫「成本」欄位。
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {channelData.map((ch) => (
              <div
                key={ch.name}
                className={`rounded-xl p-4 ${ch.name === "電商" ? "bg-orange-50" : "bg-emerald-50"}`}
              >
                <p className="text-xs text-gray-500 font-medium">{ch.name}</p>
                <p className="text-xl font-bold text-gray-800 mt-1">
                  {fmt(ch.毛利)}
                </p>
                <p
                  className={`text-xs font-medium mt-0.5 ${ch.毛利率 >= 25 ? "text-emerald-600" : "text-orange-500"}`}
                >
                  毛利率 {ch.毛利率}%
                </p>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={channelData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="營收" fill="#FFB84D" radius={[4, 4, 0, 0]} />
              <Bar dataKey="毛利" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      <SectionCard title="近 6 個月通路營收趨勢">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={monthlyChannel}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="電商" fill="#FFB84D" radius={[4, 4, 0, 0]} />
            <Bar dataKey="市集" fill="#10B981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>
      <SectionCard title="🏆 品項全通路銷售總覽">
        {allItemStats.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            尚無品項銷售資料
          </p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[24px_1fr_60px_60px_60px_60px_70px] gap-2 text-xs font-medium text-gray-400 px-4">
              <span>#</span>
              <span>品項</span>
              <span className="text-right">電商</span>
              <span className="text-right">市集</span>
              <span className="text-right">實體</span>
              <span className="text-right">總計</span>
              <span className="text-right">銷售額</span>
            </div>
            {allItemStats
              .slice((pageAll - 1) * PAGE_SIZE, pageAll * PAGE_SIZE)
              .map((item, i) => {
                const isTop = i === 0 && pageAll === 1;
                const isSlow = item.turnover !== null && item.turnover < 20;
                const isExpanded = expandedItem === item.name;
                const maxQty = Math.max(...Object.values(item.byPlatform));
                return (
                  <div key={item.name}>
                    <div
                      onClick={() =>
                        setExpandedItem(isExpanded ? null : item.name)
                      }
                      className={`grid grid-cols-[24px_1fr_60px_60px_60px_60px_70px] gap-2 items-center rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                        isExpanded
                          ? "bg-orange-50 border border-orange-200"
                          : isTop
                            ? "bg-orange-50 border border-orange-100"
                            : isSlow
                              ? "bg-red-50/40"
                              : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <span
                        className={`text-xs font-bold ${isTop ? "text-orange-400" : "text-gray-300"}`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {isTop && (
                            <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">
                              🔥 最暢銷
                            </span>
                          )}
                          {isSlow && (
                            <span className="text-xs bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full font-medium">
                              滯銷
                            </span>
                          )}
                          {item.stock !== null && (
                            <span className="text-xs text-gray-400">
                              庫存 {item.stock}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-right text-orange-500">
                        {item.ec > 0 ? item.ec : "—"}
                      </span>
                      <span className="text-xs text-right text-emerald-500">
                        {item.market > 0 ? item.market : "—"}
                      </span>
                      <span className="text-xs text-right text-purple-500">
                        {item.offline > 0 ? item.offline : "—"}
                      </span>
                      <span className="text-sm text-right font-bold text-gray-800">
                        {item.total}
                      </span>
                      <span className="text-xs text-right text-gray-500">
                        {fmt(item.amount)}
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="mx-2 mb-2 bg-white border border-orange-100 rounded-xl px-4 py-3 space-y-2">
                        <p className="text-xs font-semibold text-gray-500 mb-2">
                          📊 {item.name} 各通路銷售明細
                        </p>
                        {Object.entries(item.byPlatform)
                          .sort((a, b) => b[1] - a[1])
                          .map(([platform, qty]) => (
                            <div
                              key={platform}
                              className="flex items-center gap-3"
                            >
                              <span className="text-xs text-gray-600 w-24 shrink-0">
                                {platform}
                              </span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    EC_PLATFORMS.includes(platform)
                                      ? "bg-orange-400"
                                      : platform === "市集"
                                        ? "bg-emerald-400"
                                        : "bg-purple-400"
                                  }`}
                                  style={{
                                    width: `${maxQty > 0 ? (qty / maxQty) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                              <span className="text-sm font-bold text-gray-700 w-12 text-right">
                                {qty} 件
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            <p className="text-xs text-gray-400 pt-1">
              滯銷判斷：銷售量 / （銷售量 + 庫存）{"<"} 20%
            </p>
            <Pagination
              page={pageAll}
              setPage={setPageAll}
              total={allItemStats.length}
            />
          </div>
        )}
      </SectionCard>

      <SectionCard title="💰 品項毛利分析">
        {itemMarginStats.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            尚無資料，請確認庫存品項已填寫「售價」和「成本」欄位
          </p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[24px_1fr_60px_60px_60px_80px] gap-2 text-xs font-medium text-gray-400 px-4">
              <span>#</span>
              <span>品項</span>
              <span className="text-right">售價</span>
              <span className="text-right">成本</span>
              <span className="text-right">毛利率</span>
              <span className="text-right">總獲利</span>
            </div>
            {itemMarginStats
              .slice((pageMargin - 1) * PAGE_SIZE, pageMargin * PAGE_SIZE)
              .map((item, i) => {
                const isExpanded = expandedMarginItem === item.name;
                const isTop = i === 0 && pageMargin === 1;
                const isLow = item.marginRate !== null && item.marginRate < 20;
                return (
                  <div key={item.name}>
                    <div
                      onClick={() =>
                        setExpandedMarginItem(isExpanded ? null : item.name)
                      }
                      className={`grid grid-cols-[24px_1fr_60px_60px_60px_80px] gap-2 items-center rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                        isExpanded
                          ? "bg-emerald-50 border border-emerald-200"
                          : isTop
                            ? "bg-emerald-50 border border-emerald-100"
                            : isLow
                              ? "bg-red-50/40"
                              : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <span
                        className={`text-xs font-bold ${isTop ? "text-emerald-500" : "text-gray-300"}`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {isTop && (
                            <span className="text-xs bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">
                              💰 最賺錢
                            </span>
                          )}
                          {isLow && (
                            <span className="text-xs bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full font-medium">
                              低毛利
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            已售 {item.total} 件
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-right text-gray-600">
                        ${item.salePrice}
                      </span>
                      <span className="text-xs text-right text-gray-400">
                        ${item.cost}
                      </span>
                      <span
                        className={`text-xs text-right font-semibold ${
                          item.marginRate === null
                            ? "text-gray-300"
                            : item.marginRate >= 30
                              ? "text-emerald-600"
                              : item.marginRate >= 20
                                ? "text-orange-500"
                                : "text-red-500"
                        }`}
                      >
                        {item.marginRate !== null ? `${item.marginRate}%` : "—"}
                      </span>
                      <span className="text-sm text-right font-bold text-emerald-600">
                        {item.totalProfit !== null
                          ? fmt(item.totalProfit)
                          : "—"}
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="mx-2 mb-2 bg-white border border-emerald-100 rounded-xl px-4 py-3 space-y-1.5 text-sm">
                        <p className="text-xs font-semibold text-gray-500 mb-2">
                          💰 {item.name} 毛利明細
                        </p>
                        {[
                          "售價",
                          "成本",
                          "每件毛利",
                          "毛利率",
                          "已售件數",
                          "總獲利",
                        ].map((label, idx) => {
                          const vals = [
                            item.salePrice,
                            item.cost,
                            item.margin,
                            item.marginRate,
                            item.total,
                            item.totalProfit,
                          ];
                          const units = ["$", "$", "$", "%", "件", ""];
                          const val = vals[idx];
                          return (
                            <div key={label} className="flex justify-between">
                              <span className="text-gray-500">{label}</span>
                              <span className="font-semibold text-gray-800">
                                {val !== null
                                  ? idx === 5
                                    ? fmt(val)
                                    : `${units[idx]}${val}`
                                  : "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            <p className="text-xs text-gray-400 pt-1">
              低毛利判斷：毛利率 {"<"} 20%，總獲利 = 毛利 × 已售件數
            </p>
            <Pagination
              page={pageMargin}
              setPage={setPageMargin}
              total={itemMarginStats.length}
            />
          </div>
        )}
      </SectionCard>
      <SectionCard title="⏱️ 庫存周轉率分析">
        <p className="text-xs text-gray-400 mb-3">
          依近 30 天銷售速度估算，判斷庫存可維持天數
        </p>
        <div className="flex gap-2 mb-3 flex-wrap">
          {[
            { k: "all", l: "全部", c: "bg-gray-200 text-gray-600" },
            { k: "dead", l: "零銷售", c: "bg-gray-100 text-gray-500" },
            { k: "slow", l: "滯銷 >90天", c: "bg-red-100 text-red-600" },
            {
              k: "urgent",
              l: "即將售罄 <14天",
              c: "bg-orange-100 text-orange-600",
            },
            { k: "normal", l: "正常", c: "bg-emerald-100 text-emerald-600" },
          ].map(({ k, l, c }) => (
            <button
              key={k}
              onClick={() => {
                setRiskFilter(k);
                setPageTurnover(1);
              }}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                riskFilter === k
                  ? "ring-2 ring-offset-1 ring-gray-400 " + c
                  : c + " opacity-60 hover:opacity-100"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        {turnoverStats.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            尚無 A用品/B食品庫存資料
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_60px_60px_60px_80px] gap-2 text-xs font-medium text-gray-400 px-4">
                <span>品項</span>
                <span className="text-right">庫存</span>
                <span className="text-right">30天銷量</span>
                <span className="text-right">90天銷量</span>
                <span className="text-right">可維持</span>
              </div>
              {(() => {
                const filtered =
                  riskFilter === "all"
                    ? turnoverStats
                    : turnoverStats.filter((i) => i.risk === riskFilter);
                const paged = filtered.slice(
                  (pageTurnover - 1) * PAGE_SIZE,
                  pageTurnover * PAGE_SIZE,
                );
                if (filtered.length === 0)
                  return (
                    <p className="text-sm text-gray-400 text-center py-6">
                      此類別目前無品項
                    </p>
                  );
                return (
                  <>
                    {paged.map((item) => {
                      const riskStyle = {
                        dead: "bg-gray-50 border-l-4 border-gray-300",
                        slow: "bg-red-50/60 border-l-4 border-red-400",
                        urgent: "bg-orange-50 border-l-4 border-orange-400",
                        normal: "bg-gray-50",
                      }[item.risk];
                      const riskLabel = {
                        dead: { text: "零銷售", cls: "text-gray-400" },
                        slow: { text: "滯銷", cls: "text-red-500" },
                        urgent: { text: "即將售罄", cls: "text-orange-500" },
                        normal: { text: null, cls: "" },
                      }[item.risk];
                      return (
                        <div
                          key={item.id}
                          className={`grid grid-cols-[1fr_60px_60px_60px_80px] gap-2 items-center rounded-xl px-4 py-3 ${riskStyle}`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {item.itemName}
                            </p>
                            {riskLabel.text && (
                              <span
                                className={`text-xs font-medium ${riskLabel.cls}`}
                              >
                                {riskLabel.text}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-right text-gray-700 font-medium">
                            {item.currentQty} {item.unit}
                          </span>
                          <span
                            className={`text-xs text-right font-medium ${item.qty30 > 0 ? "text-emerald-600" : "text-gray-300"}`}
                          >
                            {item.qty30}
                          </span>
                          <span
                            className={`text-xs text-right font-medium ${item.qty90 > 0 ? "text-blue-500" : "text-gray-300"}`}
                          >
                            {item.qty90}
                          </span>
                          <span
                            className={`text-sm text-right font-bold ${
                              item.daysLeft === null
                                ? "text-gray-300"
                                : item.daysLeft < 14
                                  ? "text-orange-500"
                                  : item.daysLeft > 90
                                    ? "text-red-500"
                                    : "text-emerald-600"
                            }`}
                          >
                            {item.daysLeft !== null
                              ? `${item.daysLeft} 天`
                              : item.currentQty > 0
                                ? "—"
                                : "缺貨"}
                          </span>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
            <Pagination
              page={pageTurnover}
              setPage={setPageTurnover}
              total={
                riskFilter === "all"
                  ? turnoverStats.length
                  : turnoverStats.filter((i) => i.risk === riskFilter).length
              }
            />
          </>
        )}
      </SectionCard>

      <SectionCard title="📊 品項銷售分析">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-4">
          {[
            { k: "ec", l: "電商平台" },
            { k: "market", l: "市集" },
            { k: "offline", l: "實體通路" },
          ].map(({ k, l }) => (
            <button
              key={k}
              onClick={() => {
                setItemTab(k);
                setPageChannel(1);
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                itemTab === k
                  ? "bg-white text-orange-500 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        {itemTab === "ec" &&
          (ecItemStats.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              尚無電商訂單品項資料
            </p>
          ) : (
            <div className="space-y-2">
              {ecItemStats
                .slice((pageChannel - 1) * PAGE_SIZE, pageChannel * PAGE_SIZE)
                .map((item, i) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
                  >
                    <span className="text-xs font-bold text-gray-400 w-5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {Object.entries(item.platforms)
                          .map(([p, q]) => `${p} ${q}件`)
                          .join("、")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-orange-500">
                        {item.qty} 件
                      </p>
                      <p className="text-xs text-gray-400">
                        {fmt(item.amount)}
                      </p>
                    </div>
                    <div className="w-20">
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded-full"
                          style={{
                            width: `${ecItemStats[0].qty > 0 ? (item.qty / ecItemStats[0].qty) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              <Pagination
                page={pageChannel}
                setPage={setPageChannel}
                total={ecItemStats.length}
              />
            </div>
          ))}
        {itemTab === "market" &&
          (marketItemStats.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              尚無市集品項資料
            </p>
          ) : (
            <div className="space-y-2">
              {marketItemStats
                .slice((pageChannel - 1) * PAGE_SIZE, pageChannel * PAGE_SIZE)
                .map((item, i) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
                  >
                    <span className="text-xs font-bold text-gray-400 w-5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {item.name}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-emerald-500">
                        {item.qty} 件
                      </p>
                      <p className="text-xs text-gray-400">
                        {fmt(item.amount)}
                      </p>
                    </div>
                    <div className="w-20">
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full"
                          style={{
                            width: `${marketItemStats[0].qty > 0 ? (item.qty / marketItemStats[0].qty) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              <Pagination
                page={pageChannel}
                setPage={setPageChannel}
                total={marketItemStats.length}
              />
            </div>
          ))}
        {itemTab === "offline" &&
          (offlineItemStats.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              尚無實體通路品項資料
            </p>
          ) : (
            <div className="space-y-2">
              {offlineItemStats
                .slice((pageChannel - 1) * PAGE_SIZE, pageChannel * PAGE_SIZE)
                .map((item, i) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
                  >
                    <span className="text-xs font-bold text-gray-400 w-5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {Object.entries(item.platforms)
                          .map(([p, q]) => `${p} ${q}件`)
                          .join("、")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-purple-500">
                        {item.qty} 件
                      </p>
                      <p className="text-xs text-gray-400">
                        {fmt(item.amount)}
                      </p>
                    </div>
                    <div className="w-20">
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-400 rounded-full"
                          style={{
                            width: `${offlineItemStats[0].qty > 0 ? (item.qty / offlineItemStats[0].qty) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              <Pagination
                page={pageChannel}
                setPage={setPageChannel}
                total={offlineItemStats.length}
              />
            </div>
          ))}
      </SectionCard>

      <SectionCard title="🏠 市集品項表現">
        {marketItemPerEvent.allItems.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            尚無市集品項資料（需市集現場收款時選擇品項）
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedMarketEvent("all")}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  selectedMarketEvent === "all"
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"
                }`}
              >
                全部場次
              </button>
              {marketEvents
                .filter((e) => marketItemPerEvent.byEvent[e.id])
                .map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedMarketEvent(ev.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                      selectedMarketEvent === ev.id
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"
                    }`}
                  >
                    {ev.name} <span className="opacity-60">{ev.startDate}</span>
                  </button>
                ))}
            </div>
            {(() => {
              const items =
                selectedMarketEvent === "all"
                  ? marketItemPerEvent.allItems.slice(
                      (pageMarket - 1) * PAGE_SIZE,
                      pageMarket * PAGE_SIZE,
                    )
                  : Object.values(
                      marketItemPerEvent.byEvent[selectedMarketEvent] || {},
                    )
                      .sort((a, b) => b.qty - a.qty)
                      .slice(
                        (pageMarket - 1) * PAGE_SIZE,
                        pageMarket * PAGE_SIZE,
                      );
              const totalItems =
                selectedMarketEvent === "all"
                  ? marketItemPerEvent.allItems.length
                  : Object.keys(
                      marketItemPerEvent.byEvent[selectedMarketEvent] || {},
                    ).length;
              if (items.length === 0)
                return (
                  <p className="text-sm text-gray-400 text-center py-4">
                    此場次無品項資料
                  </p>
                );
              const maxQty = items[0]?.qty || 1;
              return (
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div
                      key={item.name}
                      className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
                    >
                      <span
                        className={`text-xs font-bold w-5 ${i === 0 ? "text-emerald-500" : "text-gray-300"}`}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {item.name}
                          </p>
                          {i === 0 && (
                            <span className="text-xs bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                              🌟 最受歡迎
                            </span>
                          )}
                        </div>
                        {selectedMarketEvent === "all" && item.byEvent && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {Object.entries(item.byEvent)
                              .map(([eid, q]) => {
                                const ev = marketEvents.find(
                                  (e) => e.id === eid,
                                );
                                return ev ? `${ev.name} ${q}件` : null;
                              })
                              .filter(Boolean)
                              .join("、")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${(item.qty / maxQty) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-emerald-600 w-12 text-right">
                          {item.qty} 件
                        </span>
                        <span className="text-xs text-gray-400 w-16 text-right">
                          {fmt(item.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <Pagination
                    page={pageMarket}
                    setPage={setPageMarket}
                    total={totalItems}
                  />
                </div>
              );
            })()}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
