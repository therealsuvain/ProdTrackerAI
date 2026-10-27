import {
    getGlobalSearchKey,
    type GlobalSearchDocument,
    type GlobalSearchField,
    type GlobalSearchProvider,
    type GlobalSearchProviderContext,
} from "@/types/global-search";

import type { PlanTier } from "@/types/entitlement";
import { tierAtLeast } from "@/types/entitlement";

export interface SearchableSetting {
    id: string;
    label: string;
    type?: string;
    href?: string;
    description?: string;
    aliases?: readonly string[];
    requiredTier?: PlanTier;
}

export interface SearchableSettingsSection {
    title: string;
    data: readonly SearchableSetting[];
}

function getSettingIcon(type?: string): string {
    switch (type) {
        case "toggle":
            return "toggle-switch-outline";
        case "action":
            return "lightning-bolt-outline";
        case "value-link":
            return "tune-variant";
        case "link":
            return "chevron-right";
        default:
            return "cog-outline";
    }
}

export const settingsSearchProvider: GlobalSearchProvider<
    readonly SearchableSettingsSection[]
> = {
    id: "setting",

    buildDocuments(
        sections: readonly SearchableSettingsSection[],
        context: GlobalSearchProviderContext,
    ) {
        const documents: GlobalSearchDocument[] = [];

        for (const section of sections) {
            for (const setting of section.data) {
                const requiredTier = setting.requiredTier;

                // Keep paid-only settings out of results unless the required
                // entitlement is loaded and satisfied.
                if (
                    requiredTier &&
                    (!context.isEntitlementLoaded ||
                        !tierAtLeast(context.plan, requiredTier))
                ) {
                    continue;
                }

                const fields: GlobalSearchField[] = [
                    {
                        kind: "settingGroup",
                        value: section.title,
                    },
                ];

                if (setting.description?.trim()) {
                    fields.push({
                        kind: "description",
                        value: setting.description.trim(),
                    });
                }

                for (const alias of setting.aliases ?? []) {
                    if (alias.trim()) {
                        fields.push({
                            kind: "alias",
                            value: alias.trim(),
                        });
                    }
                }

                documents.push({
                    key: getGlobalSearchKey({
                        kind: "setting",
                        id: setting.id,
                    }),
                    kind: "setting",
                    target: {
                        kind: "setting",
                        id: setting.id,
                        ...(setting.href ? { href: setting.href } : {}),
                    },
                    display: {
                        title: setting.label,
                        subtitle: section.title,
                        presentation: {
                            icon: {
                                family: "material-community",
                                name: getSettingIcon(setting.type),
                            },
                            accentColor: "#616161", // Use a default accent color for settings
                        },
                    },
                    fields,
                    ...(requiredTier
                        ? { access: { requiredTier } }
                        : {}),
                });
            }
        }

        return documents;
    },
};