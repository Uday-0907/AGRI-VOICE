import { useTranslation } from 'react-i18next';
import { Card, SectionHeading } from '../../components/ui';
import VoiceAssistantPanel from './VoiceAssistantPanel';

export default function VoiceAssistantPage() {
  const { t } = useTranslation('common');

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
    </div>
  );
}
