<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { buildDetectionResolvePayload, detectionRecords, type DetectionRecord } from '~/shared/detection-list'

interface ResolveConversationResponse {
  conversationId: string
  chatUrl: string
  created: boolean
}

const search = ref('')
const resolvingId = ref<string | null>(null)

const filteredRecords = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return detectionRecords
  return detectionRecords.filter(record => [
    record.testProject,
    record.sampleName,
    record.sampleCode,
    record.cas,
    record.sampleProperty
  ].some(value => value.toLowerCase().includes(keyword)))
})

async function openRecommendation(record: DetectionRecord) {
  if (resolvingId.value) return
  resolvingId.value = record.id
  try {
    const result = await $fetch<ResolveConversationResponse>('/api/conversations/resolve', {
      method: 'POST',
      body: buildDetectionResolvePayload(record)
    })
    await navigateTo(result.chatUrl)
  } catch {
    ElMessage.error('暂时无法打开 AI 推荐，请稍后重试。')
  } finally {
    resolvingId.value = null
  }
}
</script>

<template>
  <section class="detection-list-page">
    <div class="detection-hero">
      <div>
        <span class="eyebrow">TESTING WORKBENCH</span>
        <h1>检测任务列表</h1>
        <p>从待检测样品直接进入 AI 方案讨论，再次推荐将继续原有对话。</p>
      </div>
      <div class="detection-summary" aria-label="任务统计">
        <div><strong>{{ detectionRecords.length }}</strong><span>项检测任务</span></div>
        <i />
        <div><strong>AI</strong><span>方案辅助</span></div>
      </div>
    </div>

    <div class="detection-toolbar">
      <div>
        <strong>待检测样品</strong>
        <span>CAS 与检测信息已由业务系统确认</span>
      </div>
      <el-input v-model="search" clearable placeholder="搜索检测项目、样品或 CAS" data-testid="detection-search">
        <template #prefix><span class="search-symbol">⌕</span></template>
      </el-input>
    </div>

    <div class="detection-table-wrap">
      <el-table
        :data="filteredRecords"
        row-key="id"
        class="detection-table"
        empty-text="没有匹配的检测任务"
        data-testid="detection-table"
      >
        <el-table-column label="检测项目" min-width="230">
          <template #default="{ row, $index }">
            <div class="project-cell">
              <span class="project-index">{{ String($index + 1).padStart(2, '0') }}</span>
              <strong>{{ row.testProject }}</strong>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="样品名称或编号" min-width="240">
          <template #default="{ row }">
            <div class="sample-cell">
              <span class="sample-icon">◇</span>
              <div><strong>{{ row.sampleName }}</strong><small>{{ row.sampleCode }}</small></div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="CAS" min-width="220">
          <template #default="{ row }">
            <div class="cas-cell">
              <code>{{ row.cas }}</code>
              <el-button
                type="primary"
                plain
                :loading="resolvingId === row.id"
                :disabled="Boolean(resolvingId) && resolvingId !== row.id"
                :data-testid="`recommend-${row.id}`"
                @click="openRecommendation(row)"
              >
                AI 推荐 <span v-if="resolvingId !== row.id">↗</span>
              </el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="sampleProperty" label="样品性质" min-width="170" />
      </el-table>
    </div>

    <div class="detection-footnote">
      <span>i</span>
      <p>AI 建议仅供检测方案设计参考，实际方法与参数须由专业人员审核并经实验验证。</p>
    </div>
  </section>
</template>
