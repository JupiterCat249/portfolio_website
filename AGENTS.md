# AGENTS.md

## 项目概览
- **名称**：Portfolio World
- **类型**：原生极简静态网站（native-static）
- **定位**：以游戏导航隐喻构建的个人作品集网站，用户通过左右移动探索地标，靠近传送门按 E 进入项目世界
- **技术栈**：HTML + CSS + Vanilla JS，无框架、无构建步骤
- **内容驱动**：MD 文件驱动页面内容，零依赖手写解析器

## 目录结构
```
.
├── index.html              # Personal World 外壳（无内容，由 JS 动态渲染）
├── project-CC.html         # AI-Assisted Communication 外壳
├── content/
│   ├── index.md            # 主世界内容（## 段落 = 地标）
│   └── project-CC.md       # 项目世界内容
├── DESIGN.md               # 设计规范
├── styles/
│   └── main.css            # 全局样式（含设计系统）
├── assets/
│   └── world.js            # 核心引擎（MD 加载 + 解析 + 渲染 + 交互）
└── .coze                   # 部署配置
```

## 构建与运行
- **开发**：`python -m http.server ${DEPLOY_RUN_PORT} --bind 0.0.0.0`
- **无构建步骤**：纯静态文件，直接由 HTTP 服务器提供

## MD 内容规范

### 段落结构
每个 `## 标题` 自动生成一个地标节点，按出现顺序以 600px 间距排列。

### 传送门语法
```
## [→ project-CC.html] AI-Assisted Communication
```
`[→ 目标URL]` 前缀将地标标记为传送门，靠近时按 E 跳转。

### 图片语法
```
![描述文字](content/images/你的图片.png)
```
图片放在 `content/images/` 目录下，MD 中用相对路径引用。渲染为 `<img class="landmark-image">`。

### 列表语法
```
## Design Principles
- Context over Prompting
- Transparency over Mystery
```
`- ` 开头的行渲染为标签组。

## 代码架构

### world.js — 核心引擎
- `parseMd(text)` — 手写 MD 解析器，按 `##` 拆分段落
- `parseHeading(raw)` — 检测 `[→ url]` 传送门语法
- `renderLandmarks(sections)` — 动态生成地标 DOM，自动分配坐标
- 主循环：`updatePlayer()` → `updateCamera()` → `updateLandmarks()` → `updatePrompt()` → `updateHUD()`

## 扩展指南
- **新增项目**：创建 `project-XX.html`（复制外壳）+ `content/project-XX.md`（写内容）
- **编辑内容**：直接修改 `content/*.md`，刷新即生效
- **调整顺序**：调整 md 中 `##` 段落的先后顺序


## AI美德
1. 诚实透明：改了什么如实列出，没做的说没做，不要替用户下结论。
2. 追根溯源：bug 先加日志定位根因再改，不猜。反复出现时反思方向是否错了。
3. 谦逊求知：不知道的事物直接说不知道, 主动询问以获得更多信息。
4. 真诚反思：犯错说明原因和教训，承认能力边界，关心用户感受。
5. 勤于沟通：动手前确认需求和方案，有歧义时复述让用户确认，多选项让用户决策。
6. 思维清晰：互不干涉的功能独立文件，改 A 不碰 B，新功能优先独立模块。

## 当前任务
完成Chat Copilot项目在个人网站中的展示


## 网页设计
网页采用“游戏化”设计思路，抛开传统垂直滚动网页布局，用户像平台游戏一样左右移动浏览内容。虽然用中文和我交流，但网页本身是英文的。

### md编辑器
作为代码白痴，我不会直接修改代码文件，而是通过项目中的md文件修改页面内容
