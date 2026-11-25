import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, useAuth as useClerkAuth, useClerk, useUser } from '@clerk/react';

import App from './App';
import type { ClerkAuthAdapter } from './app/providers/AuthProvider';
import { i18nReady } from './app/providers/i18n';
import './styles/global.css';

function ClerkSyncedApp() {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const { user } = useUser();
  const clerk = useClerk();

  const adapter: ClerkAuthAdapter = useMemo(
    () => ({
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      displayName:
        user?.fullName ||
        user?.firstName ||
        user?.primaryEmailAddress?.emailAddress ||
        null,
      getToken: () => getToken(),
      signOut: () => signOut(),
      openSignIn: () => clerk.openSignIn(),
      openSignUp: () => clerk.openSignUp(),
    }),
    [isLoaded, isSignedIn, user, getToken, signOut, clerk]
  );

  return <App clerkAdapter={adapter} />;
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('React root element was not found.');
}

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

void i18nReady
  .then(() => {
    createRoot(rootElement).render(
      <StrictMode>
        {clerkPublishableKey ? (
          <ClerkProvider publishableKey={clerkPublishableKey}>
            <ClerkSyncedApp />
          </ClerkProvider>
        ) : (
          <App />
        )}
      </StrictMode>
    );
  })
  .catch((error: unknown) => {
    console.error('AgriVoice initialization failed:', error);
  });
