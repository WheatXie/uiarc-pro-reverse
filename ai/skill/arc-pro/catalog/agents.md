# Agents

## `agent-approvals` — Agent approvals (Pro, block)

One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.

When to use:
- Human in the loop control for agents that call tools with side effects: deploys, emails, database writes, payments and ticket changes.
- An approvals card in an agent console or side panel where one person reviews, edits and decides tool calls quickly, from the keyboard if they like.

When not to use:
- Use agent-run to follow one agent's steps and tool calls live, with an inline confirm inside the run.
- Use mcp-servers to connect tools and set their permissions up front rather than per call.

Keywords: agent approvals, human in the loop, tool call approval, permission prompt, approve deny, always allow, agent permissions, rules, audit log, keyboard shortcuts, ai agent, mcp, guardrails, risk level, editable arguments

Files: agent-approvals.module.css, agent-approvals.tsx, demo.tsx

## `agent-builder` — Agent builder (Pro, block)

A card for setting up an AI agent: an inline editable name, a model picker, instructions, tool toggles with real app marks, and knowledge files with upload progress. A Configure / Test switch opens a compact chat that answers with the tools you turned on, and Publish ships the setup with a saved or unsaved state.

When to use:
- Letting customers configure their own AI agent inside your product, like Intercom Fin, Zapier agents or an OpenAI GPT builder.
- Internal admin screens where ops teams tune instructions, tools and knowledge for a support or billing agent.

When not to use:
- Running or monitoring an agent in production: use agent-status or agent-routines.
- Approving actions an agent wants to take: use agent-approvals.

Keywords: agent builder, configure ai agent, gpt builder, assistant settings, ai agent config, tools toggle, knowledge base upload, system prompt editor, test agent chat, publish agent, intercom fin, zapier agents

Files: agent-builder.module.css, agent-builder.tsx, demo.tsx

## `agent-gallery` — Agent gallery (Pro, block)

A marketplace card of AI agent templates where you filter by team, search by agent or app, preview a sample run and install an agent inline: choose a workspace, grant access app by app, and the card confirms with a check.

When to use:
- An agents or integrations page where people browse and install ready made AI agents.
- Onboarding that suggests agent templates by team and installs one without leaving the page.

When not to use:
- Configuring a single agent's prompt, tools or schedule: use a settings form or agent routines.
- Showing a running agent's progress: use agent status or tool call.

Keywords: agent marketplace, agent templates, ai agents, agent gallery, integrations, install flow, oauth scopes, grant access, app directory, filter chips, search, claude, gpt, gemini, slack, hubspot, github

Files: agent-gallery.module.css, agent-gallery.tsx, demo.tsx

## `agent-orchestrator` — Agent orchestrator (Pro, block)

A lead agent splits a goal into a plan, fans the subtasks out to parallel worker lanes and merges what comes back, with each lane's model, progress and result in view.

When to use:
- Showing a multi agent run where a lead model splits a task across subagents, such as research, audits, migrations or comparisons.
- Debug or observability panels that need per worker progress, tool calls, errors, retries, tokens and cost in one view.

When not to use:
- Use agent-run for a single agent working through steps in one thread.
- Use agent-plan when the job is to review and edit a plan before anything runs.

Keywords: multi agent, orchestrator, subagents, parallel agents, fan out, fan in, lead agent, agent workflow, concurrency, tool calls, token usage, cost, retry, agent observability, claude, ai agents

Files: agent-orchestrator.module.css, agent-orchestrator.tsx, demo.tsx

## `agent-routines` — Agent routines (Pro, block)

Scheduled agents in one card: each routine reads as a sentence with its schedule, next run countdown, connectors and destination, and opens smoothly to edit or run it now.

When to use:
- Settings or automation screens where people schedule agents to run on their own and post results to Slack.
- A card on a dashboard that shows at a glance which scheduled agents are healthy, which failed and when each runs next.

When not to use:
- Use agent-run to watch a single agent work through a task in real time with its tool calls.
- Use agent-tasks for a queue of one-off jobs that run once rather than on a schedule.

Keywords: scheduled agents, agent routines, cron, automations, recurring tasks, ai agent schedule, run history, slack digest, triage bot, agent runs, natural language schedule, workflow automation

Files: agent-routines.module.css, agent-routines.tsx, demo.tsx

