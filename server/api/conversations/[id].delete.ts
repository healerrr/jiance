import { deleteConversation } from '../../utils/conversations'

export default defineEventHandler(async (event) => {
  await deleteConversation(getRouterParam(event, 'id')!)
  return { ok: true }
})
