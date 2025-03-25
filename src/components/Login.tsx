import React, { useState, useEffect } from 'react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../firebase';
import '../LoginStyles.css';

// Debug helper to check Firebase configuration
const checkFirebaseAuth = () => {
  try {
    console.log("Checking Firebase auth configuration:");
    console.log("Auth domain:", auth.app.options.authDomain);
    console.log("API key:", auth.app.options.apiKey);
    console.log("Project ID:", auth.app.options.projectId);
    return true;
  } catch (err) {
    console.error("Error checking Firebase auth:", err);
    return false;
  }
};

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [diagnosticInfo, setDiagnosticInfo] = useState<string | null>(null);

  useEffect(() => {
    // Run diagnostics on component mount
    const authConfigOk = checkFirebaseAuth();
    if (!authConfigOk) {
      setDiagnosticInfo("Firebase authentication configuration issue detected. Please check console for details.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Log authentication attempt for debugging
      console.log(`Attempting to ${isRegistering ? 'register' : 'sign in'} with email: ${email}`);
      console.log("Auth instance:", auth);
      
      // Hardcoded test credentials for fallback - REMOVE IN PRODUCTION
      const testEmail = "test@example.com";
      const testPass = "testpassword";
      
      if (isRegistering) {
        // Register new user
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          console.log("Registration successful");
        } catch (regErr: any) {
          console.error("Registration error details:", regErr.code, regErr.message);
          throw regErr;
        }
      } else {
        // Sign in existing user
        try {
          // Try with fallback hardcoded account if using test credentials
          if (email === testEmail && password === testPass) {
            console.log("Using test credentials - bypassing actual Firebase auth");
            // Simulate successful login
            onLogin();
            setLoading(false);
            return;
          }
          
          await signInWithEmailAndPassword(auth, email, password);
          console.log("Sign in successful");
        } catch (signInErr: any) {
          console.error("Sign in error details:", signInErr.code, signInErr.message);
          
          // Special handling for configuration errors
          if (signInErr.code === 'auth/configuration-not-found') {
            setDiagnosticInfo(
              "Authentication configuration issue detected. Please make sure Email/Password " +
              "authentication is enabled in your Firebase console and your project is properly configured."
            );
          }
          
          throw signInErr;
        }
      }
      onLogin();
    } catch (err: any) {
      console.error("Auth error:", err);
      
      // Provide user-friendly error messages
      let errorMessage = "An error occurred during authentication";
      
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errorMessage = "Invalid email or password";
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = "This email is already in use";
      } else if (err.code === 'auth/weak-password') {
        errorMessage = "Password should be at least 6 characters";
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = "Please enter a valid email address";
      } else if (err.code === 'auth/configuration-not-found') {
        errorMessage = "Authentication service is not properly configured";
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{isRegistering ? 'Create Account' : 'Login'}</h2>
        
        {error && <div className="error-message">{error}</div>}
        {diagnosticInfo && <div className="diagnostic-info">{diagnosticInfo}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading 
              ? 'Processing...' 
              : isRegistering 
                ? 'Create Account' 
                : 'Login'
            }
          </button>
        </form>

        <div className="auth-toggle">
          {isRegistering ? (
            <p>
              Already have an account?{' '}
              <button 
                className="toggle-button" 
                onClick={() => setIsRegistering(false)}
              >
                Login
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{' '}
              <button 
                className="toggle-button" 
                onClick={() => setIsRegistering(true)}
              >
                Register
              </button>
            </p>
          )}
        </div>
        
        {/* Test account info - REMOVE IN PRODUCTION */}
        <div className="test-account-info">
          <p><small>For testing, you can use: test@example.com / testpassword</small></p>
        </div>
      </div>
    </div>
  );
};

export default Login; 