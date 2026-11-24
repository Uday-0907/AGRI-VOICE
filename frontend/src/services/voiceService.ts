import { fetchVoiceSoilContext, verifyInputForVoice } from './soilService';
import { fetchWeatherAlerts, fetchWeatherDashboard } from './weatherService';
import type { AuthSession, InputCategory } from '../types/api';

export interface VoiceAssistantReply {
  answer: string;
  source: string;
  intent: 'weather' | 'alerts' | 'soil' | 'verify_input' | 'general';
}

function detectCategory(query: string): InputCategory {
  const q = query.toLowerCase();
  if (q.includes('seed')) return 'seed';
  if (q.includes('pesticide') || q.includes('spray')) return 'pesticide';
  if (q.includes('bio')) return 'bio_stimulant';
  return 'fertilizer';
}

function extractProductName(query: string): string {
  const cleaned = query
    .replace(/^(please\s+)?verify\s+(fertilizer|seed|pesticide|product|input)?\s*/i, '')
    .trim();
  return cleaned.length >= 2 ? cleaned : 'DemoBio Complex NPK 20-20-20';
}

export async function askVoiceAssistant(
  session: AuthSession,
  query: string
): Promise<VoiceAssistantReply> {
  const q = query.toLowerCase();

  if (q.includes('alert') || q.includes('warning') || q.includes('storm') || q.includes('rain warning')) {
    const alerts = await fetchWeatherAlerts(session);
    if (alerts.length === 0) {
      return {
        intent: 'alerts',
        source: session.mode === 'live' ? 'GET /weather/alerts' : 'Demo Weather Alerts',
        answer: 'No active weather alerts are currently issued for your registered farms.',
      };
    }
    const top = alerts[0];
    return {
      intent: 'alerts',
      source: session.mode === 'live' ? 'GET /weather/alerts' : 'Demo Weather Alerts',
      answer: `${alerts.length} active alert(s). Highest: ${top.headline} (${top.severity}). ${top.recommendedAction || top.description}`,
    };
  }

  if (q.includes('verify') || q.includes('fertilizer') || q.includes('seed') || q.includes('pesticide') || q.includes('batch')) {
    const productName = extractProductName(query);
    const category = detectCategory(query);
    const result = await verifyInputForVoice(session, {
      productName,
      category,
      providerMode: session.mode === 'demo' ? 'demo' : 'auto',
    });
    return {
      intent: 'verify_input',
      source: session.mode === 'live' ? 'POST /soil/voice/verify-input' : 'Demo Voice Input Verification',
      answer: `${result.productName} (${result.category}) status: ${result.status}. ${result.findingsSummary} ${result.aiGuidance}`,
    };
  }

  if (q.includes('soil') || q.includes('shc') || q.includes('npk') || q.includes('nutrient') || q.includes('ph')) {
    const soilCtx = await fetchVoiceSoilContext(session);
    if (!soilCtx.hasReport) {
      return {
        intent: 'soil',
        source: session.mode === 'live' ? 'GET /soil/voice/context' : 'Demo Voice Soil Context',
        answer: 'No Soil Health Card is linked to your profile yet. Open Soil Health -> Card Lookup to import your card.',
      };
    }
    const n = soilCtx.nutrients;
    const summaryParts = [
      `Soil Card ${soilCtx.cardId ?? soilCtx.reportId}`,
      n.ph !== null && n.ph !== undefined ? `pH ${n.ph}` : null,
      n.nitrogenKgPerHa !== null && n.nitrogenKgPerHa !== undefined ? `Nitrogen ${n.nitrogenKgPerHa} kg/ha` : null,
      n.phosphorusKgPerHa !== null && n.phosphorusKgPerHa !== undefined ? `Phosphorus ${n.phosphorusKgPerHa} kg/ha` : null,
      n.potassiumKgPerHa !== null && n.potassiumKgPerHa !== undefined ? `Potassium ${n.potassiumKgPerHa} kg/ha` : null,
    ].filter(Boolean);

    const missingText =
      soilCtx.missingMeasurements.length > 0
        ? ` Untested parameters: ${soilCtx.missingMeasurements.join(', ')}.`
        : '';

    return {
      intent: 'soil',
      source: session.mode === 'live' ? 'GET /soil/voice/context' : 'Demo Voice Soil Context',
      answer: `${summaryParts.join(', ')}.${missingText} ${soilCtx.aiGuidance}`,
    };
  }

  // Default to weather + crop advisory overview
  const weather = await fetchWeatherDashboard(session);
  const w = weather.currentWeather;
  const temp = w.temperature !== null ? `${w.temperature}°C` : 'N/A';
  const hum = w.humidity !== null ? `${w.humidity}%` : 'N/A';
  const topAdvisory = weather.advisories[0]?.advisoryText ?? 'No active advisories right now.';

  return {
    intent: 'weather',
    source: session.mode === 'live' ? 'GET /weather/dashboard' : 'Demo Weather Dashboard',
    answer: `For ${weather.farmName}: temperature is ${temp}, humidity ${hum}, rainfall ${w.rainfall} mm (${w.dataStatus}). Advisory: ${topAdvisory}`,
  };
}
