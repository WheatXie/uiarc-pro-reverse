# AI

## `agent-cursor` · Agent cursor (Pro, special)

A live document where Claude edits like a collaborator. Its labeled cursor comes out of its avatar, selects a paragraph and streams in a rewrite, adds a heading and fixes a typo, while a teammate's cursor reads along. Changes stay tinted until someone accepts or undoes them from a floating review bar.

When to use:
- Showing an AI writing assistant that edits a doc alongside people, with accept and undo.
- Landing or onboarding sections that demo a collaborative AI editor in motion.

When not to use:
- Free form chat or Q&A: use a chat transcript component.
- A real rich text editor: wire your editor's own collaboration cursors; this card renders read-only blocks.

Keywords: special, ai, new, ai cursor, agent cursor, multiplayer cursor, collaborative editing, ai writing assistant, live document edit, accept changes, suggested edits, claude, notion ai, presence

Files: agent-cursor.module.css, agent-cursor.tsx, demo.module.css, demo.tsx

## `agent-handoff` · Agent handoff (Pro, special)

A support conversation where an AI assistant hands off to a person. When it transfers, a card shows the summary it passes to the team and the typical wait. The person then joins and takes over, and a thin timeline on the left marks each step.

When to use:
- A support widget where the AI answers first and escalates to a human agent.
- Showing customers what the assistant shared with the team, so they do not repeat themselves.

When not to use:
- A general chat with one assistant and no handoff: use chat-thread.
- Showing an agent's internal steps or tool calls: use agent-timeline or tool-call.

Keywords: special, ai, new, agent handoff, human handoff, ai escalation, transfer to human, support chat, live chat, intercom, zendesk, ai support agent, customer support widget, escalation summary

Files: agent-handoff.module.css, agent-handoff.tsx, demo.tsx

## `agent-memory` · Agent memory (Pro, block)

One card for what an assistant remembers about you: filter and search memories, edit or forget one in place, and turn saved memories and chat history on or off.

When to use:
- Settings for an assistant that remembers people across chats, where people need to see, filter, search, correct and delete what it knows.
- Showing the moment an assistant saves something from a chat, with a way to see where it was filed.

When not to use:
- Use knowledge-base for documents and files an agent retrieves from, rather than short facts about the user.
- Use context-window to show what fills a single conversation's token budget, rather than what persists across chats.

Keywords: memory, assistant memory, agent memory, saved memories, chat history, personalization, memory updated, remember, forget, undo, filter, settings, preferences, llm, ai, privacy, user profile

Files: agent-memory.module.css, agent-memory.tsx, demo.tsx

## `agent-plan` · Agent plan (Pro, special)

The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.

When to use:
- An agent should show and get approval for its plan before it edits code, runs commands or touches production.
- A person needs to adjust the agent's plan (rename, reorder, remove or add steps) and then watch the same plan execute.

When not to use:
- Use agent-run for a streaming transcript of everything the agent did, with tool calls and output, rather than a checklist of steps.
- Use agent-approvals when the person approves individual risky actions one at a time instead of a whole plan up front.

Keywords: special, motion, ai, new, agent plan, plan mode, todo list, task plan, checklist, approve plan, coding agent, ai agent, step list, reorder, drag and drop, progress, retry, human in the loop, claude

Files: agent-plan.module.css, agent-plan.tsx, demo.tsx

## `agent-status` · Agent status (Pro, special)

A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.

When to use:
- An app header, title bar or composer that needs to show at a glance that an agent is running, what it is doing and for how long.
- Coding, research or browser agents that pause for approval, so the person can approve or deny without opening a full run view.

When not to use:
- Use agent-run or research-run when the run itself is the page and every step, tool call and output needs room.
- Use agent-approvals to review a queue of pending approvals across several agents.

Keywords: special, motion, ai, new, agent status, ai agent, status pill, run status, live indicator, approval, human in the loop, coding agent, research agent, elapsed timer, progress, dynamic island, agent run, claude, tool calls

Files: agent-status.module.css, agent-status.tsx, demo.module.css, demo.tsx

## `agent-timeline` · Agent timeline (Pro, special)

A compact timeline of one orchestrated agent run: the orchestrator and its subagents share a time axis, handoffs draw in between rows, and a playhead replays thinking, tool calls and waiting while the header counts time, tokens and cost. Hover a span for what it did, or click it to trace its handoff path.

When to use:
- Showing how an orchestrator split work across subagents and how long each part took, in a run history, a trace viewer or a debugging panel.
- Replaying a finished agent run in a product demo or changelog, with real numbers for time, tokens and cost.

When not to use:
- Use agent-orchestrator for a full screen of agent lanes with streaming text and messages; this timeline is the compact, reusable view of timing.
- Use observability-trace for distributed request tracing across services rather than agents.

Keywords: special, motion, ai, new, agent timeline, multi-agent, orchestrator, subagents, agent trace, gantt, handoff, tool calls, run replay, playhead, scrubber, tokens, cost, parallel agents, llm

Files: agent-timeline.module.css, agent-timeline.tsx, demo.tsx

## `ai-answer` · AI answer (Pro, block)

One AI answer set like a clean article: it thinks, shows its sources as small cards with colored marks, and streams a formatted answer where every citation lights the sentence it supports. Copy, regenerate with options, rate, share, page through versions and ask a related question in place.

When to use:
- An answer page where one question gets one well formatted, cited answer that people read, copy and share.
- Docs and help center assistants that must show where each claim comes from.

When not to use:
- Use ai-chat for a back and forth conversation with many turns kept on screen.
- Use research-run for long multi step research that plans searches and reads many sources before writing.

Keywords: ai answer, answer engine, cited answer, citations, sources, streaming, reasoning, thinking, regenerate, feedback, follow-up questions, perplexity style, llm, markdown, answer page

Files: ai-answer.module.css, ai-answer.tsx, demo.tsx

## `ai-chat` · AI chat (Pro, block)

A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.

When to use:
- A multi turn assistant inside a product page, drawer or dashboard card, with streaming answers, reasoning, tools and citations.
- Any place users need to retry, edit, rate or copy answers and switch models mid conversation.

When not to use:
- Use ai-composer when you only need the prompt box with attachments, mentions and commands.
- Use ai-answer for a single question and a long, article like answer with sources.

Keywords: ai chat, chatbot, llm chat, assistant, streaming, markdown, reasoning, thinking, tool calls, citations, model switcher, regenerate, message versions, chat history, stop generating, claude, gpt, gemini

Files: ai-chat.module.css, ai-chat.tsx, demo.tsx

## `ai-command` · AI command (Pro, special)

A Cmd+K command palette with an AI mode. Search pages and actions, or press Tab to ask a question: the answer streams inside the palette with numbered sources, and the next steps it suggests, like filing a Linear issue or opening a Notion doc, run straight from the list.

