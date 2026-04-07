import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

// ─── REEMPLAZAR CON LA CONFIG DE TU PROYECTO FIREBASE ───────────────────────
// Firebase console → Project settings → Your apps → SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyDat9SwS9_EuhbsRY-nvIEXlOly2t3Y4Xk",
  authDomain: "brauers-logistics.firebaseapp.com",
  projectId: "brauers-logistics",
  storageBucket: "brauers-logistics.firebasestorage.app",
  messagingSenderId: "302637155589",
  appId: "1:302637155589:web:8a224583f56c4e0a5fa36c"
};
// ────────────────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Persistencia offline habilitada: la app funciona sin internet y sincroniza al volver
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
