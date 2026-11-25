import { useState } from 'react';
import AppLayout from './app/layouts/AppLayout';
import { AuthProvider } from './app/providers/AuthProvider';
import { RouterProvider, useRouter, type AppRoute } from './app/routes/routes';
import FarmerLoginPage from './features/auth/FarmerLoginPage';
import FarmerDashboardPage from './features/dashboard/FarmerDashboardPage';
import LandingPage from './features/landing/LandingPage';
import SoilManagementPage from './features/soil/SoilManagementPage';
import VoiceAssistantPage from './features/voice/VoiceAssistantPage';
import WeatherAdvisoryPage from './features/weather/WeatherAdvisoryPage';

function AppShell() {
  const { route } = useRouter();
  const [voiceDrawerOpen, setVoiceDrawerOpen] = useState(false);

  const renderPage = () => {
    switch (route) {
      case '/dashboard':
        return (
          <FarmerDashboardPage
            onOpenVoiceDrawer={() => setVoiceDrawerOpen(true)}
          />
        );
      case '/weather':
        return <WeatherAdvisoryPage />;
      case '/soil':
        return <SoilManagementPage />;
      case '/voice':
        return <VoiceAssistantPage />;
      case '/login':
        return <FarmerLoginPage />;
      case '/':
      default:
        return <LandingPage />;
    }
  };

  return (
    <AppLayout
      voiceDrawerOpen={voiceDrawerOpen}
      onOpenVoiceDrawer={() => setVoiceDrawerOpen(true)}
      onCloseVoiceDrawer={() => setVoiceDrawerOpen(false)}
    >
      {renderPage()}
    </AppLayout>
  );
}

export default function App({ initialRoute }: { initialRoute?: AppRoute }) {
  return (
    <AuthProvider>
      <RouterProvider initialRoute={initialRoute}>
        <AppShell />
      </RouterProvider>
    </AuthProvider>
  );
}
