import { describe, expect, it } from 'vitest'
import { buildDetectionResolvePayload, detectionRecords } from '../../shared/detection-list'

describe('检测列表推荐入口', () => {
  it('为同一条检测记录生成稳定且完整的会话快照', () => {
    const record = detectionRecords[0]!
    const first = buildDetectionResolvePayload(record)
    const second = buildDetectionResolvePayload(record)

    expect(first).toEqual(second)
    expect(first.externalKey).toBe(`detection-list-${record.id}`)
    expect(first).toMatchObject({
      cas: record.cas,
      testProject: record.testProject,
      sampleName: record.sampleName,
      sampleCode: record.sampleCode,
      metadata: {
        source: 'detection-list',
        detectionRecordId: record.id,
        sampleProperty: record.sampleProperty
      }
    })
    expect(first.confirmedContent).toContain(record.cas)
    expect(first.confirmedContent).toContain(record.testProject)
  })

  it('不同检测记录使用不同外部业务标识', () => {
    const keys = detectionRecords.map(record => buildDetectionResolvePayload(record).externalKey)
    expect(new Set(keys).size).toBe(detectionRecords.length)
  })
})
