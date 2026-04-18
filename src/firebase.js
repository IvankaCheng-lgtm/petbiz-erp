import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

/**
 * 【安全提醒】
 * 這裡使用 import.meta.env 讀取變數。
 * 實際的數值請設定在 Vercel 的 Environment Variables 或本地的 .env.local 檔案中。
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// 初始化 Firebase 應用程式
const app = initializeApp(firebaseConfig);

// 匯出 Firestore 資料庫實例（這就是我們在其他檔案會用到的 db）
export const db = getFirestore(app);