## `agent-run` — Agent run (Pro, block)

A single card that follows one AI coding agent through a task: steps stream in with the live one shimmering, tool calls open in place, and the agent stops on a two-file diff for you to approve or send back before it writes. When the run ends, the steps fold into one line and a result shows the files changed, the checks that passed and a pull request button.

When to use:
- Coding agents and background jobs that read, search, edit and test, where people watch progress and approve the change before it is written.
- Product surfaces that hand an agent a ticket and return a pull request, such as an issue tracker, a review tool or an IDE side panel.

When not to use:
- Use research-run for a research agent that reads sources and writes a cited report.
- Use agent-approvals for an inbox of pending approvals across many agents and tools.

Keywords: ai agent, coding agent, agent run, tool calls, approval, human in the loop, diff, unified diff, pull request, steps, timeline, claude, streaming, autonomous agent, agent trace

Files: agent-run.module.css, agent-run.tsx, demo.tsx

## `agent-tasks` — Agent tasks (Pro, block)

A home for background coding agents: start a task on a repository and branch, watch each card move from queued to running to ready for review, and open a pull request from the result.

When to use:
- A product surface where people hand coding tasks to background agents and come back later to review, open a pull request, retry or archive.
- Dashboards for automated maintenance runs, such as dependency upgrades, flaky test fixes or codemods, where each run ends in a branch with a diff and checks.

When not to use:
- Use agent-run to follow one live agent run in detail, with its plan, tool calls and output.
- Use code-review when people need to read the diff line by line and leave comments; this block only summarizes the change.

Keywords: background agents, coding agent, agent tasks, task queue, cloud agent, pull request, diff stat, ci checks, step log, changed files, retry, cancel, archive, repository picker, branch picker, model picker, ai agent dashboard

Files: agent-tasks.module.css, agent-tasks.tsx, demo.tsx

## `eval-suite` — Eval suite (Pro, block)

Run an evaluation suite on a new version of an LLM feature against its baseline: results stream in case by case, and regressions and fixes are called out with the cases behind them.

When to use:
- Regression testing an LLM feature before shipping a new prompt, model or agent version.
- CI style eval dashboards where people need the overall score, the per category picture and the exact cases that broke in one place.

When not to use:
- Use prompt-studio to edit a prompt and try it on one test case at a time.
- Use model-arena for a blind side by side vote between models on a single prompt.

Keywords: eval, evals, evaluation suite, llm evaluation, regression testing, llm judge, rubric, test cases, pass rate, baseline, prompt regression, model comparison, diff, ai quality, ci for prompts

Files: demo.tsx, eval-suite-data.ts, eval-suite.module.css, eval-suite.tsx

## `knowledge-base` — Knowledge base (Pro, block)

A retrieval knowledge base in one card: add sources and watch them parse, chunk, embed and index, then test a question and see which chunks come back and why.

When to use:
- Admin screens for a RAG or support assistant where people add documents, watch them index, and check what a question retrieves.
- Explaining or tuning chunking, hybrid search and reranking with a working test bench instead of a diagram.

When not to use:
- Use vector-search to illustrate how embeddings and nearest neighbours work; this block is the working product surface.
- Use document-extract to pull structured fields out of a single document.

Keywords: knowledge base, rag, retrieval, vector store, embeddings, chunking, ingestion, reranking, reranker, hybrid search, semantic search, document indexing, top k, similarity score, retrieval test, ai search

Files: demo.tsx, knowledge-base-data.ts, knowledge-base.module.css, knowledge-base.tsx

## `mcp-servers` — MCP servers (Pro, block)

Manage the MCP servers that give an agent its tools: see what the enabled tools cost in context, connect or pause a server, and switch single tools on or off.

When to use:
- Settings for an agent or AI assistant that connects to MCP servers: which servers it has, which tools are on and what they cost in context.
- Onboarding a new integration with a directory, sign in and tool discovery in one place.

When not to use:
- Use agent-approvals to approve or deny individual tool calls while the agent runs.
- Use context-window to show everything in the context window, not only tool definitions.

Keywords: mcp, model context protocol, mcp servers, tools, integrations, connectors, agent tools, tool definitions, context budget, token cost, oauth, tool discovery, permissions, always allow reads, ai agent settings

Files: demo.tsx, mcp-servers.module.css, mcp-servers.tsx
