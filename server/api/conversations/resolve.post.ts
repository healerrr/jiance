import { resolveConversation } from '../../utils/conversations'
import { resolveConversationSchema, validationMessage } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const parsed = resolveConversationSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: validationMessage(parsed.error) })
  const { conversation, created } = await resolveConversation(parsed.data)
  return {
    conversationId: conversation.id,
    chatUrl: `/chat/${conversation.id}`,
    created
  }
})
