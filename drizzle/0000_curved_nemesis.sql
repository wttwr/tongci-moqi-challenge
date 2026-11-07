CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`round` integer DEFAULT 1 NOT NULL,
	`matches` integer DEFAULT 0 NOT NULL,
	`player1_token` text NOT NULL,
	`player1_name` text NOT NULL,
	`player2_token` text,
	`player2_name` text,
	`player1_word` text,
	`player2_word` text,
	`player1_ready` integer DEFAULT false NOT NULL,
	`player2_ready` integer DEFAULT false NOT NULL,
	`history` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
