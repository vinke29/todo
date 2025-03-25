import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User, connectAuthEmulator, Auth, fetchSignInMethodsForEmail } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';

// Update Firebase configuration with the correct values
const firebaseConfig = {
  apiKey: "AIzaSyCu0BIwoeKrseP1e_1XtFaD76K2eeR1e9U",
  authDomain: "to-do-art-e98c4.firebaseapp.com",
  projectId: "to-do-art-e98c4",
  storageBucket: "to-do-art-e98c4.firebasestorage.app",
  messagingSenderId: "156255459350",
  appId: "1:156255459350:web:31abaa69850901ada33d37",
  measurementId: "G-YSV8VSNV3L"
};

// Initialize Firebase
console.log("Initializing Firebase with config:", JSON.stringify(firebaseConfig));
const app = initializeApp(firebaseConfig);
console.log("Firebase initialized successfully");

// Initialize Auth with explicit type and direct approach for stability
console.log("Initializing Firebase Auth...");
const auth: Auth = getAuth(app); // Pass the app instance explicitly
console.log("Firebase Auth initialized successfully");

// Attempt to verify authentication configuration
export const checkAuthConfiguration = async () => {
  try {
    // This is a test email that we don't expect to exist
    // but should tell us if the auth configuration works
    const testEmail = "test-nonexistent@example.com";
    const methods = await fetchSignInMethodsForEmail(auth, testEmail);
    console.log("Auth configuration check - sign in methods:", methods);
    return true;
  } catch (error: any) {
    console.error("Auth configuration check failed:", error.code, error.message);
    
    // If we get "auth/configuration-not-found", then our auth setup is broken
    if (error.code === 'auth/configuration-not-found') {
      console.error("=========================================");
      console.error("AUTHENTICATION CONFIGURATION ERROR DETECTED");
      console.error("Please check the following:");
      console.error("1. Email/Password authentication is enabled in Firebase console");
      console.error("2. Your Firebase project is properly set up");
      console.error("3. Your API key is correct and has proper permissions");
      console.error("4. You have visited the Authentication section in Firebase Console and clicked 'Get Started'");
      console.error("=========================================");
    }
    
    return false;
  }
};

// Run auth configuration check immediately 
checkAuthConfiguration().then(isConfigured => {
  if (isConfigured) {
    console.log("Firebase Auth configuration verified successfully");
  } else {
    console.warn("Firebase Auth configuration could not be verified");
  }
});

// Initialize Firestore with explicit type
console.log("Initializing Firestore...");
const db: Firestore = getFirestore(app);
console.log("Firestore initialized successfully");

// Add specific error handlers
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log("User signed in successfully:", user.uid);
  } else {
    console.log("No user is signed in");
  }
}, (error) => {
  console.error("Auth state change error:", error);
});

// Export the auth functions and diagnostic helpers
export {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  fetchSignInMethodsForEmail
}; 