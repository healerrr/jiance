<script setup lang="ts">
import type { ChatMessage } from '~/types/app'

const props = defineProps<{ message: ChatMessage }>()
const emit = defineEmits<{ copy: [content: string]; regenerate: [id: string] }>()
const { renderMarkdown } = useSafeMarkdown()

const statusText = computed(() => ({
  pending: '等待生成',
  generating: '正在生成',
  completed: '已完成',
  stopped: '已停止',
  failed: '生成失败'
}[props.message.status]))

const timeText = computed(() => new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai'
}).format(new Date(props.message.createdAt)))
</script>

<template>
  <article class="message-row" :class="`is-${message.role}`" :data-testid="`message-${message.role}`">
    <div v-if="message.role === 'assistant'" class="avatar assistant-avatar">AI</div>
    <div class="message-content">
      <div class="message-meta">
        <strong>{{ message.role === 'assistant' ? '检测助手' : '你' }}</strong>
        <span>{{ timeText }}</span>
        <span v-if="message.role === 'assistant' && message.modelNameSnapshot" class="model-label">{{ message.modelNameSnapshot }}</span>
      </div>
      <div class="message-bubble" :class="{ 'has-error': message.status === 'failed' }">
        <div v-if="message.role === 'assistant'" class="markdown-body" v-html="renderMarkdown(message.content)" />
        <p v-else class="user-text">{{ message.content }}</p>
        <div v-if="message.status === 'generating' && !message.content" class="typing-indicator" aria-label="正在生成">
          <i /><i /><i />
        </div>
        <div v-if="message.status === 'failed'" class="message-error">
          {{ message.errorSummary || '生成失败，请重试。' }}
        </div>
      </div>
      <div v-if="message.role === 'assistant'" class="message-actions">
        <span class="status-dot" :class="message.status" />{{ statusText }}
        <button v-if="message.content" type="button" @click="emit('copy', message.content)">复制回答</button>
        <button v-if="['failed', 'stopped', 'completed'].includes(message.status)" type="button" @click="emit('regenerate', message.id)">重新生成</button>
      </div>
    </div>
    <div v-if="message.role === 'user'" class="avatar user-avatar">你</div>
  </article>
</template>
