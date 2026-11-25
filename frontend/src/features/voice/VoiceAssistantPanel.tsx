import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../app/providers/AuthProvider';
import { useRouter } from '../../app/routes/routes';
import { Button, Card, StatusBadge } from '../../components/ui';
import { askVoiceAssistant, type VoiceAssistantReply } from '../../services/voiceService';

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionCtor(): (new () => BrowserSpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export default function VoiceAssistantPanel({ onClose }: { onClose?: () => void }) {
  const { t, i18n } = useTranslation('common');
  const { session, signInDemo } = useAuth();
  const { navigate } = useRouter();

  const [query, setQuery] = useState('');
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<VoiceAssistantReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const SpeechRecognitionCtor = getSpeechRecognitionCtor();

  const runQuery = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const activeSession = session ?? signInDemo();

    setLoading(true);
    setError(null);
    try {
      const response = await askVoiceAssistant(activeSession, trimmed);
      setReply(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runQuery(query);
  };

  const handleToggleMic = () => {
    if (!SpeechRecognitionCtor) return;

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    const langCode = i18n.resolvedLanguage?.split('-')[0] ?? 'en';
    recognition.lang = `${langCode}-IN`;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setQuery(transcript);
        void runQuery(transcript);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const handleSpeakAloud = () => {
    if (!reply || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(reply.answer);
    const langCode = i18n.resolvedLanguage?.split('-')[0] ?? 'en';
    utterance.lang = `${langCode}-IN`;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const quickPrompts = [
    t('voice.promptWeather'),
    t('voice.promptSoil'),
    t('voice.promptAlerts'),
    t('voice.promptVerify'),
  ];

  return (
    <div className="stack-md">
      {onClose ? (
        <div className="row-between">
          <div>
            <span className="eyebrow">{t('voice.eyebrow')}</span>
            <h2 className="av-card-title" style={{ fontSize: 20, marginTop: 4 }}>
              {t('voice.title')}
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('navigation.close')} ✕
          </Button>
        </div>
      ) : null}

      <p style={{ margin: 0, color: 'var(--av-text-secondary)', fontSize: 14 }}>
        {t('voice.assistantGreeting')}
      </p>

      {!session ? (
        <div className="av-alert av-alert--info">
          <span>
            {t('dashboard.signInPromptDesc')}{' '}
            <button
              type="button"
              className="nav-link is-active"
              onClick={() => {
                onClose?.();
                navigate('/login');
              }}
            >
              {t('navigation.login')}
            </button>
          </span>
        </div>
      ) : null}

      <form className="stack-sm" onSubmit={handleSubmit}>
        <textarea
          aria-label={t('voice.inputPlaceholder')}
          className="av-textarea"
          rows={3}
          placeholder={t('voice.inputPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="row-wrap">
          <Button type="submit" variant="primary" loading={loading}>
            {t('voice.askButton')}
          </Button>

          {SpeechRecognitionCtor ? (
            <Button
              type="button"
              variant={listening ? 'danger' : 'secondary'}
              onClick={handleToggleMic}
            >
              {listening ? `⏹ ${t('voice.stopMic')}` : `🎙️ ${t('voice.startMic')}`}
            </Button>
          ) : null}
        </div>

        {!SpeechRecognitionCtor ? (
          <span className="av-field-hint">{t('voice.micUnsupported')}</span>
        ) : null}
      </form>

      <div className="stack-sm">
        <strong style={{ fontSize: 12.5, color: 'var(--av-muted)' }}>
          {t('voice.quickPromptsTitle')}
        </strong>
        <div className="row-wrap">
          {quickPrompts.map((prompt) => (
            <Button
              key={prompt}
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery(prompt);
                void runQuery(prompt);
              }}
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="av-alert av-alert--danger" role="alert">
          {error}
        </div>
      ) : null}

      {reply ? (
        <div className="voice-response-box stack-sm" aria-live="polite">
          <div className="row-between">
            <strong style={{ fontSize: 13 }}>{t('voice.responseLabel')}</strong>
            <StatusBadge tone="info">{reply.source}</StatusBadge>
          </div>
          <p style={{ margin: 0 }}>{reply.answer}</p>
          <div className="row-between">
            <small style={{ color: 'var(--av-muted)' }}>{t('voice.groundingNote')}</small>
            {typeof window !== 'undefined' && 'speechSynthesis' in window ? (
              <Button variant="secondary" size="sm" onClick={handleSpeakAloud}>
                🔊 {t('voice.speakResponse')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <Card tone="muted">
        <div className="stack-sm">
          <strong style={{ color: 'var(--av-dark-green)' }}>
            📞 {t('voice.helplineTitle')}
          </strong>
          <p className="av-card-subtitle" style={{ margin: 0 }}>
            {t('voice.helplineDesc')}
          </p>
          <StatusBadge tone="success">{t('voice.helplineCta')}</StatusBadge>
        </div>
      </Card>
    </div>
  );
}