When to use:
- A global Cmd+K in a SaaS app where people both jump to pages and ask questions about their workspace.
- Search that should fall back to an AI answer when nothing matches.

When not to use:
- A long, multi-turn conversation: use a chat thread.
- Plain navigation with no AI: use command-palette.

Keywords: special, ai, new, command palette, cmd k, command menu, ask ai, ai search, spotlight, raycast, quick actions, streaming answer, citations, sources, keyboard

Files: ai-command.module.css, ai-command.tsx, demo.module.css, demo.tsx

## `ai-composer` · AI composer (Pro, block)

The prompt box at the bottom of an AI app: files upload in place, / opens commands, @ inserts mentions, a model and effort menu sits in the toolbar, and the send button turns into a stop control ringed by the reply's progress.

When to use:
- The prompt box of an assistant, a coding agent or an in-product AI feature where people attach files, mention docs and pick a model.
- A new chat screen that should open on a greeting and suggestions, then show the first exchange.

When not to use:
- Use ai-chat for a full conversation with history, message actions and a sidebar of chats.
- Use ai-inline-edit to rewrite a selection inside a document instead of chatting about it.

Keywords: ai composer, chat input, prompt box, chat composer, message input, send button, stop generating, attachments, file upload, slash commands, mentions, model picker, effort, dictation, streaming, claude, assistant

Files: ai-composer.module.css, ai-composer.tsx, demo.tsx

## `ai-feature-launch` · AI feature launch (Pro, block)

An in-product launch card for an AI feature. A looping mini demo plays above a three-step tour (inline rewrite, thread summary, ask your workspace), with benefit rows, an admin-gated "Enable for my workspace" switch, and Try it now and Learn more actions.

When to use:
- Announcing a new AI feature inside the product, with a tour of what it does and a switch to turn it on for the workspace.
- Admin-gated rollouts where an admin enables AI for everyone and members can still try it.

When not to use:
- Multi-step configuration with real inputs (models, data sources): use ai-setup-wizard.
- Ongoing activation tasks: use onboarding-checklist.

Keywords: ai feature launch, introducing ai, feature announcement, launch modal, whats new, product tour, onboarding tour, enable ai, workspace setting, admin toggle, rollout, announcement card, notion ai, linear launch, pagination dots

Files: ai-feature-launch.module.css, ai-feature-launch.tsx, demo.tsx

## `ai-inline-edit` · AI inline edit (Pro, block)

A document you edit with AI in place: ⌘K on a selection, watch the rewrite stream in as a diff, accept each change, and Tab through ghost text.

When to use:
- Rewriting a selection: shorten, clarify, change tone or fix grammar in place.
- Inline autocomplete while writing documents or messages.

When not to use:
- Rich formatting such as headings, lists or links; the block edits plain paragraphs.
- Asking questions about a page; use ai-side-panel.

Keywords: ai editor, inline edit, rewrite, diff, suggestions, autocomplete, ghost text, copilot, cmd k, notion ai, tab to accept, accept reject

Files: ai-inline-edit.module.css, ai-inline-edit.tsx, demo.tsx

## `ai-insight-card` · AI insight card (Pro, block)

A KPI card that explains itself. Explain streams a short reason for the change and ranks three drivers with contribution bars. A numbered annotation lights up on the sparkline as each driver is read, and follow-up chips ask the next question in place.

When to use:
- A dashboard KPI where readers ask why it moved, such as net revenue, MRR, signups or churn.
- Weekly business reviews and finance dashboards that want an explanation next to the number.

When not to use:
- Open ended questions across many tables: use ask-your-data.
- A plain number with no explanation: use metric-card or stat-card.

Keywords: ai insight, kpi card, explain metric, revenue explanation, drivers, sparkline, analytics ai, metric annotation, why did revenue drop, dashboard card

Files: ai-insight-card.module.css, ai-insight-card.tsx, demo.tsx

## `ai-mascot` · AI mascot (Pro, special)

A small assistant character, a soft pebble with pill eyes and a companion dot, that shows what the AI is doing. It breathes and glances when idle, leans in to listen, looks up while the dot orbits its head, reads along the line it writes, squints with a sparkle when done and shakes once with worried brows on an error.

When to use:
- Give an assistant a face that shows what it is doing: in a reply header, beside a composer, on an image canvas while it generates, or in an empty state.
- Products that want generation to feel alive and friendly without a spinner, with states that read at 24px.

When not to use:
- Use agent-status when people need the steps, tools and elapsed time of a run, not just a mood.
- Use text-shimmer alone for a plain "Thinking" line in dense interfaces where a character would distract.

Keywords: special, ai, motion, new, ai mascot, assistant character, ai avatar, thinking animation, generating, loading character, agent face, blob, listening, writing, done sparkle, error shake, empty state, eyes follow cursor, svg animation

Files: ai-mascot.module.css, ai-mascot.tsx, demo.module.css, demo.tsx

## `ai-search-bar` · AI search bar (Pro, block)

A search card for an app or docs, where typing lists grouped results right away (Docs, Customers, Issues) and pressing Tab streams a short AI answer on top. The answer's numbered citations point to the results below it.

When to use:
- A product or docs search where people mix finding a page or record with asking a question.
- Support and success tools that search docs, customers and tickets in one place.

When not to use:
- Use ai-answer for a full answer page with long formatted answers, follow ups and feedback.
- Use ai-chat for a back and forth conversation.

Keywords: ai search, search bar, ask ai, command palette, docs search, instant search, grouped results, keyboard navigation, citations, streaming answer, algolia ask ai, mintlify search, linear search, combobox, rag

Files: ai-search-bar.module.css, ai-search-bar.tsx, demo.module.css, demo.tsx, kbd.module.css

## `ai-setup-wizard` · AI setup wizard (Pro, block)

A three-step setup card for turning on an AI feature. You connect Notion, Google Drive, Confluence or Zendesk and watch each one sync. Then you pick the model, tone and guardrails, and ask a test question whose answer streams with numbered citations before you go live.

When to use:
- Turning on an AI answers feature for a support, sales or internal knowledge team, like Intercom Fin, Zendesk AI or Notion Q&A.
- Onboarding admins to a copilot that needs data sources, a model choice and guardrails before it is enabled.

When not to use:
- Configuring an agent's instructions, tools and files in depth: use agent-builder.
- Only choosing a model: use model-picker.

Keywords: ai setup wizard, onboarding wizard, stepper, connect data sources, knowledge base sync, model picker, guardrails, test ai answer, citations, go live, ai feature onboarding, rag setup

Files: ai-setup-wizard.module.css, ai-setup-wizard.tsx, demo.tsx

## `ai-side-panel` · AI side panel (Pro, block)

An assistant docked beside a page that reads it and edits it: ask about the page or a selected passage, review each edit as a word diff, and apply it with a tint sweep on the page and one-click undo.

