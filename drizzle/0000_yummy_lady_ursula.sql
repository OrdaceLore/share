CREATE TABLE `exchanges` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`song` text NOT NULL,
	`value` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_rating` ON `ratings` (`owner`,`song`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`song` text NOT NULL,
	`exchange` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_receipt` ON `receipts` (`owner`,`song`);--> statement-breakpoint
CREATE TABLE `songs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`artist` text NOT NULL,
	`url` text NOT NULL,
	`tags` text NOT NULL,
	`note` text NOT NULL,
	`fingerprint` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_recommendation` ON `songs` (`owner`,`fingerprint`);