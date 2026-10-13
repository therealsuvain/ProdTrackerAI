PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`synced_at` text,
	`deleted_at` text
);
--> statement-breakpoint
INSERT INTO `__new_categories`("id", "name", "normalized_name", "color", "icon", "count", "created_at", "updated_at", "synced_at", "deleted_at") SELECT "id", "name", "normalized_name", "color", "icon", "count", "created_at", "updated_at", "synced_at", "deleted_at" FROM `categories`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `categories_name_idx` ON `categories` (`name`);--> statement-breakpoint
CREATE INDEX `categories_count_idx` ON `categories` (`count`);--> statement-breakpoint
CREATE TABLE `__new_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`synced_at` text,
	`deleted_at` text
);
--> statement-breakpoint
INSERT INTO `__new_tags`("id", "name", "normalized_name", "count", "created_at", "updated_at", "synced_at", "deleted_at") SELECT "id", "name", "normalized_name", "count", "created_at", "updated_at", "synced_at", "deleted_at" FROM `tags`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
ALTER TABLE `__new_tags` RENAME TO `tags`;--> statement-breakpoint
CREATE INDEX `user_tags_name_idx` ON `tags` (`name`);--> statement-breakpoint
CREATE INDEX `user_tags_count_idx` ON `tags` (`count`);