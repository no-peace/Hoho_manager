import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, initializeDatabase } from "../src/config/database.js";
import { staffRepository } from "../src/repositories/staffRepository.js";

describe("Empirical Challenger: StaffRepository Atomic Cooldown Upsert (RB-13 Stress Test)", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await db.run("DELETE FROM staff_cooldowns WHERE discord_user_id LIKE 'test-staff-%'");
  });

  afterAll(async () => {
    await db.run("DELETE FROM staff_cooldowns WHERE discord_user_id LIKE 'test-staff-%'");
  });

  it("inserts a new staff cooldown record atomically with count_this_hour = 1", async () => {
    const staffId = "test-staff-1";
    await staffRepository.upsertCooldown(staffId, "send");

    const record = await staffRepository.getCooldown(staffId, "send");
    expect(record).toBeDefined();
    expect(record?.discord_user_id).toBe(staffId);
    expect(record?.action).toBe("send");
    expect(record?.count_this_hour).toBe(1);

    const nowHour = new Date().toISOString().slice(0, 13);
    expect(record?.hour_bucket).toBe(nowHour);

    const hourlyCount = await staffRepository.getHourlyCount(staffId, "send");
    expect(hourlyCount).toBe(1);
  });

  it("atomically increments count_this_hour upon sequential updates in the same hour", async () => {
    const staffId = "test-staff-2";
    for (let i = 1; i <= 5; i++) {
      await staffRepository.upsertCooldown(staffId, "send");
    }

    const record = await staffRepository.getCooldown(staffId, "send");
    expect(record?.count_this_hour).toBe(5);

    const hourlyCount = await staffRepository.getHourlyCount(staffId, "send");
    expect(hourlyCount).toBe(5);
  });

  it("resets count_this_hour to 1 when rolling over to a new hour bucket", async () => {
    const staffId = "test-staff-rollover";
    const oldHourBucket = "2026-01-01T00";
    const oldTimestamp = "2026-01-01T00:15:00.000Z";

    // Simulate an existing record from a previous hour bucket
    await db.run(`
      INSERT INTO staff_cooldowns (discord_user_id, action, last_at, count_this_hour, hour_bucket)
      VALUES (?, ?, ?, ?, ?)
    `, [staffId, "send", oldTimestamp, 42, oldHourBucket]);

    const oldRecord = await staffRepository.getCooldown(staffId, "send");
    expect(oldRecord?.count_this_hour).toBe(42);
    expect(oldRecord?.hour_bucket).toBe(oldHourBucket);

    // Now upsert in current hour
    await staffRepository.upsertCooldown(staffId, "send");

    const updatedRecord = await staffRepository.getCooldown(staffId, "send");
    const currentHour = new Date().toISOString().slice(0, 13);

    expect(updatedRecord?.hour_bucket).toBe(currentHour);
    expect(updatedRecord?.count_this_hour).toBe(1); // Reset to 1 on hour change!
  });

  it("stress-tests high concurrency: 50 simultaneous upsert calls without SQLITE_CONSTRAINT crash", async () => {
    const staffId = "test-staff-concurrent";
    const action = "send";
    const concurrentRequests = 50;

    // Trigger 50 simultaneous calls in parallel
    const promises = Array.from({ length: concurrentRequests }, () =>
      staffRepository.upsertCooldown(staffId, action),
    );

    // Under the old check-then-insert pattern (RB-13), this threw:
    // SQLITE_CONSTRAINT: UNIQUE constraint failed: staff_cooldowns.discord_user_id, staff_cooldowns.action
    await expect(Promise.all(promises)).resolves.not.toThrow();

    const record = await staffRepository.getCooldown(staffId, action);
    expect(record).toBeDefined();
    expect(record?.discord_user_id).toBe(staffId);
    expect(record?.count_this_hour).toBe(concurrentRequests);
  });

  it("supports multiple distinct actions for the same staff member concurrently", async () => {
    const staffId = "test-staff-actions";
    const actions = ["send", "edit", "delete", "manage_templates"];

    await Promise.all(
      actions.flatMap((act) => [
        staffRepository.upsertCooldown(staffId, act),
        staffRepository.upsertCooldown(staffId, act),
        staffRepository.upsertCooldown(staffId, act),
      ]),
    );

    for (const act of actions) {
      const record = await staffRepository.getCooldown(staffId, act);
      expect(record?.action).toBe(act);
      expect(record?.count_this_hour).toBe(3);
    }
  });
});
