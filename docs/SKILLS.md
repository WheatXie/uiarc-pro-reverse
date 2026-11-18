# Skill 使用手册：`arc` · `arc-pro` · `impeccable`

本文件说明这一轮装进 DeepSeek Harness 的三个 skill：每个文件负责什么、什么时候该读它、什么时候读了也是浪费上下文，以及三者怎么接力。

- 安装位置：`~/.dsh/skills/`（全局，所有项目可用）；仓库内也有 `<repo>/.dsh/skills/`（项目级，随仓库走）。
- 入口约定：每个 skill 是 `<name>/SKILL.md`，头部 frontmatter 必须有 `name` 与 `description`，DSH 按 `description` 里的触发条件决定是否加载。
- 加载即消耗上下文：`arc` 13 个文件 ~92 KB，`arc-pro` 70 个文件 ~524 KB，`impeccable` 63 个文件 ~2.3 MB。**不要三个一起读**，按下表选。

---

## 0. 一分钟速查

| 你手上的活 | 先读 | 再读 | 不要读 |
|---|---|---|---|
| 在 Arc 项目里新建一个页面 | `arc-pro/SKILL.md` → `pro/PRO.md` | `pro/full-page-generation.md`，然后按需 `arc/design.md`、`arc/composition.md` | `arc-pro/catalog/**`（380 条全量目录，选型时用 MCP 搜更省） |
| 想知道“这个需求该用哪个 Arc 组件” | MCP `search_components` | `arc-pro/catalog/<group>.md` 里命中组的条目页 | `pro/*`（那是整页级玩法） |
| 改 tokens / 品牌换肤 | `pro/design-system-generation.md` | `arc/design.md`（尺度与语义 token 清单） | `catalog/**` |
| 从 shadcn / MUI / Chakra 迁过来 | `pro/refactor-to-arc.md` | `arc/composition.md`、`arc/checklist.md` | `impeccable`（先迁完再谈审美） |
| 页面能跑但“不好看/不利落” | `impeccable`：`critique` 打分 → `polish` 或 `typeset`/`layout` | 结论落回 `arc/design.md` 的规则去改 | `arc-pro/pro/full-page-generation.md`（不是生成任务） |
| 上线前查 a11y / 性能 / 响应式 | `impeccable audit`、`adapt`、`optimize` | `arc/accessibility.md`、`arc/responsive.md` 作为修复标准 | `pro/accessibility-audit.md`（与改善动作重叠，选一个） |
| 页面文案空洞 / 报错文案难懂 | `impeccable clarify` | `arc/copy.md`（Arc 的文案基调） | `arc/checklist.md` |
| 只是想知道某个 Pro 组件源码长什么样 | MCP `get_component`（`source`） | `public/docs/<id>.md` | 任何 skill |

---

## 1. 三个 skill 的定位

| Skill | 来源 | 体量 | 一句话定位 | 它不是 |
|---|---|---|---|---|
| `arc` | 官方 `https://uiarc.dev/r/arc-skill.json`，逐字节原样 | 13 文件 / 92 KB | **规范**：Arc 的视觉、文案、动效、可达性、响应式细则，加三个完整示例 | 不是组件目录（只有免费件 id），不含任何 Pro 信息 |
| `arc-pro` | 本仓库 `node ai/build.mjs` 生成 | 70 文件 / 524 KB | **目录 + 流程**：380 个 id 的全量索引、55 组逐条细节、6 份整页级 playbook | 不是设计规范（规范在 `arc` 里，它只引用） |
| `impeccable` | `pbakaus/impeccable` v4.9.2（Apache-2.0） | 63 文件 / 2.3 MB | **设计判断**：不绑定组件库的评审、诊断、改写、加动效、谈说服力 | 不是 Arc 专用，也不知道 Arc 的 token 名 |

分工一句话：**`arc` 定标准，`arc-pro` 找零件和流程，`impeccable` 做裁判和外科手术。**

---

## 2. `arc`（官方包）逐文件职责

路径：`~/.dsh/skills/arc/`（仓库内副本 `ai/skill/arc/`）