When to use:
- An assistant next to a document or record that can summarize it and propose edits.
- Copilot style help where edits must be approved, applied visibly and undone.

When not to use:
- A standalone conversation; use ai-chat.
- Rewriting a passage in place with no side panel; use ai-inline-edit.

Keywords: ai assistant, copilot, side panel, document assistant, suggested edits, word diff, apply and undo, context chips, ask about selection, streaming, bottom sheet, claude

Files: ai-side-panel.module.css, ai-side-panel.tsx, demo.tsx

## `ai-spark` · AI spark (Pro, special)

A brand-quality animated spark mark. Four tapered rays and four lighter diagonals breathe at rest, ripple while thinking, pulse like a heartbeat while writing, then gather and settle when done. Every status change blends from the pose the mark is already in.

When to use:
- Showing that an assistant is thinking or writing, inline above a streaming reply.
- A send or generate button that turns into a working indicator inside a composer.

When not to use:
- Determinate progress with a known percentage; use a progress bar or the generation stats component instead.
- Multi step agent runs where each step needs its own state and detail; use agent-status or agent-run.

Keywords: special, ai, motion, new, ai spark, ai sparkle, asterisk, thinking indicator, generating indicator, ai loader, ai logo animation, working indicator, ai status mark, spinner alternative, ai avatar, sparkle animation

Files: ai-spark.module.css, ai-spark.tsx, demo.tsx

## `ai-translate` · AI translate (Pro, special)

A message card where picking a language streams the AI translation in place, sentence by sentence over the dimmed original, with a detected-language chip, a Show original toggle and a status line credited to the model's mark.

When to use:
- Messages, comments, reviews or support tickets written in another language, translated on demand inside the product.
- Release notes or announcements that readers in several regions open in their own language.

When not to use:
- Translating a whole page or app interface; use your i18n framework.
- Long documents with headings and lists; this renders one plain paragraph.

Keywords: special, ai, new, ai translate, translation, inline translation, show original, language picker, detected language, streaming text, multilingual, localization, message translation, claude, llm, i18n

Files: ai-translate.module.css, ai-translate.tsx, demo.module.css, demo.tsx

## `ai-workflow` · AI workflow (Pro, special)

A Linear-style AI workflow card where a Gmail trigger, a Claude step, a branch and Slack and Linear actions sit on one hairline rail, and a test run glides down it, opening each step's output inline. Steps are added from a compact command menu with real app marks.

When to use:
- An automation or integrations page where people assemble a short trigger, AI step and action flow and want to test it in place.
- Onboarding or marketing surfaces that show how an AI step slots between real apps, with a working test run.

When not to use:
- Large free-form graphs with many branches, loops or merges: use a canvas editor instead.
- Showing a single tool call or a live agent's steps: use tool-call or agent-run.

Keywords: special, ai, new, workflow builder, automation, zapier, n8n, make, ai workflow, flow builder, trigger action, test run, integration, branch, claude, gmail, slack, linear

Files: ai-workflow.module.css, ai-workflow.tsx, demo.tsx

## `ask-your-data` · Ask your data (Pro, special)

A natural language to chart card: you ask a question, PostgreSQL streams into a collapsible, syntax highlighted panel, the query runs with a rolling row count, and the answer builds as stacked bars, lines or a table, with a one line insight streamed in underneath.

When to use:
- Letting people ask product or business questions in plain words and see a chart, with the SQL one click away to verify or copy.
- Embedding an analytics answer in a dashboard card, an admin page or an AI assistant's result view.

When not to use:
- Use bar-chart or line-chart when the query is fixed and there is no question to ask.
- Use tool-call to show a database query as one step inside a longer agent transcript.

Keywords: special, ai, new, ask your data, text to sql, natural language query, nl2sql, ai analytics, chart, postgresql, sql generation, stacked bar chart, line chart, data table, insight, bi, self serve analytics

Files: ask-your-data.module.css, ask-your-data.tsx, demo.module.css, demo.tsx

## `call-insights` · Call insights (Pro, block)

A sales call insights card where talk time, flagged pricing, competitor and objection moments, an AI summary and owned next steps sit in one view. Selecting a moment plays its quote, and checking off next steps lowers the deal risk.

When to use:
- A deal page that shows the latest sales call with talk ratio, flagged moments, summary and next steps.
- A call review queue for sales managers who coach on talk time and objection handling.

When not to use:
- Full transcript reading or editing: use transcript-studio.
- An internal meeting recap without a prospect or deal: use meeting-summary.

Keywords: call insights, sales call, conversation intelligence, gong, talk time, talk ratio, call recording, deal risk, next steps, call summary, objection, competitor mention

Files: call-insights.module.css, call-insights.tsx, demo.tsx

## `catch-up` · Catch up (Pro, block)

A catch me up digest for when you return, where one button reads Slack, Linear, GitHub and Gmail for the range you pick and streams back a short ranked summary: Needs you, Decisions made, Shipped and FYI. Each item is one sentence with its source mark, people and a jump link, and marking items as read clears them with a smooth collapse.

When to use:
- A home or inbox screen that summarizes what happened across connected tools while the user was away.
- An AI assistant feature that turns hundreds of notifications into a short ranked list with jump links.

When not to use:
- A live notification feed where every event matters; use a plain activity list instead.
- A long-form report or meeting summary with paragraphs; use a document view or ai-chat.

Keywords: catch up, catch me up, digest, ai summary, chief of staff, while you were away, inbox summary, slack summary, notifications digest, linear, github, gmail, prioritized summary, mark as read

Files: catch-up.module.css, catch-up.tsx, demo.tsx

## `code-suggestion` · Code suggestion (Pro, special)

An AI code edit suggestion where the model's proposed changes stream into a small editor panel as inline diff hunks, and you accept or reject each one, or all at once with Cmd+Enter. Accepted hunks fold into the file with a smooth height change.

When to use:
- Showing an AI's proposed edit to a file as an inline diff the person accepts or rejects hunk by hunk.
- Approving an agent's file change before it is written, with a clear record of what was kept.

When not to use:
- Use a dedicated diff tool for large multi file diffs or side by side comparisons; this card is for one file and a handful of hunks.
- Use code-magic-move to animate code from one version to another without a review step.

Keywords: special, ai, new, code suggestion, ai code edit, inline diff, accept reject, cursor, copilot, code review, diff hunk, inline edit, ai coding, apply changes, claude, code diff, suggested changes, accept all

Files: code-suggestion.module.css, code-suggestion.tsx, demo.module.css, demo.tsx

## `connector-setup` · Connector setup (Pro, special)

A "Connect your tools" card for an AI assistant. Each app connects inline: it redirects, authorizes and runs a first sync with a progress hairline, then lists the scopes it was granted and offers Disconnect with an inline confirm.

When to use:
- An assistant's settings or onboarding step where people connect workspace apps.
- A first-run checklist that needs to show the OAuth handshake and first sync inline, without leaving the page.

