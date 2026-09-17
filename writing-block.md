# React Native performance migration playbook

## The rule behind every migration

A store is fast only when each component subscribes to the smallest piece of state it needs.

Bad:

```tsx
const { habits, editHabit, trackMetric } = useHabits();
```

Better:

```tsx
const editHabit = useHabitStore((state) => state.editHabit);
const habit = useHabitStore((state) => state.habitsById[id]);
```

Best list architecture:

```text
Screen owns visible IDs
        ↓
Memoized row receives one ID
        ↓
Row selects its own entity from the store
        ↓
Only the changed entity row re-renders
```

## Standard store shape for tasks, habits, events, and logs

Use this same broad structure for every entity domain:

```ts
type HabitStoreState = {
  habitsById: Record<string, Habit>;
  loaded: boolean;

  addHabit: (habit: Habit) => Promise<void>;
  editHabit: (habit: Habit) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  toggleHabit: (id: string) => Promise<void>;
  refreshHabits: () => Promise<void>;
};
```

Keep the good parts of `use-task-store`:

- normalized `byId` state;
- immutable updates;
- optimistic UI update first;
- database write second;
- rollback only on failure;
- preserve untouched entity references.

For a single-entity update, this is the desired pattern:

```ts
set((state) => ({
  habitsById: {
    ...state.habitsById,
    [id]: { ...state.habitsById[id], completed: true },
  },
}));
```

Do not rebuild every habit/event/log object for a single toggle. Only create a new object for the changed entity.

## List pattern to reuse everywhere

For habits, calendar agenda events, and timer logs:

1. The screen selects a shallow array of visible IDs.
2. Each row receives an ID, not the full entity.
3. The row selects its own entity.
4. `renderItem`, `keyExtractor`, and row callbacks are memoized.

```tsx
const visibleHabitIds = useHabitStore(
  useShallow((state) =>
    Object.values(state.habitsById)
      .filter(matchesCurrentFilter)
      .sort(currentSort)
      .map((habit) => habit.id),
  ),
);
```

```tsx
const HabitRow = React.memo(function HabitRow({ id, onEdit }: Props) {
  const habit = useHabitStore((state) => state.habitsById[id]);

  if (!habit) return null;

  return <HabitItem habit={habit} onEdit={onEdit} />;
});
```

A completion update changes the target row’s selector, but the ID list remains shallow-equal. Therefore the screen and untouched rows do not render.

Use the same technique for:

- `HabitItem`
- `EventItem`
- timer-log item
- task item
- calendar agenda rows

## Stable callback rule

Never make a row callback depend on the entire entity list.

Avoid:

```tsx
const onToggle = useCallback(
  (id) => {
    const item = items.find((item) => item.id === id);
  },
  [items],
);
```

Use the store at interaction time:

```tsx
const onToggle = useCallback(
  async (id: string) => {
    const item = useHabitStore.getState().habitsById[id];
    if (!item) return;

    await toggleHabit(id);
  },
  [toggleHabit],
);
```

Memoize parent helpers too:

```tsx
const showModal = useCallback((item?: Habit) => {
  setEditingHabit(item ?? null);
  setVisible(true);
}, []);
```

If a callback changes every store update, every memoized row receiving it will also re-render.

## Tags and categories

Make taxonomy independent of metrics and entity stores.

Prefer two small stores:

```text
useTagStore
  tagsById
  tagIds
  add / edit / delete tag

useCategoryStore
  categoriesById
  categoryIds
  add / edit / delete category
```

Entity records should store only IDs:

```ts
task.category: categoryId;
task.tags: tagIds[];
```

Then subscribe at the smallest UI component:

```tsx
function CategoryBadge({ categoryId }: { categoryId: string }) {
  const category = useCategoryStore(
    (state) => state.categoriesById[categoryId],
  );

  if (!category) return null;
  return <Badge label={category.name} color={category.color} />;
}
```

```tsx
function TagBadge({ tagId }: { tagId: string }) {
  const tag = useTagStore((state) => state.tagsById[tagId]);
  if (!tag) return null;
  return <Text>{tag.name}</Text>;
}
```

This means editing one category updates its badges, not every task row and not the analytics screen.

Never mutate a category or tag prop during render. The current `CategoryBadge` does this when it assigns `category.icon`; derive a fallback value instead.

Also keep `tags` as `string[]` once data enters your app state. Do not repeatedly JSON-parse tags during row rendering.

## Metrics: smooth tracking without UI-wide renders

