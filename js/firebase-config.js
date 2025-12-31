// --- FIREBASE CONFIGURATION ---
// This file is the single source of truth for your Firebase connection.

const firebaseConfig = {
    apiKey: "AIzaSyBx4i-LJcCuYNWfYU_TfXA6_LXcY263RbA",
    authDomain: "jay-shree-shyam0back.firebaseapp.com",
    projectId: "jay-shree-shyam0back",
    storageBucket: "jay-shree-shyam0back.firebasestorage.app",
    messagingSenderId: "1084861244978",
    appId: "1:1084861244978:web:192eb36bf370ffa60a3e2b",
    measurementId: "G-WZVE9YYDGB"
};

// Prevent multiple initializations
function initFirebaseApp() {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log("🔥 Firebase Initialized Successfully");
    } else {
        firebase.app(); // if already initialized, use that one
    }
    return firebase;
}
