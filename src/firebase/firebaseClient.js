// src/firebase/firebaseClient.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ✅ Put your config here (the one you already have)
const firebaseConfig = {
  apiKey: "AIzaSyAL5Rl0drBrxNb8nMyZCJyn1Ust2SYUIao",
  authDomain: "shawcalendar-ff10f.firebaseapp.com",
  projectId: "shawcalendar-ff10f",
  storageBucket: "shawcalendar-ff10f.firebasestorage.app",
  messagingSenderId: "775795543848",
  appId: "1:775795543848:web:3e288260ba761d75e18a1d",
  measurementId: "G-Y3LNTFH0Y4",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
