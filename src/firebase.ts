import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, Auth, fetchSignInMethodsForEmail, User } from 'firebase/auth';
import { getFirestore, Firestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED, connectFirestoreEmulator } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCu0BIwoeKrseP1e_1XtFaD76K2eeR1e9U",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "to-do-art-e98c4.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "to-do-art-e98c4",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "to-do-art-e98c4.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "156255459350",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:156255459350:web:50911575d9ffa69aa33d37",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-069YCC3RG6"
};

// Add this variable to track connection status
let firestoreInitialized = false;

// Initialize Firebase with error handling
console.log("Initializing Firebase...");
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Error initializing Firebase:", error);
  throw new Error("Firebase initialization failed. Check network and configuration.");
}

// Initialize Auth
console.log("Initializing Firebase Auth...");
let auth: Auth;
try {
  auth = getAuth(app);
  console.log("Firebase Auth initialized successfully");
} catch (error) {
  console.error("Error initializing Firebase Auth:", error);
  throw new Error("Firebase Auth initialization failed");
}

// Initialize Firestore with optimal settings
console.log("Initializing Firestore...");
let db: Firestore;
try {
  db = getFirestore(app);
  
  // ADD CONNECTION CHECK
  window.addEventListener('online', () => {
    console.log("Network is online. Reconnecting to Firestore...");
    // You might want to add additional reconnection logic here
  });

  window.addEventListener('offline', () => {
    console.log("Network is offline. Firestore will use cached data if available.");
  });
  
  // Enable offline persistence with unlimited cache size
  // This helps with connectivity issues
  enableIndexedDbPersistence(db, {
    forceOwnership: true
  }).then(() => {
    console.log("Firestore offline persistence enabled");
    firestoreInitialized = true;
  }).catch((error) => {
    if (error.code === 'failed-precondition') {
      console.warn("Firestore persistence not enabled: multiple tabs open");
      // Still mark as initialized even if persistence fails
      firestoreInitialized = true;
    } else if (error.code === 'unimplemented') {
      console.warn("Firestore persistence not enabled: browser not supported");
      firestoreInitialized = true;
    } else {
      console.error("Firestore persistence error:", error);
      firestoreInitialized = false;
    }
  });
  
  console.log("Firestore initialized successfully");
} catch (error) {
  console.error("Error initializing Firestore:", error);
  firestoreInitialized = false;
  throw new Error("Firestore initialization failed");
}

// Export Firestore init status
export const isFirestoreInitialized = () => firestoreInitialized;

// Authentication test function
export const checkAuthConfiguration = async () => {
  try {
    const testEmail = "test-nonexistent@example.com";
    const methods = await fetchSignInMethodsForEmail(auth, testEmail);
    console.log("Auth configuration check successful");
    return true;
  } catch (error: any) {
    console.error("Auth configuration check failed:", error.code, error.message);
    
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

// Run auth configuration check
checkAuthConfiguration().then(isConfigured => {
  if (isConfigured) {
    console.log("Firebase Auth configuration verified successfully");
  } else {
    console.warn("Firebase Auth configuration could not be verified");
  }
});

// Auth state change listener for debugging
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log("User signed in with UID:", user.uid);
  } else {
    console.log("No user is signed in");
  }
}, (error) => {
  console.error("Auth state change error:", error);
});

// Export the initialized Firebase modules and methods
export {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  fetchSignInMethodsForEmail
}; 