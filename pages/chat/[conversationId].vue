<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ChatMessage, ConversationDetail, ModelConfigPublic } from '~/types/app'

const route = useRoute()
const router = useRouter()
const conversationId = route.params.conversationId as string
const { data: conversation, pending, error, refresh } = await useFetch<ConversationDetail>(`/api/conversations/${conversationId}`)
const { data: models } = await useFetch<ModelConfigPublic[]>('/api/models')
const input = ref('')
const selectedModelId = ref('')
const generating = ref(false)
const activeMessageId = ref<string | null>(null)
const initialAttempted = ref(false)
const messagesViewport = ref<HTMLElement | null>(null)

const enabledModels = computed(() => (models.value || []).filter(item => item.enabled))
const canSend = computed(() => Boolean(input.value.trim()) && !generating.value && Boolean(selectedModelId.value))

watchEffect(() => {
  if (!selectedModelId.value && models.value?.length) {
    selectedModelId.value = conversation.value?.currentModelConfigId
      || models.value.find(item => item.isDefault && item.enabled)?.id
      || enabledModels.value[0]?.id
      || ''
  }
})

function scrollToBottom() {
  nextTick(() => messagesViewport.value?.scrollTo({ top: messagesViewport.value.scrollHeight, behavior: 'smooth' }))
}

function parseApiError(payload: any) {
  return payload?.statusMessage || payload?.message || '请求失败，请稍后重试。'
}

async function consumeSse(response: Response) {
  if (!response.ok) {
    let payload: unknown
    try { payload = await response.json() } catch { payload = null }
    throw new Error(parseApiError(payload))
  }
  if (!response.body) throw new Error('服务器未返回流式内容。')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = done ? '' : (blocks.pop() || '')
    for (const block of blocks) {
      let eventName = 'message'
      let data: any = {}
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim()
        if (line.startsWith('data:')) {
          try { data = JSON.parse(line.slice(5).trim()) } catch { data = {} }
        }
      }
      if (eventName === 'meta') {
        activeMessageId.value = data.messageId
        const existing = conversation.value?.messages.find(item => item.id === data.messageId)
        if (!existing && conversation.value) {
          conversation.value.messages.push({
            id: data.messageId,
            conversationId,
            role: 'assistant',
            content: '',
            status: 'generating',
            modelConfigId: data.modelConfigId,
            modelNameSnapshot: data.modelName,
            createdAt: new Date().toISOString()
          })
        }
      } else if (eventName === 'delta') {
        const target = conversation.value?.messages.find(item => item.id === activeMessageId.value)
        if (target) target.content += data.content || ''
        scrollToBottom()
      } else if (eventName === 'done') {
        const target = conversation.value?.messages.find(item => item.id === data.messageId)
        if (target) target.status = data.status
      } else if (eventName === 'error') {
        const target = conversation.value?.messages.find(item => item.id === data.messageId)
        if (target) {
          target.status = 'failed'
          target.errorSummary = data.message
        }
        ElMessage.error(data.message || '生成失败，请重试。')
      }
    }
    if (done) break
  }
}

