import { beginGeneration, finishGeneration } from '../../../utils/generation'
import { generateSchema, validationMessage } from '../../../utils/validation'
import { selectModel } from '../../../utils/model-configs'
import { runnableModel, chatStream, normalizeModelError } from '../../../utils/model-adapter'
import { prepareContext } from '../../../utils/context'
import { prisma } from '../../../utils/prisma'
import { registerGeneration, unregisterGeneration } from '../../../utils/generation-registry'
import { getEncryptionMasterKey } from '../../../utils/runtime-secret'

export default defineEventHandler(async (event) => {
  const conversationId = getRouterParam(event, 'id')!
  const parsed = generateSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: validationMessage(parsed.error) })

  const existing = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: '会话不存在' })
  const modelConfig = await selectModel(parsed.data.modelConfigId || existing.currentModelConfigId)
  const model = runnableModel(modelConfig, getEncryptionMasterKey())

  const { assistant } = await beginGeneration({
    conversationId,
    mode: parsed.data.mode,
    content: parsed.data.content,
    assistantMessageId: parsed.data.assistantMessageId,
    modelConfigId: modelConfig.id,
    modelName: modelConfig.modelName
  })

  const encoder = new TextEncoder()
  const abortController = new AbortController()
  registerGeneration(assistant.id, abortController)
  const encodeEvent = (name: string, data: unknown) => encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)

  const stream = new ReadableStream({
    async start(controller) {
      let content = ''
      let lastSavedLength = 0
      controller.enqueue(encodeEvent('meta', {
        messageId: assistant.id,
        modelConfigId: modelConfig.id,
        modelName: modelConfig.modelName
      }))

      try {
        const conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } })
        const messages = await prisma.message.findMany({
          where: { conversationId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
        })
        const context = await prepareContext(conversation, messages.filter(item => item.id !== assistant.id), model, abortController.signal)

        for await (const chunk of chatStream(model, context, abortController.signal, parsed.data.deepAnalysis)) {
          content += chunk
          controller.enqueue(encodeEvent('delta', { content: chunk }))
          if (content.length - lastSavedLength >= 500) {
            lastSavedLength = content.length
            await prisma.message.update({ where: { id: assistant.id }, data: { content } })
          }
        }
        await finishGeneration({ conversationId, messageId: assistant.id, content, status: 'completed' })
        controller.enqueue(encodeEvent('done', { messageId: assistant.id, status: 'completed' }))
      } catch (error) {
        const normalized = normalizeModelError(error)
        const stopped = normalized.code === 'ABORTED'
        await finishGeneration({
          conversationId,
          messageId: assistant.id,
          content,
          status: stopped ? 'stopped' : 'failed',
          errorSummary: stopped ? null : normalized.message
        }).catch(() => undefined)
        controller.enqueue(encodeEvent(stopped ? 'done' : 'error', {
          messageId: assistant.id,
          status: stopped ? 'stopped' : 'failed',
          message: stopped ? '生成已停止' : normalized.message
        }))
      } finally {
        unregisterGeneration(assistant.id)
        controller.close()
      }
    },
    cancel() {
      abortController.abort()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
})
