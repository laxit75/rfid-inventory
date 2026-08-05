const TagAlertState = require('../models/TagAlertState');
const { publishEmailJob } = require('../services/queue');
const logger = require('../utils/logger');

/**
 * hourlyAlertDigest.js
 *
 * Scheduled job that fires once per hour. It queries TagAlertState for all
 * tags still in 'unintentional_alert' status and sends a summary email to
 * all configured recipients.
 *
 * Dedup: tracks which tag-hour combinations have already been notified via
 * the emailsSent subdocument on each TagAlertState record.
 */

/**
 * Push a digest notification into the RabbitMQ email queue.
 * The emailWorker will pick it up and send via emailService.deliverAlertEmail.
 *
 * To keep the existing email worker pattern, we publish a special digest
 * job that the email worker recognizes. The worker can be extended to render
 * the digest template when job.type === 'DIGEST_HOURLY' or 'DIGEST_DAILY'.
 */

/**
 * Run the hourly digest.
 * Returns the count of new digest emails sent (0 if none).
 */
async function runHourlyDigest() {
  const now = new Date();

  // Find all currently alerting tags
  const alertingTags = await TagAlertState.find({
    status: 'unintentional_alert'
  }).lean();

  if (alertingTags.length === 0) {
    logger.info('Hourly digest: no alerting tags to report');
    return 0;
  }

  // Filter to tags that haven't received an hourly email this hour
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);

  const tagsToNotify = alertingTags.filter((tag) => {
    const hourlySends = (tag.emailsSent || []).filter(
      (e) => e.type === 'hourly' && new Date(e.sentAt) >= hourStart
    );
    return hourlySends.length === 0;
  });

  if (tagsToNotify.length === 0) {
    logger.info('Hourly digest: all tags already notified this hour');
    return 0;
  }

  // Build email
  const recipients = await Recipient.find({}).lean();
  if (recipients.length === 0) {
    logger.warn('Hourly digest: no recipients configured');
    return 0;
  }

  const alertRows = tagsToNotify.map((tag) => {
    const since = tag.firstDetectedAt
      ? new Date(tag.firstDetectedAt).toISOString()
      : 'Unknown';
    return `<tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${tag.tagId}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${tag.status}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${since}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${tag.alarmCount || 0}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${tag.location || tag.vehicleId || 'N/A'}</td>
    </tr>`;
  }).join('\n');

  const subject = `[Hourly Digest] ${tagsToNotify.length} tag(s) currently alerting`;

  const html = renderTemplate({
    digestType: 'Hourly',
    summary: `${tagsToNotify.length} tag(s) currently in alert status as of ${now.toISOString()}`,
    timestamp: now.toISOString(),
    alertRows
  });

  const transport = getTransporter();
  if (!transport) {
    logger.error('Hourly digest: email transport unavailable');
    return 0;
  }

  // Publish a single digest email job per tag through the RabbitMQ queue
  // This ensures retry, DLQ persistence, and centralized email handling.
  const tagIds = tagsToNotify.map((t) => t.tagId);
  for (const tagId of tagIds) {
    publishEmailJob({ tagId, type: 'DIGEST_HOURLY' });
  }

  // Mark all notified tags as having received an hourly email
  await TagAlertState.updateMany(
    { tagId: { $in: tagIds } },
    {
      $push: {
        emailsSent: { cadence: 'hourly', sentAt: now }
      }
    }
  );

  logger.info('Hourly digest queued', { tagCount: tagsToNotify.length });
  return tagsToNotify.length;
}

module.exports = { runHourlyDigest };
