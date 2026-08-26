import { abortGeneration } from './model-adapter'

const registry = new Map<string, AbortController>()

export function registerGeneration(messageId: string, controller: AbortController) {
  registry.set(messageId, controller)
}

export function unregisterGeneration(messageId: string) {
  registry.delete(messageId)
}

export function stopRegisteredGeneration(messageId: string) {
  const controller = registry.get(messageId)
  if (!controller) return false
  abortGeneration(controller)
  return true
}
