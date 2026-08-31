import { CategorySettingsWidget } from "@/components/ui/settings/widgets/category-settings-widget";
import { TagSettingsWidget } from "@/components/ui/settings/widgets/tags-settings-widget";
import { RestoreRecoveryWidget } from "./restore-recovery-widget";
import { ManualSyncWidget } from "./maunal-sync-widget";

export const WidgetRegistry: Record<string, React.FC<any>> = {
  CategoryWidget: CategorySettingsWidget,
  TagsWidget: TagSettingsWidget,
  RestoreRecoveryWidget: RestoreRecoveryWidget,
  ManualSyncWidget: ManualSyncWidget,
  // Future widgets go here...
};