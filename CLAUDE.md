# CloudNav (云航) — 导航页面项目

## 项目概述

CloudNav 是一个 Cloudflare Pages 全栈导航页面，支持密码认证、云端数据同步、拖拽排序、AI 描述生成、WebDAV 备份、浏览器扩展导出等功能。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 6 |
| 样式 | Tailwind CSS (CDN 加载) |
| 图标 | lucide-react |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable |
| AI 生成 | @google/genai + OpenAI 兼容 API |
| 后端 | Cloudflare Pages Functions (`functions/api/`) |
| 存储 | Cloudflare KV + localStorage (缓存) |

## 关键文件索引

### 前端核心

| 文件 | 用途 | 关键标识 |
|---|---|---|
| `App.tsx` | 主应用组件(~2900行)，包含所有状态管理、数据处理、认证逻辑 | `AUTH_KEY`, `handleLogin`, `handleLogout`, `updateData`, `syncToCloud`, `handleCategoryActionAuth`, `SortableLinkCard`, `handleDragEnd`, `getHighResIcon` |
| `index.tsx` | 入口文件，挂载 React | - |
| `index.html` | HTML 模板，加载 Tailwind CDN | - |
| `types.ts` | 所有 TypeScript 接口和默认数据 | `LinkItem`, `Category`, `SiteSettings`, `AIConfig`, `WebDavConfig`, `DEFAULT_CATEGORIES`, `INITIAL_LINKS` |
| `vite.config.ts` | Vite 配置，定义 `process.env.API_KEY` 别名 | `GEMINI_API_KEY` |

### 功能组件 (`components/`)

| 文件 | 用途 | 关键属性/函数 |
|---|---|---|
| `AuthModal.tsx` | 密码登录弹窗 | `onLogin` |
| `CategoryAuthModal.tsx` | 分类密码解锁弹窗 | `onUnlock` |
| `CategoryActionAuthModal.tsx` | 分类编辑/删除密码验证弹窗 | `onVerify`, `onVerified`, `actionType` |
| `CategoryManagerModal.tsx` | 分类管理弹窗（排序/编辑/删除） | `isAuthenticated`, `onVerifyPassword` |
| `CategoryDeleteModal.tsx` | 分类删除确认弹窗（迁移/删除链接） | `onConfirm` |
| `LinkModal.tsx` | 添加/编辑链接弹窗 | - |
| `SettingsModal.tsx` | 设置弹窗（AI配置/站点设置/浏览器扩展导出） | 包含`extSidebarHtml`侧边栏HTML模板，`handleBulkGenerate`一键补全，`handleClearAllDescriptions`清空描述，`handleRefreshAllIcons`刷新所有图标为高清 |
| `BackupModal.tsx` | 备份弹窗（WebDAV/导出） | `onRestore` |
| `ImportModal.tsx` | Chrome书签导入弹窗 | - |
| `SearchConfigModal.tsx` | 搜索配置弹窗 | - |
| `ContextMenu.tsx` | 右键菜单 | - |
| `QRCodeModal.tsx` | 二维码弹窗 | - |
| `IconSelector.tsx` | Lucide图标选择器 | - |

### 后端函数 (`functions/api/`)

| 文件 | 路由 | 用途 |
|---|---|---|
| `storage.ts` | `/api/storage` | 核心API，处理认证检查、数据CRUD、配置获取（`?checkAuth`, `?getConfig=ai/website/search/favicon`） |
| `link.ts` | `/api/link` | 浏览器扩展提交链接 |
| `webdav.ts` | `/api/webdav` | WebDAV代理（解决CORS） |

### 服务层 (`services/`)

| 文件 | 用途 |
|---|---|
| `geminiService.ts` | AI描述生成（`generateLinkDescription`）和分类推荐（`suggestCategory`），支持Google Gemini和OpenAI兼容API |
| `bookmarkParser.ts` | Chrome书签HTML解析 |
| `exportService.ts` | HTML导出和档案导出 |
| `webDavService.ts` | WebDAV备份操作（`checkWebDavConnection`, `uploadBackup`, `downloadBackup`） |

## 数据流 & 状态架构

