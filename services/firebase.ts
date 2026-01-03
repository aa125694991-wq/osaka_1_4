import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAwbjrrng_lBZG5cW3kbQAxJg3r_6QVgFY",
  authDomain: "tryosaka-21ceb.firebaseapp.com",
  databaseURL: "https://tryosaka-21ceb-default-rtdb.firebaseio.com",
  projectId: "tryosaka-21ceb",
  storageBucket: "tryosaka-21ceb.firebasestorage.app",
  messagingSenderId: "403784289230",
  appId: "1:403784289230:web:15c98b579ccf33c46fb99f",
  measurementId: "G-X6PQJNNSSK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
const db = getFirestore(app); // For data syncing
const auth = getAuth(app);    // For user authentication
const storage = getStorage(app); // For photo uploads
const analytics = getAnalytics(app); 

export { app, db, auth, storage, analytics, onAuthStateChanged, signInAnonymously };