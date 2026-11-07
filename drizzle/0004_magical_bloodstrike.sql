ALTER TABLE `rooms` ADD `max_players` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `players` text DEFAULT '[]' NOT NULL;