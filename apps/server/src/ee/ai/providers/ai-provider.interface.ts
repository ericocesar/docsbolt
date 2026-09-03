/**
 * AI provider abstraction. Implementations may target OpenAI, OpenAI-compatible
 * endpoints (Azure, OpenRouter), Gemini, or Ollama. Docmost wires the right
 * implementation through `AiProviderFactory` based on env (`AI_DRIVER`).
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  /** Internal alias used by callers; serialised as `tool_calls` when sent to provider. */
  toolCalls?: ChatToolCall[];
}

export interface ChatToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: ChatTool[];
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  signal?: AbortSignal;
}

export interface ChatResponseChunk {
  /** Incremental text delta. Empty string means no new content in this chunk. */
  contentDelta: string;
  /** Incremental tool-call delta. Empty array means no tool calls in this chunk. */
  toolCallDeltas: ChatToolCall[];
  /** Provider-specific finish reason when the stream terminates. */
  finishReason?: string;
  /** Token usage if the provider surfaces it in the final chunk. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface EmbeddingRequest {
  model: string;
  /** Input strings to embed. Providers batch these — keep ≤ provider limit. */
  input: string[];
  /** Target dimension when the model supports MRL truncation. */
  dimensions?: number;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage?: { promptTokens?: number; totalTokens?: number };
}

export interface AiProvider {
  /** Streaming chat completion. Yields chunks then resolves on stream end. */
  streamChat(req: ChatRequest): AsyncIterable<ChatResponseChunk>;

  /** Single-shot chat completion (no streaming). */
  chat(req: ChatRequest): Promise<{
    content: string;
    toolCalls: ChatToolCall[];
    finishReason?: string;
    usage?: ChatResponseChunk['usage'];
  }>;

  /** Generate embeddings for the given input strings. */
  embed(req: EmbeddingRequest): Promise<EmbeddingResponse>;
}
