import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type AppRoute =
  | '/'
  | '/dashboard'
  | '/weather'
  | '/soil'
  | '/markets'
  | '/machinery'
  | '/institutions'
  | '/research'
  | '/voice'
  | '/buyer'
  | '/notifications'
  | '/login';

const VALID_ROUTES = new Set<AppRoute>([
  '/',
  '/dashboard',
  '/weather',
  '/soil',
  '/markets',
  '/machinery',
  '/institutions',
  '/research',
  '/voice',
  '/buyer',
  '/notifications',
  '/login',
]);

function readRouteFromHash(): AppRoute {
  if (typeof window === 'undefined') {
    return '/';
  }
  const raw = window.location.hash.replace(/^#/, '');
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  if (VALID_ROUTES.has(normalized as AppRoute)) {
    return normalized as AppRoute;
  }
  return '/';
}

interface RouterContextValue {
  route: AppRoute;
  navigate: (to: AppRoute) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export function RouterProvider({
  children,
  initialRoute,
}: {
  children: ReactNode;
  initialRoute?: AppRoute;
}) {
  const [route, setRoute] = useState<AppRoute>(() => initialRoute ?? readRouteFromHash());

  useEffect(() => {
    const onHashChange = () => {
      setRoute(readRouteFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((to: AppRoute) => {
    setRoute(to);
    if (typeof window !== 'undefined') {
      const targetHash = to === '/' ? '#/' : `#${to}`;
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  return (
    <RouterContext.Provider value={{ route, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used inside RouterProvider');
  }
  return ctx;
}
