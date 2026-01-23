// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";
import {
  getFirestore,
  serverTimestamp,
  collection,
  onSnapshot,
  query,
  where,
  limit,
  deleteDoc,
  getDocs,
  and,
  setDoc,
  doc,
  updateDoc,
  addDoc,
  getDoc,
  orderBy,
  writeBatch,
} from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAL5Rl0drBrxNb8nMyZCJyn1Ust2SYUIao",
  authDomain: "shawcalendar-ff10f.firebaseapp.com",
  projectId: "shawcalendar-ff10f",
  storageBucket: "shawcalendar-ff10f.firebasestorage.app",
  messagingSenderId: "775795543848",
  appId: "1:775795543848:web:3e288260ba761d75e18a1d",
  measurementId: "G-Y3LNTFH0Y4",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const firebaseAuthentication = getAuth();
const firebaseFireStore = getFirestore();

export {
  app,
  and,
  firebaseAuthentication,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  firebaseFireStore,
  collection,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  query,
  where,
  deleteDoc,
  getDocs,
  setDoc,
  doc,
  getDoc,
  sendPasswordResetEmail,
  sendEmailVerification,
  addDoc,
  orderBy,
  limit,
  writeBatch,
};
