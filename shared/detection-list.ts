export interface DetectionRecord {
  id: string
  testProject: string
  sampleName: string
  sampleCode: string
  cas: string
  sampleProperty: string
}

export interface ResolveConversationPayload {
  externalKey: string
  cas: string
  testProject: string
  confirmedContent: string
  sampleName: string
  sampleCode: string
  metadata: {
    source: 'detection-list'
    detectionRecordId: string
    sampleProperty: string
  }
}

export const detectionRecords: DetectionRecord[] = [
  {
    id: 'YQY5502-1',
    testProject: '气相色谱法（GC）',
    sampleName: '乙醇测试样',
    sampleCode: 'YQY5502-1',
    cas: '64-17-5',
    sampleProperty: '无色透明液体'
  },
  {
    id: 'HPLC-2608-02',
    testProject: '高效液相色谱法（HPLC）',
    sampleName: '苯甲酸对照样',
    sampleCode: 'HPLC-2608-02',
    cas: '65-85-0',
    sampleProperty: '白色结晶性粉末'
  },
  {
    id: 'ICP-2608-03',
    testProject: '电感耦合等离子体质谱（ICP-MS）',
    sampleName: '铅标准溶液',
    sampleCode: 'ICP-2608-03',
    cas: '7439-92-1',
    sampleProperty: '澄清液体'
  },
  {
    id: 'UV-2608-04',
    testProject: '紫外可见分光光度法（UV-Vis）',
    sampleName: '咖啡因研发样',
    sampleCode: 'UV-2608-04',
    cas: '58-08-2',
    sampleProperty: '白色粉末'
  },
  {
    id: 'IC-2608-05',
    testProject: '离子色谱法（IC）',
    sampleName: '氯化钠工作样',
    sampleCode: 'IC-2608-05',
    cas: '7647-14-5',
    sampleProperty: '白色晶体'
  }
]

export function buildDetectionResolvePayload(record: DetectionRecord): ResolveConversationPayload {
  return {
    externalKey: `detection-list-${record.id}`,
    cas: record.cas,
    testProject: record.testProject,
    confirmedContent: `请根据 CAS 号 ${record.cas}、检测项目“${record.testProject}”以及样品性质“${record.sampleProperty}”，给出可执行的初步检测建议，包括方法选择、样品前处理、关键参数、质量控制和安全注意事项。`,
    sampleName: record.sampleName,
    sampleCode: record.sampleCode,
    metadata: {
      source: 'detection-list',
      detectionRecordId: record.id,
      sampleProperty: record.sampleProperty
    }
  }
}