When not to use:
- Browsing dozens of integrations by category: use the integrations-grid block.
- Approving a single action the agent wants to take: use agent-approvals.

Keywords: special, ai, new, connectors, integrations, connect apps, oauth, connect your tools, ai assistant settings, mcp connectors, slack integration, github integration, scopes, permissions, disconnect

Files: connector-setup.module.css, connector-setup.tsx, demo.tsx

## `context-window` · Context window (Pro, special)

An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.

When to use:
- Showing developers or power users what fills a model's context and when it will compact.
- Agent and coding tools that compact long sessions and want the effect to be understandable.

When not to use:
- A simple quota or plan usage bar; use usage-meter.
- Choosing a model; use model-picker.

Keywords: special, ai, tokens, chart, motion, new, context window, token usage, llm context, compaction, summarize conversation, prompt tokens, mcp tools tokens, output reserve, ai session, token budget

Files: context-window.module.css, context-window.tsx, demo.tsx

## `cube-mascot` · Cube mascot (Pro, special)

An isometric cube mascot where three shaded faces and a painted-on face show what the assistant is doing. It turns a quarter turn in eased steps while thinking, prints lines onto the floor while writing, settles with a sparkle when done, and shakes once on error.

When to use:
- Give an assistant a recognisable, product-like character that shows it is generating: in a reply header, in a composer, on an image canvas or in an empty state.
- Brands with a geometric, technical feel where a soft blob would feel off.

When not to use:
- Use ai-mascot for a softer, rounder character, or when you need a listening state.
- Use agent-status when people need the steps, tools and elapsed time of a run.

Keywords: special, ai, motion, new, cube mascot, isometric cube, ai mascot, assistant character, 3d cube, thinking animation, generating, loading character, agent face, writing, done sparkle, error shake, empty state, svg animation

Files: cube-mascot.module.css, cube-mascot.tsx, demo.module.css, demo.tsx

## `dictation-button` · Dictation button (Pro, special)

A chat composer with voice input, where the mic springs into a recording pill with a smooth live waveform, a timer, and cancel and insert buttons. Words stream into the field as you speak, muted until the recognizer settles them.

When to use:
- Chat and agent composers where people would rather talk than type: mobile, long prompts, accessibility.
- Notes, comments and support replies where dictation saves time and the person still edits before sending.

When not to use:
- Full duplex voice conversations with spoken replies; use a voice agent pattern with call controls instead.
- Recording audio files to keep (voice memos); this inserts text and discards audio.

Keywords: special, ai, new, dictation, voice input, speech to text, mic button, microphone, voice typing, transcription, web speech api, speechrecognition, waveform, recording pill, composer, chat input, interim results, ai composer

Files: demo.tsx, dictation-button.module.css, dictation-button.tsx

## `document-extract` · Document extraction (Pro, block)

Turns a document into typed data with a model and shows where every value came from: fields fill in as the page is read, and hovering a value lights its source on the PDF.

When to use:
- Accounts payable, logistics or back office tools that turn invoices, receipts, emails or forms into records a person accepts before saving.
- Any extraction flow where a reviewer needs to see exactly where each value came from and fix the few the model was unsure about.

When not to use:
- Use ai-answer for a written answer with citations rather than typed fields.
- Use knowledge-base to search and cite across many documents instead of reading one.

Keywords: document extraction, structured output, invoice parsing, pdf viewer, data extraction, ocr, llm extraction, json schema, typed output, confidence, human review, source highlighting, citations, form filling, claude haiku

Files: demo.module.css, demo.tsx, document-extract.module.css, document-extract.tsx

## `enrich-column` · Enrich column (Pro, special)

An AI enrichment column for a data table, where one prompt runs down every row and each cell shimmers while it works, then settles into a value with its source or a failure you can retry.

When to use:
- Enriching a list of companies or leads with facts an agent can look up (headcount, funding, tech stack).
- Classifying or summarizing rows with one prompt, with a visible source per answer.

When not to use:
- Large spreadsheets with many columns and editing; use Data grid and add an AI column there.
- A single question over a dataset; use Ask your data.

Keywords: special, ai, new, enrich column, ai column, clay, data enrichment, lead enrichment, ai table, spreadsheet ai, company data, headcount, funding round, retry, shimmer, agent

Files: demo.module.css, demo.tsx, enrich-column.module.css, enrich-column.tsx

## `generation-stats` · Generation stats (Pro, special)

A live stats strip for a streaming LLM response where time to first token, speed with a sparkline, output tokens and cost count up in tabular numerals beside the model's real mark, then settle and open into a latency and token cost breakdown.

When to use:
- Under assistant messages in a chat product that shows people what a response cost or how fast it was.
- Playgrounds, eval runners and internal dev panels comparing models on latency, throughput and cost.

When not to use:
- Use context-window to show how much of a model's context a conversation has used.
- Use a chart or table for spend across many requests or days; this strip describes one response.

Keywords: special, ai, new, generation stats, llm stats, tokens per second, time to first token, ttft, latency, token usage, cost, streaming, sparkline, prompt cache, cached tokens, reasoning tokens, claude, gpt, gemini, dev panel, usage meter

Files: demo.tsx, generation-stats.module.css, generation-stats.tsx

## `ghost-mascot` · Ghost mascot (Pro, special)

A floating ghost mascot whose soft sheet ripples at the hem while it hovers. It blinks when idle, turns toward you to listen, fades a little translucent while thinking, draws a tiny pen line while writing, smiles with a sparkle when done and wobbles once on an error.

When to use:
- Give an assistant a light, friendly face that shows what it is doing: in a reply header, in a composer, over an image canvas while it generates, or in an empty state.
- Products that want generation to feel alive without a spinner, with states that still read at 24px.

When not to use:
- Use agent-status when people need the steps, tools and elapsed time of a run, not just a mood.
- Use text-shimmer alone for a plain "Thinking" line in dense interfaces where a character would distract.

Keywords: special, ai, motion, new, ghost mascot, ai mascot, assistant character, ai avatar, generating animation, thinking animation, loading character, ghost, listening, writing, done sparkle, error wobble, empty state, svg path morph, wavy hem

Files: demo.module.css, demo.tsx, ghost-mascot.module.css, ghost-mascot.tsx

## `ghost-text` · Ghost text (Pro, special)

An inline AI autocomplete where muted ghost text continues your sentence exactly at the caret and Tab turns it solid in place. Cmd+Right takes it one word at a time, Escape fades it away, and a calm chip shows the model behind it.

When to use:
- Long-form fields people write in product: pull request descriptions, emails, support replies, issue bodies, release notes, CRM notes.
- Short single-line fields where a likely completion saves typing, such as an email subject or a commit message.

When not to use:
- Use ai-composer for a chat-style prompt box that sends a message to an assistant.
- Use code-suggestion for code diffs with accept and reject per hunk.

