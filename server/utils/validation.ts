import { z } from 'zod'

const trimmed = (label: string, max: number) => z.string({ required_error: `${label}不能为空` })
  .trim().min(1, `${label}不能为空`).max(max, `${label}过长`)

export const resolveConversationSchema = z.object({
  externalKey: trimmed('externalKey', 200),
  cas: trimmed('CAS号', 100),
  testProject: trimmed('检测项目', 200),
  confirmedContent: trimmed('确认内容', 20_000),
  sampleName: z.string().trim().max(200).optional().nullable(),
  sampleCode: z.string().trim().max(200).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable()
}).strict()

const apiBaseUrl = z.string().trim().min(1, 'API地址不能为空').max(500).refine((value) => {
  if (value.startsWith('mock://')) return true
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}, '请输入有效的 HTTP(S) 地址或 mock:// 地址')

export const modelConfigCreateSchema = z.object({
  name: trimmed('配置名称', 100),
  apiBaseUrl,
  apiKey: z.string().min(1, 'API密钥不能为空').max(2000),
  modelName: trimmed('模型名称', 200),
  temperature: z.coerce.number().min(0).max(2),
  maxOutputTokens: z.coerce.number().int().min(1).max(128_000),
  timeoutMs: z.coerce.number().int().min(1000).max(600_000),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false)
}).strict()

export const modelConfigUpdateSchema = modelConfigCreateSchema.extend({
  apiKey: z.string().max(2000).optional()
}).partial().refine((value) => Object.keys(value).length > 0, '没有可更新的字段')

export const settingsSchema = z.object({
  globalSystemPrompt: trimmed('全局系统提示词', 30_000),
  contextMaxMessages: z.coerce.number().int().min(4).max(200),
  contextMaxChars: z.coerce.number().int().min(2000).max(500_000)
}).strict()

export const generateSchema = z.object({
  mode: z.enum(['initial', 'message', 'regenerate']),
  content: z.string().trim().min(1).max(20_000).optional(),
  modelConfigId: z.string().trim().min(1).optional(),
  assistantMessageId: z.string().trim().min(1).optional()
}).superRefine((value, context) => {
  if (value.mode === 'message' && !value.content) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '消息内容不能为空', path: ['content'] })
  }
  if (value.mode === 'regenerate' && !value.assistantMessageId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '缺少要重新生成的消息', path: ['assistantMessageId'] })
  }
})

export function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message || '请求参数不正确'
}
