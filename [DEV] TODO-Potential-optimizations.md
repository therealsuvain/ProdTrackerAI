# Remaining Optimization Opportunities (beyond Phases 1–5)

_Written 14 Oct 2026. Based on the files that could be opened during the audit; some were older snapshots, so items marked **verify** need a check against the current code._

Most remaining wins are no longer React re-renders. They are heavy embedding data, AI round trips, startup loading and a few write-path hot spots.

| # | Item | Effort | Impact |
|---|---|---|---|
| 1 | Stop parsing and holding embeddings in lists | 4–6 h | High: startup and memory |
| 2 | AI pipeline latency | 2 h to 2 days | High: perceived speed |
| 3 | Defer non-critical hydration | 3–4 h | High: splash time |
| 4 | Habit write amplification | 3–4 h | High: habits |
| 5 | No embeddings during sync pull | 3–4 h | High: first sync |
| 6 | Task screen and home array subscriptions | 2–3 h | Medium to high |
| 7 | Batch writes: atomic and efficient | 2–3 h | Medium |
| 8 | Analytics memoization | 1–2 h | Medium |
| 9 | Hygiene bundle | 2–3 h | Medium |

**Suggested order:** items 1, 3 and 5 first (together they fix startup and first sync), then 4 and the cheap parts of 2, then the screens (6, 7, 8), then the hygiene bundle (9).

---

## Phase 4 notes

- **4.1 (Chat FlatList → FlashList):** agreed, do it.
- **4.2 (memoize chat context/callbacks):** `curatedContext` is gone, but `ChatScreen` still subscribes to tasks (and habits and events) only to feed `enrichAction` (chat-screen). 
  - Read `getState()` inside `enrichAction` instead, so the screen subscribes only to messages.
  - Look up messages through `getState()` in the handlers too, so `MessageBubble` memoization holds.
  - Build a short-id index instead of calling `list.find(x => x.id.slice(0, 8) === id)` on each render.
- **4.3 (FlashList for task/habit/timer-log lists):** decide per list.
  - Tasks can't use FlashList in manual-sort mode, because it uses `DraggableFlatList`, and `handleDragEnd` never saves the order (task-screen). Either persist a sort order or drop the feature.
  - Habits lists are small.
  - Timer logs grow without limit, so they are the only strong candidate.
  - Seed about 1,000 rows from the dummy data, profile each list, and migrate only the lists that visibly drop frames. Try cheap FlatList tweaks first.
- **1.6 (looping Lottie):** being handled in another chat, ignore here.

---

## Biggest finds

### Embeddings (items 1 and 5)

- Embeddings are 768 numbers from Gemini, roughly 15 KB of JSON each (embedding-engine.ts). `rowToTask` and `rowToHabit` parse that on every read, and the parsed arrays then sit in the Zustand state (task-repository.ts, habit-repository.ts). That is millions of characters parsed at launch for a few hundred items. _This size is my estimate._ Events likely follow the same pattern (verify).
- **Fix:** select columns explicitly so list queries skip `embedding`, and load vectors lazily through a `getEmbeddings(ids)` cache. A `Float32` BLOB in a separate table cuts the size about fivefold.
- Sync pull calls `generateEmbedding`, a network call, for each new row, one after another (sync-engine.ts). On a fresh install that is one round trip per item. A failure returns `[]`, which is saved and never retried.
- **Fix:** insert with `null` and backfill in a throttled background queue with retry.

### AI latency (item 2)

- Each message runs gatekeeper, planner, router, an executor loop, then a feedback call, and a history lookup restarts the whole graph (node-n-orchestrator.ts, node-1-planner.ts, node-2-router.ts).
- **Cheapest first:**
  - Template the success summary instead of an LLM call when every action succeeded.
  - Parallelize embedding generation across multiple add actions, since `agenticExecutor` awaits one at a time (node-4-final-executor.ts).
  - Compact the router's `JSON.stringify(MasterToolIndex, null, 2)` payload and keep it as a stable prompt prefix.
  - Strip the per-node logging that serializes full responses and state.
- **Larger change:** merge gatekeeper, planner and router into one structured call, which saves two round trips. It needs a regression set of prompts, because behaviour changes.

### Undo stack

- `AIActionMemory.push` clones and persists up to 10 full objects, embeddings included, to AsyncStorage on every push, pop and prune (ai-action-undo-handlers.ts).
- **Fix:** strip embeddings, debounce the write, and move it to MMKV.

### Startup (item 3)

- `hydrateLocalWorkspace` waits for all nine loads before hiding the splash. The chat is not mounted until opened, and metric history and old logs aren't needed on the first screen.
- **Fix:**
  - Load tasks, habits, events, categories, tags and settings first.
  - Load messages on first chat open, with a small SQL query for pending-action expiry timers.
  - Load daily metric history when analytics opens, keeping the global row eager for achievements.

---

## Database and write path

