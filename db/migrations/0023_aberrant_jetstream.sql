CREATE TABLE `local_recovery_items` (
	`snapshot_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`snapshot_id`, `entity_type`, `entity_id`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `local_recovery_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `local_recovery_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`source_user_id` text,
	`source_is_anonymous` integer DEFAULT true NOT NULL
);
