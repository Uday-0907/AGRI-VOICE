import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, SectionHeading, StatusBadge } from '../../components/ui';
import { apiRequest } from '../../services/apiClient';
import VoiceAssistantPanel from './VoiceAssistantPanel';

interface VoiceStatusInfo {
  wsEnabled: boolean;
  wsPath: string;
  sarvamConfigured: boolean;
  exotelConfigured: boolean;
  llmProviders: Array<{ name: string; model: string; configured: boolean }>;
  supportedLanguages: string[];
}

export default function VoiceAssistantPage() {
  const { t } = useTranslation('common');
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatusInfo | null>(null);

  useEffect(() => {
    void apiRequest<{ data: VoiceStatusInfo }>('/voice/status')
      .then((res) => setVoiceStatus(res.data))
      .catch(() => setVoiceStatus(null));
  }, []);

  return (
    <div className="page-container stack-md">
      <SectionHeading
        eyebrow={t('voice.eyebrow')}
        title={t('voice.title')}
        description={t('voice.subtitle')}
        as="h1"
      />
      <Card>
        <VoiceAssistantPanel />
      </Card>

      <Card tone="muted">
        <CardHeader
          title="Phone Voice Agent & Language Readiness"
          subtitle="Web AI assistance runs over authenticated HTTPS APIs; inbound telephone calls use Exotel Voicebot Applet (WSS) + Sarvam Speech."
          action={
            <StatusBadge tone={voiceStatus?.wsEnabled ? 'info' : 'warning'}>
              {voiceStatus?.wsEnabled ? `WS Ready (${voiceStatus.wsPath})` : 'Web Mode Only'}
            </StatusBadge>
          }
        />
        {voiceStatus ? (
          <div className="row-wrap">
            <StatusBadge tone={voiceStatus.sarvamConfigured ? 'success' : 'warning'}>
              Sarvam Speech: {voiceStatus.sarvamConfigured ? 'Configured' : 'Pending Key'}
            </StatusBadge>
            <StatusBadge tone={voiceStatus.exotelConfigured ? 'success' : 'warning'}>
              Exotel Telephony: {voiceStatus.exotelConfigured ? 'Configured' : 'Pending Activation'}
            </StatusBadge>
            <StatusBadge tone="info">
              Supported Telephony Languages: {voiceStatus.supportedLanguages.join(', ')}
            </StatusBadge>
          </div>
        ) : (
          <p className="av-card-subtitle">
            Voice status unavailable while offline. Text-based web queries remain available when connected to the backend.
          </p>
        )}
      </Card>
    </div>
  );
}
