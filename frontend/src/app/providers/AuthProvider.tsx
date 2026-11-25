import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { ApiError } from '../../services/apiClient';
import {
  authenticateWithBackendToken,
  authenticateWithClerkToken,
  normalizeIndianPhone,
  onboardClerkFarmer,
} from '../../services/authService';
import { createDemoSession } from '../../services/demoData';
import type { AuthSession } from '../../types/api';

const SESSION_STORAGE_KEY = 'agrivoice_auth_session';

export interface ClerkAuthAdapter {
  isLoaded: boolean;
  isSignedIn: boolean;
  displayName?: string | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
  openSignIn: () => void;
  openSignUp: () => void;
}

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
  authLoading: boolean;
  authError: { code: string; message: string } | null;
  clerkAdapter: ClerkAuthAdapter | null;
  signInWithToken: (token: string) => Promise<AuthSession>;
  signInDemo: (rawPhone?: string) => AuthSession;
  completeClerkOnboarding: (payload: {
    role?: 'farmer' | 'buyer';
    fullName?: string;
    phone: string;
    preferredLanguage?: string;
    state: string;
    district: string;
    mandal?: string;
    village?: string;
    pinCode: string;
    farmName?: string;
    totalAreaAcres?: number;
    businessName?: string;
    contactName?: string;
    businessType?: string;
    city?: string;
    gstOrLicenseNumber?: string;
  }) => Promise<AuthSession>;
  selectFarm: (farmId: string) => void;
  retryClerkExchange: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  clerkAdapter = null,
}: {
  children: ReactNode;
  clerkAdapter?: ClerkAuthAdapter | null;
}) {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<{ code: string; message: string } | null>(null);
  const [exchangeNonce, setExchangeNonce] = useState(0);

  const updateSession = useCallback((next: AuthSession | null) => {
    setSession(next);
    persistSession(next);
  }, []);

  // Synchronize real Clerk sign-in -> backend JWT exchange via POST /auth/clerk/exchange
  useEffect(() => {
    if (!clerkAdapter || !clerkAdapter.isLoaded) return;

    if (!clerkAdapter.isSignedIn) {
      setAuthError(null);
      return;
    }

    // If we already have a verified live session, keep it unless user requested retry
    if (session?.mode === 'live' && exchangeNonce === 0) {
      return;
    }

    let cancelled = false;

    async function syncClerkSession() {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const clerkToken = await clerkAdapter!.getToken();
        if (!clerkToken) {
          throw new ApiError('Clerk session token unavailable.', 401, 'CLERK_TOKEN_MISSING');
        }
        const liveSession = await authenticateWithClerkToken(clerkToken);
        if (!cancelled) {
          updateSession(liveSession);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setAuthError({ code: err.code, message: err.message });
          } else {
            setAuthError({
              code: 'EXCHANGE_FAILED',
              message: err instanceof Error ? err.message : 'Clerk authentication exchange failed.',
            });
          }
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    }

    void syncClerkSession();

    return () => {
      cancelled = true;
    };
  }, [
    clerkAdapter,
    clerkAdapter?.isLoaded,
    clerkAdapter?.isSignedIn,
    exchangeNonce,
    session?.mode,
    updateSession,
  ]);

  const signInWithToken = useCallback(
    async (token: string) => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const next = await authenticateWithBackendToken(token);
        updateSession(next);
        return next;
      } catch (err) {
        const parsed =
          err instanceof ApiError
            ? { code: err.code, message: err.message }
            : {
                code: 'AUTH_FAILED',
                message: err instanceof Error ? err.message : 'Token verification failed.',
              };
        setAuthError(parsed);
        throw err;
      } finally {
        setAuthLoading(false);
      }
    },
    [updateSession]
  );

  const signInDemo = useCallback(
    (rawPhone?: string) => {
      const phone = rawPhone ? normalizeIndianPhone(rawPhone) : '+919876543201';
      const next = createDemoSession(phone);
      setAuthError(null);
      updateSession(next);
      return next;
    },
    [updateSession]
  );

  const selectFarm = useCallback((farmId: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, selectedFarmId: farmId };
      persistSession(next);
      return next;
    });
  }, []);

  const retryClerkExchange = useCallback(() => {
    setExchangeNonce((n) => n + 1);
  }, []);

  const completeClerkOnboarding = useCallback(
    async (payload: {
      role?: 'farmer' | 'buyer';
      fullName?: string;
      phone: string;
      preferredLanguage?: string;
      state: string;
      district: string;
      mandal?: string;
      village?: string;
      pinCode: string;
      farmName?: string;
      totalAreaAcres?: number;
      businessName?: string;
      contactName?: string;
      businessType?: string;
      city?: string;
      gstOrLicenseNumber?: string;
    }) => {
      if (!clerkAdapter || !clerkAdapter.isSignedIn) {
        throw new ApiError('Sign in with Clerk before completing farmer onboarding.', 401, 'UNAUTHORIZED');
      }
      setAuthLoading(true);
      setAuthError(null);
      try {
        const clerkToken = await clerkAdapter.getToken();
        if (!clerkToken) {
          throw new ApiError('Clerk session token unavailable.', 401, 'CLERK_TOKEN_MISSING');
        }
        const liveSession = await onboardClerkFarmer(clerkToken, {
          ...payload,
          phone: normalizeIndianPhone(payload.phone),
        });
        updateSession(liveSession);
        return liveSession;
      } catch (err) {
        if (err instanceof ApiError) {
          setAuthError({ code: err.code, message: err.message });
        }
        throw err;
      } finally {
        setAuthLoading(false);
      }
    },
    [clerkAdapter, updateSession]
  );

  const logout = useCallback(() => {
    setAuthError(null);
    updateSession(null);
    if (clerkAdapter?.isSignedIn) {
      void clerkAdapter.signOut();
    }
  }, [clerkAdapter, updateSession]);

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: session !== null,
        authLoading,
        authError,
        clerkAdapter,
        signInWithToken,
        signInDemo,
        completeClerkOnboarding,
        selectFarm,
        retryClerkExchange,
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
