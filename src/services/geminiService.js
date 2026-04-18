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
  if (!apiKey) return "❌ 錯誤：找不到 API 金鑰，請檢查 Vercel 環境變數。";

  const safePrompt = maskSensitiveData(prompt);

  const safeContext = maskSensitiveData(context);

  const userText = safeContext
    ? `【背景資料】\n${safeContext}\n\n【問題】\n${safePrompt}`
    : safePrompt;

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userText }],
      },
    ],
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    ],
  };

  try {
    // 使用 v1 穩定版
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                // 這裡把系統指令和使用者的問題結合，這在任何版本都不會出錯
                text: `你現在是萌獸探險隊的營運參謀。以下是系統指令：${SYSTEM_INSTRUCTION}\n\n現在請回答使用者的問題：${userText}`,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data?.error?.message ?? "";
      return `😿 錯誤（${res.status}）：${msg || "模型路徑找不到"}`;
    }

    const data = await res.json();
    return (
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? "😿 AI 未回傳內容"
    );
  } catch (err) {
    return "🌐 網路異常，請確認連線。";
  }
}
