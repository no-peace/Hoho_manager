import { db } from "../config/database.js";

export interface PublishedAppLayoutRow {
  schema_version: number;
  desktop_document: string;
  mobile_document: string;
  published_by_discord_id: string;
  created_at: string;
  updated_at: string;
}

export interface AppLayoutPublisherRow {
  discord_user_id: string;
  granted_by_discord_id: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export const appLayoutRepository = {
  getPublished: (): Promise<PublishedAppLayoutRow | undefined> =>
    db.get<PublishedAppLayoutRow>("SELECT schema_version, desktop_document, mobile_document, published_by_discord_id, created_at, updated_at FROM published_app_layouts WHERE id = 1"),

  publish: async (input: {
    schemaVersion: number;
    desktop: unknown;
    mobile: unknown;
    publisherDiscordId: string;
  }): Promise<PublishedAppLayoutRow> => db.transaction(async () => {
    await db.run(
      `INSERT INTO published_app_layouts
        (id, schema_version, desktop_document, mobile_document, published_by_discord_id, created_at, updated_at)
       VALUES (1, @schemaVersion, @desktop, @mobile, @publisher, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         schema_version = excluded.schema_version,
         desktop_document = excluded.desktop_document,
         mobile_document = excluded.mobile_document,
         published_by_discord_id = excluded.published_by_discord_id,
         updated_at = CURRENT_TIMESTAMP`,
      {
        schemaVersion: input.schemaVersion,
        desktop: JSON.stringify(input.desktop),
        mobile: JSON.stringify(input.mobile),
        publisher: input.publisherDiscordId,
      },
    );
    const row = await db.get<PublishedAppLayoutRow>(
      "SELECT schema_version, desktop_document, mobile_document, published_by_discord_id, created_at, updated_at FROM published_app_layouts WHERE id = 1",
    );
    if (!row) throw new Error("Published responsive layout was not readable after persistence.");
    return row;
  }),

  isPublisher: async (discordUserId: string): Promise<boolean> => {
    const row = await db.get<{ is_active: number }>(
      "SELECT is_active FROM app_layout_publishers WHERE discord_user_id = @discordUserId",
      { discordUserId },
    );
    return row?.is_active === 1;
  },

  listPublishers: (): Promise<AppLayoutPublisherRow[]> =>
    db.query<AppLayoutPublisherRow>(
      "SELECT discord_user_id, granted_by_discord_id, is_active, created_at, updated_at FROM app_layout_publishers WHERE is_active = 1 ORDER BY created_at DESC",
    ),

  grantPublisher: async (discordUserId: string, grantedByDiscordId: string): Promise<void> => {
    await db.run(
      `INSERT INTO app_layout_publishers (discord_user_id, granted_by_discord_id, is_active, created_at, updated_at)
       VALUES (@discordUserId, @grantedBy, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(discord_user_id) DO UPDATE SET
         granted_by_discord_id = excluded.granted_by_discord_id,
         is_active = 1,
         updated_at = CURRENT_TIMESTAMP`,
      { discordUserId, grantedBy: grantedByDiscordId },
    );
  },

  revokePublisher: async (discordUserId: string): Promise<void> => {
    await db.run(
      "UPDATE app_layout_publishers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE discord_user_id = @discordUserId",
      { discordUserId },
    );
  },
};
