import { useTranslation } from 'react-i18next';
import { useAuth } from '../../app/providers/AuthProvider';
import { useRouter } from '../../app/routes/routes';
import { Button, Card, SectionHeading, StatusBadge } from '../../components/ui';

export default function LandingPage() {
  const { t } = useTranslation('common');
  const { navigate } = useRouter();
  const { isAuthenticated, session } = useAuth();

  const pillars = [
    {
      id: 'weather',
      icon: '🌦️',
      title: t('landing.weatherTitle'),
      description: t('landing.weatherDescription'),
      route: '/weather' as const,
      tag: 'Pillar 1',
    },
    {
      id: 'soil',
      icon: '🌱',
      title: t('landing.soilTitle'),
      description: t('landing.soilDescription'),
      route: '/soil' as const,
      tag: 'Pillar 2',
    },
    {
      id: 'markets',
      icon: '🏪',
      title: 'Markets, Prices & Buyer Connections',
      description:
        'Track APMC mandi prices, publish harvest lots, and connect directly with verified produce buyers.',
      route: '/markets' as const,
      tag: 'Pillar 3',
    },
    {
      id: 'machinery',
      icon: '🚜',
      title: 'Farm Machinery & Equipment Services',
      description:
        'Discover tractors, harvesters, sprayers, and drones for custom hiring or list your own equipment.',
      route: '/machinery' as const,
      tag: 'Pillar 4',
    },
    {
      id: 'institutions',
      icon: '🏛️',
      title: 'Institutions & Financial Inclusion',
      description:
        'Explore PM-KISAN, PMFBY crop insurance, and KCC credit references and track your applications.',
      route: '/institutions' as const,
      tag: 'Pillar 5',
    },
    {
      id: 'research',
      icon: '📚',
      title: 'Agriculture Research & Extension',
      description:
        'Browse ICAR/KVK crop advisories and submit field questions directly to extension specialists.',
      route: '/research' as const,
      tag: 'Pillar 6',
    },
  ];

  const primaryDashboardRoute = session?.role === 'buyer' ? '/buyer' : '/dashboard';

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
                  navigate(primaryDashboardRoute);
                }
              }}
            >
              {t('landing.primaryAction')} →
            </Button>

            {isAuthenticated ? (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate(primaryDashboardRoute)}
              >
                {session?.role === 'buyer' ? 'Open Buyer Portal' : t('landing.openDashboard')}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/login')}
                >
                  {t('landing.secondaryAction')}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => navigate('/login')}
                >
                  Buyer Portal Login →
                </Button>
              </>
            )}
          </div>

          <div className="hero-trust">
            <span>✓ {t('landing.trustOne')}</span>
            <span>✓ {t('landing.trustTwo')}</span>
            <span>✓ {t('landing.trustThree')}</span>
            <span>✓ Dedicated Farmer & Buyer Portals</span>
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
          title="Six Integrated Agricultural Pillars"
          description="One unified platform connecting farmers, produce buyers, weather intelligence, soil health, machinery, schemes, and extension research."
          align="center"
        />

        <div className="feature-grid">
          {pillars.map((item) => (
            <Card key={item.id} as="article" interactive>
              <div id={item.id} className="feature-card-inner">
                <div className="row-between" style={{ width: '100%' }}>
                  <div className="feature-icon" aria-hidden="true">
                    {item.icon}
                  </div>
                  <StatusBadge tone="info">{item.tag}</StatusBadge>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(session?.role === 'buyer' && item.id === 'markets' ? '/buyer' : item.route)}
                  >
                    {t('landing.exploreFeature')} →
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="feature-section">
        <SectionHeading
          eyebrow="How AgriVoice Works"
          title="Built for Both Farmers and Produce Buyers"
          description="Role-separated dashboards, 23 Indian languages, and web AI voice assistance backed by PostgreSQL."
          align="center"
        />
        <div className="grid-3">
          <Card>
            <h3>1. Farmer Portal</h3>
            <p className="av-card-subtitle">
              Manage farms, monitor weather & crop advisories, submit soil lab reports, rent machinery, track schemes, and publish harvest lots.
            </p>
          </Card>
          <Card>
            <h3>2. Buyer Portal</h3>
            <p className="av-card-subtitle">
              Separate business workspace to browse verified farmer produce by crop, district, and price, send purchase requests, and track orders.
            </p>
          </Card>
          <Card>
            <h3>{t('landing.voiceTitle')}</h3>
            <p className="av-card-subtitle">
              Ask grounded questions about your farm weather, soil deficiencies, and inputs directly in the web assistant across 23 languages.
            </p>
          </Card>
        </div>
      </section>

      <section id="farmer-login" className="login-section">
        <div>
          <span className="eyebrow">{t('landing.loginEyebrow')}</span>
          <h2>{t('landing.loginTitle')}</h2>
          <p>{t('landing.loginDescription')}</p>
        </div>
        <div className="row-wrap">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate(isAuthenticated ? primaryDashboardRoute : '/login')}
          >
            {isAuthenticated
              ? session?.role === 'buyer'
                ? 'Open Buyer Portal'
                : t('landing.openDashboard')
              : t('landing.loginAction')}{' '}
            →
          </Button>
          {!isAuthenticated ? (
            <Button variant="secondary" size="lg" onClick={() => navigate('/login')}>
              Buyer Registration / Login →
            </Button>
          ) : null}
        </div>
      </section>
    </>
  );
}
