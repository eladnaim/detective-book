import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "quentin-book-db-26",
  appId: "1:185539160801:web:3d789bf5c7e947c81ae5a0",
  storageBucket: "quentin-book-db-26.firebasestorage.app",
  apiKey: "AIzaSyArsHIYwK1n2OpVrSbLgucVH9UO3HcDqUM",
  authDomain: "quentin-book-db-26.firebaseapp.com",
  messagingSenderId: "185539160801"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
