import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBOZRYtG7H9UBkgnyOijCVXVb98K1hYVY8",
    authDomain: "pick4u-v2.firebaseapp.com",
    projectId: "pick4u-v2",
    storageBucket: "pick4u-v2.firebasestorage.app",
    messagingSenderId: "73697898030",
    appId: "1:73697898030:web:b4e39c5db0ae84c031b9bf"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
