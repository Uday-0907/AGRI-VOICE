
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../../components/shared/Header';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation('common');

  return (
    <div className="application-layout">
      <Header />

      <main className="page-content">
        {children}
      </main>

      <footer className="site-footer">
        <strong>AgriVoice</strong>
        <span>{t('app.footer')}</span>
      </footer>
    </div>
  );
}
