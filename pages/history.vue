<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'

interface HistoryItem {
  id: string
  externalKey: string
  title: string
  cas: string
  sampleName?: string | null
  testProject: string
  currentModelName?: string | null
  lastMessageAt: string
  messageCount: number
  status: string
  generating: boolean
}

interface HistoryResponse {
  items: HistoryItem[]
  total: number
  projects: string[]
}

const search = ref('')
const project = ref('')
const page = ref(1)
const pendingDelete = ref<string | null>(null)
const query = computed(() => ({ search: search.value, project: project.value, page: page.value, pageSize: 20 }))
const { data, pending, refresh } = await useFetch<HistoryResponse>('/api/conversations', { query })

watch([search, project], () => { page.value = 1 })

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai'
  }).format(new Date(value))
}

async function removeConversation(item: HistoryItem) {
  await ElMessageBox.confirm(
    `会话“${item.title}”及其全部消息和摘要将被永久删除。`,
    '再次确认删除',
    { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' }
  )
  pendingDelete.value = item.id
  try {
    await $fetch(`/api/conversations/${item.id}`, { method: 'DELETE' })
    ElMessage.success('会话已删除')
    await refresh()
  } finally {
    pendingDelete.value = null
  }
}
</script>

<template>
  <section class="history-page">
    <div class="page-heading">
      <div>
        <span class="eyebrow">CONVERSATION ARCHIVE</span>
        <h1>检测咨询历史</h1>
        <p>所有外部业务发起的检测对话都会在这里持续保存。</p>
      </div>
      <div class="heading-stat">
        <strong>{{ data?.total || 0 }}</strong>
        <span>个会话</span>
      </div>
    </div>

    <div class="filter-bar">
      <el-input v-model="search" clearable placeholder="搜索 CAS、外部业务标识或样品名称" data-testid="history-search">
        <template #prefix><span class="search-symbol">⌕</span></template>
      </el-input>
      <el-select v-model="project" clearable :teleported="false" placeholder="全部检测项目" data-testid="project-filter">
        <el-option v-for="item in data?.projects || []" :key="item" :label="item" :value="item" />
      </el-select>
    </div>

    <div v-loading="pending" class="history-list">
      <div v-if="!pending && !data?.items.length" class="empty-panel">
        <div class="empty-orbit"><i /><i /></div>
        <h2>还没有检测对话</h2>
        <p>本系统不提供新建表单。请由外部业务系统调用会话入口后打开返回的聊天地址。</p>
      </div>

      <article v-for="item in data?.items || []" :key="item.id" class="history-card" data-testid="history-card">
        <NuxtLink :to="`/chat/${item.id}`" class="history-card-main">
          <div class="compound-badge">{{ item.cas.slice(0, 2).toUpperCase() }}</div>
          <div class="history-card-copy">
            <div class="card-title-row">
              <h2>{{ item.title }}</h2>
              <span class="conversation-state" :class="{ active: item.generating }">
                {{ item.generating ? '正在生成' : '可继续对话' }}
              </span>
            </div>
            <div class="record-tags">
              <span>CAS {{ item.cas }}</span>
              <span>{{ item.testProject }}</span>
              <span v-if="item.sampleName">{{ item.sampleName }}</span>
            </div>
            <div class="record-meta">
              <span>外部标识 {{ item.externalKey }}</span>
              <span>{{ item.messageCount }} 条消息</span>
              <span>{{ item.currentModelName || '等待首次生成' }}</span>
            </div>
          </div>
          <div class="history-time">
            <span>最后对话</span>
            <strong>{{ formatTime(item.lastMessageAt) }}</strong>
          </div>
        </NuxtLink>
        <button class="delete-link" type="button" :disabled="pendingDelete === item.id" @click="removeConversation(item)">
          {{ pendingDelete === item.id ? '删除中' : '删除' }}
        </button>
      </article>
    </div>

    <el-pagination
      v-if="(data?.total || 0) > 20"
      v-model:current-page="page"
      layout="prev, pager, next"
      :total="data?.total || 0"
      :page-size="20"
      class="pagination"
    />
  </section>
</template>
