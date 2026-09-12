DROP INDEX `runs_user_task_day`;--> statement-breakpoint
CREATE UNIQUE INDEX `runs_user_active` ON `runs` (`user`) WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `runs_user_task_day` ON `runs` (`user`,`task`,`day`) WHERE status <> 'cancelled';