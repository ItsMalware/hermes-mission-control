export interface DefaultModel {
  name: string
  provider: string
  model: string
  baseUrl: string
}

const DEFAULT_MODELS: DefaultModel[] = [
  // ── OpenRouter ──
  {
    name: 'Claude Sonnet 4',
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4-20250514',
    baseUrl: '',
  },
  // ── Anthropic (direct) ──
  {
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    baseUrl: '',
  },
  // ── OpenAI (direct) ──
  {
    name: 'GPT-4.1',
    provider: 'openai',
    model: 'gpt-4.1',
    baseUrl: '',
  },
  {
    name: 'ChatGPT Codex',
    provider: 'openai-codex',
    model: 'gpt-5.3-codex',
    baseUrl: '',
  },
  // ── Google (OAuth) ──
  {
    name: 'Gemini 3.1 Pro (High)',
    provider: 'google-gemini-cli',
    model: 'gemini-3.1-pro-preview',
    baseUrl: '',
  },
  // ── Ollama Cloud ──
  {
    name: 'glm-5.1',
    provider: 'ollama-cloud',
    model: 'glm-5.1',
    baseUrl: 'https://ollama.com/v1',
  },
  // ── Atlas Cloud ──
  {
    name: 'DeepSeek V4 Pro (Atlas Cloud)',
    provider: 'atlascloud',
    model: 'deepseek-ai/deepseek-v4-pro',
    baseUrl: '',
  },
  {
    name: 'DeepSeek V4 Flash (Atlas Cloud)',
    provider: 'atlascloud',
    model: 'deepseek-ai/deepseek-v4-flash',
    baseUrl: '',
  },
  {
    name: 'Qwen3-235B Instruct (Atlas Cloud)',
    provider: 'atlascloud',
    model: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
    baseUrl: '',
  },
]

export default DEFAULT_MODELS
