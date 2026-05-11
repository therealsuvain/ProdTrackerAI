CREATE TABLE `event_tags` (
	`event_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`event_id`, `tag_id`),
	FOREIGN KEY (`event_id`) REFERENCES `calendar_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
