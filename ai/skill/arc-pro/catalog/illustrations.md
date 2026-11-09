# Illustrations

## `agent-loop` · Agent loop (Pro, special)

An illustration of the agent loop: gather context, take action, verify, repeat, with a bright head circling three stations around the model.

When to use:
- Docs, explainers and landing pages that teach how an AI agent works: it gathers context, calls tools, checks the result and repeats until the task is done.
- Showing why agents take several passes, with a failed check or a failed tool call that sends the loop round again.

When not to use:
- Use agent-run or research-run to show a real agent's live steps and streamed output.
- Use tool-call for a single tool call card inside a chat or a log.

Keywords: special, motion, illustration, new, agent loop, ai agent, tool use, tool calling, gather context, take action, verify, agentic loop, react loop, observe act, context window, claude, explainer, ai diagram

Files: agent-loop.module.css, agent-loop.tsx, demo.tsx

## `branch-graph` · Branch graph (Pro, special)

A git commit graph where branches draw in as colored lanes, merge commits join lines, a rebase lifts commits and replays them onto main, a squash folds them into one, and hovering a commit shows its message, author and diff stats.

When to use:
- A merge strategy picker in a code review or pull request screen, showing exactly what main will look like afterwards.
- A commit history panel in a developer tool, with hover details and keyboard browsing.

When not to use:
- Use git-branches for a looping, non-interactive illustration of a branch, pull request, and release.
- Use a timeline or changelog for releases people need to read rather than a commit graph.

Keywords: special, git, graph, developer, motion, new, commit graph, branch, merge, rebase, squash, pull request, history, version control, developer tools, diff stats

Files: branch-graph.module.css, branch-graph.tsx, demo.module.css, demo.tsx

## `data-flow` · Data flow (Pro, special)

Data flow illustration. Sources (app, database, events) are on the left, a processing core with a live count sits in the middle, and destinations (warehouse, dashboard, alerts) are on the right. Records leave as hollow dots and travel curved paths. In the core they turn into solid accent squares, then fan out to each destination; alerts receives about every third record.

When to use:
- A hero or feature section explaining how data moves through a product.
- Docs pages introducing an ingestion, transform, or routing concept.

When not to use:
- Use sankey-flow to show real volumes between stages.
- Use pipeline-status for the live state of a CI or data job.

Keywords: special, motion, illustration, new, data flow, pipeline illustration, etl, data pipeline, event routing, animated diagram, fan out, ingestion, transform

Files: data-flow.module.css, data-flow.tsx, demo.tsx

## `dns-resolution` · DNS resolution (Pro, special)

A browser asks for a domain and the query hops from the resolver to a root server, the TLD server and the authoritative nameserver, each pointing to the next, until an IP address comes back and the page connects. The resolver keeps the answer with a TTL ring that drains, and a second lookup is answered straight from that cache in one short hop.

When to use:
- A docs or marketing section that explains how a domain name turns into an address and why the second visit is faster.
- Custom domain setup, DNS hosting, resolver or CDN pages that need the chain of servers and the role of TTL to click.

When not to use:
- Use webhook-fanout to show one event delivered to many endpoints with retries.
- Use data-flow for a general pipeline between services.

Keywords: special, motion, illustration, new, dns, dns resolution, dns lookup, resolver, root server, tld, nameserver, authoritative, ttl, cache, domain, ip address, isometric, animated diagram, landing page, docs

Files: demo.module.css, demo.tsx, dns-resolution.module.css, dns-resolution.tsx

## `mixture-of-experts` · Mixture of experts (Pro, special)

An illustration of mixture of experts routing: each token is scored by a router, travels to its top experts, and their outputs merge into the token's result.

When to use:
- Explaining why a mixture of experts model is cheap per token: only the chosen experts run, which the active parameter readout makes concrete.
- Showing how a gate scores experts, picks the top k and blends their outputs, with real or sample scores.

When not to use:
- Use model-router to pick which model handles a request in a product; this card explains routing inside one model.
- Use attention-map to show which tokens a token attends to, rather than which experts process it.

Keywords: special, motion, illustration, new, mixture of experts, moe, sparse moe, expert routing, gating network, router, top k, top 2 routing, active parameters, load balancing, expert capacity, token dropping, llm architecture, transformer

Files: demo.tsx, mixture-of-experts.module.css, mixture-of-experts.tsx

## `model-training` · Model training (Pro, special)

Training data batches feed a small neural net diagram whose connections strengthen, a loss curve descends beside it, and an evaluation check turns green at the end.

When to use:
- An AI or ML product section that explains training, fine-tuning or evaluation in one glance.
- Docs pages introducing batches, epochs, loss curves or held-out evaluation.

When not to use:
- Use line-chart or metric-card for real, live training metrics.
- Use data-flow to explain how records move through a pipeline, and pipeline-status for real job status.

Keywords: special, motion, illustration, new, model training, machine learning, neural network, deep learning, backpropagation, loss curve, epochs, evaluation, fine-tuning, ai, animated diagram

