import { useState, useCallback } from 'react'

const LS_KEY = 'petbiz_users'

const DEFAULT_USERS = [
  {
    id: '1',
    username: import.meta.env.VITE_DEFAULT_USERNAME ?? 'admin',
    password: import.meta.env.VITE_DEFAULT_PASSWORD ?? '',
    role: 'admin',
    createdAt: '2025-01-01',
  },
]

function loadUsers() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_USERS
  } catch {
    return DEFAULT_USERS
  }
}

function saveUsers(users) {
  localStorage.setItem(LS_KEY, JSON.stringify(users))
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5)

// 防止 Timing Attack 的字串比較
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const len = Math.max(a.length, b.length)
  let diff = a.length !== b.length ? 1 : 0
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0)
  }
  return diff === 0
}

export default function useAuth() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = sessionStorage.getItem('petbiz_session')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })

  const [users, setUsers] = useState(loadUsers)

  // 登入
  const login = useCallback((username, password) => {
    const users = loadUsers()
    const user  = users.find(u => timingSafeEqual(u.username, username) && timingSafeEqual(u.password, password))
    if (!user) return false
    const session = { id: user.id, username: user.username, role: user.role }
    sessionStorage.setItem('petbiz_session', JSON.stringify(session))
    setCurrentUser(session)
    return true
  }, [])

  // 登出
  const logout = useCallback(() => {
    sessionStorage.removeItem('petbiz_session')
    setCurrentUser(null)
  }, [])

  // 新增使用者
  const addUser = useCallback((username, password) => {
    const current = loadUsers()
    if (current.find(u => u.username === username)) return false
    const updated = [...current, {
      id: uid(), username, password,
      role: 'user', createdAt: new Date().toISOString().slice(0, 10),
    }]
    saveUsers(updated)
    setUsers(updated)
    return true
  }, [])

  // 刪除使用者（不可刪除 admin）
  const deleteUser = useCallback((id) => {
    const current = loadUsers()
    const target  = current.find(u => u.id === id)
    if (!target || target.role === 'admin') return false
    const updated = current.filter(u => u.id !== id)
    saveUsers(updated)
    setUsers(updated)
    return true
  }, [])

  // 修改密碼
  const changePassword = useCallback((id, newPassword) => {
    const current = loadUsers()
    const updated = current.map(u => u.id === id ? { ...u, password: newPassword } : u)
    saveUsers(updated)
    setUsers(updated)
  }, [])

  return { currentUser, users, login, logout, addUser, deleteUser, changePassword }
}