| 文件 | 内容 | 什么时候读 | 什么时候跳过 |
|---|---|---|---|
| `SKILL.md` | 入口：工作流、质量基线、何时读哪个文件的路由表 | 每次进入 Arc 相关任务的第一份 | — |
| `INSTRUCTIONS.md` | 常驻规则（可直接贴进 `AGENTS.md` / `CLAUDE.md` / `.cursor/rules`） | 项目初始化时贴一次，不必每次读 | 已在本仓库 `AGENTS.md` 里体现，日常跳过 |
| `design.md` | 颜色、字体、表面层次、圆角、间距、图标；每个 token 都对应 `foundation.css` | 定视觉、改 token、判断“这是不是 Arc 的灰” | 只改业务逻辑时 |
| `composition.md` | 页面容器、栅格、区块组合、dashboard 布局、组件状态与空态 | 拼页面骨架、决定“卡片里能不能再套卡片” | 只调一个组件的内部样式 |
| `components.md` | 免费件选型说明（按职责而非长相） | 需要免费组件、或确认“官方推荐用哪个” | 要 Pro 组件（用 `arc-pro/components.md` 或 MCP） |
| `copy.md` | 所有可见文案：按钮、标题、空态、错误、通知的写法与长度 | 写界面文字、改文案、审语气 | 纯样式调整 |
| `motion.md` | 动效的因果规则、时长/弹簧取值、reduced-motion、什么该删 | 加动画、审动画、判断“这个过渡在解释什么” | 静态页面 |
| `accessibility.md` | 语义、键盘、焦点、命名、播报 | 表单、菜单、对话框、自定义控件 | 纯展示型静态块 |
| `responsive.md` | 容器查询、断点行为、表格与溢出处理 | 做多端、修横向滚动 | 固定尺寸的嵌入式组件 |
| `checklist.md` | 交付前逐条自查（可整段抄进回复） | 每个任务收尾 | 任务刚开始时 |
| `example-dashboard.md` | 完整示例：分析概览页（KPI + 图表 + Top 来源） | 要照着写 dashboard 时 | 已有自己的骨架 |
| `example-pricing.md` | 完整示例：三档定价 + 月/年切换 + 功能对比 + FAQ | 做定价、套餐、对比表 | — |
| `example-settings.md` | 完整示例：账户设置（资料、通知、删除账号） | 做设置页、表单分区 | — |

> 已知漂移：官方 `design.md` / `responsive.md` 在 2026-11 更新过一次，尺度收紧为 `--radius-control` 14px / `--radius-panel` 20px / `--radius-surface` 24px、`--text-base` 15px、控件高 40px；本仓库 `src/components/arc/foundation.css` 仍是 18 / 26 / 34px 与 16px。**读规则用新文件，量像素用本地 CSS**，两者暂时不一致是预期内的。

---

## 3. `arc-pro`（本仓库增量）逐文件职责

路径：`~/.dsh/skills/arc-pro/`（仓库内 `ai/skill/arc-pro/`，由 `ai/build.mjs` 生成，不要手改）

### 3.1 顶层

| 文件 | 内容 | 什么时候读 |
|---|---|---|
| `SKILL.md` | 入口：380 个 id 的定位法、MCP 的 Find 步骤、快决策表（含 AI/Agent 类） | 进入“用 Arc 做东西”任务的第一份 |
| `INSTRUCTIONS.md` | 13 条 always / 7 条 never 的硬规则（比官方更严：例如 Pro 源码已在本地、禁止自行重写组件内部） | 需要给项目写规则文件时整段复制 |
| `components.md` | 380 条索引：按 55 组分节，每条 `## id · 标题 (badge, kind)` + 一句话用途 | 需要按组扫一遍找候选（比 MCP 更适合“浏览”而非“检索”） |
| `catalog/<group>.md` | 55 个分组明细，每条含：用途、别用场景、关键词、依赖、文件路径 | 已锁定 2–5 个候选后读细节 |

### 3.2 `catalog/` 全部 55 组（条目数 / Pro / 免费）

