const fs = require('fs');
let c = fs.readFileSync('G:/PetBiz-ERP/src/pages/MarketDiary.jsx', 'utf8');

const i = c.indexOf('const barData');
const end = c.indexOf(', [stats])', i) + ', [stats])'.length;
const old = c.substring(i, end);

const newStr = `const barData = useMemo(() =>
    stats.map(e => ({ name: e.name.length > 8 ? e.name.slice(0, 8) + '\u2026' : e.name, \u71df\u6536: e.totalRev, \u651e\u4f4d\u8cbb: e.boothFee, \u7d14\u5229: e.netProfit, \u6de8\u5229: e.trueProfit }))
  , [stats])`;

c = c.substring(0, i) + newStr + c.substring(end);
fs.writeFileSync('G:/PetBiz-ERP/src/pages/MarketDiary.jsx', c, 'utf8');
console.log('done');
console.log('new barData:', JSON.stringify(newStr.substring(0, 100)));
