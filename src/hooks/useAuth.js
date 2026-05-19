import { useState, useEffect, useCallback } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { auth } from '../firebase'

export default function useAuth() {
  const [currentUser, setCurrentUser] = useState(undefined) // undefined = 載入中

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setCurrentUser(user ? { id: user.uid, username: user.email, role: 'admin' } : null)
    })
    return unsub
  }, [])

  // 登入（username 當 email 用）
  const login = useCallback(async (username, password) => {
    try {
      await signInWithEmailAndPassword(auth, username, password)
      return true
    } catch {
      return false
    }
  }, [])

  // 登出
  const logout = useCallback(() => signOut(auth), [])

  // 新增使用者
  const addUser = useCallback(async (username, password) => {
    try {
      await createUserWithEmailAndPassword(auth, username, password)
      return true
    } catch {
      return false
    }
  }, [])

  // 刪除使用者（Firebase Auth 前端無法刪除其他帳號，保留介面相容）
  const deleteUser = useCallback(() => false, [])

  // 修改當前使用者密碼
  const changePassword = useCallback(async (_, newPassword) => {
    if (auth.currentUser) await updatePassword(auth.currentUser, newPassword)
  }, [])

  return {
    currentUser,
    users: currentUser ? [currentUser] : [],
    login,
    logout,
    addUser,
    deleteUser,
    changePassword,
  }
}