| 组 | 条目 | Pro | 免费 | 典型需求 |
|---|---|---|---|---|
| AI | 66 | 66 | 0 | 聊天、补全、检索、Agent、模型面板、提示词工具 |
| Analytics | 13 | 13 | 0 | 指标卡、漏斗、留存、MRR、异常、看板 |
| Charts | 14 | 1 | 13 | 折线/柱/面积等基础图 |
| Advanced charts | 7 | 7 | 0 | 桑基、雷达、旭日、赛马、实时流、漏斗 |
| Agents | 10 | 10 | 0 | 任务队列、审批、记忆、编排、评估、画廊 |
| Illustrations | 12 | 12 | 0 | 空态/引导用的插画组件 |
| Buttons | 11 | 0 | 11 | 基础按钮族 |
| Projects | 10 | 9 | 1 | 看板、甘特、里程碑、发布就绪度 |
| Settings | 8 | 8 | 0 | 设置页、权限、API key、环境变量、webhook |
| Pricing | 8 | 8 | 0 | 定价表、计算器、试用、结账 |
| Overlays | 8 | 2 | 6 | 弹层、抽屉、确认、命令面板 |
| Toggles | 8 | 0 | 8 | 开关、复选、单选、分段 |
| Tables | 7 | 0 | 7 | 表格基础件 |
| App shell | 7 | 3 | 4 | 侧栏、顶栏、页面骨架 |
| Text fields | 7 | 0 | 7 | 输入框族 |
| Special inputs | 7 | 0 | 7 | OTP、标签输入、文件上传等 |
| Docks and tabs | 6 | 6 | 0 | Dock、标签栏、分段导航 |
| Commerce | 6 | 6 | 0 | 商品卡、购物车、结算、推荐 |
| Messages | 6 | 1 | 5 | 消息流、输入区、AI 回答 |
| Support | 6 | 5 | 1 | 工单、会话、帮助中心、状态页 |
| Pickers | 6 | 1 | 5 | 日期、时间、颜色、emoji |
| Surfaces | 6 | 6 | 0 | 玻璃卡、分层表面、材质 |
| Developer | 6 | 5 | 1 | API key、webhook、日志、域名校验 |
| Progress | 6 | 0 | 6 | 进度、骨架、加载 |
| Auth | 6 | 4 | 2 | 登录、两步验证、会话 |
| Login and sign up | 5 | 5 | 0 | 整块登录/注册区 |
| People | 5 | 5 | 0 | 成员、邀请、团队展示、在线状态 |
| Loaders | 5 | 5 | 0 | 变形加载、像素角色等 |
| Media | 5 | 2 | 3 | 播放器、图库、图片流 |
| Navigation | 5 | 2 | 3 | 菜单、面包屑、TOC |
| Selects | 5 | 0 | 5 | 下拉、组合框、多选 |
| Expand | 5 | 0 | 5 | 手风琴、折叠区 |
| Data | 4 | 4 | 0 | 数据网格、选择工具条、表格增强 |
| Content | 5 | 1 | 4 | 文章、卡片流、富文本块 |
| Cards | 4 | 1 | 3 | 卡片基础件 |
| Editors | 4 | 1 | 3 | 富文本、代码、内联编辑 |
| Features | 4 | 1 | 3 | 功能列表、比较、Bento |
| Galleries | 4 | 4 | 0 | 画廊、照片网格、封面流 |
| Headers and footers | 4 | 4 | 0 | 页头页脚组合 |
| Cursor | 4 | 4 | 0 | 自定义光标、跟随/拖拽 |
| Glass | 4 | 4 | 0 | 玻璃材质组件族 |
| Playful | 4 | 4 | 0 | 贴纸、印章、滚动趣味 |
| Text effects | 4 | 0 | 4 | 文字变形、打字机 |
| Avatars | 4 | 1 | 3 | 头像、头像组、上传 |
| Sliders | 4 | 0 | 4 | 滑块、范围 |
| Social proof | 3 | 1 | 2 | 评价、logo 墙、计数 |
| Activity | 3 | 0 | 3 | 动态流基础件 |
| Menus | 3 | 0 | 3 | 右键菜单、下拉菜单 |
| Gestures | 3 | 0 | 3 | 拖拽、捏合、滑动 |
| Type | 3 | 3 | 0 | 排版演示、字重/字距实验 |
| Audio and video | 3 | 3 | 0 | 录音、播放、可视化 |
| Finance | 2 | 2 | 0 | 钱包、账单、额度 |
| Line charts | 2 | 2 | 0 | 回放式折线、地平线图 |
| Heroes | 2 | 0 | 2 | 首屏区 |
| Showpieces | 1 | 1 | 0 | 展示型整块 |
| Free registry · actions | 3 | 0 | 3 | 注册表独有的动作类条目 |
| Free registry · blocks | 3 | 0 | 3 | 注册表独有的区块 |
| Free registry · foundation | 2 | 0 | 2 | `arc-foundation`（tokens）、`arc-motion-tokens` |
| Free registry · ai | 1 | 0 | 1 | 注册表独有的 AI 条目 |
| Free registry · special | 1 | 0 | 1 | 注册表独有的特殊件 |

