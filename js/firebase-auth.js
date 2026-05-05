/* ========== CricPulse — Firebase Auth ========== */

const firebaseConfig = {
  apiKey: ""
  authDomain: "cricket-b7a19.firebaseapp.com",
  projectId: "cricket-b7a19",
  storageBucket: "cricket-b7a19.firebasestorage.app",
  messagingSenderId: "555164972893",
  appId: "1:555164972893:web:cbc4bb0de6d0f45045dab4"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

class CricPulseAuth {
  constructor() {
    this.user = null;
    this.onLoginCallback = null;
  }

  init(onLogin) {
    this.onLoginCallback = onLogin;

    // Listen for auth state changes (handles page refresh too)
    auth.onAuthStateChanged((user) => {
      if (user) {
        this.user = {
          uid: user.uid,
          name: user.displayName || 'Cricket Fan',
          email: user.email,
          photo: user.photoURL || null
        };
        window.currentUser = this.user;
        console.log('✅ Logged in as:', this.user.name);
        if (this.onLoginCallback) this.onLoginCallback(this.user);
      }
    });
  }

  async signInWithGoogle() {
    try {
      const result = await auth.signInWithPopup(googleProvider);
      return result.user;
    } catch (error) {
      console.error('Google sign-in failed:', error);
      // If popup blocked, try redirect
      if (error.code === 'auth/popup-blocked') {
        await auth.signInWithRedirect(googleProvider);
      }
      throw error;
    }
  }

  async signOut() {
    await auth.signOut();
    this.user = null;
    window.currentUser = { name: 'You', team: null };
  }

  isLoggedIn() {
    return !!this.user;
  }
}

window.cricAuth = new CricPulseAuth();
