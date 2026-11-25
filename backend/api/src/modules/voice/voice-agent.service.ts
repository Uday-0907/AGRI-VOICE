import { voiceDispatcher, VoiceSessionContext } from './dispatcher.js';
import { LlmMessage, LlmOrchestrator, LlmProviderName } from './llm.service.js';
import { registerPlatformVoiceTools } from './voice-tools-registry.js';

export interface VoiceAgentTurnResult {
  replyText: string;
  provider: LlmProviderName | 'fallback_error';
  model: string;
  toolNamesExecuted: string[];
  shouldEndCall: boolean;
  handoverRequested: boolean;
}

const SYSTEM_PROMPT = `You are AgriVoice, a helpful, concise voice assistant for Indian farmers.
Rules:
1. Respond in the same language as the farmer's utterance (Telugu-first if Telugu, or Hindi/English/other Indian language).
2. Keep spoken responses short, clear, and natural (2-4 sentences max, no markdown bullets).
3. ALWAYS use the provided backend tools to fetch farmer profile, weather, soil health, market prices, crop history, or buyer connections. Never invent numbers, weather, prices, or government approvals.
4. If a tool reports data is missing or an external government API is unavailable, state that honestly and clearly.
5. Before calling request_buyer_connection, confirm the crop, quantity, and buyer with the farmer first.`;

export class VoiceAgentService {
  private readonly llm: LlmOrchestrator;

  constructor(llm?: LlmOrchestrator) {
    registerPlatformVoiceTools();
    this.llm = llm || new LlmOrchestrator();
  }

  getLlmStatuses() {
    return this.llm.getProviderStatuses();
  }

  async handleTurn(
    session: VoiceSessionContext,
    userText: string,
    history: LlmMessage[] = [],
    signal?: AbortSignal
  ): Promise<VoiceAgentTurnResult> {
    const messages: LlmMessage[] = [...history, { role: 'user', content: userText }];
    const tools = voiceDispatcher.getTools();
    const executedSignatures = new Set<string>();
    const toolNamesExecuted: string[] = [];
    let shouldEndCall = false;
    let handoverRequested = false;
    let lastProvider: LlmProviderName | 'fallback_error' = 'gemini';
    let lastModel = 'none';

    try {
      for (let round = 0; round < 3; round++) {
        const res = await this.llm.generateWithFallback({
          systemPrompt: SYSTEM_PROMPT,
          messages,
          tools,
          temperature: 0.2,
          maxTokens: 350,
          signal,
        });

        lastProvider = res.provider;
        lastModel = res.model;

        if (!res.toolCalls.length) {
          return {
            replyText: res.text || 'సమాచారం అందుబాటులో ఉంది. ఇంకా ఏమైనా సహాయం కావాలా?',
            provider: lastProvider,
            model: lastModel,
            toolNamesExecuted,
            shouldEndCall,
            handoverRequested,
          };
        }

        messages.push({
          role: 'assistant',
          content: res.text || '',
          toolCalls: res.toolCalls,
        });

        for (const call of res.toolCalls) {
          const sig = `${call.name}:${JSON.stringify(call.arguments || {})}`;
          if (executedSignatures.has(sig)) {
            messages.push({
              role: 'tool',
              toolCallId: call.id,
              toolName: call.name,
              content: JSON.stringify({ skippedDuplicate: true }),
            });
            continue;
          }
          executedSignatures.add(sig);

          const execResult = await voiceDispatcher.dispatch(session, call.name, call.arguments || {});
          toolNamesExecuted.push(call.name);

          if (call.name === 'end_call' && execResult.success) {
            shouldEndCall = true;
          }
          if (call.name === 'request_human_assistance' && execResult.success) {
            handoverRequested = true;
          }

          messages.push({
            role: 'tool',
            toolCallId: call.id,
            toolName: call.name,
            content: JSON.stringify(execResult.success ? execResult.result : execResult.error),
          });
        }
      }

      return {
        replyText: 'క్షమించండి, మీ అభ్యర్థనను పూర్తి చేయలేకపోయాను. దయచేసి మళ్ళీ అడగండి.',
        provider: lastProvider,
        model: lastModel,
        toolNamesExecuted,
        shouldEndCall,
        handoverRequested,
      };
    } catch {
      return {
        replyText:
          'క్షమించండి, ప్రస్తుతం AI సహాయక సేవ అందుబాటులో లేదు. దయచేసి కొద్దిసేపటి తర్వాత మళ్ళీ ప్రయత్నించండి.',
        provider: 'fallback_error',
        model: 'none',
        toolNamesExecuted,
        shouldEndCall: false,
        handoverRequested: false,
      };
    }
  }
}