### 3.3 `pro/` 六份 playbook（整页级任务）

| 文件 | 产出物 | 适用 | 不适用 | 自带验收 |
|---|---|---|---|---|
| `PRO.md` | 路由表 + 通用前置（先定位库、确认 `foundation.css`、读条目而非截图、先写下宽度与状态） | 任何 playbook 之前的 30 秒 | — | — |
| `full-page-generation.md` | 五行简报（Page/Job/Regions/Data/States）→ 区域表（每行附“为什么是它”，引用条目的 not-for）→ 构建顺序 → 四段验收 → 报告模板 | 从零做一个完整页面，或只到“方案”为止 | 只改一个区块 | 390/768/1024/1440 无横向滚动、状态齐、键盘可走、暗色可读 |
| `design-system-generation.md` | `brand.css` 覆盖层（`--accent*` 与 `--neutral-*` 双主题）+ 六行对比度表 + 圆角/密度旋钮 | 换品牌、定主题、做设计系统 | 用现成主题不改 | body ≥4.5、大字 ≥3、边框 ≥3、焦点环 ≥3（两主题都要） |
| `refactor-to-arc.md` | 冻结基线 → 按“职责”映射组件 → 分层替换 → 逐区六项对齐 → 删除旧层 | 从 shadcn/MUI/Chakra/自研迁到 Arc | 新项目（用 full-page） | 视觉、交互、状态、文案、键盘、暗色六项逐区过 |
| `motion-recommendations.md` | `rg` 盘点 → 动效清单（Purpose / Verdict）→ token 指派 → 删除顺序 → 验证 | 动画多、乱、卡 | 还没写动画 | 长任务 <50ms、打断测试、键盘等价、reduced-motion 全覆盖 |
| `responsive-optimization.md` | 五宽度实测脚本（`scrollWidth - clientWidth`、裁切、<44px 目标）→ 六步修复顺序 → 复测 | 横向滚动、断点错乱、触控太小 | 只做桌面 | 五宽度复测全绿 |
| `accessibility-audit.md` | 结构/键盘/语义/对比度/动效五段检查 → 按影响排序的发现表（选择器、实测值、补丁） | 上线前、合规检查 | 纯展示原型 | 键盘走一遍、对比度重测、axe 当网不当结论 |

---

## 4. `impeccable`（v4.9.2）

路径：`~/.dsh/skills/impeccable/`。用法是**动词触发**：说 `impeccable polish`、`critique`、`audit`、`bolder` 等，或直接描述目标由它路由（`reference/routing.md`）。不带参数时它给菜单，不会自己乱跑。

### 4.1 四种模式（先定“访客的成功是什么”）

| 模式 | 访客目标 | 典型界面 |
|---|---|---|
| **Persuade** | 做决定并行动 | 落地页、营销、活动、定价 |
| **Operate** | 完成任务 | 后台、仪表盘、编辑器、设置 |
| **Read** | 看懂内容 | 文档、文章、指南、更新日志 |
| **Experience** | 沉浸在作品里 | 作品集、画廊、展示页 |

### 4.2 命令表（24 条）

