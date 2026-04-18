const SYSTEM_INSTRUCTION = `你是「萌獸探險隊」的專屬 AI 參謀。
你是一位專業的寵物產業顧問、產品經理與會計助理，語氣專業、溫暖且有商業洞察力。
回答時請使用繁體中文，並盡量結合寵物食品品牌的實際營運情境給予具體建議。`;

export function maskSensitiveData(text) {
  return text
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "<email>")
    .replace(/09\d{2}[-\s]?\d{3}[-\s]?\d{3}/g, "<phone>")
    .replace(/\(?\d{2,4}\)?[-\s]?\d{3,4}[-\s]?\d{4}/g, "<phone>")
    .replace(
      /(^|[\s：:,，。、])[\u4e00-\u9fa5]{2,4}(?=[\s：:,，。、]|$)/gm,
      "$1<name>",
    )
    .replace(/[A-Z][12]\d{8}/g, "<id>")
    .replace(/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, "<card>");
}

export async function askGemini(prompt, context = "") {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return "❌ VITE_GEMINI_API_KEY 未設定，請檢查 .env 檔案。";

  const safePrompt = maskSensitiveData(prompt);
  const safeContext = maskSensitiveData(context);
  const userText = safeContext
    ? `【背景資料】\n${safeContext}\n\n【問題】\n${safePrompt}`
    : safePrompt;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data?.error?.message ?? "";
      if (
        res.status === 429 ||
        msg.includes("quota") ||
        msg.includes("RESOURCE_EXHAUSTED")
      )
        return "⏳ 請求過於頻繁（免費方案每分鐘限制）。請等待 60 秒後再試。";
      if (res.status === 400 || res.status === 403)
        return `❌ API 金鑰無效或權限不足（${res.status}）。請至 Google AI Studio 重新取得 Key。`;
      return `😿 錯誤（${res.status}）：${msg || "未知錯誤"}`;
    }

    const data = await res.json();
    return (
      data.candidates?.[0]?.content?.parts?.[0]?.text ??
      "😿 AI 未回傳內容，請再試一次。"
    );
  } catch (err) {
    return "🌐 網路連線異常，請確認網路後再試。";
  }
}
