/* eslint-disable @typescript-eslint/no-unused-vars */
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC8uqVzbJapFVYcM5uJHr8q9rv8UtL57K8",
  authDomain: "tnb-pos.firebaseapp.com",
  databaseURL: "https://tnb-pos-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tnb-pos",
  storageBucket: "tnb-pos.appspot.com",
  messagingSenderId: "874773236809",
  appId: "1:874773236809:web:4d64964b3ac1e54fef0398",
  measurementId: "G-S9DG1VMLKP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const rdb = getDatabase(app);

// Only initialize analytics in the browser
if (typeof window !== "undefined") {
  import("firebase/analytics").then(({ getAnalytics, isSupported }) => {
    isSupported().then((supported) => {
      if (supported) {
        getAnalytics(app);
      }
    });
  });
}

export { db, auth, storage, rdb };