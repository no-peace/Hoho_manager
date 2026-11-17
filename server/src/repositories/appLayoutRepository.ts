import { db } from "../config/database.js";

export interface PublishedAppLayoutRow {
  schema_version: number;
  desktop_document: string;
  mobile_document: string;
  published_by_discord_id: string;
  created_at: string;
  updated_at: string;
}

export const appLayoutRepository = {
  getPublished: (): Promise<PublishedAppLayoutRow | undefined> =>
    db.get<PublishedAppLayoutRow>(
      "SELECT schema_version, desktop_document, mobile_document, published_by_discord_id, created_at, updated_at FROM published_app_layouts WHERE id = 1",
    ),

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
};
