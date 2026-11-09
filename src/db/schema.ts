import { customType, integer, pgTable, text, timestamp, uuid, varchar, index } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const previewMedia = pgTable("socialsync_preview_media", {
  id: uuid("id").defaultRandom().primaryKey(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 80 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  fileData: bytea("file_data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const previewPosts = pgTable("socialsync_preview_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 100 }).notNull(),
  caption: text("caption").notNull(),
  mediaId: uuid("media_id").notNull().references(() => previewMedia.id),
  status: varchar("status", { length: 24 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("socialsync_preview_posts_created_idx").on(table.createdAt)]);

export const previewTargets = pgTable("socialsync_preview_targets", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").notNull().references(() => previewPosts.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 24 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  externalId: text("external_id"),
  externalUrl: text("external_url"),
  error: text("error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("socialsync_preview_targets_post_idx").on(table.postId), index("socialsync_preview_targets_status_idx").on(table.status)]);
