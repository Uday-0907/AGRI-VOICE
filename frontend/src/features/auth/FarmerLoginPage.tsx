import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../app/providers/AuthProvider';
import { useRouter } from '../../app/routes/routes';
import { Button, Card, SectionHeading, StatusBadge } from '../../components/ui';
import { ApiError } from '../../services/apiClient';

export default function FarmerLoginPage() {
  const { t } = useTranslation('common');
  const { navigate } = useRouter();
  const {
    session,
    authLoading,
    authError,
    clerkAdapter,
    signInDemo,
    signInWithToken,
    completeClerkOnboarding,
    retryClerkExchange,
    logout,
  } = useAuth();

  const [jwtToken, setJwtToken] = useState('');
  const [showTokenDrawer, setShowTokenDrawer] = useState(false);
  const [submittingToken, setSubmittingToken] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [onboardRole, setOnboardRole] = useState<'farmer' | 'buyer'>('farmer');
  // Farmer onboarding state when Clerk is signed in but not yet linked
  const [onboardName, setOnboardName] = useState('');
  const [onboardPhone, setOnboardPhone] = useState('');
  const [onboardState, setOnboardState] = useState('Andhra Pradesh');
  const [onboardDistrict, setOnboardDistrict] = useState('');
  const [onboardMandal, setOnboardMandal] = useState('');
  const [onboardVillage, setOnboardVillage] = useState('');
  const [onboardPin, setOnboardPin] = useState('');
  const [onboardFarm, setOnboardFarm] = useState('');
  const [onboardArea, setOnboardArea] = useState('2.5');
  // Buyer onboarding state
  const [bizName, setBizName] = useState('');
  const [bizType, setBizType] = useState('wholesaler');
  const [bizCity, setBizCity] = useState('');
  const [bizGst, setBizGst] = useState('');
  const [onboardingBusy, setOnboardingBusy] = useState(false);

  useEffect(() => {
    if (session?.mode === 'live') {
      navigate(session.role === 'buyer' ? '/buyer' : '/dashboard');
    }
  }, [session?.mode, session?.role, navigate]);

  const handleDemoLogin = () => {
    signInDemo('+919876543201');
    navigate('/dashboard');
  };

  const handleTokenSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    if (jwtToken.trim().length < 10) {
      setErrorMsg('Please enter a valid JWT bearer token.');
      return;
    }

    setSubmittingToken(true);
    try {
      await signInWithToken(jwtToken.trim());
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(`${err.code}: ${err.message}`);
      } else {
        setErrorMsg(err instanceof Error ? err.message : t('common.error'));
      }
    } finally {
      setSubmittingToken(false);
    }
  };

  const handleOnboardingSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    setOnboardingBusy(true);
    try {
      const nextSession = await completeClerkOnboarding(
        onboardRole === 'buyer'
          ? {
              role: 'buyer',
              businessName: bizName.trim(),
              contactName: onboardName.trim(),
              businessType: bizType,
              phone: onboardPhone.trim(),
              state: onboardState.trim(),
              district: onboardDistrict.trim(),
              city: bizCity.trim(),
              pinCode: onboardPin.trim(),
              gstOrLicenseNumber: bizGst.trim() || undefined,
            }
          : {
              role: 'farmer',
              fullName: onboardName.trim(),
              phone: onboardPhone.trim(),
              preferredLanguage: 'en',
              state: onboardState.trim(),
              district: onboardDistrict.trim(),
              mandal: onboardMandal.trim(),
              village: onboardVillage.trim(),
              pinCode: onboardPin.trim(),
              farmName: onboardFarm.trim() || undefined,
              totalAreaAcres: onboardArea ? Number(onboardArea) : undefined,
            }
      );
      navigate(nextSession.role === 'buyer' ? '/buyer' : '/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(`${err.code}: ${err.message}`);
      } else {
        setErrorMsg(err instanceof Error ? err.message : t('common.error'));
      }
    } finally {
      setOnboardingBusy(false);
    }
  };

  return (
    <div className="page-container">
      <div className="auth-shell stack-md">
        <SectionHeading
          eyebrow={t('auth.eyebrow')}
          title={t('auth.title')}
          description={t('auth.subtitle')}
          as="h1"
        />

        {session ? (
          <Card tone="accent">
            <div className="stack-sm">
              <div className="row-between">
                <strong>
                  {t('auth.alreadySignedIn')}:{' '}
                  {session.farmerProfile?.fullName ?? session.user.phone}
                </strong>
                <StatusBadge tone={session.mode === 'live' ? 'success' : 'warning'}>
                  {session.mode === 'live' ? t('common.liveDataBadge') : t('common.demoDataBadge')}
                </StatusBadge>
              </div>
              <span className="av-field-hint">
                {session.user.phone}
                {session.farmerProfile
                  ? ` · ${t('auth.farmerLocation')}: ${session.farmerProfile.village}, ${session.farmerProfile.district}`
                  : ''}
              </span>
              <div className="row-wrap">
                <Button variant="primary" onClick={() => navigate('/dashboard')}>
                  {t('landing.openDashboard')} →
                </Button>
                <Button variant="outline" onClick={logout}>
                  {t('navigation.logout')}
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {errorMsg ? (
          <div className="av-alert av-alert--danger" role="alert">
            {errorMsg}
          </div>
        ) : null}

        {authError ? (
          <div className="av-alert av-alert--danger" role="alert">
            <div>
              <strong>{authError.code}:</strong> {authError.message}
            </div>
            {clerkAdapter?.isSignedIn ? (
              <div className="row-wrap" style={{ marginTop: 8 }}>
                <Button variant="outline" size="sm" onClick={retryClerkExchange}>
                  {t('common.retry')}
                </Button>
                <Button variant="ghost" size="sm" onClick={logout}>
                  {t('navigation.logout')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <Card>
          <div className="stack-md">
            <div>
              <h3 className="av-card-title">Live Farmer Account Sign-In</h3>
              <p className="av-card-subtitle">
                Authenticate via Clerk to exchange your verified identity for an AgriVoice backend
                session (`POST /auth/clerk/exchange`).
              </p>
            </div>

            {clerkAdapter ? (
              <div className="row-wrap">
                {clerkAdapter.isSignedIn ? (
                  <>
                    <StatusBadge tone="info">
                      Clerk signed in ({clerkAdapter.displayName || 'Account'})
                    </StatusBadge>
                    {authLoading ? (
                      <span className="av-field-hint">Exchanging session with backend…</span>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={logout}>
                      {t('navigation.logout')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      onClick={() => clerkAdapter.openSignIn()}
                      disabled={!clerkAdapter.isLoaded || authLoading}
                    >
                      Sign In with Clerk →
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => clerkAdapter.openSignUp()}
                      disabled={!clerkAdapter.isLoaded || authLoading}
                    >
                      Create Account
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="av-alert av-alert--info" role="status">
                Clerk sign-in provider is not configured in this environment. Preview offline demo mode below.
              </div>
            )}

            {clerkAdapter?.isSignedIn && authError?.code === 'FARMER_NOT_LINKED' ? (
              <form className="stack-sm" onSubmit={handleOnboardingSubmit}>
                <h4 className="av-card-title">Complete Account Registration</h4>
                <p className="av-card-subtitle">
                  Choose your AgriVoice role to link your Clerk account to a Farmer or Buyer profile in PostgreSQL.
                </p>
                <div className="row-wrap">
                  <Button
                    type="button"
                    variant={onboardRole === 'farmer' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setOnboardRole('farmer')}
                  >
                    I am a Farmer
                  </Button>
                  <Button
                    type="button"
                    variant={onboardRole === 'buyer' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setOnboardRole('buyer')}
                  >
                    I am a Produce Buyer
                  </Button>
                </div>
                <div className="grid-2">
                  <div className="av-field">
                    <label htmlFor="onboard-name">{onboardRole === 'buyer' ? 'Contact Person Name' : 'Full Name'}</label>
                    <input id="onboard-name" className="av-input" required value={onboardName} onChange={(e) => setOnboardName(e.target.value)} />
                  </div>
                  <div className="av-field">
                    <label htmlFor="onboard-phone">Mobile Number (10-digit or +91)</label>
                    <input id="onboard-phone" className="av-input" required placeholder="+919876543210" value={onboardPhone} onChange={(e) => setOnboardPhone(e.target.value)} />
                  </div>
                  {onboardRole === 'buyer' ? (
                    <>
                      <div className="av-field">
                        <label htmlFor="onboard-biz">Business / Firm Name</label>
                        <input id="onboard-biz" className="av-input" required value={bizName} onChange={(e) => setBizName(e.target.value)} />
                      </div>
                      <div className="av-field">
                        <label htmlFor="onboard-biz-type">Business Type</label>
                        <select id="onboard-biz-type" className="av-select" value={bizType} onChange={(e) => setBizType(e.target.value)}>
                          <option value="wholesaler">Wholesaler / Mandi Trader</option>
                          <option value="processor">Agro Processor / Mill</option>
                          <option value="exporter">Exporter</option>
                          <option value="fpo_buyer">FPO / Institutional Buyer</option>
                        </select>
                      </div>
                      <div className="av-field">
                        <label htmlFor="onboard-city">City</label>
                        <input id="onboard-city" className="av-input" required value={bizCity} onChange={(e) => setBizCity(e.target.value)} />
                      </div>
                      <div className="av-field">
                        <label htmlFor="onboard-gst">GST / Mandi License (Optional)</label>
                        <input id="onboard-gst" className="av-input" value={bizGst} onChange={(e) => setBizGst(e.target.value)} />
                      </div>
                    </>
                  ) : null}
                  <div className="av-field">
                    <label htmlFor="onboard-state">State</label>
                    <input id="onboard-state" className="av-input" required value={onboardState} onChange={(e) => setOnboardState(e.target.value)} />
                  </div>
                  <div className="av-field">
                    <label htmlFor="onboard-district">District</label>
                    <input id="onboard-district" className="av-input" required value={onboardDistrict} onChange={(e) => setOnboardDistrict(e.target.value)} />
                  </div>
                  {onboardRole === 'farmer' ? (
                    <>
                      <div className="av-field">
                        <label htmlFor="onboard-mandal">Mandal / Taluka</label>
                        <input id="onboard-mandal" className="av-input" required value={onboardMandal} onChange={(e) => setOnboardMandal(e.target.value)} />
                      </div>
                      <div className="av-field">
                        <label htmlFor="onboard-village">Village</label>
                        <input id="onboard-village" className="av-input" required value={onboardVillage} onChange={(e) => setOnboardVillage(e.target.value)} />
                      </div>
                    </>
                  ) : null}
                  <div className="av-field">
                    <label htmlFor="onboard-pin">PIN Code</label>
                    <input id="onboard-pin" className="av-input" required value={onboardPin} onChange={(e) => setOnboardPin(e.target.value)} />
                  </div>
                  {onboardRole === 'farmer' ? (
                    <>
                      <div className="av-field">
                        <label htmlFor="onboard-farm">Primary Farm Name (Optional)</label>
                        <input id="onboard-farm" className="av-input" placeholder="e.g. Main Paddy Plot" value={onboardFarm} onChange={(e) => setOnboardFarm(e.target.value)} />
                      </div>
                      <div className="av-field">
                        <label htmlFor="onboard-area">Farm Area (Acres)</label>
                        <input id="onboard-area" className="av-input" type="number" step="0.1" min="0.1" value={onboardArea} onChange={(e) => setOnboardArea(e.target.value)} />
                      </div>
                    </>
                  ) : null}
                </div>
                <Button type="submit" variant="primary" loading={onboardingBusy}>
                  {onboardRole === 'buyer' ? 'Complete Buyer Registration →' : 'Complete Farmer Profile & Open Dashboard →'}
                </Button>
              </form>
            ) : null}

            {import.meta.env.DEV ? (
              <>
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTokenDrawer((v) => !v)}
                  >
                    {t('auth.tokenSectionToggle')}
                  </Button>
                </div>

                {showTokenDrawer ? (
                  <form className="stack-sm" onSubmit={handleTokenSubmit}>
                    <div className="av-field">
                      <label htmlFor="dev-jwt-token">{t('auth.tokenLabel')}</label>
                      <input
                        id="dev-jwt-token"
                        className="av-input"
                        type="password"
                        placeholder={t('auth.tokenPlaceholder')}
                        value={jwtToken}
                        onChange={(e) => setJwtToken(e.target.value)}
                      />
                      <span className="av-field-hint">
                        Development-only: verified live against <code>GET /auth/me</code> before starting a session.
                      </span>
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      loading={submittingToken}
                    >
                      {t('auth.tokenLoginButton')}
                    </Button>
                  </form>
                ) : null}
              </>
            ) : null}
          </div>
        </Card>

        <Card tone="muted">
          <div className="stack-sm">
            <h3 className="av-card-title">{t('auth.demoSectionTitle')}</h3>
            <p className="av-card-subtitle">{t('auth.demoSectionDescription')}</p>
            <div className="row-wrap" style={{ marginTop: 6 }}>
              <Button variant="secondary" onClick={handleDemoLogin}>
                {t('auth.demoLoginButton')} →
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
