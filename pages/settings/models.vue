<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ModelConfigPublic } from '~/types/app'

interface AppSettings {
  globalSystemPrompt: string
  contextMaxMessages: number
  contextMaxChars: number
}

const { data: models, refresh: refreshModels } = await useFetch<ModelConfigPublic[]>('/api/models')
const { data: settings, refresh: refreshSettings } = await useFetch<AppSettings>('/api/settings')
const dialogVisible = ref(false)
const saving = ref(false)
const testingId = ref<string | null>(null)
const editingId = ref<string | null>(null)
const settingsDraft = reactive<AppSettings>({ globalSystemPrompt: '', contextMaxMessages: 20, contextMaxChars: 40000 })
const form = reactive({
  name: '', apiBaseUrl: '', apiKey: '', modelName: '', temperature: 0.3,
  maxOutputTokens: 2000, timeoutMs: 60000, enabled: true, isDefault: false
})

watchEffect(() => {
  if (settings.value) Object.assign(settingsDraft, settings.value)
})

function openCreate() {
  editingId.value = null
  Object.assign(form, {
    name: '', apiBaseUrl: 'https://api.openai.com/v1', apiKey: '', modelName: '',
    temperature: 0.3, maxOutputTokens: 2000, timeoutMs: 60000, enabled: true, isDefault: false
  })
  dialogVisible.value = true
}

function openEdit(model: ModelConfigPublic) {
  editingId.value = model.id
  Object.assign(form, {
    name: model.name, apiBaseUrl: model.apiBaseUrl, apiKey: '', modelName: model.modelName,
    temperature: model.temperature, maxOutputTokens: model.maxOutputTokens,
    timeoutMs: model.timeoutMs, enabled: model.enabled, isDefault: model.isDefault
  })
  dialogVisible.value = true
}

async function saveModel() {
  saving.value = true
  try {
    const payload: Record<string, unknown> = { ...form }
    if (editingId.value && !form.apiKey) delete payload.apiKey
    await $fetch(editingId.value ? `/api/models/${editingId.value}` : '/api/models', {
      method: editingId.value ? 'PUT' : 'POST', body: payload
    })
    ElMessage.success(editingId.value ? '模型配置已更新' : '模型配置已添加')
    dialogVisible.value = false
    await refreshModels()
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || '保存失败')
  } finally {
    saving.value = false
  }
}

async function testModel(model: ModelConfigPublic) {
  testingId.value = model.id
  try {
    await $fetch(`/api/models/${model.id}/test`, { method: 'POST' })
    ElMessage.success(`${model.name} 连接成功`)
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || '连接测试失败')
  } finally {
    testingId.value = null
  }
}

async function makeDefault(model: ModelConfigPublic) {
  await $fetch(`/api/models/${model.id}/default`, { method: 'POST' })
  ElMessage.success(`已将 ${model.name} 设为默认模型`)
  await refreshModels()
}

async function deleteModel(model: ModelConfigPublic) {
  await ElMessageBox.confirm(`确认删除模型配置“${model.name}”？历史消息中的模型快照会保留。`, '删除模型配置', {
    confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning'
  })
  try {
    await $fetch(`/api/models/${model.id}`, { method: 'DELETE' })
    ElMessage.success('模型配置已删除')
    await refreshModels()
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || '删除失败')
  }
}

async function saveSettings() {
  try {
    await $fetch('/api/settings', { method: 'PUT', body: settingsDraft })
    ElMessage.success('全局提示词与上下文策略已保存')
    await refreshSettings()
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || '保存失败')
  }
}
</script>

