import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../app/providers/AuthProvider';
import { changeAppLanguage } from '../../app/providers/i18n';
import {
  languages,
  type LanguageCode,
} from '../../app/providers/languageCatalog';
import { useRouter, type AppRoute } from '../../app/routes/routes';
import Button from '../ui/Button';

export default function Header() {
  const { t, i18n } = useTranslation('common');
  const { route, navigate } = useRouter();
  const { session, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentLanguage = i18n.resolvedLanguage?.split('-')[0] ?? 'en';

  const farmerLinks: ReadonlyArray<{ key: string; to: AppRoute; label?: string }> = [
    { key: 'home', to: '/' },
    { key: 'dashboard', to: '/dashboard' },
    { key: 'weather', to: '/weather' },
    { key: 'soil', to: '/soil' },
    { key: 'markets', to: '/markets', label: 'Markets' },
    { key: 'machinery', to: '/machinery', label: 'Machinery' },
    { key: 'institutions', to: '/institutions', label: 'Schemes' },
    { key: 'research', to: '/research', label: 'Research' },
    { key: 'voice', to: '/voice' },
    ...(session ? [{ key: 'notifications', to: '/notifications' as AppRoute, label: 'Notifications' }] : []),
  ];

  const buyerLinks: ReadonlyArray<{ key: string; to: AppRoute; label?: string }> = [
    { key: 'home', to: '/' },
    { key: 'buyer', to: '/buyer', label: 'Buyer Portal' },
    { key: 'notifications', to: '/notifications', label: 'Notifications' },
  ];

  const links = session?.role === 'buyer' ? buyerLinks : farmerLinks;

  const handleNavigate = (to: AppRoute) => {
    navigate(to);
    setMenuOpen(false);
  };

  return (
    <header className="site-header">
      <button
        type="button"
        className="brand"
        aria-label={t('app.homeAriaLabel')}
        onClick={() => handleNavigate('/')}
      >
        <span className="brand-mark" aria-hidden="true">A</span>
        <span className="brand-text">
          <strong>AgriVoice</strong>
          <small>{t('app.brandCaption')}</small>
        </span>
      </button>

      <button
        className="mobile-menu-button"
        type="button"
        aria-label={t('navigation.toggle')}
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? '✕' : '☰'}
      </button>

      <nav
        id="primary-navigation"
        className={`main-navigation ${menuOpen ? 'is-open' : ''}`}
        aria-label={t('navigation.ariaLabel')}
      >
        {links.map((link) => {
          const isActive = route === link.to;
          return (
            <button
              key={link.key}
              type="button"
              className={`nav-link ${isActive ? 'is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => handleNavigate(link.to)}
            >
              {link.label ?? t(`navigation.${link.key}`)}
            </button>
          );
        })}
      </nav>

      <div className="header-actions">
        <label className="language-control">
          <span aria-hidden="true">🌐</span>
          <select
            aria-label={t('common.language')}
            value={currentLanguage}
            onChange={(event) => {
              void changeAppLanguage(event.target.value as LanguageCode).catch(
                (error: unknown) => {
                  console.error('Language change failed:', error);
                }
              );
            }}
          >
            {languages.map((language) => (
              <option
                key={language.code}
                value={language.code}
                disabled={language.status !== 'approved'}
              >
                {language.nativeName === language.name
                  ? language.name
                  : `${language.nativeName} (${language.name})`}
              </option>
            ))}
          </select>
        </label>

        {session ? (
          <div className="row-wrap">
            <button
              type="button"
              className="user-pill"
              onClick={() => handleNavigate(session.role === 'buyer' ? '/buyer' : '/dashboard')}
              title={
                session.role === 'buyer'
                  ? session.buyerProfile?.businessName ?? session.user.phone
                  : session.farmerProfile?.fullName ?? session.user.phone
              }
            >
              <span aria-hidden="true">{session.role === 'buyer' ? '🛒' : '👨‍🌾'}</span>
              <span>
                {(session.role === 'buyer'
                  ? session.buyerProfile?.contactName ?? session.buyerProfile?.businessName ?? session.user.phone
                  : session.farmerProfile?.fullName ?? session.user.phone
                ).split(' ')[0]}
              </span>
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logout();
                handleNavigate('/');
              }}
            >
              {t('navigation.logout')}
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleNavigate('/login')}
          >
            {t('navigation.login')} →
          </Button>
        )}
      </div>
    </header>
  );
}
