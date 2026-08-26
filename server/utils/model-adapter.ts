import type { ModelConfig } from '@prisma/client'
import { decryptApiKey } from './crypto'

export type ChatRole = 'system' | 'user' | 'assistant'
export interface ChatInputMessage { role: ChatRole; content: string }
export type RunnableModelConfig = ModelConfig & { apiKey: string }

export class ModelServiceError extends Error {
  constructor(public code: string, message: string) {
    super(message)
    this.name = 'ModelServiceError'
  }
}

function mockAnswer(messages: ChatInputMessage[]) {
  const system = messages.map(item => item.content).join('\n')
  if (system.includes('请将下面新增的较早对话合并进已有摘要')) {
    return `### 实验参数\n- 保留原对话中已明确的检测项目、样品条件与参数范围。\n\n### 用户反馈\n- 已记录用户在较早轮次中的现象与偏好。\n\n### 已排除方案\n- 以原对话明确排除的方案为准；未明确内容不作推断。\n\n### 未解决问题\n- 仍需结合最近消息继续确认实验条件并由专业人员验证。`
  }

  const latestUser = [...messages].reverse().find(item => item.role === 'user')?.content || ''
  return `## 结论摘要\n\n已收到本次检测需求。建议先核对样品状态、目标物结构信息和现有仪器条件，再通过小范围筛选确定方法；以下内容属于初步实验设计建议。\n\n## 已知信息\n\n- 已确认的检测项目与 CAS 信息已纳入本次分析。\n- 当前关注：${latestUser.slice(0, 120)}\n\n## 缺失信息\n\n- 样品纯度预期、杂质类型与可用对照品情况。\n- 仪器型号、色谱柱库存及方法验收标准。\n\n## 推荐检测方法\n\n| 阶段 | 建议 | 目的 |\n| --- | --- | --- |\n| 初筛 | 采用与检测项目匹配的通用方法进行梯度筛选 | 观察主峰与杂质分离趋势 |\n| 确认 | 根据初筛结果收窄条件范围 | 提升重复性与分离度 |\n| 验证 | 进行专属性、重复性和稳定性检查 | 确认方法适用性 |\n\n## 样品前处理\n\n从低浓度、小体积开始验证溶解性，记录溶剂、浓度、超声时间与是否出现析出；避免把未知溶解性当作既定事实。\n\n## 风险点与优化建议\n\n1. 若出现峰形异常，依次排查溶剂效应、进样量和系统适配性。\n2. 若分离不足，建议在合规范围内小步调整流动相组成与梯度。\n3. 所有具体参数需由检测人员结合仪器和样品实测确认。\n\n> AI 建议仅供实验设计参考，必须由专业人员审核并经实验验证。`
}

async function* mockChat(messages: ChatInputMessage[], signal?: AbortSignal) {
  const answer = mockAnswer(messages)
  const chunks = answer.match(/[\s\S]{1,16}/g) || []
  const delayMs = messages.some(item => item.content.includes('[停止测试]')) ? 250 : 15
  for (const chunk of chunks) {
    if (signal?.aborted) throw new ModelServiceError('ABORTED', '生成已停止')
    await new Promise(resolve => setTimeout(resolve, delayMs))
    yield chunk
  }
}

function chatCompletionsUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, '')
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`
}

type ChatRequestConfig = Pick<ModelConfig, 'modelName' | 'temperature' | 'maxOutputTokens'>

export function chatRequestBody(config: ChatRequestConfig, messages: ChatInputMessage[], deepAnalysis = false) {
  return {
    model: config.modelName,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxOutputTokens,
    stream: true,
    enable_thinking: deepAnalysis
  }
}

async function* openAiChat(config: RunnableModelConfig, messages: ChatInputMessage[], signal?: AbortSignal, deepAnalysis = false) {
  const timeoutController = new AbortController()
  const timer = setTimeout(() => timeoutController.abort(), config.timeoutMs)
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal

  try {
    const response = await fetch(chatCompletionsUrl(config.apiBaseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(chatRequestBody(config, messages, deepAnalysis)),
      signal: combinedSignal
    })

    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw new ModelServiceError('AUTH_ERROR', '模型鉴权失败，请检查 API 密钥。')
      if (response.status === 429) throw new ModelServiceError('RATE_LIMITED', '模型服务请求过于频繁，请稍后重试。')
      throw new ModelServiceError('UPSTREAM_ERROR', `模型服务暂时不可用（HTTP ${response.status}）。`)
    }
    if (!response.body) throw new ModelServiceError('EMPTY_RESPONSE', '模型服务没有返回可读取的内容。')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
      const lines = buffer.split(/\r?\n/)
      buffer = done ? '' : (lines.pop() || '')
      for (const line of lines) {
        const value = line.trim()
        if (!value.startsWith('data:')) continue
        const data = value.slice(5).trim()
        if (!data || data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (typeof content === 'string') yield content
        } catch {
          // Ignore malformed keep-alive events without exposing upstream content.
        }
      }
      if (done) break
    }
  } catch (error) {
    if (error instanceof ModelServiceError) throw error
    if (signal?.aborted) throw new ModelServiceError('ABORTED', '生成已停止')
    if (timeoutController.signal.aborted) throw new ModelServiceError('TIMEOUT', '模型响应超时，请稍后重试。')
    throw new ModelServiceError('NETWORK_ERROR', '无法连接模型服务，请检查 API 地址和网络。')
  } finally {
    clearTimeout(timer)
  }
}

export function runnableModel(config: ModelConfig, masterKey: string): RunnableModelConfig {
  return { ...config, apiKey: decryptApiKey(config.apiKeyEncrypted, masterKey) }
}

export async function* chatStream(config: RunnableModelConfig, messages: ChatInputMessage[], signal?: AbortSignal, deepAnalysis = false) {
  if (config.apiBaseUrl.startsWith('mock://')) {
    yield* mockChat(messages, signal)
    return
  }
  yield* openAiChat(config, messages, signal, deepAnalysis)
}

export async function testConnection(config: RunnableModelConfig) {
  let output = ''
  for await (const chunk of chatStream(config, [{ role: 'user', content: '请只回复 OK' }])) {
    output += chunk
    if (output.length >= 2) break
  }
  return { ok: true, message: '连接成功' }
}

export function abortGeneration(controller: AbortController) {
  controller.abort()
}

export function normalizeModelError(error: unknown) {
  if (error instanceof ModelServiceError) return { code: error.code, message: error.message }
  return { code: 'UNKNOWN_ERROR', message: '生成失败，请稍后重试。' }
}
