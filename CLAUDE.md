# RayNav — 导航页面项目

## 项目概述

RayNav 是一个 Cloudflare Pages 全栈导航页面，支持密码认证、云端数据同步、拖拽排序、AI 描述生成、WebDAV 备份、浏览器扩展导出、壁纸自定义（纯色/图片上传/缩放裁剪）等功能。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 6 |
| 样式 | Tailwind CSS (CDN 加载) |
| 图标 | lucide-react |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable |
| AI 生成 | Anthropic Messages API（支持第三方中转 Base URL）+ OpenAI 兼容 API，浏览器直连 |
| 后端 | Cloudflare Pages Functions (`functions/api/`) |
| 存储 | Cloudflare KV + localStorage (缓存) |

## 关键文件索引

### 前端核心

| 文件 | 用途 | 关键标识 |
|---|---|---|
| `App.tsx` | 主应用组件(~2900行)，包含所有状态管理、数据处理、认证逻辑 | `AUTH_KEY`, `handleLogin`, `handleLogout`, `updateData`, `syncToCloud`, `handleCategoryActionAuth`, `SortableLinkCard`, `handleDragEnd`, `getHighResIcon` |
| `index.tsx` | 入口文件，挂载 React | - |
| `index.html` | HTML 模板，加载 Tailwind CDN | - |
| `types.ts` | 所有 TypeScript 接口和默认数据 | `LinkItem`, `Category`, `SiteSettings`, `WallpaperType`, `WallpaperFit`, `AIConfig`, `WebDavConfig`, `DEFAULT_CATEGORIES`, `INITIAL_LINKS` |
| `vite.config.ts` | Vite 配置（历史遗留 `process.env.API_KEY` 别名已不再使用——AI Key 改由用户在设置填写，避免构建时硬编码进 bundle 泄露） | `GEMINI_API_KEY`(弃用) |

### 功能组件 (`components/`)

| 文件 | 用途 | 关键属性/函数 |
|---|---|---|
| `AuthModal.tsx` | 密码登录弹窗 | `onLogin` |
| `CategoryAuthModal.tsx` | 分类密码解锁弹窗 | `onUnlock` |
| `CategoryActionAuthModal.tsx` | 分类编辑/删除密码验证弹窗 | `onVerify`, `onVerified`, `actionType` |
| `CategoryManagerModal.tsx` | 分类管理弹窗（排序/编辑/删除） | `isAuthenticated`, `onVerifyPassword` |
| `CategoryDeleteModal.tsx` | 分类删除确认弹窗（迁移/删除链接） | `onConfirm` |
| `LinkModal.tsx` | 添加/编辑链接弹窗 | `handleFetchIcon`自动获取图标、自制文字图标（`makeTextIcon` 生成 SVG data URI：选背景色 + 1-3 个中英字符，文字色按亮度自动黑白）、`handleAIAssist`、`cacheCustomIcon` |
| `SettingsModal.tsx` | 设置弹窗（AI配置/站点设置/工具/浏览器扩展导出） | **站点设置**：网页标题/导航名称/favicon（`generateSvgIcon` 随机文字图标：标题首字符为英文字母时用 `R`）、身份验证过期天数、**壁纸设置**（见下）；AI配置：提供商 Anthropic/OpenAI 兼容 + API Key + Base URL（两者均可填第三方中转）+ 模型；`handleBulkGenerate`一键补全描述（失败保留原描述），`handleClearAllDescriptions`清空描述，`handleRefreshAllIcons`通过`/api/icon`重新抓取高清图标（刷新全部书签，含导入的 `data:` 低清图标，跳过自制 `data:image/svg` 文字图标；`/api/icon` 失败回退 gstatic 256 + 缓存破坏参数；带 loading 态与并发限流 5） |
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
| `icon.ts` | `/api/icon?url=` | 高清图标抓取：真正访问书签站点，解析 HTML 中最高清图标（SVG > apple-touch-icon 180 > 大尺寸 favicon > favicon.ico > Google 回退）。前端「刷新所有图标」并发调用，并发限流 5 |

### 服务层 (`services/`)

| 文件 | 用途 |
|---|---|
| `geminiService.ts` | AI 服务层（文件名沿用）：`generateLinkDescription` 描述生成、`suggestCategory` 分类推荐。支持 **Anthropic**（`callAnthropic`+`normalizeAnthropicBaseUrl`，浏览器直连 Messages API，带 `anthropic-dangerous-direct-browser-access` 头，支持第三方中转 Base URL）与 **OpenAI 兼容**（`callOpenAICompatible`+`normalizeOpenAIBaseUrl`）。失败统一返回空串（不再写错误文字），由调用方提示 |
| `bookmarkParser.ts` | Chrome书签HTML解析 |
| `exportService.ts` | HTML导出和档案导出 |
| `webDavService.ts` | WebDAV备份操作（`checkWebDavConnection`, `uploadBackup`, `downloadBackup`） |
| `textIcon.ts` | 文字图标生成（`makeTextIcon` 生成 SVG data URI；`makeFallbackIcon` 紫色背景+标题前3字符兜底；`ICON_PRESET_COLORS` 预设色）。LinkModal 自制图标与 App 卡片加载兜底共用 |

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
- `PASSWORD` — 站点登录密码（Cloudflare Pages 环境变量，必需）
- AI API Key — **不再用环境变量构建注入**（原 `GEMINI_API_KEY` 经 Vite 会硬编码进前端 bundle 造成泄露，已移除）。改为用户在「设置 → AI」填写，存于 localStorage + KV

