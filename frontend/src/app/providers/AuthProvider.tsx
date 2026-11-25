import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import {
  createJwtLiveSession,
  normalizeIndianPhone,
  requestOtp as apiRequestOtp,
  verifyOtp as apiVerifyOtp,
} from '../../services/authService';
import { createDemoSession } from '../../services/demoData';
import type { AuthSession } from '../../types/api';

const SESSION_STORAGE_KEY = 'agrivoice_auth_session';

function readStoredSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

function persistSession(session: AuthSession | null): void {
  try {
    if (session) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

interface AuthContextValue {
  session: AuthSession | null;
  isAuthenticated: boolean;
  requestOtp: (rawPhone: string) => Promise<{ phone: string }>;
  verifyOtp: (rawPhone: string, otp: string) => Promise<AuthSession>;
  signInWithToken: (token: string) => AuthSession;
  signInDemo: (rawPhone?: string) => AuthSession;
  selectFarm: (farmId: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());

  const updateSession = useCallback((next: AuthSession | null) => {
    setSession(next);
    persistSession(next);
  }, []);

  const requestOtp = useCallback(async (rawPhone: string) => {
    const phone = normalizeIndianPhone(rawPhone);
    await apiRequestOtp(phone);
    return { phone };
  }, []);

  const verifyOtp = useCallback(
    async (rawPhone: string, otp: string) => {
      const phone = normalizeIndianPhone(rawPhone);
      const next = await apiVerifyOtp(phone, otp.trim());
      updateSession(next);
      return next;
    },
    [updateSession]
  );

  const signInWithToken = useCallback(
    (token: string) => {
      const next = createJwtLiveSession(token);
      updateSession(next);
      return next;
    },
    [updateSession]
  );

  const signInDemo = useCallback(
    (rawPhone?: string) => {
      const phone = rawPhone ? normalizeIndianPhone(rawPhone) : '+919876543201';
      const next = createDemoSession(phone);
      updateSession(next);
      return next;
    },
    [updateSession]
  );

  const selectFarm = useCallback(
    (farmId: string) => {
      setSession((prev) => {
        if (!prev) return prev;
        const next = { ...prev, selectedFarmId: farmId };
        persistSession(next);
        return next;
      });
    },
    []
  );

  const logout = useCallback(() => {
    updateSession(null);
  }, [updateSession]);

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: session !== null,
        requestOtp,
        verifyOtp,
        signInWithToken,
        signInDemo,
        selectFarm,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
