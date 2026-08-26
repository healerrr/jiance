# ChemInsight · 化学检测 AI 对话系统

一个可独立运行的基础版化学检测对话系统。外部业务系统负责 CAS、检测项目和用户内容的录入与确认；本系统只接收确认快照、创建或恢复会话，并提供可持续追问的 AI 检测建议。

## 已实现

- `/detection-list` 检测任务列表在 CAS 列提供“AI 推荐”，点击后创建或恢复该任务的对话并自动生成检测建议。
- `POST /api/conversations/resolve` 创建或恢复外部会话，`externalKey` 数据库唯一约束保证并发幂等。
- 新会话首次打开聊天页时自动生成且只生成一次，使用 SSE 流式展示。
- 多轮对话、停止生成、失败重试、复制回答、临时切换模型。
- 全量 SQLite 持久化；页面刷新和服务重启后会话、消息、摘要均保留。
- 默认携带最近 20 条消息；超出后生成并保存包含实验参数、用户反馈、已排除方案和未解决问题的结构化摘要。
- 历史会话搜索、检测项目筛选、恢复与事务删除。
- 多个 OpenAI Chat Completions 兼容模型的新增、编辑、启停、连接测试、默认切换和删除。
- API 密钥只在服务端通过 AES-256-GCM 加密保存，前端接口仅返回脱敏值。
- 全局系统提示词和上下文消息/字符上限设置。
- Markdown、表格、列表、代码块和外链安全渲染；原始 HTML 默认禁用。

## 技术栈

Nuxt 3、Vue 3、TypeScript、Element Plus、Nitro Server API、Prisma ORM、SQLite、SSE、Vitest、Playwright。

## 目录结构

```text
assets/css/                 全局视觉样式
components/                 Logo、消息气泡等组件
composables/                安全 Markdown 渲染
layouts/                    应用导航布局
pages/
  detection-list.vue          检测任务与 AI 推荐入口
  chat/[conversationId].vue 聊天页面
  history.vue               历史记录
  settings/models.vue       模型与全局提示词设置
prisma/
  schema.prisma             数据模型
  migrations/               SQLite 迁移
  seed.ts                   全局设置初始化
server/api/                 Nitro HTTP/SSE 接口
server/utils/               加密、模型适配、上下文、摘要、会话服务
shared/                     默认提示词和共享常量
tests/unit/                 单元测试
tests/integration/          数据库服务集成测试
tests/e2e/                  Playwright 核心流程测试
```

## 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本
- 运行 E2E 测试时需要本机安装 Chrome

不需要 MySQL、Redis 或 Docker；开始对话前需配置一个可用的 OpenAI 兼容模型。

## 初始化与启动

```bash
npm install
```

复制 `.env.example` 为 `.env`，至少修改 `ENCRYPTION_MASTER_KEY`。生产环境应使用密码管理工具生成并保管至少 32 位的随机值。更换主密钥后，原先保存的模型 API 密钥将无法解密。如需自动配置百炼模型，同时设置 `BAILIAN_API_KEY`。

```bash
npm run db:setup
npm run dev
```

打开：

- 检测列表：<http://127.0.0.1:3000/detection-list>
- 历史记录：<http://127.0.0.1:3000/history>
- 模型设置：<http://127.0.0.1:3000/settings/models>

生产构建：

```bash
npm run build
npm run start
```

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | Prisma SQLite 地址，默认 `file:./dev.db`，相对于 `prisma/schema.prisma` |
| `ENCRYPTION_MASTER_KEY` | 是 | 模型 API 密钥的服务端加密主密钥 |
| `BAILIAN_API_KEY` | 否 | 设置后自动创建或更新三个百炼模型；只在服务端读取 |
| `NUXT_PUBLIC_APP_BASE_URL` | 否 | 页面基础地址，默认 `http://127.0.0.1:3000` |

`.env` 已加入 `.gitignore`，不要提交真实密钥。

## 外部会话入口

```bash
curl -X POST http://127.0.0.1:3000/api/conversations/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "externalKey": "ORDER-2026-0001",
    "cas": "123-45-6",
    "testProject": "液相色谱",
    "confirmedContent": "请为该样品提供纯度检测的初步筛选方案。",
    "sampleName": "研发样品 A",
    "sampleCode": "RD-A-001",
    "metadata": {
      "source": "external-business-system"
    }
  }'
```