Keywords: special, ai, new, ghost text, ai autocomplete, inline suggestion, copilot, tab to accept, text completion, autocomplete textarea, predictive text, smart compose, llm, claude, streaming, pull request, email, writing assistant

Files: demo.tsx, ghost-text.module.css, ghost-text.tsx, kbd.module.css

## `image-generation` · Image generation (Pro, special)

An image studio where each image forms on a dot matrix: a soft halftone wave breathes across the grid, the dots take the colours of the coming photo and grow into a coloured halftone, then blur away into the sharp photo. One large canvas with a mono size label, a filmstrip of four variations, a prompt bar with model and ratio, and upscale with a sweeping dot band, vary or download, with real provider marks and a built-in simulation.

When to use:
- A text to image feature inside a product: marketing asset tools, listing photo helpers, slide or doc illustration.
- Any flow where people compare a few candidates and continue with one (upscale, vary, download).

When not to use:
- A full canvas editor with layers, masks and inpainting; build on a canvas library instead.
- Drawing a sketch to turn into an image; use sketch-to-image.

Keywords: special, ai, new, image generation, text to image, ai image, diffusion, prompt, upscale, variations, filmstrip, generate images, aspect ratio, dot matrix, halftone, loading state, dot spinner, blur to sharp

Files: demo.module.css, demo.tsx, image-generation.module.css, image-generation.tsx

## `image-reveal` · Image reveal (Pro, special)

An image generation canvas where a soft, blurred preview made from the image's own colors sharpens top to bottom behind a soft-edged band. It works the way ChatGPT, Midjourney and Gemini show images forming, with fine film grain, a translucent progress pill and calm queued and error states.

When to use:
- Showing an image model's progress on a canvas or in a chat reply.
- A batch of image variations sampling side by side.

When not to use:
- Plain image loading from a CDN; use a blur-up placeholder or a skeleton.
- Text generation or tool calls; use text-shimmer or tool-call.

Keywords: special, ai, motion, new, image generation, ai image, generating, progressive reveal, diffusion, denoising, latent noise, sampler steps, vae decode, progress, canvas, image placeholder, midjourney style, chatgpt image

Files: demo.tsx, image-reveal.module.css, image-reveal.tsx

## `install-snippet` · Install snippet (Pro, special)

A "get started in 30 seconds" card where framework tabs, three numbered steps and highlighted snippets take a developer from install to first event. Generate key wipes a fresh API key into the placeholder in place.

When to use:
- A quickstart that has to work for several frameworks without three pages of docs.
- Onboarding where creating an API key is part of getting started.

When not to use:
- A single code sample with no steps: use code-block.
- Trying requests against a live API: use api-playground.

Keywords: special, saas, new, install snippet, quickstart, getting started, sdk install, npm install, api key, code tabs, framework tabs, developer onboarding, copy code

Files: demo.tsx, install-snippet.module.css, install-snippet.tsx

## `lead-scoring` · Lead scoring (Pro, block)

A lead scoring card where inbound B2B leads are ranked by an AI fit score, each with a score ring and a one-line reason. Open a lead to see its signals and score breakdown, then push it to HubSpot or Salesforce.

When to use:
- A sales inbox or SDR queue that ranks new inbound leads by fit.
- Showing why a model scored a lead, with signals and a weighted breakdown.

When not to use:
- Large tables of hundreds of leads with filters and bulk edits; use a data table.
- Enriching columns of company data; use enrich-column.

Keywords: lead scoring, ai lead scoring, inbound leads, sales qualification, fit score, crm, hubspot, salesforce, sdr queue, b2b sales

Files: demo.tsx, lead-scoring.module.css, lead-scoring.tsx

## `live-visitors` · Live visitors (Pro, special)

A realtime visitors card where the live count rolls digit by digit, new arrivals ping in on a dotted world map, the top pages reorder with bars, and signups and upgrades tick in with country flags.

When to use:
- Realtime visitors on a marketing site or app, next to signups and upgrades as they happen.
- Launch days and campaigns where a team watches traffic and conversions live.

When not to use:
- Historical trends over days or weeks; use a chart with axes.
- Precise geography or per-country breakdowns; use a table or a proper map.

Keywords: special, saas, new, live visitors, realtime analytics, active users, visitors now, world map, dotted map, top pages, signups, upgrades, conversion ticker, rolling number, odometer, country flags, live dashboard

Files: demo.tsx, live-visitors.module.css, live-visitors.tsx

## `llm-cost-calculator` · LLM cost calculator (Pro, special)

A pricing calculator for LLM workloads. Set tokens per request, requests per day and prompt caching, and eight current models re-rank by monthly cost. Bars glide and prices roll as you drag.

When to use:
- A pricing or settings page needs an honest monthly estimate for an LLM workload across several models.
- People pick a model for a feature and should see how cost moves with prompt size, output length, traffic and caching.

When not to use:
- Use model-picker to choose a model in a chat or composer without a cost comparison.
- Use context-window to show the live token usage of one conversation against a model's context window.

Keywords: special, ai, new, llm cost calculator, token pricing, ai pricing, model cost, api cost estimate, prompt caching, cached input, price comparison, claude, gpt, gemini, deepseek, monthly cost, budget, slider

Files: demo.module.css, demo.tsx, llm-cost-calculator.module.css, llm-cost-calculator.tsx

## `meeting-summary` · Meeting summary (Pro, special)

An AI meeting notes card: the header shows the Google Meet or Zoom mark, the attendees and the duration. Summary, Decisions and Action items stream in after a short summarizing pass. Hover any line to see the transcript quote it came from, then check off action items or send them to Linear or Notion.

When to use:
- Showing AI notes after a call in a CRM, a recruiting tool, a meeting recorder or a team workspace.
- Turning a transcript into decisions and owned tasks that people can push to their tracker.

When not to use:
- Live captions or a running transcript during the call; use text-stream or a transcript view.
- A general task list with no meeting behind it; use checkbox rows in your own list.

Keywords: special, ai, new, meeting summary, meeting notes, ai notes, action items, call recap, transcript summary, google meet, zoom, linear, notion, decisions, ai meeting assistant

Files: demo.tsx, meeting-summary.module.css, meeting-summary.tsx

## `model-arena` · Model arena (Pro, block)

A blind side by side model comparison in one card: send one prompt to two models, watch both answers stream at the same pace, vote for the better one, then reveal which model wrote each.

When to use:
- Blind human preference tests between two models on the same prompt, such as an internal bake-off before switching providers.
- Prompt or model evaluation tools where people should judge answers without knowing which model wrote them.

When not to use:
- Use model-picker to let someone choose one model for their own chat; this block compares answers, it does not set a default.
- Use eval-suite to score many prompts automatically against expected outputs rather than collecting one human vote at a time.

