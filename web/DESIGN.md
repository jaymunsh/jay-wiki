# jay-wiki Design System

## 1. Direction

jay-wiki is an operational portfolio/wiki interface. The UI should stay quiet, dense, and scan-friendly: dark neutral surfaces, thin borders, compact controls, and restrained accent color.

## 2. Tokens

Colors come from `web/src/app/globals.css` custom properties:

| Token | Use |
|---|---|
| `--bg`, `--bg-1`, `--bg-2` | page and panel backgrounds |
| `--border`, `--hover` | separators and row/card hover states |
| `--text`, `--text-dim`, `--text-mute` | primary, secondary, and metadata text |
| `--accent`, `--accent-2` | links, selected states, and primary actions |
| `--success`, `--danger`, `--warn` | status and feedback |

Typography uses the project font variables `--font` and `--mono`. The primary Korean sans is the self-hosted Pretendard 1.3.9 variable WOFF2 loaded through `next/font/local`; it must not depend on an external font CDN, so Windows, macOS, and Linux receive the same glyph metrics. Keep headings compact inside tools and dashboards, while operational labels and code retain the separate mono stack.

## 3. Layout

Main content uses the existing constrained `main` container. Tool pages use unframed sections and repeated cards only for comparable items, such as search methods.

## 4. Components

