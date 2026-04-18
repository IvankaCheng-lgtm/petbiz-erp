import { useState } from 'react'
import { askGemini } from '../services/geminiService'
import { MessageCircle, Send, Loader2 } from 'lucide-react'

export default function AIAccountingAssistant() {
  const [question, setQuestion] = useState('')
  const [answer,   setAnswer]   = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleAsk() {
    if (!question.trim() || loading) return
    setLoading(true)
    setAnswer('')
    const context = `你是萌獸探險隊的會計顧問。請針對台灣稅務法規（營業稅、憑證扣抵）提供淺顯易懂的建議。`
    const res = await askGemini(question, context)
    setAnswer(res)
    setLoading(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !loading && question.trim()) handleAsk()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden mt-8">
      <div className="p-4 border-b border-orange-50 bg-orange-50/30 flex items-center gap-2">
        <MessageCircle size={18} className="text-orange-500" />
        <h3 className="font-bold text-gray-800">萌獸法規小助手</h3>
      </div>
      <div className="p-4 space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-orange-500 py-1">
            <Loader2 size={16} className="animate-spin shrink-0" />
            AI 正在查詢法規資料...
          </div>
        )}
        {answer && !loading && (
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed border border-gray-100">
            <p className="whitespace-pre-wrap">{answer}</p>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-orange-200 outline-none disabled:opacity-60"
            placeholder="詢問稅務問題（如：進項抵扣規則）..."
            value={question}
            disabled={loading}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={handleAsk}
            disabled={loading || !question.trim()}
            className="bg-orange-500 text-white p-2 rounded-xl hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}
