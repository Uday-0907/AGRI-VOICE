import { useTranslation } from 'react-i18next';
import { useAuth } from '../../app/providers/AuthProvider';
import { useRouter } from '../../app/routes/routes';
import { Button, Card, SectionHeading } from '../../components/ui';

export default function LandingPage() {
  const { t } = useTranslation('common');
  const { navigate } = useRouter();
  const { isAuthenticated } = useAuth();

  const features = [
    {
      id: 'weather',
      icon: '🌦️',
      title: t('landing.weatherTitle'),
      description: t('landing.weatherDescription'),
      route: '/weather' as const,
    },
    {
      id: 'soil',
      icon: '🌱',
      title: t('landing.soilTitle'),
      description: t('landing.soilDescription'),
      route: '/soil' as const,
    },
    {
      id: 'voice',
      icon: '🎙️',
      title: t('landing.voiceTitle'),
      description: t('landing.voiceDescription'),
      route: '/voice' as const,
    },
  ];

  return (
    <>
      <section id="home" className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">{t('landing.eyebrow')}</span>

          <h1>
            {t('landing.heading')}
            <span>{t('landing.headingAccent')}</span>
          </h1>

          <p>{t('landing.description')}</p>

          <div className="hero-actions">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                const target = document.getElementById('features');
                if (target && typeof target.scrollIntoView === 'function') {
                  target.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate('/dashboard');
                }
              }}
            >
              {t('landing.primaryAction')} →
            </Button>

            {isAuthenticated ? (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate('/dashboard')}
              >
                {t('landing.openDashboard')}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/login')}
              >
                {t('landing.secondaryAction')}
              </Button>
            )}
          </div>

          <div className="hero-trust">
            <span>✓ {t('landing.trustOne')}</span>
            <span>✓ {t('landing.trustTwo')}</span>
            <span>✓ {t('landing.trustThree')}</span>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="visual-orbit orbit-one" />
          <div className="visual-orbit orbit-two" />
          <div className="visual-center">
            <span>🌾</span>
            <strong>{t('landing.orbitTitle')}</strong>
            <small>{t('landing.orbitSubtitle')}</small>
          </div>
          <div className="floating-card floating-one">☀️ {t('landing.floatingWeather')}</div>
          <div className="floating-card floating-two">🧪 {t('landing.floatingSoil')}</div>
          <div className="floating-card floating-three">🎙️ {t('landing.floatingVoice')}</div>
        </div>
      </section>

      <section id="features" className="feature-section">
        <SectionHeading
          eyebrow={t('landing.featuresEyebrow')}
          title={t('landing.featuresHeading')}
          description={t('landing.featuresDescription')}
          align="center"
        />

        <div className="feature-grid">
          {features.map((item) => (
            <Card key={item.id} as="article" interactive>
              <div id={item.id} className="feature-card-inner">
                <div className="feature-icon" aria-hidden="true">
                  {item.icon}
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(item.route)}
                  >
                    {t('landing.exploreFeature')} →
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section id="farmer-login" className="login-section">
        <div>
          <span className="eyebrow">{t('landing.loginEyebrow')}</span>
          <h2>{t('landing.loginTitle')}</h2>
          <p>{t('landing.loginDescription')}</p>
        </div>
        <div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
          >
            {isAuthenticated ? t('landing.openDashboard') : t('landing.loginAction')} →
          </Button>
        </div>
      </section>
    </>
  );
}
