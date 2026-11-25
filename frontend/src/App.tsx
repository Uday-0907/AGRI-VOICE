import { useState } from 'react';
import AppLayout from './app/layouts/AppLayout';
import { AuthProvider, useAuth, type ClerkAuthAdapter } from './app/providers/AuthProvider';
import { RouterProvider, useRouter, type AppRoute } from './app/routes/routes';
import { Button, EmptyState } from './components/ui';
import FarmerLoginPage from './features/auth/FarmerLoginPage';
import BuyerPortalPage from './features/buyer/BuyerPortalPage';
import FarmerDashboardPage from './features/dashboard/FarmerDashboardPage';
import InstitutionsPage from './features/institutions/InstitutionsPage';
import LandingPage from './features/landing/LandingPage';
import MachineryPage from './features/machinery/MachineryPage';
import MarketsPage from './features/markets/MarketsPage';
import NotificationsPage from './features/notifications/NotificationsPage';
import ResearchPage from './features/research/ResearchPage';
import SoilManagementPage from './features/soil/SoilManagementPage';
import VoiceAssistantPage from './features/voice/VoiceAssistantPage';
import WeatherDashboard from './features/weather/WeatherDashboard';

const FARMER_ONLY_ROUTES = new Set<AppRoute>([
  '/dashboard',
  '/weather',
  '/soil',
  '/markets',
  '/machinery',
  '/institutions',
  '/research',
  '/voice',
]);

function AppShell() {
  const { route, navigate } = useRouter();
  const { session } = useAuth();
  const [voiceDrawerOpen, setVoiceDrawerOpen] = useState(false);

  const renderPage = () => {
    if (session?.role === 'buyer' && FARMER_ONLY_ROUTES.has(route)) {
      return (
        <div className="page-container">
          <EmptyState
            icon="🔒"
            title="Farmer Account Required"
            description="Buyer accounts can only access the Buyer Portal, Notifications, and Home Page."
            action={
              <Button variant="primary" onClick={() => navigate('/buyer')}>
                Go to Buyer Portal →
              </Button>
            }
          />
        </div>
      );
    }

    switch (route) {
      case '/dashboard':
        return (
          <FarmerDashboardPage
            onOpenVoiceDrawer={() => setVoiceDrawerOpen(true)}
          />
        );
      case '/weather':
        return <WeatherDashboard embedded />;
      case '/soil':
        return <SoilManagementPage />;
      case '/markets':
        return <MarketsPage />;
      case '/machinery':
        return <MachineryPage />;
      case '/institutions':
        return <InstitutionsPage />;
      case '/research':
        return <ResearchPage />;
      case '/voice':
        return <VoiceAssistantPage />;
      case '/buyer':
        return <BuyerPortalPage />;
      case '/notifications':
        return <NotificationsPage />;
      case '/login':
        return <FarmerLoginPage />;
      case '/':
      default:
        return <LandingPage />;
    }
  };

  return (
    <AppLayout
      voiceDrawerOpen={session?.role === 'buyer' ? false : voiceDrawerOpen}
      onOpenVoiceDrawer={() => {
        if (session?.role !== 'buyer') setVoiceDrawerOpen(true);
      }}
      onCloseVoiceDrawer={() => setVoiceDrawerOpen(false)}
    >
      {renderPage()}
    </AppLayout>
  );
}

export default function App({
  initialRoute,
  clerkAdapter = null,
}: {
  initialRoute?: AppRoute;
  clerkAdapter?: ClerkAuthAdapter | null;
}) {
  return (
    <AuthProvider clerkAdapter={clerkAdapter}>
      <RouterProvider initialRoute={initialRoute}>
        <AppShell />
      </RouterProvider>
    </AuthProvider>
  );
}
