'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserProfile, onAuthChange, signIn, signUp, signOut as authSignOut, UserRole } from '@/lib/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type AnbyansUser = Awaited<ReturnType<typeof getUserProfile>>;

interface AuthContextType {
  user: AnbyansUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<AnbyansUser>;
  register: (data: RegisterData) => Promise<AnbyansUser>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export interface RegisterData {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  country: string;
  businessName?: string;
  businessType?: string;
  payoutMethod?: string;
  payoutAccount?: string;
  shopName?: string;
  inviteCode?: string;
  organizerId?: string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  login: async () => { throw new Error('No provider'); },
  register: async () => { throw new Error('No provider'); },
  logout: async () => {},
  clearError: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AnbyansUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen for Firebase auth state
  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const timeout = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 8000)
          );
          const profile = await Promise.race([getUserProfile(firebaseUser.uid), timeout]);
          if (profile?.suspended) {
            await authSignOut();
            setUser(null);
            setError('Kont ou a suspann. Kontakte nou pou plis enfòmasyon.');
          } else if (profile) {
            setUser(profile);
          }
        } catch {
          // Firestore read failed or timed out — keep existing user, don't wipe session
        }
      } else {
        setUser(null); // Firebase explicitly says signed out
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const authUser = await signIn(email, password);
      const profile = await getUserProfile(authUser.uid);
      if (profile?.suspended) {
        await authSignOut();
        const msg = 'Kont ou a suspann. Kontakte nou pou plis enfòmasyon.';
        setError(msg);
        throw new Error(msg);
      }
      setUser(profile);
      return profile;
    } catch (err: unknown) {
      if ((err as Error).message.includes('suspann')) throw err;
      const msg = parseAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const register = async (data: RegisterData) => {
    setError(null);
    try {
      const authUser = await signUp(data.email, data.password, data);
      const profile = await getUserProfile(authUser.uid);
      setUser(profile);
      return profile;
    } catch (err: unknown) {
      const msg = parseAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    await authSignOut();
    setUser(null);
  };

  // Real-time suspension enforcement — kicks user immediately when admin suspends them
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists() && snap.data()?.suspended === true) {
        authSignOut();
        setUser(null);
        setError('Kont ou a suspann. Kontakte nou pou plis enfòmasyon.');
      }
    });
    return unsub;
  }, [user?.uid]);

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/* ── Error parser ───────────────────────────────────────────── */

function parseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'Imèl sa a deja itilize / Email already in use',
    'auth/invalid-email': 'Imèl envalid / Invalid email',
    'auth/weak-password': 'Modpas twò fèb (6+ karaktè) / Password too weak',
    'auth/user-not-found': 'Kont sa a pa egziste / Account not found',
    'auth/wrong-password': 'Modpas pa bon / Wrong password',
    'auth/invalid-credential': 'Imèl oswa modpas pa bon / Invalid email or password',
    'auth/too-many-requests': 'Twòp tantativ. Eseye pita / Too many attempts',
  };
  return map[code] || 'Yon erè rive / An error occurred';
}
