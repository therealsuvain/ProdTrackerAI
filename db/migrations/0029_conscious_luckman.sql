DROP INDEX `categories_normaized_name_unique_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_normaized_name_unique_idx` ON `categories` (`normalized_name`) WHERE "categories"."deleted_at" IS NULL;--> statement-breakpoint
DROP INDEX `tags_normaized_name_unique_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `tags_normaized_name_unique_idx` ON `tags` (`normalized_name`) WHERE "tags"."deleted_at" IS NULL;