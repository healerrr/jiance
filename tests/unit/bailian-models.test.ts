import { describe, expect, it } from 'vitest'
import { BAILIAN_API_BASE_URL, BAILIAN_MODEL_PRESETS, LEGACY_DEMO_MODEL } from '../../shared/bailian-models'

describe('百炼预置模型', () => {
  it('提供三个名称简洁且模型 ID 唯一的配置', () => {
    expect(BAILIAN_API_BASE_URL).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1')
    expect(BAILIAN_MODEL_PRESETS.map(model => model.name)).toEqual([
      'deepseek-v4',
      'qwen3.8-max',
      'glm-5.2'
    ])
    expect(new Set(BAILIAN_MODEL_PRESETS.map(model => model.modelName)).size).toBe(3)
  })

  it('只将 DeepSeek 设为默认并保留旧演示模型清理标识', () => {
    expect(BAILIAN_MODEL_PRESETS.filter(model => model.isDefault).map(model => model.name)).toEqual(['deepseek-v4'])
    expect(LEGACY_DEMO_MODEL).toMatchObject({
      name: '内置演示模型',
      modelName: 'chemical-mock-v1'
    })
  })
})
