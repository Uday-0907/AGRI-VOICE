export type LlmProviderName = 'gemini' | 'claude' | 'openai';

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolCalls?: LlmToolCall[];
}

export interface LlmRequest {
  systemPrompt: string;
  messages: LlmMessage[];
  tools: LlmToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LlmResponse {
  provider: LlmProviderName;
  model: string;
  text: string;
  toolCalls: LlmToolCall[];
}

export class LlmProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: LlmProviderName,
    public readonly code: 'UNCONFIGURED' | 'INVALID_CREDENTIALS' | 'RATE_LIMITED' | 'TIMEOUT' | 'UPSTREAM_UNAVAILABLE' | 'BAD_REQUEST',
    public readonly statusCode?: number,
    public readonly fallbackEligible = true
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }
}

export interface ILlmProvider {
  readonly name: LlmProviderName;
  readonly model: string;
  isConfigured(): boolean;
  generate(request: LlmRequest): Promise<LlmResponse>;
}

function classifyLlmHttpError(provider: LlmProviderName, status: number, body: string): LlmProviderError {
  if (status === 401 || status === 403) {
    return new LlmProviderError(`${provider} credentials rejected (${status}).`, provider, 'INVALID_CREDENTIALS', status, true);
  }
  if (status === 429) {
    return new LlmProviderError(`${provider} rate limited (429).`, provider, 'RATE_LIMITED', status, true);
  }
  if (status >= 500) {
    return new LlmProviderError(`${provider} upstream error (${status}).`, provider, 'UPSTREAM_UNAVAILABLE', status, true);
  }
  return new LlmProviderError(`${provider} bad request (${status}): ${body.slice(0, 140)}`, provider, 'BAD_REQUEST', status, false);
}

async function fetchWithTimeout(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  provider: LlmProviderName,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new LlmProviderError(`${provider} request timed out after ${timeoutMs}ms.`, provider, 'TIMEOUT', undefined, true);
    }
    throw new LlmProviderError(`${provider} network error: ${err?.message || 'unknown'}`, provider, 'UPSTREAM_UNAVAILABLE', undefined, true);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onAbort);
  }
}

