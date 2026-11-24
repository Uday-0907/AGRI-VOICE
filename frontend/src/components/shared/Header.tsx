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

  const links: ReadonlyArray<{ key: 'home' | 'dashboard' | 'weather' | 'soil' | 'voice'; to: AppRoute }> = [
    { key: 'home', to: '/' },
    { key: 'dashboard', to: '/dashboard' },
    { key: 'weather', to: '/weather' },
    { key: 'soil', to: '/soil' },
    { key: 'voice', to: '/voice' },
  ];

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
              {t(`navigation.${link.key}`)}
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
              onClick={() => handleNavigate('/dashboard')}
              title={session.farmerProfile.fullName}
            >
              <span aria-hidden="true">👨‍🌾</span>
              <span>{session.farmerProfile.fullName.split(' ')[0]}</span>
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