async function startGeneration(body: Record<string, unknown>, optimisticUser?: string) {
  if (generating.value) return
  generating.value = true
  if (optimisticUser && conversation.value) {
    conversation.value.messages.push({
      id: `local-${Date.now()}`,
      conversationId,
      role: 'user',
      content: optimisticUser,
      status: 'completed',
      createdAt: new Date().toISOString()
    })
    scrollToBottom()
  }
  try {
    const response = await fetch(`/api/conversations/${conversationId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, modelConfigId: selectedModelId.value })
    })
    await consumeSse(response)
  } catch (requestError: any) {
    if (!String(requestError?.message).includes('首次回答已经生成')) {
      ElMessage.error(requestError?.message || '生成请求失败')
    }
  } finally {
    generating.value = false
    activeMessageId.value = null
    await refresh()
    scrollToBottom()
  }
}

async function sendMessage() {
  const content = input.value.trim()
  if (!content || !canSend.value) return
  input.value = ''
  await startGeneration({ mode: 'message', content }, content)
}

async function stopGeneration() {
  if (!activeMessageId.value) return
  await $fetch(`/api/messages/${activeMessageId.value}/stop`, { method: 'POST' })
}

async function regenerate(messageId: string) {
  await startGeneration({ mode: 'regenerate', assistantMessageId: messageId })
}

async function copyAnswer(content: string) {
  await navigator.clipboard.writeText(content)
  ElMessage.success('回答已复制')
}

async function deleteCurrentConversation() {
  await ElMessageBox.confirm('该会话、全部消息和摘要将被永久删除。', '再次确认删除', {
    confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning'
  })
  await $fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' })
  ElMessage.success('会话已删除')
  await router.push('/history')
}

watch(() => conversation.value, (value) => {
  if (!value || initialAttempted.value || pending.value) return
  const hasAssistant = value.messages.some(item => item.role === 'assistant')
  if (!hasAssistant && !value.generating && selectedModelId.value) {
    initialAttempted.value = true
    startGeneration({ mode: 'initial' })
  }
}, { immediate: true, deep: true })

watch(selectedModelId, (value) => {
  if (!initialAttempted.value && conversation.value && !conversation.value.messages.some(item => item.role === 'assistant') && value) {
    initialAttempted.value = true
    startGeneration({ mode: 'initial' })
  }
})
</script>

<template>
  <div v-if="pending" class="loading-page" v-loading="true" />
  <div v-else-if="error || !conversation" class="not-found-panel">
    <span>404</span><h1>没有找到这个会话</h1><NuxtLink to="/history">返回历史记录</NuxtLink>
  </div>
  <section v-else class="chat-page">
    <aside class="conversation-panel">
      <div class="conversation-panel-scroll">
        <NuxtLink class="back-link" to="/history">← 返回历史记录</NuxtLink>
        <div class="conversation-kicker">检测档案</div>
        <h1>{{ conversation.title }}</h1>
        <p class="external-key">{{ conversation.externalKey }}</p>

        <dl class="sample-facts">
          <div><dt>CAS 号</dt><dd>{{ conversation.cas }}</dd></div>
          <div><dt>检测项目</dt><dd>{{ conversation.testProject }}</dd></div>
          <div v-if="conversation.sampleName"><dt>样品名称</dt><dd>{{ conversation.sampleName }}</dd></div>
          <div v-if="conversation.sampleCode"><dt>样品编号</dt><dd>{{ conversation.sampleCode }}</dd></div>
        </dl>

        <div class="confirmed-note">
          <span>已确认需求</span>
          <p>{{ conversation.confirmedContent }}</p>
        </div>
      </div>

      <div class="conversation-panel-footer" data-testid="conversation-panel-footer">
        <div class="safety-note">
          <strong>实验验证提醒</strong>
          <p>AI 建议仅供方案设计参考，须由专业人员审核。</p>
        </div>
        <button class="danger-ghost" type="button" @click="deleteCurrentConversation">删除当前会话</button>
      </div>
    </aside>

    <div class="chat-workspace">
      <div ref="messagesViewport" class="messages-viewport" data-testid="messages-viewport">
        <div class="date-divider"><span>检测咨询开始</span></div>
        <MessageBubble
          v-for="message in conversation.messages"
          :key="message.id"
          :message="message"
          @copy="copyAnswer"
          @regenerate="regenerate"
        />
      </div>

      <footer class="composer-wrap" data-testid="composer-dock">
        <div class="composer" :class="{ disabled: generating }">
          <el-input
            v-model="input"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 6 }"
            :disabled="generating"
            placeholder="继续追问方法选择、前处理或异常排查…"
            data-testid="chat-input"
            @keydown.ctrl.enter.prevent="sendMessage"
            @keydown.meta.enter.prevent="sendMessage"
          />
          <div class="composer-actions">
            <div class="composer-model-switcher">
              <label for="chat-model">当前模型</label>
              <el-select id="chat-model" v-model="selectedModelId" size="small" :disabled="generating" :teleported="false" data-testid="chat-model-select">
                <el-option v-for="model in enabledModels" :key="model.id" :label="model.name" :value="model.id" />
              </el-select>
            </div>
            <span class="composer-shortcut">Ctrl / ⌘ + Enter 发送</span>
            <el-button v-if="generating" class="stop-button" @click="stopGeneration">停止生成</el-button>
            <el-button v-else type="primary" :disabled="!canSend" data-testid="send-button" @click="sendMessage">发送问题 <span>↗</span></el-button>
          </div>
        </div>
      </footer>
    </div>
  </section>
</template>