Keywords: model arena, llm comparison, blind test, side by side, model battle, ab test, human preference, vote, leaderboard, win rate, time to first token, tokens per second, latency, cost, streaming, claude, gpt, gemini

Files: demo.tsx, model-arena.module.css, model-arena.tsx

## `model-card` · Model card (Pro, special)

A model details card where switching models rolls every price, limit and score in place, a token slider estimates monthly cost live, and benchmark bars show each model's rank on hover. Compare crossfades to a side-by-side table against any rival with the better values marked, and the card never changes size.

When to use:
- The detail pane of a model picker, showing what the highlighted model can do and what it costs before someone selects it.
- Model pages in docs or a marketplace, with limits, prices and a quick benchmark read against close rivals.

When not to use:
- Use model-picker to choose between many models; pair it with this card for the details.
- Use context-window to show how full a live conversation's context is.

Keywords: special, ai, new, model card, model details, model picker, llm, ai model, compare models, benchmark, context window, pricing per token, cost estimator, token cost calculator, tokens, claude, gpt, gemini, grok, copy model id, marketplace

Files: demo.tsx, model-card.module.css, model-card.tsx

## `model-picker` · Model picker (Pro, block)

A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.

When to use:
- Choosing the model and effort for a chat, an agent or a playground.
- A default model setting with a short review of what the chosen model costs and how much context it takes.

When not to use:
- Comparing two models' answers side by side; use model-arena.
- A full prompt box with attachments and tools; use ai-composer, which has its own model chip.

Keywords: model picker, model selector, llm model switcher, ai model dropdown, reasoning effort, claude, gpt, gemini, choose model, ai settings

Files: demo.tsx, model-picker.module.css, model-picker.tsx

## `pii-redaction` · PII redaction (Pro, special)

A guardrail card where personal data is redacted before the prompt reaches the model. Scan marks each name, email, phone number and card with its type and swaps it for a placeholder like [EMAIL_1]. The safe prompt travels to Claude, and the reply comes back with the original values put back for the person.

When to use:
- Explaining or proving a privacy guardrail in an AI product: support assistants, health or finance copilots, enterprise chat.
- A settings or onboarding screen where admins see what the PII filter does before they turn it on.

When not to use:
- Use ai-chat or ai-composer for the conversation itself; redact behind the scenes and show this card only where the guardrail needs explaining.
- Do not rely on the built-in detector for compliance; pass a real DLP service through detect.

Keywords: special, ai, new, pii, redaction, guardrail, privacy, data loss prevention, dlp, anonymize, mask, placeholder, llm safety, prompt, claude, personal data, gdpr, support assistant

Files: demo.module.css, demo.tsx, pii-redaction.module.css, pii-redaction.tsx

## `pixel-mascot` · Pixel mascot (Pro, special)

A pixel-art robot that shows what an AI assistant is doing. It idles, thinks, types, celebrates and errors in frame-stepped sprite animations, and stays crisp at every integer size from 24px to 192px.

When to use:
- A friendly generating indicator next to an assistant reply or in a chat composer.
- An empty state or onboarding panel where a small character makes an AI feature feel approachable.

When not to use:
- Detailed agent progress with steps and timings; use agent-status or agent-timeline.
- Dense tables or toolbars where a 24px character is noise; use status-dot or a spinner.

Keywords: special, ai, motion, new, pixel art, 8-bit, 16-bit, sprite, mascot, robot, ai loading, thinking indicator, typing indicator, generating, assistant avatar, retro, loader, empty state

Files: demo.module.css, demo.tsx, pixel-mascot.module.css, pixel-mascot.tsx

## `prompt-studio` · Prompt studio (Pro, block)

One card for editing, testing and shipping a prompt template: variables as chips with sample values, a test run against the chosen model, and versions you can compare and promote to production.

When to use:
- A settings or admin page where a support lead or engineer tunes the prompt behind one AI feature and tests it on real cases.
- Prompt management that needs a compact version history with authors, a diff against an earlier version and a visible production pointer.

When not to use:
- Use ai-chat for an end user conversation; this card edits templates, not messages.
- Use model-arena to compare the replies of several models side by side on one prompt.

Keywords: prompt studio, prompt editor, prompt template, prompt management, prompt versioning, llm playground, template variables, test cases, production prompt, promote to production, prompt diff, system prompt, model effort, streaming reply

Files: demo.tsx, prompt-studio.module.css, prompt-studio.tsx

## `provider-keys` · Provider keys (Pro, special)

A settings card for bring-your-own-key AI products. Each provider row shows its real mark, the masked key, a status and when the key was last used. You can reveal a key for five seconds, copy, rotate or remove it with undo. Adding or rotating a key opens an inline form that checks the format as you type, then tests the connection before saving.

When to use:
- A settings page where users add their own Anthropic, OpenAI, Google AI, Mistral or xAI keys.
- Showing which providers are connected, which keys were rejected, and when each key was last used.

When not to use:
- Choosing a model for a request; use model-picker.
- Managing your own product's API keys for customers with scopes and expiry; use secret-rotation or a table.

Keywords: special, ai, new, api keys, provider keys, byok, bring your own key, anthropic api key, openai api key, secret, settings, rotate key, masked key, connection test

Files: demo.tsx, provider-keys.module.css, provider-keys.tsx

## `provider-status` · Provider status (Pro, special)

A status card for the AI providers your product depends on. Each row shows the provider's real mark, its health as an icon and label, p50 latency and a 30-day uptime bar with a tooltip for each day. An incident row expands into its timeline of updates, and the card checks again on a visible countdown.

When to use:
- Showing the live health, latency and recent uptime of the model providers your product routes to.
- Explaining degraded AI features to users or admins with the provider's incident updates in place.

When not to use:
- A full public status page with components, subscriptions and history: build a page, not a card.
- A single provider's state inside a chat header: use agent-status or a small badge.

Keywords: special, ai, new, provider status, ai status, llm uptime, status page, incident, uptime bar, latency, health check, openai status, anthropic status, model provider, monitoring

Files: demo.tsx, provider-status.module.css, provider-status.tsx

## `reasoning-block` · Reasoning block (Pro, special)

The collapsible thinking block of an AI reply. While the model thinks, a shimmering label counts the seconds and the latest reasoning streams underneath. When it finishes, it folds to "Thought for 7s" and opens to show the full reasoning as calm steps with headings.

When to use:
- Showing a reasoning model's thinking above its answer in a chat or agent transcript.
- Letting people audit why an assistant reached a recommendation without crowding the reply.

When not to use:
- Tool or function calls with inputs and outputs: use ToolCall.
- A multi step agent plan with checkable tasks: use Agent plan.

Keywords: special, ai, new, reasoning, thinking, thought for, extended thinking, chain of thought, reasoning summary, collapsible, ai reply, claude, streaming, llm

Files: demo.tsx, reasoning-block.module.css, reasoning-block.tsx

