'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserProfile, onAuthChange, signIn, signUp, signOut, UserRole } from '@/lib/auth';
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
          const profile = await getUserProfile(firebaseUser.uid);
          setUser(profile);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const authUser = await signIn(email, password);
      const profile = await getUserProfile(authUser.uid); setUser(profile);
      return profile;
    } catch (err: unknown) {
      const msg = parseAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const register = async (data: RegisterData) => {
    setError(null);
    try {
      const u = await signUp(data);
      const profile = await getUserProfile(authUser.uid); setUser(profile);
      return profile;
    } catch (err: unknown) {
      const msg = parseAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    await signOut();
    setUser(null);
  };

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
