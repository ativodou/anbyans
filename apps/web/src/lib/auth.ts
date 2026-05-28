import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  deleteUser,
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
  suspended?: boolean;
  organizerStatus?: 'pending' | 'approved' | 'rejected';
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
    ...(profile.role === 'organizer' && { organizerStatus: 'pending' }),
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
googleProvider.setCustomParameters({ prompt: 'select_account' });

async function upsertGoogleProfile(fbUser: User, intendedRole: UserRole): Promise<UserRole> {
  const userRef = doc(db, 'users', fbUser.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    const [firstName, ...rest] = (fbUser.displayName || '').split(' ');
    await setDoc(userRef, {
      uid: fbUser.uid, email: fbUser.email || '',
      firstName: firstName || '', lastName: rest.join(' ') || '',
      phone: fbUser.phoneNumber || '',
      city: '', state: '', country: '',
      role: intendedRole,
      payoutMethod: '', payoutDetails: '',
      businessName: '', businessType: '',
      notifications: ['email'],
      ...(intendedRole === 'organizer' && { organizerStatus: 'pending' }),
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    } as UserProfile);
    return intendedRole;
  }
  return (userSnap.data() as UserProfile).role ?? intendedRole;
}

// Popup — desktop
export async function signInWithGoogle(role: UserRole = 'fan'): Promise<{ user: User; role: UserRole }> {
  const cred = await signInWithPopup(auth, googleProvider);
  const actualRole = await upsertGoogleProfile(cred.user, role);
  return { user: cred.user, role: actualRole };
}

// Redirect — mobile (call this to initiate, then handleGoogleRedirectResult on page load)
export async function startGoogleRedirect(): Promise<void> {
  await signInWithRedirect(auth, googleProvider);
}

export async function handleGoogleRedirectResult(intendedRole: UserRole = 'fan'): Promise<{ user: User; role: UserRole } | null> {
  const result = await getRedirectResult(auth);
  if (!result) return null;
  const role = await upsertGoogleProfile(result.user, intendedRole);
  return { user: result.user, role };
}

// ─── Get User Profile ────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}
export async function deleteUserAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('not-signed-in');
  await deleteUser(user);
}

// ─── Auth State Listener ─────────────────────────────────────────

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}