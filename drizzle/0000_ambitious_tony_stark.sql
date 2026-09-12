CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`started` integer NOT NULL,
	`completed` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_user` ON `events` (`user`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`user` text NOT NULL,
	`task` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorites_user_task` ON `favorites` (`user`,`task`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`run` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `media_run_user` ON `media` (`run`,`user`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`city` text NOT NULL,
	`answers` text NOT NULL,
	`discoverable` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`task` text NOT NULL,
	`day` text NOT NULL,
	`status` text NOT NULL,
	`started` integer NOT NULL,
	`completed` integer,
	`note` text DEFAULT '' NOT NULL,
	`place` text DEFAULT '' NOT NULL,
	`location` text,
	`partner` text,
	`match_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `runs_user_task_day` ON `runs` (`user`,`task`,`day`);--> statement-breakpoint
CREATE INDEX `runs_user_status` ON `runs` (`user`,`status`);--> statement-breakpoint
CREATE INDEX `runs_matching` ON `runs` (`task`,`status`,`partner`);--> statement-breakpoint
CREATE INDEX `runs_match_id` ON `runs` (`match_id`);