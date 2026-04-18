import { useState } from 'react'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import logoImg from '../assets/LOGO.png'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 400))
    const ok = onLogin(username.trim(), password)
    if (!ok) setError('帳號或密碼錯誤，請重新輸入。')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <img src={logoImg} alt="萌獸探險隊" className="h-14 object-contain" />
          <div className="text-center">
            <p className="text-lg font-bold text-gray-800">萌獸探險隊</p>
            <p className="text-xs text-gray-400">PetBiz ERP · 智慧戰情室</p>
          </div>
        </div>

        {/* 表單 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">帳號</label>
            <input
              type="text" autoComplete="username" required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
              style={{ '--tw-ring-color': '#722927' }}
              placeholder="請輸入帳號"
              value={username} onChange={e => setUsername(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">密碼</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'} autoComplete="current-password" required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
                placeholder="請輸入密碼"
                value={password} onChange={e => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
            style={{ backgroundColor: '#722927' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#5a1f1d'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#722927'}>
            {loading
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><LogIn size={16} /> 登入</>
            }
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">
          © 萌獸探險隊 PetBiz ERP
        </p>
      </div>
    </div>
  )
}
