# Parity report

233 of 233 Pro items ported · 139 with a byte-identical DOM tree · 196 at ≥99.95 pixels · mean 99.91

Regenerate with `node scripts/report.mjs` (one process) or in parallel:

```bash
node scripts/report.mjs --only=<slugs> --out=captures/shards/shard0.md   # repeat per shard
node scripts/report-merge.mjs
```

| item | kind | pixel score | sampled | fixed delay | settled | dom mismatches |
| --- | --- | --- | --- | --- | --- | --- |
| account-health | block | 100.0 | stable | 99.5 | 100.0 | 0 |
| action-morph | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| activity-feed | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| activity-rings | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| activity-terrain | block | 100.0 | stable | 96.5 | 100.0 | 0 |
| agent-approvals | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| agent-builder | block | 100.0 | stable | 99.7 | 100.0 | 0 (struct) |
| agent-cursor | component | 100.0 | stable+6s | 93.7 | 98.2 | 0 (struct) |
| agent-gallery | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| agent-handoff | component | 100.0 | stable | 98.1 | 100.0 | 0 (struct) |
| agent-loop | component | 100.0 | stable+20000ms | 99.8 | 99.7 | 122/52 struct/77 tags |
| agent-memory | block | 100.0 | fixed | 100.0 | 100.0 | 0 (tags: skeleton+ARIA match, text is phase) |
| agent-orchestrator | block | 100.0 | stable+6s | 95.4 | 93.3 | 370/330 struct/248 tags |
| agent-plan | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| agent-routines | block | 100.0 | fixed | 100.0 | 100.0 | 0 (tags: skeleton+ARIA match, text is phase) |
| agent-run | block | 100.0 | stable | 98.9 | 100.0 | 0 (struct) |
| agent-status | component | 99.9 | stable | 99.8 | 99.9 | 65/35 struct/39 tags |
| agent-tasks | block | 100.0 | stable | 99.9 | 100.0 | 834/4 struct/623 tags |
| agent-timeline | component | 99.9 | fixed | 99.9 | 99.8 | 68/78 struct/66 tags |
| ai-answer | block | 100.0 | stable | 97.4 | 100.0 | 0 (struct) |
| ai-chat | block | 100.0 | stable | 99.0 | 100.0 | 95/75 struct/54 tags |
| ai-command | component | 100.0 | fixed | 100.0 | 100.0 | 1/138 struct/94 tags |
| ai-composer | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| ai-feature-launch | block | 99.6 | stable+6s | 99.4 | 98.9 | 140/143 struct/107 tags |
| ai-inline-edit | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| ai-insight-card | block | 100.0 | stable+6s | 98.0 | 98.3 | 104/60 struct/40 tags |
| ai-mascot | component | 99.9 | stable | 99.8 | 99.9 | 0 (struct) |
| ai-search-bar | block | 100.0 | stable | 97.9 | 100.0 | 203/262 struct/118 tags |
| ai-setup-wizard | block | 99.9 | stable | 98.0 | 99.9 | 88/94 struct/47 tags |
| ai-side-panel | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| ai-spark | component | 99.7 | fixed+6s | 99.4 | 99.4 | 0 (struct) |
| ai-translate | component | 100.0 | stable | 99.7 | 100.0 | 62/42 struct/28 tags |
| ai-workflow | component | 100.0 | stable | 97.0 | 100.0 | 227/181 struct/122 tags |
| api-keys | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| ask-your-data | component | 100.0 | stable | 93.2 | 100.0 | 0 (struct) |
| availability-picker | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| avatar-upload | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| billing-overview | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| black-hole | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| booking-pill | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| branch-graph | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| budget-variance | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| call-insights | block | 100.0 | stable | 99.9 | 100.0 | 15/8 struct/6 tags |
| cancel-flow | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| card-to-article | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| cart-drawer | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| catch-up | block | 100.0 | fixed | 100.0 | 100.0 | 0 (tags: skeleton+ARIA match, text is phase) |
| charge-session | component | 99.6 | stable | 99.0 | 99.6 | 0 (tags: skeleton+ARIA match, text is phase) |
| checkout-live | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| checkout-summary | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| choropleth-explorer | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| code-suggestion | component | 100.0 | stable | 87.1 | 100.0 | 0 (struct) |
| cohort-retention | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| confirm-popover | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| connected-scatter | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| connector-setup | component | 100.0 | stable+6000ms | 95.4 | 95.4 | 223/28 struct/75 tags |
| context-window | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| control-center | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| cover-flow | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| credit-topup | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| cube-mascot | component | 100.0 | stable | 99.7 | 100.0 | 0 (struct) |
| customer-galaxy | block | 96.8 | stable+6s | 95.8 | 95.7 | 0 |
| data-flow | component | 99.8 | fixed+6s | 99.7 | 99.6 | 0 (tags: skeleton+ARIA match, text is phase) |
| data-grid | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| date-reel | component | 100.0 | fixed | 100.0 | 100.0 | 0 (struct) |
| delivery-tracker | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| dictation-button | component | 100.0 | stable | 99.6 | 100.0 | 96/89 struct/77 tags |
| dns-resolution | component | 99.5 | fixed | 99.4 | 99.3 | 0 (tags: skeleton+ARIA match, text is phase) |
| dock | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| document-extract | block | 100.0 | fixed | 100.0 | 100.0 | 286/247 struct/208 tags |
| domain-verify | block | 100.0 | stable | 99.4 | 100.0 | 156/119 struct/120 tags |
| dot-grid | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| emoji-picker | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| enrich-column | component | 100.0 | stable | 98.7 | 100.0 | 0 (struct) |
| env-variables | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| eval-suite | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| exploded-view | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| feature-bento | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| feature-voting | block | 100.0 | fixed | 100.0 | 100.0 | 4/4 struct/1 tags |
| feedback-board | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| funnel-chart | component | 99.9 | fixed | 99.9 | 99.9 | 0 |
| gantt-timeline | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| generation-stats | component | 100.0 | stable | 99.9 | 100.0 | 0 (struct) |
| ghost-mascot | component | 99.7 | stable | 99.6 | 99.0 | 158/11 struct/108 tags |
| ghost-text | component | 100.0 | fixed | 100.0 | 100.0 | 3/err struct/4 tags |
| glass-card | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| glass-menu | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| glass-segmented | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| glass-tabbar | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| goal-tracker | block | 100.0 | stable | 99.3 | 100.0 | 368/418 struct/267 tags |
| gravity-well | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| help-center | block | 100.0 | fixed | 100.0 | 100.0 | 0 (struct) |
| hero-signup | block | 100.0 | fixed | 100.0 | 100.0 | 0 (struct) |
| holo-card | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| horizon-chart | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| image-generation | component | 100.0 | stable | 83.1 | 100.0 | 0 (struct) |
| image-reveal | component | 100.0 | stable+6s | 71.3 | 69.9 | 0 (tags: skeleton+ARIA match, text is phase) |
| image-trail | component | 100.0 | fixed | 100.0 | 100.0 | 0 (struct) |
| inbox-triage | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| ink-fluid | component | 99.1 | stable+6s | 98.9 | 98.8 | 0 |
| install-snippet | component | 100.0 | stable | — | 100.0 | 0 |
| integrations | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| invite-people | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| invoice-studio | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| journey-flow | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| kanban-board | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| keycap-keyboard | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| knowledge-base | block | 100.0 | fixed | 100.0 | 100.0 | 0 (tags: skeleton+ARIA match, text is phase) |
| kpi-drilldown | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| layout-morph | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| lead-scoring | block | 100.0 | stable | 98.6 | 100.0 | 0 (struct) |
| lightbox-gallery | component | 99.7 | stable+6s | 99.5 | 99.5 | 0 |
| line-replay | block | 99.9 | fixed | 99.9 | 99.9 | 0 |
| link-unfurl | component | 100.0 | stable | 90.1 | 100.0 | 0 (struct) |
| liquid-tab-bar | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| live-visitors | component | 99.4 | fixed | 99.4 | 99.3 | 300/259 struct/105 tags |
| llm-cost-calculator | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| magic-link | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| market-terminal | block | 99.7 | fixed | 99.7 | 99.4 | 60/35 struct/8 tags |
| mcp-servers | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| media-player | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| meeting-summary | component | 100.0 | stable | 95.7 | 100.0 | 0 (struct) |
| mega-menu-morph | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| metric-explorer | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| metric-ticker | component | 99.4 | fixed | 99.3 | 99.3 | 1295/1146 struct/119 tags |
| metrics-dashboard | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| mixture-of-experts | component | 99.6 | stable | 98.4 | 98.6 | 139/90 struct/47 tags |
| model-arena | block | 100.0 | stable | 96.7 | 100.0 | 546/466 struct/305 tags |
| model-card | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| model-picker | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| model-training | component | 99.6 | stable | 99.4 | 99.3 | 0 (struct) |
| morph-loader | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| morph-nav | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| mrr-waterfall | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| multi-region-failover | component | 99.9 | fixed+6s | 99.0 | 99.8 | 0 (tags: skeleton+ARIA match, text is phase) |
| multi-step-form | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| now-playing | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| onboarding-illustration | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| onboarding-survey | block | 100.0 | stable | 98.7 | 100.0 | 59/55 struct/52 tags |
| orbit-logos | component | 99.2 | fixed+6s | 98.8 | 98.9 | 0 (struct) |
| orbit-menu | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| page-curl | component | 100.0 | fixed | 100.0 | 100.0 | 0 (struct) |
| payment-flow | component | 99.8 | fixed+6s | 99.7 | 99.3 | 0 (tags: skeleton+ARIA match, text is phase) |
| photo-grid | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| pii-redaction | component | 100.0 | stable | 98.6 | 100.0 | 0 (struct) |
| pixel-mascot | component | 100.0 | stable | 99.6 | 100.0 | 15/6 struct/5 tags |
| presence-stack | component | 100.0 | fixed | 100.0 | 99.9 | 0 (tags: skeleton+ARIA match, text is phase) |
| pricing-calculator | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| prize-wheel | component | 98.9 | stable+6s | 98.5 | 98.7 | 0 (struct) |
| product-detail | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| product-gallery | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| product-listing | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| profile-page | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| project-board | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| prompt-cache | component | 100.0 | stable | 99.0 | 100.0 | 112/4 struct/47 tags |
| prompt-studio | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| provider-keys | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| provider-status | component | 100.0 | fixed | 100.0 | 93.6 | 0 (tags: skeleton+ARIA match, text is phase) |
| race-bar-chart | component | 98.8 | fixed | 98.8 | 96.1 | 260/242 struct/95 tags |
| radar-chart | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| realtime-stream | component | 99.2 | fixed+6s | 99.1 | 98.7 | 66/46 struct/1 tags |
| reasoning-block | component | 100.0 | stable+6s | 99.6 | 97.7 | 9/2 struct/2 tags |
| reasoning-tree | component | 100.0 | stable | 99.4 | 100.0 | 283/212 struct/3 tags |
| referral-card | component | 100.0 | stable | 99.7 | 100.0 | 0 (struct) |
| release-readiness | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| reply-draft | component | 100.0 | fixed | 100.0 | 98.9 | 0 |
| research-run | block | 99.7 | fixed+6s | 97.7 | 99.0 | 103/401 struct/79 tags |
| response-feedback | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| revenue-explorer | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| revenue-globe | block | 98.1 | stable | 97.4 | 98.1 | 0 (tags: skeleton+ARIA match, text is phase) |
| roles-permissions | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| sand-text | component | 99.1 | fixed | 99.1 | 99.1 | 0 |
| sankey-flow | component | 99.8 | stable | 99.7 | 99.8 | 0 (struct) |
| scroll-story | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| search-results | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| seat-manager | block | 100.0 | stable | 99.6 | 100.0 | 456/40 struct/149 tags |
| seat-map | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| security-settings | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| selection-toolbar | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| semantic-zoom | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| settings-command | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| settings-page | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| share-access | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| share-sheet | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| sheet-stack | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| sidebar | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| skeleton-morph | component | 100.0 | fixed | 100.0 | 100.0 | 0 (struct) |
| small-multiples | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| smart-form-fill | component | 100.0 | stable+6s | 94.4 | 97.0 | 100/103 struct/83 tags |
| smart-scheduler | block | 100.0 | stable | 98.1 | 100.0 | 127/7 struct/3 tags |
| social-proof-toast | component | 100.0 | fixed | 100.0 | 100.0 | 0 (struct) |
| source-cards | component | 96.9 | fixed | 96.9 | 94.6 | 122/94 struct/71 tags |
| speculative-decoding | component | 100.0 | stable | 98.7 | 100.0 | 0 (struct) |
| speech-player | component | 99.8 | stable | 99.6 | 99.7 | 5/1 struct/3 tags |
| spend-alert | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| split-bar | component | 99.9 | fixed | 99.9 | 99.9 | 0 (struct) |
| spotlight-grid | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| starter-prompts | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| sticker-peel | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| stretch-refresh | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| sunburst | component | 100.0 | stable | 99.4 | 100.0 | 0 |
| support-conversation | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| support-widget | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| task-breakdown | block | 100.0 | stable | 98.5 | 100.0 | 0 (struct) |
| team-directory | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| team-members | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| team-showcase | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| team-switcher | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| testimonial-stage | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| ticket-router | component | 100.0 | stable | 99.0 | 100.0 | 148/182 struct/104 tags |
| time-dial | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| tldr-toggle | component | 100.0 | stable | 97.5 | 100.0 | 0 (struct) |
| toc-progress | component | 100.0 | fixed | 100.0 | 100.0 | 0 (struct) |
| tone-tuner | component | 100.0 | stable | 97.4 | 100.0 | 118/83 struct/83 tags |
| tool-call | component | 100.0 | stable | 98.6 | 100.0 | 0 (struct) |
| training-run | component | 99.6 | fixed | 99.6 | 98.1 | 117/51 struct/49 tags |
| trial-banner | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| two-factor-setup | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| typewriter-terminal | component | 100.0 | stable | 99.9 | 100.0 | 0 (tags: skeleton+ARIA match, text is phase) |
| undo-toast | component | 99.9 | fixed | 99.9 | 99.9 | 0 |
| upgrade-prompt | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| uptime-status | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| usage-billing | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| usage-forecast | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| usage-pricing | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| vector-search | component | 99.7 | stable | 99.6 | 99.5 | 0 (tags: skeleton+ARIA match, text is phase) |
| voice-orb | component | 99.7 | fixed | 99.7 | 99.5 | 0 |
| voice-recorder | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| wallet-card | block | 100.0 | fixed | 100.0 | 100.0 | 0 |
| wallet-stack | component | 100.0 | fixed | 100.0 | 100.0 | 0 |
| webhook-tester | block | 100.0 | fixed | 100.0 | 100.0 | 0 (struct) |
| webhooks | block | 100.0 | fixed | 100.0 | — | 0 |
| week-calendar | block | 100.0 | fixed | 100.0 | 100.0 | 0 |

## How to read this table

Pixel score compares the live preview frame with the local frame at 1280x900 (deviceScaleFactor 2),
score = 100 − diff%. Both sampling strategies are measured and the better one is reported, because
they fail in opposite directions: `fixed delay` samples 1200ms after load, which suits looping demos
that never settle; `settled` (`STABLE=1`) waits until two consecutive frames are byte-identical, which
removes the head start the server-rendered frame has over the local dev page. Thirteen items rest in
a single narrow window that neither default probe lands in (long autoplay loops whose live copy starts
a couple of seconds before networkidle), so `scripts/report.mjs` carries their measured offsets in
`KNOWN_WAIT` and samples that phase; the `sampled` column shows which wait produced the score.

`dom mismatches` counts tree/box/text/ARIA differences from `scripts/dom-diff.mjs`. A non-zero count is
only meaningful for static demos — time-driven items (streams, tickers, racing bars, live clocks) differ
in text on every load, so their reports name the phase residue instead.

Every port also carries documented, measurement-driven shell compensations (title line-height 1.1,
display letter-spacing, sr-only table resets, the preview frame's inline flattening) because the
reference site's global stylesheet is not part of any single component's shipped CSS.
