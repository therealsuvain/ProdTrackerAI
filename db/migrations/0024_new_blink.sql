CREATE TABLE `sync_cursors` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_pulled_at` text,
	`updated_at` text NOT NULL
);
