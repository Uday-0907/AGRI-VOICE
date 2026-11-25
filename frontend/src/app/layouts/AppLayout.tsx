import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../../components/shared/Header';
import VoiceAssistantPanel from '../../features/voice/VoiceAssistantPanel';

interface AppLayoutProps {
  children: ReactNode;
  voiceDrawerOpen: boolean;
  onOpenVoiceDrawer: () => void;
  onCloseVoiceDrawer: () => void;
}

export default function AppLayout({
  children,
  voiceDrawerOpen,
  onOpenVoiceDrawer,
  onCloseVoiceDrawer,
}: AppLayoutProps) {
  const { t } = useTranslation('common');

  return (
    <div className="application-layout">
      <a href="#main-content" className="skip-link">
        {t('app.skipToContent')}
      </a>

      <Header />

      <main id="main-content" className="page-content">
        {children}
      </main>

      <footer className="site-footer">
        <div>
          <strong>AgriVoice</strong>
          <div>{t('app.footer')}</div>
        </div>
        <div>
          <span>
            {t('app.helplineLabel')}: <strong>{t('app.helplineNumber')}</strong>
          </span>
        </div>
      </footer>

      <button
        type="button"
        className="voice-fab"
        aria-label={t('voice.quickLaunch')}
        onClick={onOpenVoiceDrawer}
      >
        <span aria-hidden="true">🎙️</span>
        <span>{t('voice.quickLaunch')}</span>
      </button>

      {voiceDrawerOpen ? (
        <div
          className="voice-drawer-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={t('voice.title')}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onCloseVoiceDrawer();
            }
          }}
        >
          <div className="voice-drawer-panel">
            <VoiceAssistantPanel onClose={onCloseVoiceDrawer} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
