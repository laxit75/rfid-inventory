const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const TagAlertState = require('../models/TagAlertState');
const { handleTagEvent, muteTag, resolveTag } = require('../services/handleTagEvent');

// Note: queue and realtime modules are not mocked. Their functions will
// silently no-op if RabbitMQ is unavailable (handled by internal retry logic).
// Tests verify the state machine transitions, not queue delivery.

describe('TagAlertState → handleTagEvent Integration', () => {
  const testTagId = 'E2E-TEST-001';
  const testZoneId = 'Zone-A';

  let mongoAvailable = false;

  before(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rfid_inventory_test';
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
      mongoAvailable = true;
    } catch (err) {
      console.warn('MongoDB not available — skipping DB-dependent tests. Start MongoDB and set MONGODB_URI to run these tests.');
      mongoAvailable = false;
    }
  });

  after(async () => {
    if (!mongoAvailable) return;
    await TagAlertState.deleteMany({ tagId: { $regex: /^E2E-TEST-/ } }).catch(() => {});
    await mongoose.disconnect().catch(() => {});
  });

  it('should start in normal state and transition to alert on violation exit', async (t) => {
    if (!mongoAvailable) t.skip();
    // Initial state should be normal (auto-created)
    const result = await handleTagEvent(
      { tagId: testTagId, zoneId: testZoneId, eventType: 'exit' },
      { isViolation: true }
    );

    assert.strictEqual(result.transitioned, true);
    assert.strictEqual(result.newStatus, 'unintentional_alert');
    assert.strictEqual(result.alerted, true);

    // Verify DB record
    const state = await TagAlertState.findOne({ tagId: testTagId });
    assert.ok(state);
    assert.strictEqual(state.status, 'unintentional_alert');
    assert.strictEqual(state.alarmCount, 1);
    assert.ok(state.firstDetectedAt);
    assert.ok(state.lastAlarmTriggeredAt);
  });

  it('should re-trigger on subsequent violation exit after the repeat interval', async (t) => {
    if (!mongoAvailable) t.skip();
    // Simulate that enough time has passed by manually setting lastAlarmTriggeredAt far back
    const longAgo = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    await TagAlertState.updateOne(
      { tagId: testTagId },
      { $set: { lastAlarmTriggeredAt: longAgo, alarmCount: 1 } }
    );

    const result = await handleTagEvent(
      { tagId: testTagId, zoneId: testZoneId, eventType: 'exit' },
      { isViolation: true }
    );

    assert.strictEqual(result.reTriggered, true);
    assert.strictEqual(result.alerted, true);

    const state = await TagAlertState.findOne({ tagId: testTagId });
    assert.strictEqual(state.alarmCount, 2);
  });

  it('should not re-trigger if within the repeat interval', async (t) => {
    if (!mongoAvailable) t.skip();
    // lastAlarmTriggeredAt is now (just set)
    const result = await handleTagEvent(
      { tagId: testTagId, zoneId: testZoneId, eventType: 'exit' },
      { isViolation: true }
    );

    assert.strictEqual(result.alerted, false);
    assert.strictEqual(result.reTriggered, undefined);
  });

  it('should mute an alerting tag', async (t) => {
    if (!mongoAvailable) t.skip();
    const state = await muteTag(testTagId, 'test-operator', 60 * 1000); // 1 min mute
    assert.strictEqual(state.alarmMuted, true);
    assert.strictEqual(state.mutedBy, 'test-operator');
    assert.ok(state.muteExpiresAt);
  });

  it('should resolve an alerting tag on return', async (t) => {
    if (!mongoAvailable) t.skip();
    const result = await handleTagEvent(
      { tagId: testTagId, zoneId: testZoneId, eventType: 'return' },
      { isViolation: false }
    );

    assert.strictEqual(result.resolved, true);
    assert.strictEqual(result.newStatus, 'normal');

    const state = await TagAlertState.findOne({ tagId: testTagId });
    assert.strictEqual(state.status, 'normal');
    assert.ok(state.resolvedAt);
  });

  it('should ignore permanently disabled tags', async (t) => {
    if (!mongoAvailable) t.skip();
    await TagAlertState.updateOne(
      { tagId: testTagId },
      { $set: { status: 'permanently_disabled' } }
    );

    const result = await handleTagEvent(
      { tagId: testTagId, zoneId: testZoneId, eventType: 'exit' },
      { isViolation: true }
    );

    assert.strictEqual(result.ignored, true);

    // Clean up
    await TagAlertState.deleteOne({ tagId: testTagId });
  });

  it('should handle complete lifecycle: normal → alert → mute → resolve', async (t) => {
    if (!mongoAvailable) t.skip();
    const tagId = 'E2E-TEST-LIFECYCLE';

    // Step 1: Violation exit triggers alert
    let result = await handleTagEvent(
      { tagId, zoneId: testZoneId, eventType: 'exit' },
      { isViolation: true }
    );
    assert.strictEqual(result.newStatus, 'unintentional_alert');

    // Step 2: Mute
    await muteTag(tagId, 'operator', 5 * 60 * 1000);
    let state = await TagAlertState.findOne({ tagId });
    assert.strictEqual(state.alarmMuted, true);

    // Step 3: Muted tag receives another EXIT — should NOT re-trigger alarm
    result = await handleTagEvent(
      { tagId, zoneId: testZoneId, eventType: 'exit' },
      { isViolation: true }
    );
    assert.strictEqual(result.alerted, false);

    // Step 4: Return resolves
    result = await handleTagEvent(
      { tagId, zoneId: testZoneId, eventType: 'return' },
      { isViolation: false }
    );
    assert.strictEqual(result.resolved, true);

    // Step 5: Manual resolve again on normal tag — should be idempotent
    state = await resolveTag(tagId, 'admin');
    assert.strictEqual(state.status, 'normal');

    // Clean up
    await TagAlertState.deleteOne({ tagId });
  });

  it('should handle temp_disabled expiry → overdue', async (t) => {
    if (!mongoAvailable) t.skip();
    const tagId = 'E2E-TEST-OVERDUE';

    // Create tag in temp_disabled with past expiry
    await TagAlertState.create({
      tagId,
      status: 'temp_disabled',
      disabledUntil: new Date(Date.now() - 60 * 1000) // expired 1 min ago
    });

    const result = await handleTagEvent(
      { tagId, zoneId: testZoneId, eventType: 'exit' },
      { isViolation: true }
    );

    assert.strictEqual(result.newStatus, 'temp_disabled_overdue');
    assert.strictEqual(result.alerted, true);

    await TagAlertState.deleteOne({ tagId });
  });
});
