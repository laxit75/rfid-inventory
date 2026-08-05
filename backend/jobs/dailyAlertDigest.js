const TagAlertState = require('../models/TagAlertState');
const { publishEmailJob } = require('../services/queue');
const logger = require('../utils/logger');

async function runDailyDigest() {
  const now = new Date();

  // Find all currently unresolved tags
  const unresolvedTags = await TagAlertState.find({
    status: { $in: ['unintentional_alert', 'temp_disabled_overdue'] }
  }).lean();

  if (unresolvedTags.length === 0) {
    logger.info('Daily digest: no unresolved tags to report');
    return 0;
  }

  // Filter to tags that haven't received a daily email today
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const tagsToNotify = unresolvedTags.filter((tag) => {
    const dailySends = (tag.emailsSent || []).filter(
      (e) => e.type === 'daily' && new Date(e.sentAt) >= dayStart
    );
    return dailySends.length === 0;
  });

  if (tagsToNotify.length === 0) {
    logger.info('Daily digest: all tags already notified today');
    return 0;
  }

  // Publish digest jobs through the RabbitMQ queue for centralized email handling
  const tagIds = tagsToNotify.map((t) => t.tagId);
  for (const tagId of tagIds) {
    publishEmailJob({ tagId, type: 'DIGEST_DAILY' });
  }

  // Mark all notified tags
  await TagAlertState.updateMany(
    { tagId: { $in: tagIds } },
    {
      $push: {
        emailsSent: { cadence: 'daily', sentAt: now }
      }
    }
  );

  logger.info('Daily digest queued', { tagCount: tagsToNotify.length });
  return tagsToNotify.length;
}

module.exports = { runDailyDigest };
