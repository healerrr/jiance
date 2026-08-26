<template>
  <div class="app-shell">
    <header class="topbar">
      <AppLogo />
      <nav class="main-nav" aria-label="主导航">
        <NuxtLink to="/detection-list">检测列表</NuxtLink>
        <NuxtLink to="/history">历史记录</NuxtLink>
        <NuxtLink to="/settings/models">模型设置</NuxtLink>
      </nav>
      <div class="system-state"><span /> 本地数据已连接</div>
    </header>
    <main class="page-shell">
      <slot />
    </main>
  </div>
</template>