| Component | Pattern |
|---|---|
| Button | `.btn`, `.btn-primary`; compact text buttons for clear commands |
| Brand mark | Header logo uses `/android-chrome-192x192.png` from `web/public`; keep the image at a stable 28px square inside `.logo-mark` |
| Form fields | 10px vertical padding, 1px `--border`, `--bg-1`, visible focus border |
| Wiki image upload | The Markdown pane keeps a compact Lucide image command in `.pane-tools`. File selection, paste, and drag/drop share one upload state; `.asset-upload-status` lists only assets uploaded in the current unsaved session and exposes an icon-only delete command. The textarea owns the drag highlight and the preview uses the existing `.prose img` boundary. |
| Wiki image layout | Markdown images remain responsive by default. A trusted title directive such as `width=280 align=center` may set a bounded 64–1200px width and left, center, or right alignment; the renderer generates allowlisted attributes and classes while raw HTML stays escaped. |
| Public MinIO publication | `/api/assets/publications/{collection}/{release}/{filename}` exposes only code-allowlisted immutable files from the internal `wiki-assets/publications` prefix. JSON, Markdown and checksum manifests keep explicit MIME, inline disposition, immutable cache, ETag and `nosniff`; arbitrary paths, unregistered files, writes and deletes remain unavailable from the public route. |
| Admin authoring guide | `/admin/guide` is a compact reference surface linked from the admin rail. It documents article identifiers, image directives, upload lifecycle, and safety boundaries as separated rows and tables rather than a public wiki article. A dedicated table wrapper owns horizontal overflow on mobile. |
| Comparison card | `.cmp-col` with `.cmp-head`, `.cmp-ms`, `.cmp-hits`; stable metric area and ellipsis result rows |
| Saga workbench | `.saga-panel`, `.saga-timeline`, `.saga-state-grid`; compact operational controls with stable status rows |
| Kafka workbench | `.kafka-panel`, `.kafka-flow`, `.kafka-consumer`; event-pipeline demo with topic/DLQ status, consumer fan-out cards, and ordered timeline |
| Chat workbench | `.chat-room`, `.chat-thread`, `.chat-bubble`, `.chat-side`; chat-first room layout with compact Redis queue/debug panels |
| Home project hub | `.home-hub`, `.home-proof-list`, `.home-status`; the home hero states the project goal, exposes two next actions, and summarizes three verifiable operating concerns without nested cards |
| Monitoring console | `/monitoring` uses `.monitoring-hero`, `.live-operations`, `.monitoring-reading`, `.monitoring-scope`; the public home keeps the architecture map only, while this dedicated page keeps the operations panel permanently open. It pairs traffic, event flow, miniPC/k3s runtime, and backup aggregates with concise reading cues, but keeps raw labels, logs, traces and Grafana behind the existing Access boundary. A local opt-in remote aggregate view uses a visually distinct `REMOTE · miniPC LIVE` source state; `Metrics`, `Logs`, and `Traces` are separate Grafana commands |
| Orchestration map | `.orchestration-board`; it spans the home content width above the article/aside grid, with k3s centered between public ingress, in-cluster services, and delivery/recovery. Selecting a region reveals its concrete data flow and responsibility rows; planned work is visibly marked as `next`. Technical brand marks are served through the same-origin MinIO asset route from `wiki-assets/portfolio/stack`, while text labels remain visible if an asset fails to load |
| Category document list | `.side-doc-list`; rows give the timestamp its intrinsic width and let the title consume the remaining space. The right column shows the document's last update in local time as `YY-MM-DD HH:mm`, set in mono type and right aligned so the full value remains readable while only the title truncates. Hover and keyboard focus use the button's own accent border without an external outline |
| Article navigation | Selecting a category or document updates `?article=<slug>` without losing the current scroll position. The URL is the share, refresh, and browser-history contract for the active article |
| Wiki search | `/search` exposes three compact sample-query commands and identifies the active `OpenSearch · nori` or `PostgreSQL · fallback` engine beside the Redis cache state. Result rows deep-link through `?article=<slug>`; the search surface explains fallback without presenting it as a failure. |
| Wiki category hierarchy | `.tabs-primary` uses developer-lifecycle labels `DASHBOARD`, `BUILD`, `OPERATE`, `IMPROVE`, and `LAB` with quiet Korean helper labels. `.tabs-secondary` is not another card: it renders BUILD, OPERATE, IMPROVE, or LAB subcategories as a text rail with an accent underline for the current item. Only DASHBOARD has no second level; LAB separates personal projects, technical experiments, and development notes. |
| Work case hub | `/scenarios` retains its stable URL while the navigation label is `실무 사례`. `.scenario-list`, `.scenario-group`, `.scenario-detail`, `.scenario-panel`, `.scenario-proof`, `.scenario-provenance` group 21 entries into transaction consistency, distributed integration, performance and data, infrastructure recovery, and operations governance without adding another navigation depth. Global card numbers remain continuous across groups. Every card and case study identifies whether it is reconstructed from work, operated in jay-wiki, or a bounded policy model, then one selected runbook explains the proof, execution, signals, and related records |
| Domain scenario workbench | `.domain-lab-*`; gift-card consistency, partner API resilience, and order confirmation share one operational workbench. The partner hero begins with `.partner-scenario-context`, an illustrative lost-response case that explains the duplicate-issuance risk and why the executable rehearsal exists; it is context, not a claim that point accounting is implemented. A segmented mode control drives a persisted rehearsal, the metric strip keeps evidence stable, the actor timeline exposes every transition, and recent runs remain selectable. Partner API replaces before/after values with HTTP status, attempts, and elapsed time. Between the result and timeline, `.partner-flow` renders one compact Mermaid flow for the selected failure mode and `.partner-exchange` summarizes the persisted request, response, retry, and callback evidence without secrets. Both own their mobile overflow. `.partner-code` exposes WebClient factory, gateway wrapper, error policy, callback, and FastAPI code in a five-tab evidence surface. `.partner-client-evolution` separates the customized WebClient implementation from `@HttpExchange` as a reference option. `.partner-production` is a dense table, not another card grid: it distinguishes implemented, partial, and next work across pool, deadline, retry, response resource, trust, and observability concerns. |
| Order confirmation evidence | `/domain-scenarios/order-confirmation` follows the same evidence order without pretending to call a PG or lock real stock rows. Its hero frames a last-item race, `.order-flow` changes across normal, race, duplicate callback, compensation, and expiry modes, and the policy evidence strip reports the persisted state, inventory delta, protection policy, and request key. `.order-code` shows the actual deterministic engine branches; its production boundary table labels every guarantee as `MODELED` and names the transaction, constraint, outbox/Saga, inbox, scheduler, and operational proof still required. |
| HPA rehearsal | `.hpa-console`; a live operational panel inside the HPA scenario. Public visitors see anonymized Pod cards, CPU threshold, replicas, and phase history; authenticated administrators additionally see fixed run/cancel controls. Raw Pod IPs, node identity, labels, and credentials never render |
| Status chip | `.saga-chip`; uppercase mono-adjacent labels using existing semantic tokens |
| Auth boundary chip | `.auth-boundary`; compact header pill that distinguishes `GUEST`, Google `USER`, and local `ADMIN` without exposing admin controls to user accounts |
| Authenticated profile trigger | `.profile-trigger.authenticated`; a restrained success-colored border, avatar fill, and status dot distinguish an authenticated account from the neutral guest trigger |
| Login page | Header exposes account entry through the menu; `/login` owns Google OAuth, local login, and local USER signup in one surface |
| Profile card | `.profile-card`; logged-in account actions live behind one profile trigger, while guests use the same card shell from a 3dots menu |

## 5. Responsive Rules

Comparison grids may use 3 columns on desktop, 2 on tablet, and 1 on mobile. Text inside result rows must truncate instead of changing card width.

The home proof list uses three columns on desktop and one column on mobile. Keep proof labels short and prevent Korean headings from breaking into isolated final syllables.

The monitoring console uses four columns on wide screens, then places traffic first, event flow and runtime side by side, and backup below them on tablet. The traffic plot must retain a stable aspect ratio; unavailable data is a labelled empty state, never a synthetic chart or fabricated metric. Reading cues use three columns on wide screens and stack to one column on mobile.

At the mobile header breakpoint, `.mobile-menu` uses a two-column grid. The first two navigation commands occupy row one, and monitoring plus the icon-only theme command occupy row two; all four use the same 44px control height and equal column width.