### 部署
- Cloudflare Pages 部署，`functions/api/` 自动映射为 `/api/*` 路由
- 需要绑定 KV namespace（`CLOUDNAV_KV`）和设置 `PASSWORD` 环境变量

### 壁纸设置（设置 → 网站设置）
- `SiteSettings` 新增壁纸字段：`wallpaperType`(`none`/`color`/`image`)、`wallpaperColor`(hex)、`wallpaperImage`(上传图片 data URI)、`wallpaperFit`(`cover`裁剪填充/`contain`完整显示/`fill`拉伸/`repeat`平铺)、`wallpaperOpacity`(10–100%)、`wallpaperBlur`(0–20px)
- `SettingsModal.tsx`「网站设置」Tab：壁纸块位于 favicon 与身份验证过期天数之间，提供纯色取色器 + hex 输入、图片上传（`FileReader`→data URI，限 4MB）、适配方式下拉、不透明度/模糊滑杆；保存后随 `siteSettings` 写入 localStorage 与 KV（`saveConfig=website`）
- `App.tsx` 通过 `useEffect` 把壁纸渲染到一个 `position:fixed;z-index:-1` 的固定背景层（`#cloudnav-wallpaper-layer`），不干扰内容滚动；纯色直接设 `document.body` 背景色，图片按 `wallpaperFit` 设置 `background-size`/`repeat`，模糊时 `scale(1.05)` 避免透边
- 默认 `wallpaperType='none'` 使用页面原背景；旧数据缺字段时各处均有默认值兜底

### AI 配置与 Key 安全（设置 → AI）
- 提供商：**Anthropic Claude**（默认，Messages API：`x-api-key` + `anthropic-version` + `messages` body）或 **OpenAI 兼容**
- 两者均支持自定义 **Base URL**（留空走官方，或填第三方中转）；模型可自定义
- **Key 安全**：仅存 localStorage + 用户 KV（`/api/storage?saveConfig=ai`），调用时浏览器直连用户填写的 AI 地址，**不经过任何第三方**。已移除构建时 `process.env.API_KEY` 注入（避免 key 硬编码进 bundle 泄露给访客）
- 失败处理：`generateLinkDescription`/`suggestCategory` 失败返回空串/null，`LinkModal.handleAIAssist` 弹可操作提示（按 provider 区分 Anthropic/OpenAI 原因）

### 修改侧边栏扩展样式
- `SettingsModal.tsx` 中的 `extSidebarHtml` 模板字符串包含完整 CSS 和 HTML
- JS 逻辑在 `extSidebarJs` 模板字符串中
- 链接布局当前为**2列网格卡片**（`.cat-links` 使用 `grid-template-columns: repeat(2, 1fr)`）

### 链接卡片与拖拽排序
- 详细视图(detailed)卡片为**横向书签布局**（图标左 44px + 标题/描述右），图标经 `getHighResIcon` 动态升级为高清（gstatic favicon size 128→256）
- 简约视图(simple)卡片为**纵向图标墙**（圆角图标在上 + 居中名称在下，无描述），**无卡片边框/背景/阴影**，图标直接贴合页面背景，hover 仅轻微上浮；网格大屏最多 6 列（`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`）。`SortableLinkCard`/`renderLinkCard` 按 `isDetailedView` 在横向/纵向布局间切换
- 普通分类视图下**直接按住卡片即可拖动排序**（`SortableLinkCard` + `DndContext`，`handleDragEnd` 用 `arrayMove` 重排并自动 `updateData` 保存），点击仍可跳转（`PointerSensor` distance=8 区分点击/拖拽）
- 「全部」视图、锁定分类、批量编辑模式、搜索状态下**不可拖拽**（回退到 `renderLinkCard` 普通渲染）
- 置顶链接排序保留独立「排序」按钮模式（`isSortingPinned` + `handlePinnedDragEnd` + `pinnedOrder` 字段）
- 批量操作（设置弹窗「工具」Tab）：`handleBulkGenerate` 一键补全描述、`handleClearAllDescriptions` 清空描述、`handleRefreshAllIcons` 重新抓取高清图标（刷新全部书签含导入的 `data:` 低清图标，跳过自制 `data:image/svg` 文字图标，逐个走 `/api/icon`，并发限流 5，失败回退 gstatic 256 + 缓存破坏参数）

## 代码规范

### 修复合入
- 直接 push 到 `main` 分支
- 提交信息格式：`feat:` / `fix:` / `style:` / `refactor:` 前缀
- 提交信息末尾添加 `Co-Authored-By: Claude <noreply@anthropic.com>`