- **Habit write amplification (item 4).** Every check-in, freeze or edit deletes and reinserts all check-ins, freezes, goal completions and tag rows (habit-repository.ts). A habit with 365 check-ins writes about 730 rows per tap.
  - The ids are deterministic, so insert only new dates with `ON CONFLICT DO NOTHING` and delete only removed ones.
  - Skip the child rewrite in batch updates when the new values don't touch them.
- **Batch writes (item 7).** `batchUpdateTasks` fires N updates under an async transaction, and the habit batch functions open N concurrent transactions (task-repository.ts, habit-repository.ts). These aren't atomic on this driver, which also makes the AI handler's "rolled back" message untrue.
  - Use one synchronous transaction, and for tasks a single `UPDATE … WHERE id IN (…)`.
- **Count queries.** `countTasks`, `countHabits`, `countMessages` and the tag and category counts select every `id` and take `.length` (task-repository.ts, chat-message-repository.ts, tags-and-category-repository.ts). Use `count(*)`.
- **Unbounded loads.** Timer logs and messages load completely. Add paging, plus SQL aggregates for today and this-week totals on the timer screen.
- The sync TODO already covers the full-table scans.

---

## Screens and lists

- **Task screen and home (item 6).** Both select `Object.values(tasksById)` with `useShallow`, so the container re-renders and re-sorts on any task field change, and callbacks depending on `tasks` are rebuilt (task-screen-2.tsx, index.tsx).
  - Select a filtered, sorted id list, as habits and calendar already do, and use `getState()` in callbacks.
- **Home timeline (verify).** The attached version calls `useTaskStore(...)` inside a `useMemo` callback, which is an invalid hook call (home-timeline.tsx). Check whether that is still in the current file.
- **Analytics (item 8).**
  - `useFilteredMetrics` isn't memoized, so every chart gets a new object each render and chart transformers rerun (use-filtered-analytics-metrics.ts). Wrap it in `useMemo`.
  - The screen is wired to `DummyMetrics` from a 225 KB constants file (analytics-screen.tsx). Remove it from the production path once real data is wired.
  - When wiring real data, select narrowly. The attached version also subscribed to chat messages for no clear reason.
- **Colors.** The calendar timeline picks a random event color on each call (calendar-timeline-view.tsx). Home caches random colors per session (home-timeline.tsx). Use the category's real color from the store.
- **Notifications.**
  - A recurring event schedules up to 30 notifications one after another (use-notifications.ts).
  - Post-sync reconcile is also sequential (reconcile-notifications.ts). Run these with small concurrency.
  - `useNotifications()` re-requests permission and shows an `alert()` on every home mount.
  - Two modules set the notification handler, one with a `proiority` typo. Keep only the one in the new notification setup.

---

## Cheap cleanups (item 9)

- Add `babel-plugin-transform-remove-console` for production, keeping `warn` and `error`. Hot-path logs include per-key analytics logs, habit repo logs and the AI nodes dumping whole responses.
- **Tokens in logs.** `AuthContext` logs the full session, including the access and refresh tokens (AuthContext.tsx). Remove it. Tokens also appeared in logs pasted into the chat, so sign out and back in to rotate them.
- **Accidental imports.** `import de from "zod/v4/locales/de.cjs"` in `sync-engine.ts`, and a React Native internal `get` import in `chat-screen`. An unused-imports lint rule catches these.
- **AsyncStorage leftovers.** The undo stack and the missed-tasks audit still use it (analytics-utils.ts).
- **UTC date keys.** The heatmap, the analytics presets, the missed-tasks audit and the home timeline still build keys with `toISOString().split("T")[0]` (habit-heatmap.tsx, use-filtered-analytics-metrics.ts). Metric keys are local now, so these are off by a day between midnight and 05:30 IST. Switch to one `localDateKey()`.
- **Missed-tasks audit.** It is commented out in the hydrate. Its logic also counts a task due today as missed early, then checks end of day when cleaning up, so it can overcount (analytics-utils.ts). Re-enable it with one consistent end-of-day rule.
- **Measure startup.** `babel.config`, `metro.config` and `app.json` weren't visible during the audit. Run a bundle analysis such as Expo Atlas and a Hermes profile before guessing further.

---

## Source files referenced

task-repository.ts, habit-repository.ts, chat-message-repository.ts, tags-and-category-repository.ts, embedding-engine.ts, ai-action-undo-handlers.ts, node-n-orchestrator.ts, node-1-planner.ts, node-2-router.ts, node-4-final-executor.ts, sync-engine.ts, use-notifications.ts, reconcile-notifications.ts, analytics-screen.tsx, habit-heatmap.tsx, analytics-utils.ts, use-filtered-analytics-metrics.ts, AuthContext.tsx, index.tsx (home), task-screen-2.tsx, chat-screen-3.tsx, home-timeline.tsx, calendar-timeline-view.tsx.