| 命令 | 类别 | 职责 | 什么时候用 |
|---|---|---|---|
| `shape [feature]` | Build | 写码前把 UX/UI 方案定下来 | 需求模糊、要出方案再动手 |
| `init`（别名 `teach`） | Build | 生成 `PRODUCT.md`：产品定位、用户、语气、非目标 | 新项目/接手项目第一次 |
| `document` | Build | 从现有代码反推 `DESIGN.md`（tokens、组件、规则） | 项目没有设计文档但要维护一致性 |
| `extract [target]` | Build | 把散落样式抽成可复用 tokens / 组件 | 样式开始重复、准备做设计系统 |
| `critique [target]` | Evaluate | 启发式打分评审（层级、构图、节奏、文案、一致性） | 想听真话、想知道差在哪 |
| `audit [target]` | Evaluate | 技术体检：a11y、性能、响应式（原生版另有 `audit.native.md`） | 上线前、交接前 |
| `polish [target]` | Refine | 交付前最后一轮打磨（对齐、间距、状态、细节） | 功能已完成，只差手感 |
| `bolder [target]` | Refine | 把平庸/安全的设计做大胆 | 页面“正确但没人记得” |
| `quieter [target]` | Refine | 把过吵、过饱和的设计收回来 | 花哨、噪音多、抢注意力 |
| `distill [target]` | Refine | 砍到本质，删复杂度 | 元素过多、解释过多 |
| `harden [target]` | Refine | 生产就绪：错误、空态、长内容、i18n、边界 | demo 转产品 |
| `onboard [target]` | Refine | 首次运行、空态、激活路径 | 新用户不知道下一步 |
| `animate [target]` | Enhance | 加有意义的动效（有因果，不是装饰） | 交互缺反馈 |
| `colorize [target]` | Enhance | 给单色界面加策略性颜色 | 全灰白、缺强调 |
| `typeset [target]` | Enhance | 字体层级、字号节奏、字距 | 层级乱、读起来累 |
| `layout [target]` | Enhance | 修间距、节奏、视觉层级 | 拥挤/松散、重心不稳 |
| `delight [target]` | Enhance | 加记忆点（细节、个性、微交互） | 界面合格但没性格 |
| `overdrive [target]` | Enhance | 突破常规上限（展示型） | 作品集/活动页要震撼 |
| `clarify [target]` | Fix | UX 文案：标签、按钮、错误提示 | 文案含糊、报错没用 |
| `adapt [target]` | Fix | 多端适配（原生版 `adapt.native.md`） | 手机/平板/宽屏各有毛病 |
| `optimize [target]` | Fix | 诊断并修 UI 性能（布局抖动、重绘、长任务） | 卡、掉帧、滚动黏 |
| `live` | Iterate | 浏览器里点选元素、出变体、当场迭代 | 想边看边改（需浏览器桥） |
| `generate [n] [action] [element]` | Iterate | 直接生成 n 个变体供挑选，不用手点 | 有明确元素但方向不确定 |
| `craft [feature]` | Build | 已废弃别名，等价于普通新建请求 | 不要主动用 |

### 4.3 支撑参考（不单独当命令，被上面按需加载）

| 文件 | 作用 |
|---|---|
| `reference/routing.md` | 无参数时的上下文菜单与“该跑哪个命令”的判断 |
| `reference/foundations.md` | 设计基础（节奏、层级、对齐、密度的最低线） |
| `reference/craft-floor.md` | “手艺人底线”：低于这条线的界面不谈风格 |
| `reference/critique-rubric.md` | `critique` 的评分细则与扣分依据 |
| `reference/region-map.md` | 把页面切成区域，便于逐区评审与替换 |
| `reference/new-work.md` / `new-work-comp.md` / `new-work-world.md` | 新界面的三条路径：常规新建、以 comp 为主的构建、创建/替换视觉世界 |
| `reference/mode-persuade.md` / `mode-operate.md` / `mode-read.md` / `operate.md` | 四种模式的深度指引 |
| `reference/visualize.md` | 方向稿（comps）与素材生产 |
| `reference/component-review.md` | 计划与素材评审 |
| `reference/doctor.md` | 自检：安装、依赖、浏览器桥是否正常 |
| `reference/hooks.md` / `live-setup.md` / `live.md` | hook 安装、浏览器桥配置、`live` 迭代流程 |
| `reference/ios.md` / `android.md` / `adapt.native.md` / `audit.native.md` | 原生 iOS/Android 分支 |
| `reference/degraded.md` | 环境受限（无浏览器、无网络）时的降级路径 |
| `reference/craft.md` | 废弃别名的说明 |

### 4.4 与 `arc` / `arc-pro` 的边界

- `impeccable` **不知道** Arc 的 token 名与 380 个 id；它给判断，不给零件。它的建议要翻译成 `arc/design.md` 的 token 才能落地。
- `arc/checklist.md` 管“是否合规”，`impeccable critique` 管“是否好”。两者都要时先 `critique` 再 `checklist`。
- 两者都讲动效：`arc/motion.md` 是**取值标准**（曲线、时长、token），`impeccable animate` 是**取舍判断**（该不该有、解释什么）。先取舍再取值。

### 4.5 没装的部分

本轮只做了目录复制，**没装 hook、没装子代理**：`critique / audit / polish` 目前靠对话触发，不是斜杠命令；`live` / `generate` 依赖 `scripts/live-browser.js` 的浏览器桥，第一次用需配置。要补齐跑一次 `npx impeccable install`（会写 `.impeccable/` 与工具侧配置），并确认 hook 不被安全策略拦截。