返回：

```json
{
  "conversationId": "会话ID",
  "chatUrl": "/chat/会话ID",
  "created": true
}
```

相同 `externalKey` 再次调用会返回同一个 `conversationId`，`created` 为 `false`，且不会覆盖首次保存的 CAS、检测项目、确认内容或扩展数据。

## 配置真实模型

### 百炼自动配置

在服务器环境变量或服务器 `.env` 中设置：

```dotenv
BAILIAN_API_KEY="你的百炼 API Key"
```

执行 `npm run db:setup`，或直接使用 `npm start`。`npm start` 会先自动执行数据库迁移与幂等初始化，然后创建或更新以下配置：

- `deepseek-v4` → `deepseek-v4-pro-0813`（默认）
- `qwen3.8-max` → `qwen3.8-max`
- `glm-5.2` → `glm-5.2`

初始化会使用 `ENCRYPTION_MASTER_KEY` 加密百炼密钥，清理旧的“内置演示模型”，且不会把密钥写入源码或浏览器响应。修改服务器环境变量后重启服务即可更新三个模型保存的密钥。

### 手动配置

1. 打开 `/settings/models`。
2. 点击“新增模型”。
3. 填写配置名称、OpenAI 兼容 API 地址、API 密钥和模型名称。
4. 调整 Temperature、最大输出 Token 和超时。
5. 保存后先运行“测试连接”，再按需设为默认。

API 地址示例为 `https://api.openai.com/v1`。适配器会请求其 `/chat/completions` 路径并解析 OpenAI SSE 数据格式。聊天页面的模型切换只影响该次及后续回答，之前的消息仍保留实际模型名称快照。

自动化测试会临时创建 `mock://chemical-assistant` 配置并在结束时清理；正式初始化数据不包含演示模型。

## 测试

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```

`npm test` 会先部署迁移和补齐种子数据，再运行 Vitest。测试数据使用唯一前缀并在结束时清理，不会清空已有业务会话。

Playwright 默认复用本机 Chrome。若要指定另一个 Chrome 可执行文件：

```powershell
$env:PLAYWRIGHT_CHROME_PATH='C:\path\to\chrome.exe'
npm run test:e2e
```

自动化覆盖：模型配置校验、密钥加密和脱敏、默认模型切换、完整上下文、历史摘要、模型错误归一化、`externalKey` 幂等与并发、首次自动回答、刷新防重复、多轮消息、模型切换、失败重试、历史搜索和删除。

## 主要接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/api/conversations/resolve` | 创建或恢复外部会话 |
| `GET` | `/api/conversations` | 搜索历史会话 |
| `GET` / `DELETE` | `/api/conversations/:id` | 获取或删除会话 |
| `POST` | `/api/conversations/:id/generate` | 首次、继续或重新流式生成 |
| `POST` | `/api/messages/:id/stop` | 停止当前生成 |
| `GET` / `POST` | `/api/models` | 列出或新增模型配置 |
| `PUT` / `DELETE` | `/api/models/:id` | 编辑或删除模型配置 |
| `POST` | `/api/models/:id/default` | 切换默认模型 |
| `POST` | `/api/models/:id/test` | 测试连接 |
| `GET` / `PUT` | `/api/settings` | 读取或更新全局提示词与上下文策略 |

## 安全说明

- 模型密钥不会进入 Nuxt public runtime config、浏览器响应或错误消息。
- 上游错误统一归一化，不把完整上游正文、内部堆栈或 Authorization 头返回前端。
- Markdown 关闭原始 HTML，用户消息使用文本插值，外链强制 `noopener noreferrer nofollow`。
- 本期没有登录和权限控制，请只在受信任的内网或本机环境运行；开放到公网前必须另行增加身份与访问控制。

## 本期范围外

未开发 CAS 录入、检测项目录入、确认弹窗、登录、用户与权限、联网搜索、引用来源、MCP、仪器/色谱柱管理、文件上传、Excel、统计、审计、MySQL、Redis 和 Docker。当前检测列表是用于演示外部业务系统接入方式的静态页面；真实外部系统只需调用会话入口并打开返回的 `chatUrl`。
