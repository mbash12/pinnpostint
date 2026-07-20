import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBHEqtXLm3ajo5zRGEOjTr6E-eosadleDU",
  authDomain: "adposting-cef8e.firebaseapp.com",
  projectId: "adposting-cef8e",
  storageBucket: "adposting-cef8e.firebasestorage.app",
  messagingSenderId: "60856065114",
  appId: "1:60856065114:android:126cc012aabbf0d3f04c63",
  measurementId: "G-3141SQGXL3"
};

export const app = initializeApp(firebaseConfig);
export const analytics = null; // Analytics not available in React Native
