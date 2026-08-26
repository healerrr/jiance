import { expect, test } from '@playwright/test'

const runId = `e2e-${Date.now()}`
const conversationIds: string[] = []
const modelIds: string[] = []
let originalDefaultId: string | undefined

test.beforeAll(async ({ request }) => {
  const currentModels = await request.get('/api/models')
  const items = await currentModels.json() as Array<{ id: string, isDefault: boolean }>
  originalDefaultId = items.find(item => item.isDefault)?.id

  const response = await request.post('/api/models', { data: {
    name: `${runId}-默认测试模型`, apiBaseUrl: 'mock://chemical-assistant', apiKey: 'mock-e2e-default-key',
    modelName: 'chemical-mock-e2e', temperature: 0.2, maxOutputTokens: 1800,
    timeoutMs: 10000, enabled: true, isDefault: true
  } })
  const model = await response.json()
  modelIds.push(model.id)
})

test.afterAll(async ({ request }) => {
  for (const id of conversationIds) await request.delete(`/api/conversations/${id}`).catch(() => undefined)
  if (originalDefaultId) await request.post(`/api/models/${originalDefaultId}/default`).catch(() => undefined)
  for (const id of modelIds) await request.delete(`/api/models/${id}`).catch(() => undefined)
})

test('检测列表的 AI 推荐会创建并恢复同一会话', async ({ page, request }) => {
  const existingResponse = await request.get('/api/conversations', { params: {
    search: 'detection-list-YQY5502-1',
    page: 1,
    pageSize: 20
  } })
  const existingItems = (await existingResponse.json()).items as Array<{ id: string, externalKey: string }>
  const existingId = existingItems.find(item => item.externalKey === 'detection-list-YQY5502-1')?.id

  await page.goto('/detection-list')
  await expect(page.getByRole('heading', { name: '检测任务列表' })).toBeVisible()
  await expect(page.getByTestId('detection-table').locator('tbody tr')).toHaveCount(5)

  await page.getByTestId('recommend-YQY5502-1').click()
  await expect(page).toHaveURL(/\/chat\/[a-z0-9-]+/)
  const firstUrl = page.url()
  const conversationId = firstUrl.split('/').pop()!
  if (!existingId) conversationIds.push(conversationId)
  await expect(page.getByText('64-17-5')).toBeVisible()
  await expect(page.getByText('气相色谱法（GC）')).toBeVisible()
  await expect(page.getByTestId('message-assistant')).toContainText('结论摘要')

  await page.goto('/detection-list')
  await page.getByTestId('recommend-YQY5502-1').click()
  await expect(page).toHaveURL(firstUrl)

  const resolvedAgain = await request.post('/api/conversations/resolve', { data: {
    externalKey: 'detection-list-YQY5502-1',
    cas: '64-17-5',
    testProject: '气相色谱法（GC）',
    confirmedContent: '此内容不应覆盖首次快照。',
    sampleName: '乙醇测试样',
    sampleCode: 'YQY5502-1'
  } })
  expect((await resolvedAgain.json()).conversationId).toBe(conversationId)
})

test('全局系统提示词只提交可编辑字段并可成功保存', async ({ page, request }) => {
  const originalResponse = await request.get('/api/settings')
  expect(originalResponse.ok()).toBeTruthy()
  const original = await originalResponse.json() as {
    globalSystemPrompt: string
    contextMaxMessages: number
    contextMaxChars: number
  }
  const prompt = `${original.globalSystemPrompt}\n\n${runId}-全局提示词保存验证`

  try {
    await page.goto('/settings/models')
    await page.getByTestId('system-prompt').fill(prompt)

    const [saveResponse] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/api/settings') && response.request().method() === 'PUT'),
      page.getByTestId('save-settings').click()
    ])
    expect(saveResponse.ok()).toBeTruthy()
    expect(saveResponse.request().postDataJSON()).toEqual({
      globalSystemPrompt: prompt,
      contextMaxMessages: original.contextMaxMessages,
      contextMaxChars: original.contextMaxChars
    })

    const savedResponse = await request.get('/api/settings')
    expect((await savedResponse.json()).globalSystemPrompt).toBe(prompt)
  } finally {
    await request.put('/api/settings', { data: {
      globalSystemPrompt: original.globalSystemPrompt,
      contextMaxMessages: original.contextMaxMessages,
      contextMaxChars: original.contextMaxChars
    } })
  }
})

