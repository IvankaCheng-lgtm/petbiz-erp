import { useState, useRef, useCallback } from 'react'
import { Download, Trash2, Upload, Save, RefreshCw } from 'lucide-react'
import { SectionCard, FormRow, inputCls, btnPrimary, btnSecondary } from '../components/ui'

export default function Settings({ data }) {
  const { inventory, updateInventoryItem, clearAllData, exportData, importData, resetInventoryToSeed, auth } = data
  const { currentUser } = auth
  const fileRef = useRef()
  const [importMsg, setImportMsg] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  // 電費參數（存 localStorage）
  const [elecParams, setElecParams] = useState(() => {
    try {
      const saved = localStorage.getItem('petbiz_elec')
      return saved ? JSON.parse(saved) : { summerRate: 6.24, normalRate: 5.07, defaultWatt: 1100 }
    } catch {
      return { summerRate: 6.24, normalRate: 5.07, defaultWatt: 1100 }
    }
  })

  function saveElec() {
    localStorage.setItem('petbiz_elec', JSON.stringify(elecParams))
    alert('電費參數已儲存')
  }

  function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      let parsed
      try {
        parsed = JSON.parse(ev.target.result)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error()
      } catch {
        setImportMsg('❌ 檔案格式錯誤，請確認為正確的備份 JSON。')
        setTimeout(() => setImportMsg(''), 4000)
        return
      }
      const ok = importData(JSON.stringify(parsed))
      setImportMsg(ok ? '✅ 匯入成功！' : '❌ 檔案格式錯誤，請確認為正確的備份 JSON。')
      setTimeout(() => setImportMsg(''), 4000)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleClear() {
    if (!confirmClear) { setConfirmClear(true); return }
    clearAllData()
    setConfirmClear(false)
  }

  const cItems = inventory.filter(i => i.category === 'C食材')
  void cItems // 保留相容，安全水位已改用內部過濾

  const handleTogglePwd = useCallback(() => {}, [])

  const handleFileClick = useCallback(() => fileRef.current.click(), [])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">系統設置</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 電費參數 */}
        <SectionCard title="⚡ 電費參數設定">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="夏季電價（6~9月）元/度">
                <input type="number" step="0.01" className={inputCls} value={elecParams.summerRate}
                  onChange={e => setElecParams(p => ({ ...p, summerRate: parseFloat(e.target.value) }))} />
              </FormRow>
              <FormRow label="非夏季電價 元/度">
                <input type="number" step="0.01" className={inputCls} value={elecParams.normalRate}
                  onChange={e => setElecParams(p => ({ ...p, normalRate: parseFloat(e.target.value) }))} />
              </FormRow>
            </div>
            <FormRow label="預設機器瓦數（W）">
              <input type="number" min="1" className={inputCls} value={elecParams.defaultWatt}
                onChange={e => setElecParams(p => ({ ...p, defaultWatt: parseFloat(e.target.value) }))} />
            </FormRow>
            <button onClick={saveElec} className={btnPrimary + ' flex items-center gap-2'}>
              <Save size={16} /> 儲存電費參數
            </button>
          </div>
        </SectionCard>

        {/* C食材 + D包材安全水位 */}
        <SectionCard title="📦 C食材 / D包材安全水位設定">
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {['C食材', 'D包材'].map(cat => {
              const items = inventory.filter(i => i.category === cat)
              if (items.length === 0) return null
              return (
                <div key={cat}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 mt-2">{cat}</p>
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5 mb-1.5">
                      <span className="text-sm font-medium text-gray-700 flex-1">{item.itemName}</span>
                      <span className="text-xs text-gray-400">{item.unit}</span>
                      <input type="number" min="0"
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-300"
                        value={item.safetyQty}
                        onChange={e => updateInventoryItem(item.id, { safetyQty: parseFloat(e.target.value) || 0 })} />
                    </div>
                  ))}
                </div>
              )
            })}
            {inventory.filter(i => i.category === 'C食材' || i.category === 'D包材').length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">尚無品項</p>
            )}
          </div>
        </SectionCard>
      </div>

      {/* 數據備份 */}
      <SectionCard title="💾 數據備份與還原">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button onClick={resetInventoryToSeed}
            className="flex items-center justify-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium px-4 py-3 rounded-xl transition-colors">
            <RefreshCw size={18} /> 重置庫存為預設值
          </button>

          <button onClick={exportData}
            className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium px-4 py-3 rounded-xl transition-colors">
            <Download size={18} /> 下載備份 JSON
          </button>

          <button onClick={handleFileClick}
            className="flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium px-4 py-3 rounded-xl transition-colors">
            <Upload size={18} /> 匯入備份 JSON
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

          <button onClick={handleClear}
            className={`flex items-center justify-center gap-2 font-medium px-4 py-3 rounded-xl transition-colors
              ${confirmClear
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-red-50 hover:bg-red-100 text-red-600'}`}>
            <Trash2 size={18} />
            {confirmClear ? '⚠️ 再按一次確認清空' : '清空所有數據'}
          </button>
        </div>

        {importMsg && (
          <div className={`mt-3 px-4 py-3 rounded-xl text-sm font-medium
            ${importMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {importMsg}
          </div>
        )}

        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
          ⚠️ 清空操作不可復原，請先下載備份後再執行。
        </div>
      </SectionCard>

      {/* 使用者管理 */}
      <SectionCard title="👤 使用者管理">
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-4 space-y-3">
          <p className="text-sm text-blue-800">
            目前使用 <span className="font-semibold">Firebase Authentication</span> 管理帳號。
          </p>
          <p className="text-xs text-blue-600">目前登入：{currentUser?.username}</p>
          <a
            href="https://console.firebase.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            前往 Firebase Console 管理帳號 →
          </a>
        </div>
      </SectionCard>

      {/* 系統資訊 */}
      <SectionCard title="ℹ️ 系統資訊">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: '版本', value: 'v1.0.0' },
            { label: '數據儲存', value: 'LocalStorage' },
            { label: '框架', value: 'React 18 + Vite' },
            { label: '樣式', value: 'Tailwind CSS v4' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl py-3">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