Metrics are not interaction UI state. Treat them as a background write-behind system.

Your ideal flow:

```text
Tap checkbox
  → optimistic task store update immediately
  → queue metric in a non-React analytics service
  → batch-write metrics later
  → update metric UI only if a visible analytics screen needs it
```

Keep the queue in `analyticsEngine` as plain JavaScript state. It should be safe to call from anywhere without subscribing a component to a provider.

Do not let every `trackMetric()` event immediately update a broad React context. That was the source of the 100+ ms `DataProvider` commits.

Recommended separation:

```text
analyticsEngine
  owns pending metric deltas
  batches database writes
  flushes on timer/background/unmount

useMetricsStore
  holds displayed analytics data
  only AnalyticsScreen and metric widgets subscribe

useAchievementStore
  holds unlocked achievement/toast state
  only updates when an achievement is actually unlocked
```

A task completion should not update tags, categories, task rows, timers, hidden screens, and the whole dashboard just because one metric changed.

Also:

- remove or development-guard `console.log` from hot paths;
- run achievement evaluation after the interaction frame, unless an immediate unlock toast is essential;
- batch metric writes as you already do;
- flush queued metrics on app background, so deferring React work does not risk losing data.

## Modals and form state

Keep fast-changing form state near the modal.

Currently, task form state lives in `TaskScreenInner`. Typing into a modal can therefore re-render the entire task screen. Move form hooks into `TaskModal` or a small modal container where practical.

Apply this to task, habit, calendar-event, and timer-log modals.

## Screen-specific pointers

### Habits

Habit history arrays can be large. Update only the target habit object and its nested changed array. Do not refresh all habits after a check-in.

Keep ticking, streak animation, and denial feedback inside `HabitItem`, not in the whole screen or a broad provider.

### Calendar

Calendar is usually the next expensive screen.

- Store events by ID.
- Derive event IDs for the selected day/month.
- Memoize day cells.
- Make each event item subscribe to one event ID.
- Build date-to-event-ID indexes when events change, rather than filtering all events inside every day cell.
- Use a virtualized list for agenda/event lists; do not reach for FlashList until invalidation is already correct.

### Timer and logs

Keep a live timer tick isolated. A one-second timer update must only render the timer display, never the complete log screen, dashboard, or tabs.

Timer logs should follow the same ID-list plus row-selector design.

## Mounted versus visible

A screen hidden behind a tab, portal, or `visible={false}` prop may still be mounted and subscribed.

Your chat change proved this matters.

Use conditional mounting for heavy UI that has no job while hidden:

```tsx
{aiVisible && (
  <Portal>
    <ChatScreen visible onDismiss={closeChat} />
  </Portal>
)}
```

Apply the same thought process to expensive modals, chart screens, rich calendars, and timer configuration UI.

## FlatList and UI work

For ordinary task display, prefer `FlatList`. Use `DraggableFlatList` only while the user is explicitly reordering.

Keep these stable:

```tsx
const keyExtractor = useCallback((id: string) => id, []);

const renderItem = useCallback(
  ({ item: id }) => <TaskRow id={id} onToggle={onToggle} />,
  [onToggle],
);
```

Do not pass a changing `extraData` object unless the list truly needs it.

Avoid deeply nested `TouchableOpacity`, `TouchableRipple`, `Card`, and shadow-heavy wrappers in every row unless they are visually worthwhile. After React invalidation is fixed, temporarily replacing them with plain `View` rows is a good way to isolate remaining native UI cost.

## Migration checklist

For each context:

1. Create one focused Zustand store.
2. Normalize entities into `byId`.
3. Keep actions in the store; select actions individually.
4. Convert lists to visible IDs.
5. Convert rows to entity-by-ID selectors.
6. Stabilize all callbacks passed to rows.
7. Remove broad `useData()` / context subscriptions from rows.
8. Conditionally mount heavy hidden components.
9. Profile one interaction before moving on.
10. Only optimize native components after React renders are narrow.

## How to profile correctly

Use the update highlighter to find suspicious breadth, not to measure speed.

Use React Profiler to answer:

- Which component caused this commit?
- Which rows actually rendered?
- Did a hidden screen render?
- Is the changed row the only entity row rendering?

For final FPS judgment, use a release build with console logging and DevTools profiling disabled. Your current 17.3 ms development commit is already a strong result; release should be better.

## The simple decision rule

Before subscribing, ask:

> If this exact piece of state changes, should this component visibly change right now?

If the answer is no, do not subscribe that component to it.