test('外部入口、首次流式回答、多轮上下文、刷新和模型切换', async ({ page, request }) => {
  const resolved = await request.post('/api/conversations/resolve', { data: {
    externalKey: `${runId}-main`, cas: '50-00-0', testProject: '液相色谱',
    confirmedContent: '需要建立样品纯度检测的初步筛选方案。', sampleName: '甲醛对照样', sampleCode: 'QA-2026-01',
    metadata: { department: 'QC' }
  } })
  expect(resolved.ok()).toBeTruthy()
  const entry = await resolved.json()
  conversationIds.push(entry.conversationId)
  expect(entry.created).toBe(true)

  await page.goto(entry.chatUrl)
  await expect(page.getByRole('heading', { name: /甲醛对照样/ })).toBeVisible()
  await expect(page.getByTestId('message-assistant')).toContainText('结论摘要')
  await expect(page.getByText('已完成').first()).toBeVisible()
  await expect(page.getByTestId('conversation-panel-footer')).toBeInViewport()
  await expect(page.getByTestId('composer-dock')).toBeInViewport()
  await expect(page.getByTestId('composer-dock').getByTestId('chat-model-select')).toBeVisible()
  await expect(page.getByTestId('deep-analysis-switch')).not.toBeChecked()
  await expect(page.locator('.chat-header')).toHaveCount(0)

  await page.getByTestId('messages-viewport').evaluate(element => {
    element.scrollTop = element.scrollHeight
  })
  await expect(page.getByTestId('conversation-panel-footer')).toBeInViewport()
  await expect(page.getByTestId('composer-dock')).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(await page.evaluate(() => document.documentElement.clientHeight))

  await page.getByTestId('chat-input').fill('如果初筛分离不足，下一步如何排查？')
  await page.getByTestId('deep-analysis-switch').click()
  await expect(page.getByTestId('deep-analysis-switch')).toBeChecked()
  await page.getByTestId('send-button').click()
  await expect(page.getByTestId('message-assistant')).toHaveCount(2)
  await expect(page.getByTestId('message-assistant').last()).toContainText('初筛分离不足')
  const assistantCount = await page.getByTestId('message-assistant').count()

  await page.reload()
  await expect(page.getByTestId('message-assistant')).toHaveCount(assistantCount)
  await expect(page.getByText('50-00-0')).toBeVisible()

  const modelResponse = await request.post('/api/models', { data: {
    name: `${runId}-备用模型`, apiBaseUrl: 'mock://chemical-assistant', apiKey: 'mock-e2e-key',
    modelName: 'chemical-mock-v2', temperature: 0.2, maxOutputTokens: 1800,
    timeoutMs: 10000, enabled: true, isDefault: false
  } })
  expect(modelResponse.ok()).toBeTruthy()
  const secondModel = await modelResponse.json()
  modelIds.push(secondModel.id)

  await page.reload()
  await page.getByTestId('chat-model-select').click()
  await page.getByRole('option', { name: new RegExp(`${runId}-备用模型`) }).click()
  await page.getByTestId('chat-input').fill('请用新模型给出样品前处理注意点。')
  await page.getByTestId('send-button').click()
  await expect(page.getByTestId('message-assistant').last()).toContainText('样品前处理')
  await expect(page.getByTestId('message-assistant').last()).toContainText('chemical-mock-v2')

  await page.goto('/history')
  await page.getByTestId('history-search').fill(`${runId}-main`)
  await expect(page.getByTestId('history-card')).toHaveCount(1)
  await expect(page.getByTestId('history-card')).toContainText('50-00-0')
})

test('并发恢复、模型失败与重试、删除会话', async ({ page, request }) => {
  const payload = {
    externalKey: `${runId}-failure`, cas: '64-17-5', testProject: '气相色谱',
    confirmedContent: '评估挥发性样品的检测方案。', sampleName: '乙醇测试样'
  }
  const responses = await Promise.all(Array.from({ length: 6 }, () => request.post('/api/conversations/resolve', { data: payload })))
  const entries = await Promise.all(responses.map(item => item.json()))
  expect(new Set(entries.map(item => item.conversationId)).size).toBe(1)
  expect(entries.filter(item => item.created)).toHaveLength(1)
  conversationIds.push(entries[0].conversationId)

  const failingResponse = await request.post('/api/models', { data: {
    name: `${runId}-故障模型`, apiBaseUrl: 'http://127.0.0.1:1/v1', apiKey: 'never-logged',
    modelName: 'unreachable-model', temperature: 0.3, maxOutputTokens: 1000,
    timeoutMs: 1000, enabled: true, isDefault: false
  } })
  const failingModel = await failingResponse.json()
  modelIds.push(failingModel.id)

  await page.goto(entries[0].chatUrl)
  await expect(page.getByTestId('message-assistant')).toContainText('结论摘要')
  await page.getByTestId('chat-model-select').click()
  await page.getByRole('option', { name: new RegExp(`${runId}-故障模型`) }).click()
  await page.getByTestId('chat-input').fill('触发一次失败但保留这条用户消息。')
  await page.getByTestId('send-button').click()
  await expect(page.getByText('生成失败', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('触发一次失败但保留这条用户消息。')).toBeVisible()

  await page.getByTestId('chat-model-select').click()
  await page.getByRole('option', { name: new RegExp(`${runId}-默认测试模型`) }).click()
  await page.getByRole('button', { name: '重新生成' }).last().click()
  await expect(page.getByTestId('message-assistant').last()).toContainText('结论摘要')
  await expect(page.getByText('已完成').last()).toBeVisible()

  await page.goto('/history')
  await page.getByTestId('history-search').fill(`${runId}-failure`)
  const card = page.getByTestId('history-card')
  await expect(card).toHaveCount(1)
  await card.getByRole('button', { name: '删除' }).click()
  await page.getByRole('button', { name: '确认删除' }).click()
  await expect(page.getByTestId('history-card')).toHaveCount(0)
  conversationIds.splice(conversationIds.indexOf(entries[0].conversationId), 1)
})