<template>
  <section class="settings-page">
    <div class="page-heading settings-heading">
      <div>
        <span class="eyebrow">MODEL CONTROL</span>
        <h1>模型与提示词</h1>
        <p>管理 OpenAI 兼容模型。API 密钥只在服务端加密保存。</p>
      </div>
      <el-button type="primary" data-testid="add-model" @click="openCreate">＋ 新增模型</el-button>
    </div>

    <section class="settings-section">
      <div class="section-title">
        <div><span>01</span><h2>模型配置</h2></div>
        <p>同一时间只有一个默认模型，聊天页面可临时切换。</p>
      </div>
      <div class="model-grid">
        <article v-for="model in models || []" :key="model.id" class="model-card" :class="{ default: model.isDefault, disabled: !model.enabled }" data-testid="model-card">
          <div class="model-card-top">
            <span class="provider-mark">{{ model.name.slice(0, 1).toUpperCase() }}</span>
            <div><h3>{{ model.name }}</h3><p>{{ model.modelName }}</p></div>
            <span v-if="model.isDefault" class="default-badge">默认</span>
            <span v-else-if="!model.enabled" class="disabled-badge">已停用</span>
          </div>
          <dl>
            <div><dt>API 地址</dt><dd>{{ model.apiBaseUrl }}</dd></div>
            <div><dt>API 密钥</dt><dd>{{ model.apiKeyMasked }}</dd></div>
            <div><dt>Temperature</dt><dd>{{ model.temperature }}</dd></div>
            <div><dt>输出上限</dt><dd>{{ model.maxOutputTokens }} tokens</dd></div>
            <div><dt>超时</dt><dd>{{ model.timeoutMs / 1000 }} 秒</dd></div>
          </dl>
          <div class="model-actions">
            <button type="button" :disabled="testingId === model.id" @click="testModel(model)">{{ testingId === model.id ? '测试中…' : '测试连接' }}</button>
            <button v-if="!model.isDefault && model.enabled" type="button" @click="makeDefault(model)">设为默认</button>
            <button type="button" @click="openEdit(model)">编辑</button>
            <button v-if="!model.isDefault" class="danger" type="button" @click="deleteModel(model)">删除</button>
          </div>
        </article>
      </div>
    </section>

    <section class="settings-section prompt-section">
      <div class="section-title">
        <div><span>02</span><h2>全局系统提示词</h2></div>
        <p>将作为每次模型调用的第一段上下文。</p>
      </div>
      <el-input v-model="settingsDraft.globalSystemPrompt" type="textarea" :rows="16" data-testid="system-prompt" />
      <div class="context-fields">
        <label>最近消息数量 <el-input-number v-model="settingsDraft.contextMaxMessages" :min="4" :max="200" /></label>
        <label>上下文字符上限 <el-input-number v-model="settingsDraft.contextMaxChars" :min="2000" :max="500000" :step="1000" /></label>
        <el-button type="primary" data-testid="save-settings" @click="saveSettings">保存全局设置</el-button>
      </div>
    </section>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑模型配置' : '新增模型配置'" width="min(620px, 92vw)" destroy-on-close>
      <el-form label-position="top" @submit.prevent="saveModel">
        <div class="form-grid">
          <el-form-item label="配置名称"><el-input v-model="form.name" data-testid="model-name" placeholder="例如：生产 GPT" /></el-form-item>
          <el-form-item label="模型名称"><el-input v-model="form.modelName" data-testid="model-id" placeholder="例如：gpt-4.1-mini" /></el-form-item>
        </div>
        <el-form-item label="API 地址"><el-input v-model="form.apiBaseUrl" data-testid="api-base-url" placeholder="https://api.openai.com/v1" /></el-form-item>
        <el-form-item :label="editingId ? 'API 密钥（留空则保留原密钥）' : 'API 密钥'">
          <el-input v-model="form.apiKey" data-testid="api-key" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <div class="form-grid three">
          <el-form-item label="Temperature"><el-input-number v-model="form.temperature" :min="0" :max="2" :step="0.1" /></el-form-item>
          <el-form-item label="最大输出 Token"><el-input-number v-model="form.maxOutputTokens" :min="1" :max="128000" /></el-form-item>
          <el-form-item label="请求超时（毫秒）"><el-input-number v-model="form.timeoutMs" :min="1000" :max="600000" :step="1000" /></el-form-item>
        </div>
        <div class="switch-row">
          <label><el-switch v-model="form.enabled" /> 启用配置</label>
          <label><el-switch v-model="form.isDefault" :disabled="!form.enabled" /> 设为默认</label>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" data-testid="save-model" @click="saveModel">保存配置</el-button>
      </template>
    </el-dialog>
  </section>
</template>
