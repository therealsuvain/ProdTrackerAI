# Reusable Dialog System

This replaces application-level `Alert.alert` calls with a small dialog hierarchy.

## Files

- `AppDialog.tsx` — generic dialog primitive. Supports arbitrary action arrays, async actions, loading state, custom content, theme, and dismissal behavior.
- `ConfirmDialog.tsx` — convenience wrapper for ordinary two-action confirmations.
- `DestructiveConfirmDialog.tsx` — specialized high-friction destructive confirmation with delayed activation and keyword confirmation.
- `examples.tsx` — examples corresponding to the Alert use cases discussed.

## Recommended architecture

Use `AppDialog` when you need multiple or unusual actions.

Use `ConfirmDialog` for simple:
- Cancel / Confirm
- Cancel / Reset
- Cancel / Replace

Use `DestructiveConfirmDialog` only when the operation deserves extra friction:
- deleting large amounts of data
- replacing an entire workspace
- irreversible destructive operations

## Important behavior

The generic dialog does not automatically close when an action is pressed. This is intentional: the action can perform async work and decide when its parent state should close the dialog.

Set `autoClose: true` for immediate UI-only actions.

Async actions automatically put the pressed button into a loading state and disable the other actions until the Promise settles.

For a two-stage destructive flow, close the first dialog and then open the second. Do not stack two dialogs visually at the same time.

## One adjustment you may want

If your project uses a different import path, update:

```ts
import { AppDialog, ConfirmDialog, DestructiveConfirmDialog } from "./dialogs";
```

The components assume `react-native-paper`, matching the existing confirmation modal.
