// Firebase Authentication Configuration for OpenBento Dashboard
// Integration: Firebase Auth with Google provider

import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect,
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut,
  User
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Sign in with Google using popup (better UX than redirect)
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Firebase Auth Error:", error.code, error.message);
    
    // Provide actionable error messages
    if (error.code === 'auth/configuration-not-found') {
      throw new Error('Google Sign-In is not configured. Please enable it in Firebase Console → Authentication → Sign-in method.');
    }
    if (error.code === 'auth/unauthorized-domain') {
      throw new Error(`This domain is not authorized. Add "${window.location.hostname}" to Firebase Console → Authentication → Settings → Authorized domains.`);
    }
    if (error.code === 'auth/popup-closed-by-user') {
      return null; // User cancelled, not an error
    }
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked. Please allow popups for this site and try again.');
    }
    
    throw error;
  }
}

// Sign out
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error("Sign out error:", error.message);
  }
}

// Auth state listener
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// Export types
export type { User };
