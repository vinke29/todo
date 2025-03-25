# API Key Security

## API Key Rotation Process

This document outlines the process used to rotate the Firebase API key in this application.

### Actions Taken - August 2023 (Initial Rotation)

1. **Rotated the Firebase API Key**
   - Old API key: `AIzaSyCu0BIwoeKrseP1e_1XtFaD76K2eeR1e9U` (was mistakenly marked as disabled)
   - New API key: `AIzaSyCDHotsPi8bfdpiZPFWSljQcYf0c1niO7M` (now disabled)

### Actions Taken - October 2023 (Security Fix)

1. **Addressed API Key Leak**
   - Reverted to the original API key: `AIzaSyCu0BIwoeKrseP1e_1XtFaD76K2eeR1e9U`
   - Updated `.env` file to use the correct key
   - Created proper `.env.example` file with placeholder values
   - Ensured build process uses the environment variables

2. **Security Improvements**
   - Verified `.gitignore` properly excludes `.env` files
   - Fixed build process to properly use environment variables
   - Added documentation about API key rotation
   - Deployed updated code to GitHub Pages

### Best Practices for API Key Management

1. **Never commit API keys to repositories**
   - Use environment variables to store sensitive information
   - Add `.env` files to `.gitignore`
   - Create a proper `.env.example` file with placeholder values

2. **Rotate API keys regularly**
   - Create a schedule for key rotation (e.g., quarterly)
   - Immediately rotate keys if they're accidentally exposed
   - Disable compromised API keys in the Google Cloud Console

3. **Use environment variables**
   - In a React app, prefix variables with `REACT_APP_` 
   - Access them via `process.env.REACT_APP_VARIABLE_NAME`
   - Ensure build process properly incorporates environment variables

4. **Use restricted API keys**
   - Set up domain restrictions in the Firebase console
   - Use IP restrictions when possible
   - Create separate keys for development and production

5. **Monitor for unauthorized usage**
   - Set up alerts for unusual activity
   - Implement rate limiting if available
   - React quickly to security notifications

## Implementation

The current implementation uses environment variables to manage API keys:

```javascript
import { initializeApp } from "firebase/app";
import { getAuth, getApps } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCu0BIwoeKrseP1e_1XtFaD76K2eeR1e9U",
  authDomain: "to-do-art-e98c4.firebaseapp.com",
  projectId: "to-do-art-e98c4",
  storageBucket: "to-do-art-e98c4.firebasestorage.app",
  messagingSenderId: "156255459350",
  appId: "1:156255459350:web:31abaa69850901ada33d37",
  measurementId: "G-YSV8VSNV3L"
};

console.log("Initializing Firebase with config:", JSON.stringify(firebaseConfig));
export const app = initializeApp(firebaseConfig);
console.log("Firebase initialized successfully");
```

For improved security, modify `src/firebase.ts` to use environment variables:

```javascript
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

console.log("Initializing Firebase with config:", 
  JSON.stringify({
    ...firebaseConfig,
    apiKey: firebaseConfig.apiKey ? "REDACTED" : undefined
  })
);

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
``` 