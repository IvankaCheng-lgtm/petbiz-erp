export function getAccountingReminders(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const reminders = [];

  if (month % 2 === 1 && day >= 1 && day <= 10) {
    reminders.push({
      id: "blank_invoice",
      title: "上傳空白發票提醒",
      desc: `${month} 月份空白發票上傳期間（1~10 日），請登入電子發票平台完成上傳。`,
      color: "green",
      icon: "🧮",
    });
  }

  if (month % 2 === 1 && day >= 1 && day <= 15) {
    reminders.push({
      id: "vat",
      title: "營業稅申報提醒",
      desc: `${month} 月份營業稅申報期間（1~15 日），請確認本期銷售額與進項憑證。`,
      color: "orange",
      icon: "🧾",
    });
  }

  if (month % 2 === 0 && day === 25) {
    reminders.push({
      id: "voucher",
      title: "憑證整理提醒",
      desc: `今日（${month}/${day}）為憑證整理日，請彙整本雙月所有收支憑證。`,
      color: "blue",
      icon: "📂",
    });
  }

  return reminders;
}