Files: demo.module.css, demo.tsx, model-training.module.css, model-training.tsx

## `multi-region-failover` · Multi-region failover (Pro, special)

Animated multi-region failover on a 2.5D stage: users stream requests through a global load balancer to two regions; the primary degrades, fails three health checks, traffic shifts smoothly to the healthy region, then it recovers, passes three checks and traffic ramps back to an even split.

When to use:
- A reliability, infrastructure or pricing page that needs to show why running in two regions keeps a service up during an outage.
- Docs for health checks, failover policies, traffic weights or slow start, where viewers should step through detection, failover, recovery and rebalance.

When not to use:
- Use database-replication to show a primary database failing over to a replica.
- Use circuit-breaker for one service failing fast against a failing dependency.

Keywords: special, motion, illustration, new, failover, multi-region, region, high availability, disaster recovery, load balancer, global load balancing, dns failover, health check, traffic shift, weights, rebalance, outage, isometric, animated diagram, landing page, docs

Files: demo.module.css, demo.tsx, multi-region-failover.module.css, multi-region-failover.tsx

## `payment-flow` · Payment flow (Pro, special)

A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip.

When to use:
- A payments or checkout landing section that explains authorization and settlement.
- Docs pages introducing processors, card networks, issuers, fees, and payout timing.

When not to use:
- Use checkout-flow or checkout-live for a real checkout form.
- Use webhook-fanout to explain what happens after a payment event is emitted.

Keywords: special, motion, illustration, new, payment, card payment, authorization, settlement, payout, processor, card network, issuer, fees, animated diagram

Files: demo.tsx, payment-flow.module.css, payment-flow.tsx

## `prompt-cache` · Prompt cache (Pro, special)

An animated explainer for prompt caching: the shared prefix of each request is cached once, later requests read it back, and the cost and time saved add up.

When to use:
- A docs page or blog post that explains why a stable prefix makes repeat requests cheaper and faster.
- A pricing or usage page that shows how cache reads, writes and the time to live affect cost.

When not to use:
- Use context-window to show how much of a model's window a conversation fills and when it compacts.
- Use token-inspector to show how text splits into tokens and what each costs.

Keywords: special, motion, illustration, new, prompt caching, prompt cache, cache hit, cache write, cache read, prefix matching, time to live, ttl, time to first token, token cost, llm cost, claude, api pricing, animated diagram

Files: demo.module.css, demo.tsx, prompt-cache.module.css, prompt-cache.tsx

## `reasoning-tree` · Reasoning tree (Pro, special)

An illustration of tree search over thoughts: candidates are scored, weak branches fade, the best expand, and the winning path from question to answer draws in.

When to use:
- Explainers, docs and landing pages that teach tree of thoughts, beam search or test time search over reasoning steps.
- Showing why a wider search can beat a greedy one, with a control the reader can change and replay.

When not to use:
- Use agent-run or research-run to show a real agent's steps and output as they stream.
- Use agent-loop to explain the plan, act and observe cycle of a tool using agent.

Keywords: special, motion, illustration, new, tree of thoughts, beam search, reasoning, search tree, pruning, chain of thought, test time compute, thought tree, best path, llm reasoning, explainer, ai diagram

Files: demo.tsx, reasoning-tree.module.css, reasoning-tree.tsx

## `speculative-decoding` · Speculative decoding (Pro, special)

An illustration of speculative decoding: a fast draft model guesses a few tokens, the target model checks them in one pass, and accepted guesses join the answer.

When to use:
- Explaining why a product answers faster: docs, model pages, inference dashboards and blog posts about latency.
- Showing a recorded speculative run from your own server, with acceptance and tokens per pass for a chosen draft length.

When not to use:
- Use text-stream to show an answer streaming to a user; this card explains the mechanism behind the speed.
- Use token-inspector to look at token probabilities and alternatives for one answer.

Keywords: special, motion, illustration, new, speculative decoding, draft model, target model, assisted generation, inference speed, llm latency, token acceptance, tokens per pass, verify, ai illustration, explainer, decoding

Files: demo.tsx, speculative-decoding.module.css, speculative-decoding.tsx

## `vector-search` · Vector search (Pro, special)

Documents drop onto a tilted embedding plane and fold into points that cluster by topic; the index links neighbours, a query is typed, embedded and lowered onto the plane, a signal hops along the graph toward it, and a widening ring lights the nearest documents with connecting lines, similarity scores and a ranked list.

When to use:
- A feature section on semantic search, AI answers, or retrieval over a team's docs.
- Docs pages introducing embeddings, nearest neighbour search, or approximate indexes.

When not to use:
- Use search-index to explain keyword search with an inverted index.
- Use a real scatter or cluster chart to show an actual embedding projection.

Keywords: special, motion, illustration, new, vector search, embeddings, semantic search, nearest neighbours, similarity, rag, retrieval, vector database, hnsw, animated diagram

Files: demo.tsx, vector-search.module.css, vector-search.tsx