## `referral-card` · Referral card (Pro, special)

A give-and-get referral card where people copy or share their invite link, invite friends by email as chips, and watch invites move from invited to signed up to earned, with the credit total counting up and a milestone reward unlocking.

When to use:
- A referral or invite program in account settings, billing or an onboarding checklist.
- Showing a person what their invites have earned and how close they are to a bonus reward.

When not to use:
- Team member invites with roles and permissions; use a members table.
- Public leaderboards or affiliate payouts with many columns; use a table.

Keywords: special, saas, new, referral, refer a friend, invite, give get, affiliate, credits, share link, growth, milestone, reward

Files: demo.tsx, referral-card.module.css, referral-card.tsx

## `reply-draft` · Reply draft (Pro, special)

An AI email reply drafter where Claude streams a reply under a received Gmail message. Quick replies steer a fresh draft, tone and length rewrite it with a single crossfade, and you can edit the finished draft before you insert it.

When to use:
- Drafting a reply to an email, ticket or message with an AI model, where the reader reviews and edits before sending.
- Offering quick reply intents plus tone and length controls for generated text.

When not to use:
- Free-form chat with a model: use a chat or composer component instead.
- Inline autocomplete while typing: use ghost-text.

Keywords: special, ai, new, ai reply, email reply, smart reply, draft reply, help me write, gmail ai, tone, rewrite, quick replies, streaming text, claude, inbox ai, support reply

Files: demo.tsx, reply-draft.module.css, reply-draft.tsx

## `research-run` · Research run (Pro, block)

Deep research that plans searches, reads sources with their marks, and streams a cited answer where every chip lights up the sentence it supports.

When to use:
- An answer engine or deep research feature that searches, reads and cites.
- Internal knowledge search where people must verify each claim.

When not to use:
- Open ended conversation without sources; use ai-chat.
- An agent that edits files or runs tools; use agent-run.

Keywords: deep research, answer engine, citations, sources, streaming, perplexity, search, llm, ai answer, follow up, research agent

Files: demo.tsx, research-run.module.css, research-run.tsx

## `response-feedback` · Response feedback (Pro, special)

A feedback control for AI replies where thumbs down opens an inline panel with reason chips and an optional note, thumbs up fills and asks what was good, and a submit shows a short thank-you before folding back into the row.

When to use:
- Collecting thumbs up and down on AI replies in a chat, copilot or search answer.
- Gathering structured reasons (inaccurate, unsafe) for model evaluation or support triage.

When not to use:
- Star or numeric ratings of a product or session: use rating.
- General product feedback not tied to one reply: use feedback-morph.

Keywords: special, ai, new, thumbs up, thumbs down, feedback, ai feedback, response rating, message actions, rlhf, helpful, chat feedback, reasons, llm evaluation

Files: demo.tsx, response-feedback.module.css, response-feedback.tsx

## `smart-form-fill` · Smart form fill (Pro, special)

A paste-to-fill form card where AI reads an email signature or messy notes and fills a contact field by field. Each value flashes in with a confidence dot, its source lights up in the pasted text, low-confidence guesses ask for review, and Undo puts the old values back.

When to use:
- People paste an email signature, a forwarded message or notes and expect the record to fill itself.
- You need visible confidence and an easy review path before AI-filled data is saved.

When not to use:
- Plain data entry with no unstructured source; use form-field and input.
- Long multi-page applications; use multi-step-form and add a paste step to one page.

Keywords: special, ai, new, ai form fill, autofill, smart paste, extract contact, email signature parser, ai form, confidence, crm contact, structured extraction, paste to fill

Files: demo.module.css, demo.tsx, smart-form-fill.module.css, smart-form-fill.tsx

## `social-proof-toast` · Social proof toast (Pro, special)

A stack of social proof notifications for landing and pricing pages, where recent trials, upgrades and verified purchases from people and companies arrive every few seconds. The stack pauses and fans out on hover, and visitors can dismiss any toast.

When to use:
- Showing recent trials, purchases or upgrades on a landing or pricing page.
- A live activity feed for a launch or waitlist page (people joining, teams upgrading).

When not to use:
- System feedback after a user action (saved, copied, failed): use toast or undo-toast.
- Inside a signed in product where activity is not marketing: use an activity feed list.

Keywords: special, saas, new, social proof, fomo notification, recent purchase popup, sales notification, live activity toast, trial signup toast, conversion, landing page, verified badge, toast stack

Files: demo.module.css, demo.tsx, social-proof-toast-marks.tsx, social-proof-toast.module.css, social-proof-toast.tsx

## `source-cards` · Source cards (Pro, special)

A row of cited sources under an AI answer where cards stream in with real site marks while the model searches, the overflow collapses into a stack of favicons, hovering lifts a preview with the passage, and an inline [n] citation highlights its card.

When to use:
- Citations under an AI search or docs assistant answer.
- Showing live search progress ("Searching 3 of 8") while an agent browses.

When not to use:
- A full search results page with many results and filters; use a list layout instead.
- Tool calls with arguments and outputs; use tool-call.

Keywords: special, ai, new, sources, citations, ai search, perplexity, references, web search, favicon, cited answer, rag, search progress

Files: demo.tsx, source-cards.module.css, source-cards.tsx

## `speech-player` · Speech player (Pro, special)

A read-aloud player for AI replies. The Read aloud button in the message's action row turns into a compact player with play, a scrubbable progress bar, speed and a voice picker, and a highlight follows the spoken word through the reply, karaoke style.

When to use:
- A chat or answer surface where people want a reply read out, with the spoken word followed in the text.
- Accessibility and hands free reading for long AI answers, summaries or briefings.

When not to use:
- Use dictation-button to turn speech into text in a composer.
- Use a plain audio player for podcasts or long recordings without a transcript to highlight.

Keywords: special, ai, new, text to speech, tts, read aloud, speech player, karaoke, word highlight, audio player, voice picker, playback speed, ai reply, accessibility, elevenlabs, openai tts, claude, message actions

Files: demo.tsx, speech-player.module.css, speech-player.tsx

## `starter-prompts` · Starter prompts (Pro, special)

A greeting and a grid of starter cards for the empty state of an AI app. The cards are grouped into Write, Code, Analyze and Plan tabs, and a shuffle swaps them with a short staggered crossfade. Picking a card fills the composer, and cards that use a connected app show its mark (Gmail, GitHub, Notion, Linear, Google Calendar).

When to use:
- The empty state of a chat, copilot or agent, before the first message.
- Teaching what an assistant can do with connected tools, such as Gmail, GitHub or Notion.

When not to use:
- Inside a running conversation; use follow-up suggestion chips in the chat thread instead.
- A command launcher with search; use command-palette or ai-command.

Keywords: special, ai, new, starter prompts, prompt suggestions, empty state, ai chat, new chat, conversation starters, prompt cards, composer, shuffle, integrations

