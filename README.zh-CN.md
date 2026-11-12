# uiarc-pro-reverse

[English](./README.md) · 简体中文

**[uiarc.dev](https://uiarc.dev) 全部 233 个付费 Pro 组件，重建为可直接运行的原生 React 源码。**

官网为了让免费预览帧能渲染，必须把组件本身发给浏览器，但把*源码*锁在 Pro 账户后面。本仓库从这些投递产物里把源码还原出来，并重新托管成一个本地文档站：在线预览、可复制的代码、以及与原始站点逐像素的一致性验证。

![条目页 — 预览区、Code 标签与文档](docs/screenshot-component.png)

```
233 / 233 个条目已重建 · 平均像素分 99.91 · 196 项 ≥ 99.95 · 139 项 DOM 完全一致
```

| 项目 | 内容 |
| --- | --- |
| 组件 | 17 个 Pro 组件 + 103 个特殊组件 |
| 区块 | 113 个 Pro 区块 |
| 技术栈 | Vite 8 · React 19 · TypeScript（strict）· CSS Modules · `motion` · Radix UI · lucide |
| 验证对象 | 1280×900 @2x 的线上预览帧，外加结构级 DOM 对比 |
| 结果表 | [REPORT.md](REPORT.md) — 每条一行，含两种采样模式 |
| 方法 | [METHOD.md](METHOD.md) — 产物如何读取，以及全部已知残差 |

## 快速开始

```bash
pnpm install
pnpm dev        # http://localhost:5183
pnpm build      # tsc --noEmit && vite build
```

条目页面位于 `/components/<slug>`（组件与特殊组件）或 `/components/blocks/<slug>`（区块）；
`/frame/<slug>` 渲染用于一致性对比的裸预览。

## 仓库里有什么

- **`src/components/arc/<slug>/`** — 233 个自包含移植：`<slug>.tsx`、`<slug>.module.css`
  （由官网投递的 CSS Module 去哈希而来，声明逐字节保留）以及一个会被文档页自动注册的 `demo.tsx`。
- **`src/site/`** — 文档站外壳：带搜索与范围筛选的侧边栏、带 Preview / Code 双标签的条目页、逐条 Markdown 文档、页内导航。
- **`src/components/arc/foundation.css`** — 设计变量（颜色、圆角、阴影、缓动），取自官网公开的 registry 条目。
- **`public/media`、`public/block-logos`、`public/docs`** — 演示与页面所需的图片素材，以及从同一批公开路由取回的 267 份 Markdown 文档。

运行时不会请求任何 registry：Code 标签通过 `import.meta.glob` 读取本地文件，因此整个目录可以离线使用。

## 给 AI agent 使用

官网提供两条 AI 路径：一条是需要 Arc 账号、且只有付费才返回 Pro 源码的远程 MCP 服务；另一条是目录里只列免费条目的 skill。这里两条都用本地产物替代，认识**全部 380 个 id**——233 个 Pro 加 147 个免费——并能直接给出源码。

```bash
cd ai/mcp && pnpm install && cd ../..   # 一次性：@modelcontextprotocol/sdk + zod
node ai/install.mjs --claude            # 项目级 .mcp.json + .claude/skills/arc-pro 链接
node ai/install.mjs --all               # 所有支持的客户端（见下表）
node ai/mcp/smoke.mjs                   # 对工具契约的 17 项断言
```

| MCP 工具 | 回答什么 |
| --- | --- |
| `search_components` | 需求 → 排序后的 id，附带「为什么用它」与「什么情况下别用」 |
| `list_components` | 按 kind、tier 或分组浏览 55 个分组 |
| `get_component` | 文档（何时使用、用法、API、键盘、无障碍、动效、响应式）+ 源码文件 |
| `get_install_command` | 免费条目给 shadcn 命令，Pro 条目给复制方式 |
| `get_skill` | 任意 skill 文件，含按分组的目录与 playbook |

### 安装到客户端

`ai/install.mjs` 写入各客户端期望的配置，并复制或链接 skill。既有文件一律合并、不覆盖；不带参数运行可查看它准备做什么，加 `--print` 可输出原始 JSON。

| 参数 | 写入内容 | 客户端从哪里读取 |
| --- | --- | --- |
| `--claude` | `.mcp.json`（项目级，随仓库提交）+ `.claude/skills/arc-pro` 符号链接 | 本仓库内的 Claude Code |
| `--claude-user` | `~/.claude/skills/arc-pro` | Claude Code，所有项目 |
| `--cursor` | `.cursor/mcp.json` + `.cursor/rules/arc.mdc` | 本仓库内的 Cursor |
| `--vscode` | `.vscode/mcp.json` | VS Code Copilot Chat 的 agent 模式 |
| `--codex` | `~/.codex/config.toml` 中的 `[mcp_servers.arc-pro]` | Codex |
| `--agents` | `~/.agents/skills/arc-pro` | 读取 `~/.agents/skills` 的 agent |
| `--dsh` | `.dsh/skills/arc-pro` 副本 + DeepSeek Harness profile 里的 `mcp-arc-pro` 插入项 | DeepSeek Harness |

手写配置同样可用：

```json
{ "mcpServers": { "arc-pro": { "command": "node", "args": ["/abs/path/uiarc/ai/mcp/server.mjs"] } } }
```

```bash
claude mcp add arc-pro -- node "$PWD/ai/mcp/server.mjs"   # 不必手改 .mcp.json
```

### Skill 与 playbook

`ai/skill/arc-pro/` 就是一个普通 skill 目录（`SKILL.md` 头部 `name: arc-pro`）：官网 10 份规则文件原样保留、`INSTRUCTIONS.md`（给 `AGENTS.md` / `CLAUDE.md` 的常驻规则）、覆盖全部 380 个 id 的 `components.md`、逐条细节的 `catalog/<group>.md`，以及 `pro/` 下六份面向整页任务的 playbook：

| Playbook | 什么时候用 |
| --- | --- |
| `pro/full-page-generation.md` | 逐个区域、含全部状态地构建整页，或只产出计划 |
| `pro/design-system-generation.md` | 在 Arc 变量上做品牌主题，两套主题都校验对比度 |
| `pro/refactor-to-arc.md` | 从 shadcn/ui、MUI、Chakra 或手写 CSS 迁移，并做一致性核对 |
| `pro/motion-recommendations.md` | 盘点动效、分配 token、删掉纯装饰 |
| `pro/responsive-optimization.md` | 量五个宽度、修溢出与触控、再量一遍 |
| `pro/accessibility-audit.md` | 按影响排序的发现与补丁，而不是清单打勾 |

不论免费还是 Pro，每个条目都是 `src/components/arc/` 下的一个目录，因此 MCP 服务与 skill 只读本地文件。
`node ai/build.mjs` 会从 `src/data/catalog.json`、`public/docs/*.md` 和这份源码重新生成 `ai/data/index.json` 与 skill 目录；
`node scripts/sync-free.mjs` 随时可拿免费那一半与公开 registry 对比。

### 接手这个仓库

[AGENTS.md](AGENTS.md) 是交接文档：命令、两道验证闸门、不能为单个条目修改的共享文件，以及库本身要遵守的 UI 规则。
[ai/README.md](ai/README.md) 里有官方与本地的对照表、各客户端配置与工具契约。

## 怎么还原的

闸门保护的是 `/api/component-source`，并不保护组件本身——预览帧必须渲染它。所以移植来源就是浏览器实际收到的东西：

1. **抓取** — `scripts/capture.mjs <slug>` 用 Playwright 打开 `/components/<slug>/frame`，保留 SSR DOM、该条目自己的 CSS Module（按选择器前缀挑选，而不是按体积）以及包含其实现的 webpack chunk。
2. **去哈希** — `.block_someClass__a1b2c` → `.someClass`；关键帧与嵌套 at-rule 原样保留。
3. **移植** — 重建组件：props、状态机、弹簧参数、ARIA、键盘模型、canvas/WebGL 渲染、种子数据生成器、响应式断点。
4. **校验** — `scripts/compare.mjs`（两帧像素差）与 `scripts/dom-diff.mjs`（path / tag / 盒模型 ±1px / 文本 / role / aria），再对每个状态做交互 A/B。
5. **报告** — `scripts/report.mjs` 并行分片跑完两个闸门，写出 [REPORT.md](REPORT.md)。

长时间运行的演示在与参考相同的静止窗口内对比（报告里带每条目的 `KNOWN_WAIT`），因此循环相位不会被当成保真度问题。

## 工具

| 脚本 | 作用 |
| --- | --- |
| `capture.mjs <slug> [--kind=block]` | 把 DOM + CSS + 实现 chunk 抓到 `captures/<slug>/` |
| `capture-parallel.sh <n> <slugs…>` | 按限定的并发抓取一批 |
| `compare.mjs <slug>` | 截取两帧并打印 `diff N% of pixels · score N`；支持 `STABLE=1`、`WAIT=ms`、`--local=` |
| `dom-diff.mjs <slug>` | 两帧结构遍历；支持 `--struct`、`--tags`、`WAIT=ms` |
| `report.mjs`、`report-all.sh`、`report-merge.mjs` | 全量一致性报告（分片） |
| `smoke.mjs` | 每个目录页返回 200、预览挂载、Code 标签有文件、无控制台报错 |
| `queue.mjs`、`audit-captures.mjs` | 进度与抓取质量审计 |
| `prune-free.mjs` | 只保留 Pro 条目所需导入闭包 |

`captures/` 是生成物，不提交——想重新验证某条目，重跑抓取即可。

## 已知残差

有 8 项低于 99.5，没有一项是缺功能：一个无阻尼轨道（`customer-galaxy`，它和*自己*比也只有约 96）、随机文本揭示循环（`source-cards`）、实时时钟数字（`revenue-globe`）、17 秒长赛跑（`race-bar-chart`）、旋转轮盘（`prize-wheel`）、WebGL 流体噪点（`ink-fluid`）、逐格随机（`sand-text`）以及时钟提前量（`orbit-logos`）。全部带测量记录在 [METHOD.md § 7](METHOD.md#7-known-irreducible-residues)。

## 致谢与声明

全部设计、布局与组件创意归 **Arc / [uiarc.dev](https://uiarc.dev)** 所有——本仓库是逆向工程研究，不是原始源码的再分发。这里的代码是从公开投递产物中还原的，用于研究与移植练习；如果你需要受支持、有授权的版本（含更新与支持），请购买原版。商标归各自所有者。
