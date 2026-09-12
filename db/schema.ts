// Historical D1 schema retained for the previous Sites deployment.
// MySQL schema is maintained in server/migrations; do not generate new D1 migrations.
import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  city: text("city").notNull(),
  answers: text("answers").notNull(),
  discoverable: integer("discoverable").notNull().default(0),
  created: integer("created").notNull(),
});
export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    user: text("user").notNull(),
    task: text("task").notNull(),
    day: text("day").notNull(),
    status: text("status").notNull(),
    started: integer("started").notNull(),
    completed: integer("completed"),
    note: text("note").notNull().default(""),
    place: text("place").notNull().default(""),
    invitation: text("invitation").notNull().default(""),
    location: text("location"),
    partner: text("partner"),
    matchId: text("match_id"),
  },
  (t) => [
    uniqueIndex("runs_user_task_day")
      .on(t.user, t.task, t.day)
      .where(sql`status <> 'cancelled'`),
    uniqueIndex("runs_user_active")
      .on(t.user)
      .where(sql`status = 'active'`),
    index("runs_user_status").on(t.user, t.status),
    index("runs_matching").on(t.task, t.status, t.partner),
    index("runs_match_id").on(t.matchId),
  ],
);
export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    user: text("user").notNull(),
    run: text("run").notNull(),
    type: text("type").notNull(),
    size: integer("size").notNull(),
    created: integer("created").notNull(),
  },
  (t) => [index("media_run_user").on(t.run, t.user)],
);
export const favorites = sqliteTable(
  "favorites",
  { user: text("user").notNull(), task: text("task").notNull() },
  (t) => [uniqueIndex("favorites_user_task").on(t.user, t.task)],
);
export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    user: text("user").notNull(),
    started: integer("started").notNull(),
    completed: integer("completed"),
  },
  (t) => [uniqueIndex("events_user").on(t.user)],
);
