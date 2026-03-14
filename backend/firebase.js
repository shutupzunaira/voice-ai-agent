// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAIr9mEkYUvmse6i5g2bTtQjc4dZmfqpe4",
  authDomain: "cliniq-ai-6bd01.firebaseapp.com",
  projectId: "cliniq-ai-6bd01",
  storageBucket: "cliniq-ai-6bd01.firebasestorage.app",
  messagingSenderId: "680329193112",
  appId: "1:680329193112:web:541d58bdcab128717f12ed",
  measurementId: "G-8ZRXHMHNY3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log("✅ Firebase app initialized successfully");

// Initialize Firestore
export const db = getFirestore(app);
console.log("✅ Firestore database connected successfully");