The site defaults to light mode. A valid saved `theme` value (`light` or `dark`) is applied before hydration; every mounted theme control synchronizes through the document theme state, so desktop and mobile controls never show different modes.

Scenario groups use four entry columns on wide screens, two columns on tablet, and one column on mobile. Group headings remain unframed and pair one short scope sentence with an item count; the selected runbook always follows all groups instead of becoming a fixed-height or horizontal-scroll panel.

Scenario provenance is a compact evidence label, not another card or marketing badge. `work-reconstructed` uses the primary accent and names anonymized work-derived problem structures, `portfolio-operated` uses the success token for directly executed jay-wiki evidence, and `policy-model` uses the warning token to prevent deterministic comparisons from being read as production measurements. Full labels include one sentence; grid cards use the label only.

Domain scenario workbenches keep controls and the current result in a two-column layout above 900px, then stack controls, metrics, timeline, and explanation on smaller screens. Mode labels wrap inside their own segmented buttons; timelines never force page-level horizontal scrolling. Monetary values and idempotency keys use mono type, while Korean explanation text follows normal line breaking.

The HPA console keeps the CPU plot and Pod lifecycle side by side on wide screens and stacks them on tablet/mobile. Its chart has a stable aspect ratio and a visible 60% threshold even before samples arrive. Pod metrics wrap within their own card and never cause page-level horizontal overflow.

The orchestration map keeps every stack label visible: labels may wrap within a node but must never use truncation or ellipses. Its responsive switch follows the map container rather than the viewport: the single-row desktop flow reserves at least 720px for the k3s cluster, and only a container at 1120px or below moves public edge and delivery below the full-width cluster. Desktop connector lanes must contain their complete labels without crossing adjacent zone borders. Mobile reads in an explicit order: public edge, HTTPS ingress, k3s, deploy/recovery, then delivery.

The page itself never scrolls horizontally. Long category rails, tables, code, and Mermaid diagrams own their horizontal overflow inside the component. At mobile width, Mermaid keeps a readable canvas width and scrolls inside its framed diagram surface instead of shrinking the whole graph to illegibility.

Wiki categories use two semantic levels rather than placing every DB tab in one rail. Desktop preserves the existing compact segmented-control treatment. At 640px and below, both levels use a two-column grid so Korean labels and document counts remain complete without page-level horizontal scrolling.

Self-hosted production builds set `NEXT_DEPLOYMENT_ID` to the immutable Git SHA. A browser tab that survives a rollout must hard-navigate when it encounters a newer deployment instead of combining an old global stylesheet with a new App Router payload. Static CSS and JavaScript URLs carry the deployment identifier so the browser and CDN cannot reuse a different release's assets.

Gift-card scenario evidence follows the same operational reading order as the partner API and order labs: an explicit example case, selectable policy mode, current state, mode-specific Mermaid flow, persisted execution timeline, executable policy excerpt, then a `MODELED` production-boundary table. The page must distinguish its deterministic Spring policy engine and PostgreSQL run history from a production ledger. Balance changes, idempotency, concurrent use, response recovery, and reversal entries are shown as inspectable evidence without implying a real issuer integration or transactional guarantee.

The work case hub is the comparison and discovery surface, and every CTA moves once to the final case surface. Domain rehearsals use canonical `/scenarios/[id]` pages that contain the case, controls, flow, persisted evidence, timeline, code, and production boundary together; legacy `/domain-scenarios/*` URLs redirect to them. Saga, Kafka, chat, search, and monitoring already own executable tools, so their case-study band lives directly on those pages. Backup and operations-governance entries without a synthetic executor use canonical narrative pages with situation, risk, verification, runbook, signals and current boundaries. One typed source drives hub labels, provenance and case copy.

The traffic-burst lab is a bounded policy-analysis surface, not a public load generator or benchmark. Six server-owned modes compare direct DB processing, rate shedding, Kafka buffering, slow consumers, duplicate bursts, and backlog recovery under a fixed synthetic input. The evidence strip exposes persisted input/processed RPS, p95, shed or deduplicated count, queue lag, replicas, and recovery time. Copy and `MODELED` boundary rows must always distinguish these deterministic values from future isolated k6 and Prometheus/Kafka measurements; users can select a policy but cannot provide arbitrary traffic volume or duration.

Operational troubleshooting labs reuse the same final workbench for coupon concurrency, settlement restart safety, connection-pool exhaustion, and JPA N+1. Every selected mode changes the Mermaid flow and persisted analysis snapshot before the timeline, so a visitor can compare the faulty baseline with one bounded mitigation without navigating to another page. These values explain policy behavior; they must not be labelled as a live Redis, settlement ledger, HikariCP, Hibernate, or miniPC benchmark. Each page names the production evidence still required: concurrency and reconciliation, source-total comparison, pool metrics and timeouts, or SQL counters and query plans.
