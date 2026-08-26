export interface ChatMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  status: 'pending' | 'generating' | 'completed' | 'stopped' | 'failed'
  modelConfigId?: string | null
  modelNameSnapshot?: string | null
  errorSummary?: string | null
  createdAt: string
}

export interface ConversationDetail {
  id: string
  externalKey: string
  title: string
  cas: string
  testProject: string
  sampleName?: string | null
  sampleCode?: string | null
  confirmedContent: string
  summary?: string | null
  status: string
  currentModelConfigId?: string | null
  currentModelName?: string | null
  generating: boolean
  activeGenerationId?: string | null
  createdAt: string
  updatedAt: string
  lastMessageAt: string
  messages: ChatMessage[]
}

export interface ModelConfigPublic {
  id: string
  name: string
  apiBaseUrl: string
  apiKeyMasked: string
  modelName: string
  temperature: number
  maxOutputTokens: number
  timeoutMs: number
  enabled: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}