---

## 5. 组合配方

### 配方 A：从零做一个 Arc 页面
1. `arc-pro/pro/PRO.md` → 确认库在哪、读条目而非截图。
2. `arc-pro/pro/full-page-generation.md` → 五行简报 + 区域表（每行写“为什么不是别的组件”）。
3. 选型用 MCP `search_components`（比翻 `catalog/` 省），命中后 `get_component` 读 docs + source。
4. 落地时对照 `arc/design.md`（token）、`arc/composition.md`（骨架）、`arc/copy.md`（文案）。
5. 收尾：`impeccable critique`（好不好）→ `arc/checklist.md`（合不合规）→ `impeccable polish`。

### 配方 B：审一个已上线的页面
1. `impeccable audit`（技术面）+ `critique`（体验面），拿到按影响排序的清单。
2. 每条结论映射到 `arc/*.md` 的具体规则，避免“我觉得”。
3. 修复顺序：`layout` / `typeset` → `clarify` → `animate` → `harden`。
4. 复测：`impeccable adapt` 五宽度 + `arc/responsive.md` 的溢出检查。

### 配方 C：从 shadcn / MUI 迁到 Arc
1. `arc-pro/pro/refactor-to-arc.md`：冻结基线（截图、交互清单、状态清单、文案清单）。
2. 按职责映射（例如 MUI `Dialog` → `confirm-popover`，Chakra toast → `undo-toast`）。
3. 分层替换：tokens → 控件 → 容器 → 一次一个区域，删旧层。
4. 每区六项对齐后跑 `arc/checklist.md`。

### 配方 D：只换品牌皮肤
1. `arc-pro/pro/design-system-generation.md` → 写 `brand.css`（覆盖 `--accent*`、`--neutral-*`，别改组件内部）。
2. `arc/design.md` 核对语义 token 有没有漏。
3. 对比度表两主题都过；`impeccable colorize` 只用来补“哪里还缺强调”。

### 配方 E：只想知道“用哪个组件”
MCP `search_components(意图)` → `get_component(id, docs)` → 需要细节再 `get_skill("arc-pro/catalog/<group>.md")`。**不要**为此读整套 skill。

---

## 6. MCP 与 skill 的分工

| 问题 | 用 MCP（`ai/mcp/server.mjs`） | 用 skill 文件 |
|---|---|---|
| “有没有能做大表格的 Pro 组件？” | `search_components` → `data-grid` | — |
| “data-grid 支持哪些 props？” | `get_component` 取 docs | — |
| “把 data-grid 的源码给我” | `get_component` 取 source（上限 160k 字符/次） | — |
| “这东西怎么装/怎么引用？” | `get_install_command` | — |
| “整页怎么排、先做什么后做什么” | — | `arc-pro/pro/*.md` |
| “颜色/字号/圆角用哪个 token” | — | `arc/design.md` |
| “这个界面够不够好” | — | `impeccable critique / audit` |

MCP 是**检索层**（按需取一条），skill 是**方法论层**（常驻规则）。两者共用同一份 `ai/data/index.json`，所以 id 与文件路径永远一致。

---

## 7. 维护与校验

| 目的 | 命令 |
|---|---|
| 重新生成两个 skill + 索引 | `node ai/build.mjs` |
| 装到 DSH（项目级 + cordis 条目） | `node ai/install.mjs --dsh` |
| 装到全部客户端（Claude / Cursor / VS Code / Codex / agents） | `node ai/install.mjs --all` |
| 只打印配置不写文件 | `node ai/install.mjs --print` |
| MCP 自检（工具面 + 10 个意图排序） | `node ai/mcp/smoke.mjs` |
| 免费件与官网对齐（只补缺失，不覆盖改过的） | `node scripts/sync-free.mjs`（`--apply` 才写） |
| 类型检查 / 构建 / 全站冒烟 | `npx tsc --noEmit` · `pnpm build` · `node scripts/smoke.mjs` |

改动 skill 内容的正确姿势：改 `ai/skill-src/**`（官方 13 份在 `ai/skill-src/official/`，我们的增量在 `SKILL.md`、`INSTRUCTIONS.md`、`pro/`），再 `node ai/build.mjs`，再 `node ai/install.mjs --dsh`。**不要直接改 `ai/skill/**` 或 `~/.dsh/skills/**`**，下次生成会被覆盖。
