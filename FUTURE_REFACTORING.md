# Future Refactoring Tasks

## Refactor Firebase Configuration

To improve security and maintainability, the Firebase configuration should be refactored to properly use environment variables. Here's the plan:

### 1. Update the Environment Variables Setup

Ensure environment variables are properly set up:

- `.env` file exists with real configuration values (already in place)
- `.env.example` file exists with placeholder values (already created)
- `.gitignore` includes `.env` files (already configured)

### 2. Refactor `src/firebase.ts`

Update the Firebase configuration to use environment variables instead of hardcoded values:

```javascript
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User, connectAuthEmulator, Auth, fetchSignInMethodsForEmail } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';

// Get Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Log configuration with redacted API key for security
console.log("Initializing Firebase with config:", 
  JSON.stringify({
    ...firebaseConfig,
    apiKey: firebaseConfig.apiKey ? "REDACTED" : undefined
  })
);

// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log("Firebase initialized successfully");

// Rest of the file remains the same...
```

### 3. Add Environment Validation

Add a validation function to ensure all required environment variables are present:

```javascript
// At the start of the file
function validateEnvVars() {
  const requiredVars = [
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_FIREBASE_STORAGE_BUCKET',
    'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
    'REACT_APP_FIREBASE_APP_ID'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    console.error('Please ensure these variables are defined in your .env file.');
    
    // In development, provide more helpful error
    if (process.env.NODE_ENV === 'development') {
      console.error('Tip: Create a .env file based on the .env.example template.');
    }
    
    return false;
  }
  
  return true;
}

// Call this before initializing Firebase
if (!validateEnvVars()) {
  // Optionally halt initialization or use fallback/dummy values
  console.warn('Using fallback configuration for Firebase due to missing environment variables.');
}
```

### 4. Test Thoroughly

After making these changes:

1. Test in development environment to ensure it reads the variables correctly
2. Verify that the build process correctly includes the environment variables
3. Deploy to GitHub Pages and confirm everything works correctly
4. Verify that API keys are not exposed in the deployed JavaScript files

### 5. Implement API Key Rotation Schedule

Create a schedule for regular API key rotation:

1. Create a new API key in Google Cloud Console
2. Update the `.env` file with the new key
3. Verify the application works with the new key
4. Disable the old API key
5. Document the rotation in `API_KEY_SECURITY.md`

Aim to rotate keys quarterly or after any suspected security incident. 