import { useState, useRef, useCallback } from 'react'
import { Download, Trash2, Upload, Save, RefreshCw, UserPlus, Key } from 'lucide-react'
import { SectionCard, FormRow, inputCls, btnPrimary, btnSecondary, btnDanger } from '../components/ui'

function UserRow({ u, editPwdId, editPwdVal, setEditPwdVal, onTogglePwd, onChangePwd, onDelete }) {
  const handleToggle = useCallback(() => onTogglePwd(u.id), [u.id, onTogglePwd])
  const handleDelete = useCallback(() => onDelete(u.id),    [u.id, onDelete])
  const handleSave   = useCallback(() => onChangePwd(u.id), [u.id, onChangePwd])
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: '#722927' }}>
            {u.username[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{u.username}</p>
            <p className="text-xs text-gray-400">{u.role === 'admin' ? 'ÁÆ°Á??? : '‰∏Ä?¨‰Ωø?®ËÄ?} ¬∑ Âª∫Á? {u.createdAt}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={handleToggle}
            className="bg-blue-50 hover:bg-blue-100 text-blue-600 p-1.5 rounded-lg transition-colors">
            <Key size={14} />
          </button>
          {u.role !== 'admin' && (
            <button onClick={handleDelete} className={btnDanger}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {editPwdId === u.id && (
        <div className="flex gap-2 pt-1">
          <input type="password" className={inputCls + ' text-sm'} placeholder="Ëº∏ÂÖ•?∞Â?Á¢?
            value={editPwdVal} onChange={e => setEditPwdVal(e.target.value)} />
          <button onClick={handleSave} className={btnPrimary + ' shrink-0 text-sm'}>?≤Â?</button>
        </div>
      )}
    </div>
  )
}

export default function Settings({ data }) {
  const { inventory, updateInventoryItem, clearAllData, exportData, importData, resetInventoryToSeed, auth } = data
  const { users, addUser, deleteUser, changePassword, currentUser } = auth
  const fileRef = useRef()
  const [importMsg, setImportMsg] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  // ‰ΩøÁî®?ÖÁÆ°??  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [userMsg,     setUserMsg]     = useState('')
  const [editPwdId,   setEditPwdId]   = useState(null)
  const [editPwdVal,  setEditPwdVal]  = useState('')

  function handleAddUser(e) {
    e.preventDefault()
    if (!newUsername.trim() || !newPassword.trim()) return
    const ok = addUser(newUsername.trim(), newPassword.trim())
    setUserMsg(ok ? '??‰ΩøÁî®?ÖÊñ∞Â¢ûÊ??? : '??Â∏≥Ë?Â∑≤Â???)
    if (ok) { setNewUsername(''); setNewPassword('') }
    setTimeout(() => setUserMsg(''), 3000)
  }

  function handleChangePwd(id) {
    if (!editPwdVal.trim()) return
    changePassword(id, editPwdVal.trim())
    setEditPwdId(null); setEditPwdVal('')
    setUserMsg('??ÂØÜÁ¢ºÂ∑≤Êõ¥??)
    setTimeout(() => setUserMsg(''), 3000)
  }

  // ?ªË≤ª?ÉÊï∏ÔºàÂ? localStorageÔº?  const [elecParams, setElecParams] = useState(() => {
    try {
      const saved = localStorage.getItem('petbiz_elec')
      return saved ? JSON.parse(saved) : { summerRate: 6.24, normalRate: 5.07, defaultWatt: 1100 }
    } catch {
      return { summerRate: 6.24, normalRate: 5.07, defaultWatt: 1100 }
    }
  })

  function saveElec() {
    localStorage.setItem('petbiz_elec', JSON.stringify(elecParams))
    alert('?ªË≤ª?ÉÊï∏Â∑≤ÂÑ≤Â≠?)
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
        setImportMsg('°˘ ¿…Æ◊≥Wø˘Ω◊°AΩ–Ω’»œ¶≥•ª•ø™∫≥∆•´ JSON°B')
        setTimeout(() => setImportMsg(''), 4000)
        return
      }
      const ok = importData(JSON.stringify(parsed))
      setImportMsg(ok ? '???ØÂÖ•?êÂ?Ôº? : '??Ê™îÊ??ºÂ??ØË™§ÔºåË?Á¢∫Ë??∫Ê≠£Á¢∫Á??ô‰ªΩ JSON??)
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

  const cItems = inventory.filter(i => i.category === 'CÈ£üÊ?')
  void cItems // ‰øùÁ??∏ÂÆπÔºåÂ??®Ê∞¥‰ΩçÂ∑≤?πÁî®?ßÈÉ®?éÊøæ

  const handleTogglePwd = useCallback((id) => {
    setEditPwdId(prev => prev === id ? null : id)
    setEditPwdVal('')
  }, [setEditPwdId, setEditPwdVal])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Á≥ªÁµ±Ë®≠ÁΩÆ</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ?ªË≤ª?ÉÊï∏ */}
        <SectionCard title="???ªË≤ª?ÉÊï∏Ë®≠Â?">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Â§èÂ≠£?ªÂÉπÔº?~9?àÔ???Â∫?>
                <input type="number" step="0.01" className={inputCls} value={elecParams.summerRate}
                  onChange={e => setElecParams(p => ({ ...p, summerRate: parseFloat(e.target.value) }))} />
              </FormRow>
              <FormRow label="?ûÂ?Â≠?õª????Â∫?>
                <input type="number" step="0.01" className={inputCls} value={elecParams.normalRate}
                  onChange={e => setElecParams(p => ({ ...p, normalRate: parseFloat(e.target.value) }))} />
              </FormRow>
            </div>
            <FormRow label="?êË®≠Ê©üÂô®?¶Êï∏ÔºàWÔº?>
              <input type="number" min="1" className={inputCls} value={elecParams.defaultWatt}
                onChange={e => setElecParams(p => ({ ...p, defaultWatt: parseFloat(e.target.value) }))} />
            </FormRow>
            <button onClick={saveElec} className={btnPrimary + ' flex items-center gap-2'}>
              <Save size={16} /> ?≤Â??ªË≤ª?ÉÊï∏
            </button>
          </div>
        </SectionCard>

        {/* CÈ£üÊ? + D?ÖÊ?ÂÆâÂÖ®Ê∞¥‰? */}
        <SectionCard title="?ì¶ CÈ£üÊ? / D?ÖÊ?ÂÆâÂÖ®Ê∞¥‰?Ë®≠Â?">
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {['CÈ£üÊ?', 'D?ÖÊ?'].map(cat => {
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
            {inventory.filter(i => i.category === 'CÈ£üÊ?' || i.category === 'D?ÖÊ?').length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Â∞öÁÑ°?ÅÈ?</p>
            )}
          </div>
        </SectionCard>
      </div>

      {/* ?∏Ê??ô‰ªΩ */}
      <SectionCard title="?íæ ?∏Ê??ô‰ªΩ?áÈ???>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button onClick={resetInventoryToSeed}
            className="flex items-center justify-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium px-4 py-3 rounded-xl transition-colors">
            <RefreshCw size={18} /> ?çÁΩÆÂ∫´Â??∫È?Ë®≠ÂÄ?          </button>

          <button onClick={exportData}
            className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium px-4 py-3 rounded-xl transition-colors">
            <Download size={18} /> ‰∏ãË??ô‰ªΩ JSON
          </button>

          <button onClick={() => fileRef.current.click()}
            className="flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium px-4 py-3 rounded-xl transition-colors">
            <Upload size={18} /> ?ØÂÖ•?ô‰ªΩ JSON
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

          <button onClick={handleClear}
            className={`flex items-center justify-center gap-2 font-medium px-4 py-3 rounded-xl transition-colors
              ${confirmClear
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-red-50 hover:bg-red-100 text-red-600'}`}>
            <Trash2 size={18} />
            {confirmClear ? '?†Ô? ?çÊ?‰∏ÄÊ¨°Á¢∫Ë™çÊ?Á©? : 'Ê∏ÖÁ©∫?Ä?âÊï∏??}
          </button>
        </div>

        {importMsg && (
          <div className={`mt-3 px-4 py-3 rounded-xl text-sm font-medium
            ${importMsg.startsWith('??) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {importMsg}
          </div>
        )}

        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
          ?†Ô? Ê∏ÖÁ©∫?ç‰?‰∏çÂèØÂæ©Â?ÔºåË??à‰?ËºâÂ?‰ªΩÂ??çÂü∑Ë°å„Ä?        </div>
      </SectionCard>

      {/* ‰ΩøÁî®?ÖÁÆ°??*/}
      <SectionCard title="?ë§ ‰ΩøÁî®?ÖÁÆ°??>
        {/* ?∞Â?Ë°®ÂñÆ */}
        <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row gap-2 mb-4">
          <input type="text" className={inputCls} placeholder="?∞Â∏≥?? value={newUsername}
            onChange={e => setNewUsername(e.target.value)} required />
          <input type="password" className={inputCls} placeholder="?∞Â?Á¢? value={newPassword}
            onChange={e => setNewPassword(e.target.value)} required />
          <button type="submit" className={btnPrimary + ' flex items-center gap-1 shrink-0'}>
            <UserPlus size={15} /> ?∞Â?‰ΩøÁî®??          </button>
        </form>

        {userMsg && (
          <div className={`mb-3 px-4 py-2 rounded-xl text-sm font-medium
            ${userMsg.startsWith('??) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {userMsg}
          </div>
        )}

        {/* ‰ΩøÁî®?ÖÂ?Ë°?*/}
        <div className="space-y-2">
          {users.map(u => (
            <UserRow
              key={u.id}
              u={u}
              editPwdId={editPwdId}
              editPwdVal={editPwdVal}
              setEditPwdVal={setEditPwdVal}
              onTogglePwd={handleTogglePwd}
              onChangePwd={handleChangePwd}
              onDelete={deleteUser}
            />
          ))}
        </div>
      </SectionCard>

      {/* Á≥ªÁµ±Ë≥áË? */}
      <SectionCard title="?πÔ? Á≥ªÁµ±Ë≥áË?">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: '?àÊú¨', value: 'v1.0.0' },
            { label: '?∏Ê??≤Â?', value: 'LocalStorage' },
            { label: 'Ê°ÜÊû∂', value: 'React 18 + Vite' },
            { label: 'Ê®??', value: 'Tailwind CSS v4' },
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
