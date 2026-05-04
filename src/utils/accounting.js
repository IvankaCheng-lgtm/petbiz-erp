export function getAccountingReminders() {
  const reminders = [
    {
      id: "blank_invoice",
      title: "上傳空白發票提醒",
      desc: "奇數月份 1~10 日為空白發票上傳期間，請登入電子發票平台完成上傳。",
      color: "green",
      icon: "🧮",
    },
    {
      id: "vat",
      title: "營業稅申報提醒",
      desc: "奇數月份 1~15 日為營業稅申報期間，請確認本期銷售額與進項憑證。",
      color: "orange",
      icon: "🧾",
    },
    {
      id: "voucher",
      title: "憑證整理提醒",
      desc: "偶數月份 25 日為憑證整理日，請彙整本雙月所有收支憑證。",
      color: "blue",
      icon: "📂",
    },
  ]
  return reminders
}
