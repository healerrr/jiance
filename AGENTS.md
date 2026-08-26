# 项目协作说明

- 技术栈固定为 Nuxt 3、Vue 3、TypeScript、Element Plus、Prisma 与 SQLite。
- 不在前端返回或记录完整模型 API 密钥、Authorization 请求头或上游错误正文。
- 数据库结构变更必须提交 Prisma schema 与迁移文件。
- 新功能应补充 Vitest；关键用户流程应补充 Playwright。
- 不增加登录、权限、联网搜索、MCP、文件上传等本期范围外功能。
- 提交前运行 `npm run typecheck`、`npm test`、`npm run build` 和必要的 E2E 测试。
