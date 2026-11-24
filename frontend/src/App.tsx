
import { useTranslation } from 'react-i18next';
import AppLayout from './app/layouts/AppLayout';

export default function App() {
  const { t } = useTranslation('common');

  return (
    <AppLayout>
      <section id="home" className="hero-section">
        <span className="eyebrow">
          {t('landing.eyebrow')}
        </span>

        <h1>
          {t('landing.heading')}
          <br />
          {t('landing.headingAccent')}
        </h1>

        <p>{t('landing.description')}</p>

        <a href="#features" className="primary-button">
          {t('landing.primaryAction')} →
        </a>
      </section>

      <section id="features" className="feature-section">
        <h2>{t('landing.featuresHeading')}</h2>

        <div className="feature-grid">
          <article id="weather" className="feature-card">
            <h3>{t('landing.weatherTitle')}</h3>
            <p>{t('landing.weatherDescription')}</p>
          </article>

          <article id="soil" className="feature-card">
            <h3>{t('landing.soilTitle')}</h3>
            <p>{t('landing.soilDescription')}</p>
          </article>

          <article id="voice" className="feature-card">
            <h3>{t('landing.voiceTitle')}</h3>
            <p>{t('landing.voiceDescription')}</p>
          </article>
        </div>
      </section>

      <section id="farmer-login" className="login-section">
        <h2>{t('landing.loginTitle')}</h2>
        <p>{t('landing.loginDescription')}</p>
      </section>
    </AppLayout>
  );
}