Files: demo.tsx, starter-prompts.module.css, starter-prompts.tsx

## `team-switcher` · Team switcher (Pro, special)

A workspace switcher like Linear, Vercel or Slack. The trigger shows the current workspace's logo and plan. The menu has search, your role in each workspace and a Cmd+1 to 9 shortcut for each, and lets you create or join a workspace inline. A highlight glides between rows, and switching crossfades the trigger through a short loading state.

When to use:
- Switching between organizations, teams or workspaces in a multi-tenant SaaS app.
- An account or project picker that needs search, roles and keyboard shortcuts.

When not to use:
- Picking from a short static list of options in a form: use a select or segmented control.
- Global navigation across pages and commands: use the command palette block.

Keywords: special, saas, new, team switcher, workspace switcher, organization switcher, org picker, account switcher, tenant switcher, project switcher, multi-tenant, linear, vercel, slack, dropdown

Files: demo.tsx, team-switcher.module.css, team-switcher.tsx

## `ticket-router` · Ticket router (Pro, special)

A support ticket router where messages from Gmail, Intercom, Slack and Zendesk come in one at a time. An AI classifier labels each one with intent, sentiment and confidence, and the ticket moves into a team lane with an assignee. Low confidence tickets wait in a review lane, and one click there routes them to the suggested team.

When to use:
- Showing how an AI classifier triages inbound support messages into team queues.
- A live triage widget in a helpdesk or ops dashboard, with a human review lane for low confidence.

When not to use:
- A full ticket inbox with search and bulk actions; use a table or list layout.
- A single tool step in a chat transcript; use tool-call.

Keywords: special, ai, new, ticket routing, support triage, ai classifier, helpdesk, intent detection, sentiment, confidence, queue, assignment, intercom, zendesk, gmail, slack, customer support

Files: demo.tsx, ticket-router.module.css, ticket-router.tsx

## `tldr-toggle` · TL;DR toggle (Pro, special)

An article card with a Full, Summary and Key points switch and a length slider. Switching streams an AI summary in place of the article as the card's height springs to fit, and each key point links back to the paragraph it came from, which gets scrolled to and highlighted.

When to use:
- Offering a quick summary or key points above or in place of a long article, doc or report.
- Letting readers verify AI claims against the source, through key points that link back to paragraphs.

When not to use:
- Open-ended questions about content: use an answer or chat component such as ai-answer.
- Short content under a couple of paragraphs, where a summary saves no time.

Keywords: special, ai, new, tldr, summarize, summary toggle, ai summary, key points, article summary, read mode, length slider, streaming summary, source links, citations

Files: demo.tsx, tldr-toggle.module.css, tldr-toggle.tsx

## `tone-tuner` · Tone tuner (Pro, special)

A brand voice card where two sliders (formality and detail) and Friendly, Confident and Empathetic chips rewrite a customer reply. Each changed sentence crossfades in place, new words can be highlighted against the original, and Copy takes the current version.

When to use:
- A composer or help desk reply that offers AI tone controls before sending.
- Brand voice tooling where marketers compare versions of the same copy.

When not to use:
- Free form AI editing with a prompt box: use a chat or composer instead.
- Long documents: the card is sized for a message of a few paragraphs.

Keywords: special, saas, new, tone, brand voice, rewrite, ai writing, formality, tone slider, copy editing, email reply, diff highlight, support reply

Files: demo.module.css, demo.tsx, tone-tuner.module.css, tone-tuner.tsx

## `tool-call` · Tool call (Pro, special)

A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.

When to use:
- Showing what tools an AI agent used inside a chat or agent transcript, with the arguments and results one click away.
- Human in the loop actions where a call must be allowed or denied inline before it runs, such as posting a message or writing to a database.

When not to use:
- Use agent-run for a full multi step run with a plan, a timeline and live logs rather than inline rows in a message.
- Use agent-approvals for a queue of pending approvals across many agents and runs.

Keywords: special, motion, ai, new, tool call, tool use, function call, agent transcript, ai chat, used tools, approval, human in the loop, retry, tool result, mcp, agent, llm tools, inline approval

Files: demo.tsx, tool-call.module.css, tool-call.tsx

## `training-run` · Training run (Pro, special)

A fine-tuning job card where a live train and validation loss curve draws across a fixed step axis that doubles as the epoch progress bar. It shows the learning rate, elapsed time, ETA and the latest evals and checkpoints, has Pause and Cancel while it runs, and ends in results with a Deploy button.

When to use:
- A fine-tuning or training job page in an AI platform, where people watch loss, pause, cancel and deploy.
- An eval or distillation run that reports a loss curve, checkpoints and a final score.

When not to use:
- A generic multi-series chart with no job lifecycle: use line-chart.
- A short agent task with steps rather than a loss curve: use agent-status.

Keywords: special, ai, new, fine-tuning, training run, loss curve, lora, epochs, checkpoint, eval, learning rate, eta, deploy model, ml job, qwen, hugging face

Files: demo.module.css, demo.tsx, training-run.module.css, training-run.tsx

## `trial-banner` · Trial banner (Pro, special)

A trial status banner where a ring counts down the days left, the copy names what the workspace loses, and the upgrade path is one click away. It comes as a slim banner, a sidebar card or a header pill. It shifts to a warning tone in the last days, has expired and upgraded states, and folds into the pill when dismissed or snoozed.

When to use:
- A SaaS app with a free trial that needs a quiet, always visible upgrade path.
- Telling a workspace what it loses when the trial ends and nudging harder in the last days.

When not to use:
- A hard paywall that blocks a feature; use a modal or an upgrade screen instead.
- Generic announcements or release notes; use a plain banner or toast.

Keywords: special, saas, new, trial banner, free trial, trial countdown, upgrade banner, billing nudge, trial expired, saas trial, paywall, add payment method, snooze banner

Files: demo.tsx, trial-banner.module.css, trial-banner.tsx

## `upgrade-prompt` · Upgrade prompt (Pro, special)

An upgrade nudge for the moment someone hits a limit. It shows a usage meter at 50 of 50 AI credits, a rolling price with a monthly and yearly toggle, three concrete unlocks with real model marks, and Upgrade or Maybe later. Upgrading leads into a success state with the new limits, and the card never changes size between states.

When to use:
- An AI product that hits a usage limit (credits, generations, seats) and needs a tasteful, conversion focused nudge.
- A paywall moment inside an app, in a dialog, popover or inline in place of the blocked result.

When not to use:
- Comparing several plans side by side: use a pricing table or plan picker.
- Buying prepaid credits without a plan change: use credit-topup.

Keywords: special, saas, new, upgrade, paywall, upsell, limit reached, usage limit, credits, plan upgrade, pricing toggle, monthly yearly, conversion, nudge, out of credits, pro plan, billing

Files: demo.tsx, upgrade-prompt.module.css, upgrade-prompt.tsx