### 核心数据流
```
后端 KV 存储 ⇄ App.tsx (状态中心) ⇄ localStorage (离线缓存)
                       ⇄ 子组件 (通过 props 传递)
```

### 关键 State 一览 (`App.tsx`)
```
links: LinkItem[]            // 所有链接
categories: Category[]       // 所有分类
authToken: string | null     // 登录密码 token
siteSettings: SiteSettings   // 站点设置
aiConfig: AIConfig           // AI 配置
webDavConfig: WebDavConfig   // WebDAV 配置
unlockedCategoryIds: Set     // 已解锁的分类ID（分类密码）

// Modal 开关状态
isAuthOpen, isCatManagerOpen, isBackupModalOpen, isImportModalOpen, isSettingsModalOpen, isModalOpen, isSearchConfigModalOpen
```

## 认证机制

### 站点密码认证
1. Cloudflare Pages 部署时设置 `PASSWORD` 环境变量
2. 前端通过 `handleLogin` → `POST /api/storage { authOnly: true }` 验证
3. 验证通过后 `authToken = password` 存入 state 和 localStorage（`cloudnav_auth_token`）
4. 后续数据同步通过 header `x-auth-password` 传递 token
5. 密码有效期由 `siteSettings.passwordExpiryDays` 控制（0=永不过期）

### 分类密码保护
- 分类模型支持 `password` 字段
- `CategoryAuthModal` 通过前端比对解锁，不经过后端
- 锁定状态通过 `unlockedCategoryIds` Set 管理
- `handleCategoryActionAuth` 函数：**已登录时返回true跳过验证**（`isAuthenticated` prop）

### 敏感操作免密流程
- `CategoryManagerModal` 接收 `isAuthenticated` prop
- 用户已登录时，编辑/删除分类跳过 `CategoryActionAuthModal` 密码弹窗
- 参见 `App.tsx:933` 的 `handleCategoryActionAuth` 和 `handleStartEdit` / `handleDeleteClick`

## 常用操作指南

### 本地开发
```bash
npm run dev      # Vite dev server, port 3000
npm run build    # Vite 生产构建
npm run preview  # 预览构建结果
```

### 环境变量
- `GEMINI_API_KEY` — AI 功能所需的 Gemini API Key（通过 `.env` 文件或 Cloudflare 环境变量注入）

### 部署
- Cloudflare Pages 部署，`functions/api/` 自动映射为 `/api/*` 路由
- 需要绑定 KV namespace（`CLOUDNAV_KV`）和设置 `PASSWORD` 环境变量

### 修改侧边栏扩展样式
- `SettingsModal.tsx` 中的 `extSidebarHtml` 模板字符串包含完整 CSS 和 HTML
- JS 逻辑在 `extSidebarJs` 模板字符串中
- 链接布局当前为**2列网格卡片**（`.cat-links` 使用 `grid-template-columns: repeat(2, 1fr)`）

### 链接卡片与拖拽排序
- 详细视图卡片为**横向书签布局**（图标左 44px + 标题/描述右），图标经 `getHighResIcon` 动态升级为高清（gstatic favicon size 128→256）
- 普通分类视图下**直接按住卡片即可拖动排序**（`SortableLinkCard` + `DndContext`，`handleDragEnd` 用 `arrayMove` 重排并自动 `updateData` 保存），点击仍可跳转（`PointerSensor` distance=8 区分点击/拖拽）
- 「全部」视图、锁定分类、批量编辑模式、搜索状态下**不可拖拽**（回退到 `renderLinkCard` 普通渲染）
- 置顶链接排序保留独立「排序」按钮模式（`isSortingPinned` + `handlePinnedDragEnd` + `pinnedOrder` 字段）
- 批量操作（设置弹窗「工具」Tab）：`handleBulkGenerate` 一键补全描述、`handleClearAllDescriptions` 清空描述、`handleRefreshAllIcons` 刷新所有图标（跳过 `data:` 自定义图标）

## 代码规范

### 修复合入
- 直接 push 到 `main` 分支
- 提交信息格式：`feat:` / `fix:` / `style:` / `refactor:` 前缀
- 提交信息末尾添加 `Co-Authored-By: Claude <noreply@anthropic.com>`