export class GeminiLlmProvider implements ILlmProvider {
  readonly name: LlmProviderName = 'gemini';
  readonly model: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options?: { model?: string; fetchFn?: typeof fetch; timeoutMs?: number }) {
    this.model = options?.model || 'gemini-3-flash-preview';
    this.fetchFn = options?.fetchFn ?? fetch;
    this.timeoutMs = options?.timeoutMs ?? 12000;
  }

  isConfigured(): boolean {
    const k = process.env.GEMINI_API_KEY?.trim();
    return Boolean(k && !k.includes('placeholder'));
  }

  async generate(request: LlmRequest): Promise<LlmResponse> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey.includes('placeholder')) {
      throw new LlmProviderError('GEMINI_API_KEY is not configured.', 'gemini', 'UNCONFIGURED', undefined, true);
    }

    const contents = request.messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: m.toolName || 'tool',
                response: { result: m.content },
              },
            },
          ],
        };
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'model',
          parts: m.toolCalls.map((tc) => ({
            functionCall: { name: tc.name, args: tc.arguments },
          })),
        };
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      };
    });

    const body: any = {
      systemInstruction: { parts: [{ text: request.systemPrompt }] },
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.2,
        maxOutputTokens: request.maxTokens ?? 400,
      },
    };

    if (request.tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: request.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetchWithTimeout(
      this.fetchFn,
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      this.timeoutMs,
      'gemini',
      request.signal
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw classifyLlmHttpError('gemini', res.status, text);
    }

    const data = (await res.json()) as any;
    const parts = data.candidates?.[0]?.content?.parts || [];
    const textParts: string[] = [];
    const toolCalls: LlmToolCall[] = [];

    for (const part of parts) {
      if (typeof part.text === 'string' && part.text.trim()) {
        textParts.push(part.text.trim());
      }
      if (part.functionCall?.name) {
        toolCalls.push({
          id: `gem-${Date.now()}-${toolCalls.length}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args || {},
        });
      }
    }

    return {
      provider: 'gemini',
      model: this.model,
      text: textParts.join(' ').trim(),
      toolCalls,
    };
  }
}

export class ClaudeLlmProvider implements ILlmProvider {
  readonly name: LlmProviderName = 'claude';
  readonly model: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options?: { model?: string; fetchFn?: typeof fetch; timeoutMs?: number }) {
    this.model = options?.model || 'claude-sonnet-4-20250514';
    this.fetchFn = options?.fetchFn ?? fetch;
    this.timeoutMs = options?.timeoutMs ?? 12000;
  }

  isConfigured(): boolean {
    const k = process.env.ANTHROPIC_API_KEY?.trim();
    return Boolean(k && !k.includes('placeholder'));
  }

  async generate(request: LlmRequest): Promise<LlmResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey || apiKey.includes('placeholder')) {
      throw new LlmProviderError('ANTHROPIC_API_KEY is not configured.', 'claude', 'UNCONFIGURED', undefined, true);
    }

    const messages = request.messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: m.toolCallId || 'tool-1', content: m.content }],
        };
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'assistant',
          content: m.toolCalls.map((tc) => ({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          })),
        };
      }
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
    });

    const body: any = {
      model: this.model,
      max_tokens: request.maxTokens ?? 400,
      temperature: request.temperature ?? 0.2,
      system: request.systemPrompt,
      messages,
    };

    if (request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const res = await fetchWithTimeout(
      this.fetchFn,
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      this.timeoutMs,
      'claude',
      request.signal
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw classifyLlmHttpError('claude', res.status, text);
    }

    const data = (await res.json()) as any;
    const blocks = Array.isArray(data.content) ? data.content : [];
    const textParts: string[] = [];
    const toolCalls: LlmToolCall[] = [];

    for (const block of blocks) {
      if (block.type === 'text' && typeof block.text === 'string') {
        textParts.push(block.text.trim());
      }
      if (block.type === 'tool_use' && block.name) {
        toolCalls.push({
          id: block.id || `cld-${Date.now()}-${toolCalls.length}`,
          name: block.name,
          arguments: block.input || {},
        });
      }
    }

    return {
      provider: 'claude',
      model: this.model,
      text: textParts.join(' ').trim(),
      toolCalls,
    };
  }
}

export class OpenAiLlmProvider implements ILlmProvider {
  readonly name: LlmProviderName = 'openai';
  readonly model: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options?: { model?: string; fetchFn?: typeof fetch; timeoutMs?: number }) {
    this.model = options?.model || 'gpt-4o-mini';
    this.fetchFn = options?.fetchFn ?? fetch;
    this.timeoutMs = options?.timeoutMs ?? 12000;
  }

  isConfigured(): boolean {
    const k = process.env.OPENAI_API_KEY?.trim();
    return Boolean(k && !k.includes('placeholder'));
  }

  async generate(request: LlmRequest): Promise<LlmResponse> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey || apiKey.includes('placeholder')) {
      throw new LlmProviderError('OPENAI_API_KEY is not configured.', 'openai', 'UNCONFIGURED', undefined, true);
    }

    const messages: any[] = [{ role: 'system', content: request.systemPrompt }];
    for (const m of request.messages) {
      if (m.role === 'tool') {
        messages.push({
          role: 'tool',
          tool_call_id: m.toolCallId || 'tool-1',
          content: m.content,
        });
      } else if (m.role === 'assistant' && m.toolCalls?.length) {
        messages.push({
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        });
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    }

    const body: any = {
      model: this.model,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 400,
      messages,
    };

    if (request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const res = await fetchWithTimeout(
      this.fetchFn,
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      this.timeoutMs,
      'openai',
      request.signal
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw classifyLlmHttpError('openai', res.status, text);
    }

    const data = (await res.json()) as any;
    const msg = data.choices?.[0]?.message || {};
    const toolCalls: LlmToolCall[] = Array.isArray(msg.tool_calls)
      ? msg.tool_calls.map((tc: any, idx: number) => {
          let parsedArgs = {};
          try {
            parsedArgs = typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function?.arguments || {};
          } catch {
            parsedArgs = {};
          }
          return {
            id: tc.id || `oai-${Date.now()}-${idx}`,
            name: tc.function?.name || '',
            arguments: parsedArgs,
          };
        })
      : [];

    return {
      provider: 'openai',
      model: this.model,
      text: (msg.content || '').trim(),
      toolCalls,
    };
  }
}

export class LlmOrchestrator {
  private readonly providers: ILlmProvider[];

  constructor(providers?: ILlmProvider[]) {
    const gemini = new GeminiLlmProvider();
    const claude = new ClaudeLlmProvider();
    const openai = new OpenAiLlmProvider();

    if (providers) {
      this.providers = providers;
    } else {
      const primary = (process.env.PRIMARY_LLM_PROVIDER || 'gemini').toLowerCase();
      const ordered =
        primary === 'claude'
          ? [claude, gemini, openai]
          : primary === 'openai'
          ? [openai, gemini, claude]
          : [gemini, claude, openai];
      const fallbackEnabled = process.env.LLM_FALLBACK_ENABLED !== 'false';
      this.providers = fallbackEnabled ? ordered : [ordered[0]];
    }
  }

  getProviderStatuses(): Array<{ name: LlmProviderName; model: string; configured: boolean }> {
    return this.providers.map((p) => ({
      name: p.name,
      model: p.model,
      configured: p.isConfigured(),
    }));
  }

  async generateWithFallback(request: LlmRequest): Promise<LlmResponse> {
    const errors: string[] = [];

    for (const provider of this.providers) {
      if (!provider.isConfigured()) {
        errors.push(`${provider.name}: unconfigured`);
        continue;
      }

      try {
        return await provider.generate(request);
      } catch (err) {
        if (err instanceof LlmProviderError) {
          errors.push(`${provider.name}: ${err.code}`);
          if (!err.fallbackEligible) {
            throw err;
          }
          continue;
        }
        errors.push(`${provider.name}: unknown_error`);
      }
    }

    throw new LlmProviderError(
      `All configured LLM providers failed (${errors.join(', ')}).`,
      this.providers[0]?.name || 'gemini',
      'UPSTREAM_UNAVAILABLE',
      503,
      false
    );
  }
}
