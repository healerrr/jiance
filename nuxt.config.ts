export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['element-plus/dist/index.css', '~/assets/css/main.css'],
  typescript: {
    strict: true,
    // Type checking is run explicitly by `npm run typecheck`; keeping it out of
    // Vite's transform phase avoids duplicate checker processes on Windows.
    typeCheck: false
  },
  runtimeConfig: {
    public: {
      appBaseUrl: process.env.NUXT_PUBLIC_APP_BASE_URL || 'http://127.0.0.1:3000'
    }
  },
  app: {
    head: {
      title: 'ChemInsight · 化学检测 AI',
      meta: [
        { name: 'description', content: '面向化学分析检测场景的可追溯 AI 多轮对话系统' },
        { name: 'theme-color', content: '#0c3b36' }
      ]
    }
  }
})
