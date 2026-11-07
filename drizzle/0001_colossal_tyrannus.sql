ALTER TABLE `rooms` ADD `timer_seconds` integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `deadline` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `is_paused` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `paused_remaining` integer;