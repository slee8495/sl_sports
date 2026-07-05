import {
  pgTable,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
  integer,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";

export const sportEnum = pgEnum("sport", [
  "soccer",
  "baseball",
  "football",
  "hockey",
  "basketball",
]);

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  sport: sportEnum("sport").notNull(),
  league: varchar("league", { length: 128 }),
  country: varchar("country", { length: 64 }),
  foundedYear: integer("founded_year"),
  logoUrl: text("logo_url"),

  history: text("history"),
  stadiumName: varchar("stadium_name", { length: 128 }),
  stadiumDescription: text("stadium_description"),
  stadiumPhotos: jsonb("stadium_photos").$type<string[]>().default([]),
  stadiumVideoUrl: text("stadium_video_url"),

  coachName: varchar("coach_name", { length: 128 }),
  coachBio: text("coach_bio"),

  profileUpdatedAt: timestamp("profile_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 128 }).notNull(),
  position: varchar("position", { length: 64 }),
  number: varchar("number", { length: 8 }),
  isStarPlayer: boolean("is_star_player").default(false).notNull(),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
});

export const newsItems = pgTable("news_items", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 256 }).notNull(),
  summary: text("summary"),
  url: text("url").notNull().unique(),
  source: varchar("source", { length: 128 }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
});

export const highlights = pgTable("highlights", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 256 }).notNull(),
  videoUrl: text("video_url").notNull().unique(),
  thumbnailUrl: text("thumbnail_url"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
});

export const podcastEpisodes = pgTable("podcast_episodes", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  showName: varchar("show_name", { length: 128 }),
  title: varchar("title", { length: 256 }).notNull(),
  episodeUrl: text("episode_url").notNull().unique(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
});

export const games = pgTable(
  "games",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    opponent: varchar("opponent", { length: 128 }).notNull(),
    isHome: boolean("is_home"),
    competition: varchar("competition", { length: 128 }),
    venue: varchar("venue", { length: 128 }),
    gameTime: timestamp("game_time", { withTimezone: true }),
    status: varchar("status", { length: 16 }).notNull().default("upcoming"), // upcoming | completed
    result: text("result"),
    keyPoints: jsonb("key_points").$type<string[]>().default([]),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.teamId, t.opponent, t.gameTime)],
);

export const updateLog = pgTable("update_log", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 32 }).notNull(), // profile | news | schedule
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  ranAt: timestamp("ran_at", { withTimezone: true }).defaultNow().notNull(),
});
