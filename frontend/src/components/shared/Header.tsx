
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  languages,
  type LanguageCode,
} from '../../app/providers/languageCatalog';
import { changeAppLanguage } from '../../app/providers/i18n';

export default function Header() {
  const { t, i18n } = useTranslation('common');
  const [menuOpen, setMenuOpen] = useState(false);

  const currentLanguage =
    i18n.resolvedLanguage?.split('-')[0] ?? 'en';

  const links = [
    { key: 'home', href: '#home' },
    { key: 'weather', href: '#weather' },
    { key: 'soil', href: '#soil' },
    { key: 'voice', href: '#voice' },
  ] as const;

  return (
    <header className="site-header">
      <a href="#home" className="brand" aria-label={t('app.homeAriaLabel')}>
        <span className="brand-mark">A</span>
        <span className="brand-text">
          <strong>AgriVoice</strong>
          <small>{t('app.brandCaption')}</small>
        </span>
      </a>

      <button
        className="mobile-menu-button"
        type="button"
        aria-label={t('navigation.toggle')}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? '✕' : '☰'}
      </button>

      <nav
        className={`main-navigation ${menuOpen ? 'is-open' : ''}`}
        aria-label={t('navigation.ariaLabel')}
      >
        {links.map((link) => (
          <a
            key={link.key}
            href={link.href}
            onClick={() => setMenuOpen(false)}
          >
            {t(`navigation.${link.key}`)}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        <label className="language-control">
          <span aria-hidden="true">◎</span>
          <select
            aria-label={t('common.language')}
            value={currentLanguage}
            onChange={(event) => {
              void changeAppLanguage(
                event.target.value as LanguageCode
              ).catch((error: unknown) => {
                console.error('Language change failed:', error);
              });
            }}
          >
            {languages.map((language) => (
              <option
                key={language.code}
                value={language.code}
                disabled={language.status !== 'approved'}
              >
                {language.name}
              </option>
            ))}
          </select>
        </label>

        <a href="#farmer-access" className="header-login">
          {t('navigation.login')} →
        </a>
      </div>
    </header>
  );
}
