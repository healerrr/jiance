import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 200) : ''
  const project = typeof query.project === 'string' ? query.project.trim().slice(0, 200) : ''
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))

  const where = {
    ...(project ? { testProject: project } : {}),
    ...(search ? {
      OR: [
        { cas: { contains: search } },
        { externalKey: { contains: search } },
        { sampleName: { contains: search } }
      ]
    } : {})
  }

  const [items, total, projects] = await prisma.$transaction([
    prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { messages: true } } }
    }),
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({ distinct: ['testProject'], select: { testProject: true }, orderBy: { testProject: 'asc' } })
  ])

  return {
    items: items.map(({ metadataJson: _metadata, activeGenerationId, ...item }) => ({
      ...item,
      generating: Boolean(activeGenerationId),
      messageCount: item._count.messages,
      _count: undefined
    })),
    total,
    page,
    pageSize,
    projects: projects.map(item => item.testProject)
  }
})
