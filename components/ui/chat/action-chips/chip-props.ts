export interface ActionChipProps {
    action: any; // Consider typing this strictly later (e.g., PendingAction)
    onRemove: () => void;
    onUpdateAction: (updatedArgs: any) => void; // CRITICAL: Exposes mutation to the parent
    isConfirmed?: boolean;
    isExpired?: boolean;
}