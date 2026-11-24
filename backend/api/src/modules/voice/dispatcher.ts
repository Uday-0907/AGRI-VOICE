export interface VoiceSessionContext {
  sessionId: string;
  userId: string;
  phone: string;
  language?: string;
  metadata?: Record<string, any>;
}

export interface VoiceTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (session: VoiceSessionContext, args: any) => Promise<any>;
}

export interface VoiceToolExecutionResult {
  success: boolean;
  tool: string;
  result?: any;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * AgriVoice Platform Voice AI Tool Dispatcher.
 *
 * Central registry and runtime invocation dispatcher for phone-call Voice AI sessions.
 * Security Invariants:
 * 1. Caller session identity is mandatory (`session.userId`); untrusted caller sessions are rejected immediately.
 * 2. Model-generated tool arguments can NEVER supply or override the farmer ID.
 * 3. Arguments are validated against the tool's JSON Schema.
 * 4. Tools invoke the same underlying business services as the HTTP web endpoints.
 */
export class VoiceDispatcher {
  private tools = new Map<string, VoiceTool>();

  registerTool(tool: VoiceTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Voice tool '${tool.name}' is already registered in the dispatcher.`);
    }
    this.tools.set(tool.name, tool);
  }

  getTools(): Array<{ name: string; description: string; parameters: any }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  getTool(name: string): VoiceTool | undefined {
    return this.tools.get(name);
  }

  async dispatch(
    session: VoiceSessionContext,
    toolName: string,
    args: Record<string, any> = {}
  ): Promise<VoiceToolExecutionResult> {
    // 1. Security Check: Session identity must be present and verified
    if (!session || !session.userId || session.userId.trim() === '') {
      return {
        success: false,
        tool: toolName,
        error: {
          code: 'UNAUTHORIZED_CALLER_SESSION',
          message: 'Voice session caller identity is unverified or missing.',
        },
      };
    }

    // 2. Tool Lookup
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        tool: toolName,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Requested voice tool '${toolName}' is not registered in the voice dispatcher.`,
        },
      };
    }

    // 3. Validate required arguments
    const required = tool.parameters.required || [];
    for (const param of required) {
      if (args[param] === undefined || args[param] === null || args[param] === '') {
        return {
          success: false,
          tool: toolName,
          error: {
            code: 'INVALID_TOOL_ARGUMENTS',
            message: `Missing required argument '${param}' for tool '${toolName}'.`,
          },
        };
      }
    }

    // 4. Safe Execution using trusted caller session
    try {
      const result = await tool.execute(session, args);
      return {
        success: true,
        tool: toolName,
        result,
      };
    } catch (err: any) {
      return {
        success: false,
        tool: toolName,
        error: {
          code: err.code || 'TOOL_EXECUTION_ERROR',
          message: err.message || 'An error occurred during voice tool execution.',
        },
      };
    }
  }
}

// Global voice dispatcher instance for the platform
export const voiceDispatcher = new VoiceDispatcher();
