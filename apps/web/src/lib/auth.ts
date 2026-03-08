import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

// ─── Types ───────────────────────────────────────────────────────
export type UserRole = 'fan' | 'organizer' | 'reseller' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  role: UserRole;
  payoutMethod?: string;
  payoutDetails?: string;
  businessName?: string;
  businessType?: string;
  notifications?: string[];
  createdAt: any;
  updatedAt: any;
}

// ─── Email/Password Auth ─────────────────────────────────────────

export async function signUp(
  email: string,
  password: string,
  profile: Partial<UserProfile> & { firstName: string; lastName: string; role: UserRole }
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, {
    displayName: `${profile.firstName} ${profile.lastName}`,
  });

  const userDoc: UserProfile = {
    uid: cred.user.uid,
    email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone || '',
    city: profile.city || '',
    state: profile.state || '',
    country: profile.country || '',
    role: profile.role,
    payoutMethod: profile.payoutMethod || '',
    payoutDetails: profile.payoutDetails || '',
    businessName: profile.businessName || '',
    businessType: profile.businessType || '',
    notifications: profile.notifications || ['whatsapp'],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'users', cred.user.uid), userDoc);
  return cred.user;
}

export async function signIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

// ─── Google Sign-In ──────────────────────────────────────────────

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(role: UserRole = 'fan') {
  const cred = await signInWithPopup(auth, googleProvider);
  const user = cred.user;

  // Check if user profile already exists in Firestore
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // First time — create profile from Google data
    const nameParts = (user.displayName || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const userDoc: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      firstName,
      lastName,
      phone: user.phoneNumber || '',
      city: '',
      state: '',
      country: '',
      role,
      payoutMethod: '',
      payoutDetails: '',
      businessName: '',
      businessType: '',
      notifications: ['email'],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, userDoc);
  }

  return user;
}

// ─── Get User Profile ────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}
// ─── Auth State Listener ─────────────────────────────────────────

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}