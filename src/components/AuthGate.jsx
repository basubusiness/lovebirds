/**
 * AuthGate.jsx
 *
 * Wraps the entire app. If the user is not logged in, shows a
 * Google Sign-in screen. Once authenticated, renders children.
 *
 * Add to App.jsx:
 *   import AuthGate from './components/AuthGate';
 *   // Wrap <div className={styles.app}> content with <AuthGate>
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import styles from './AuthGate.module.css';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    // Listen for login / logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const signOut = () => supabase.auth.signOut();

  // Still loading
  if (session === undefined) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner} />
      </div>
    );
  }

  // Not logged in → show sign-in screen
  if (!session) {
    return (
      <div className={styles.loginScreen}>
        <div className={styles.loginCard}>
          <div className={styles.logo}>HIRT</div>
          <div className={styles.tagline}>Household Inventory & Replenishment Tracker</div>
          <button className={styles.googleBtn} onClick={signInWithGoogle}>
            <GoogleIcon />
            Sign in with Google
          </button>
          <p className={styles.privacy}>
            Your inventory is private and only visible to you.
          </p>
        </div>
      </div>
    );
  }

  // Logged in → render app with sign-out available via context
  return (
    <AuthContext.Provider value={{ session, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Context so child components can access session/signOut ──────────────────

import { createContext, useContext } from 'react';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

// ── Google SVG icon ──────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
