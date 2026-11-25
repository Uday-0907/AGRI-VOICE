import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../app/providers/AuthProvider';
import { useRouter } from '../../app/routes/routes';
import { Button, Card, SectionHeading, StatusBadge } from '../../components/ui';
import { ApiError } from '../../services/apiClient';
import {
  isValidE164Phone,
  isValidOtp,
  normalizeIndianPhone,
} from '../../services/authService';

export default function FarmerLoginPage() {
  const { t } = useTranslation('common');
  const { navigate } = useRouter();
  const { session, requestOtp, verifyOtp, signInDemo, signInWithToken, logout } = useAuth();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [jwtToken, setJwtToken] = useState('');
  const [showTokenDrawer, setShowTokenDrawer] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleRequestOtp = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const normalized = normalizeIndianPhone(phoneInput);
    if (!isValidE164Phone(normalized)) {
      setErrorMsg(t('auth.invalidPhone'));
      return;
    }

    setLoading(true);
    try {
      await requestOtp(normalized);
      setNormalizedPhone(normalized);
      setStep('otp');
      setInfoMsg(t('auth.otpSentMessage'));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 0)) {
        setNormalizedPhone(normalized);
        setInfoMsg(t('auth.backendAuthNotice'));
      } else {
        setErrorMsg(err instanceof Error ? err.message : t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!isValidOtp(otpInput)) {
      setErrorMsg(t('auth.invalidOtp'));
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(normalizedPhone || phoneInput, otpInput);
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 0)) {
        setInfoMsg(t('auth.backendAuthNotice'));
      } else {
        setErrorMsg(err instanceof Error ? err.message : t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    const candidate = normalizeIndianPhone(phoneInput || '+919876543201');
    signInDemo(isValidE164Phone(candidate) ? candidate : '+919876543201');
    navigate('/dashboard');
  };

  const handleTokenSubmit = (event: FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    if (jwtToken.trim().length < 10) {
      setErrorMsg('Please paste a valid JWT token.');
      return;
    }
    signInWithToken(jwtToken);
    navigate('/dashboard');
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
                <strong>{t('auth.signedInAs')}: {session.farmerProfile.fullName}</strong>
                <StatusBadge tone={session.mode === 'live' ? 'success' : 'warning'}>
                  {session.mode === 'live' ? t('common.liveDataBadge') : t('common.demoDataBadge')}
                </StatusBadge>
              </div>
              <span className="av-field-hint">
                {session.user.phone} · {t('auth.farmerLocation')}: {session.farmerProfile.village}, {session.farmerProfile.district}
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

        {infoMsg ? (
          <div className="av-alert av-alert--info" role="status">
            {infoMsg}
          </div>
        ) : null}

        <Card>
          {step === 'phone' ? (
            <form className="stack-md" onSubmit={handleRequestOtp}>
              <div className="av-field">
                <label htmlFor="farmer-phone">{t('auth.phoneLabel')}</label>
                <input
                  id="farmer-phone"
                  className="av-input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={t('auth.phonePlaceholder')}
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  required
                />
                <span className="av-field-hint">{t('auth.phoneHint')}</span>
              </div>

              <Button type="submit" variant="primary" fullWidth loading={loading}>
                {loading ? t('auth.sendingOtp') : t('auth.sendOtp')}
              </Button>
            </form>
          ) : (
            <form className="stack-md" onSubmit={handleVerifyOtp}>
              <div className="av-field">
                <label htmlFor="farmer-otp">{t('auth.otpLabel')}</label>
                <input
                  id="farmer-otp"
                  className="av-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={t('auth.otpPlaceholder')}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  required
                />
                <span className="av-field-hint">
                  {t('auth.otpHint')} ({normalizedPhone})
                </span>
              </div>

              <div className="row-wrap">
                <Button type="submit" variant="primary" loading={loading}>
                  {loading ? t('auth.verifyingOtp') : t('auth.verifyOtp')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep('phone');
                    setOtpInput('');
                    setErrorMsg(null);
                  }}
                >
                  {t('auth.changePhone')}
                </Button>
              </div>
            </form>
          )}
        </Card>

        <Card tone="muted">
          <div className="stack-sm">
            <h3 className="av-card-title">{t('auth.demoSectionTitle')}</h3>
            <p className="av-card-subtitle">{t('auth.demoSectionDescription')}</p>
            <div className="row-wrap" style={{ marginTop: 6 }}>
              <Button variant="secondary" onClick={handleDemoLogin}>
                {t('auth.demoLoginButton')} →
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTokenDrawer((v) => !v)}
              >
                {t('auth.tokenSectionToggle')}
              </Button>
            </div>

            {showTokenDrawer ? (
              <form className="stack-sm" onSubmit={handleTokenSubmit} style={{ marginTop: 12 }}>
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
                </div>
                <Button type="submit" variant="outline" size="sm">
                  {t('auth.tokenLoginButton')}
                </Button>
              </form>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
