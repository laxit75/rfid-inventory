const nodemailer = require('nodemailer');
const Recipient = require('../models/Recipient');
const AlertLog = require('../models/AlertLog');
const logger = require('../utils/logger');

let transporter;

function buildTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || 'RFID System <no-reply@rfid.local>';

  if (!smtpHost || !smtpUser || !smtpPass) {
    logger.warn('SMTP credentials missing; falling back to Ethereal for local development', { smtpHost: Boolean(smtpHost), smtpUser: Boolean(smtpUser) });
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    from: smtpFrom
  });
}

(async () => {
  transporter = buildTransporter();
  if (!transporter) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      logger.warn('Using Ethereal test account for local development', { previewUrl: true });
    } catch (err) {
      logger.error('Unable to initialize email transport', { error: err.message });
    }
  }
})();

/**
 * Sends an alert email to all configured recipients.
 * @param {Object} tag - Mongoose Tag document
 * @param {('ALARM'|'OVERDUE')} type
 * @returns {Object} - the nodemailer info object
 */
async function sendAlertEmail(tag, type) {
  try {
    const recipients = await Recipient.find({});
    if (recipients.length === 0) {
      logger.warn('No recipients configured; skipping email', { tagId: tag.tagId, type });
      return null;
    }

    const to = recipients.map(r => r.email).join(',');
    const subject = type === 'ALARM'
      ? `ALARM: Equipment "${tag.equipment?.name || tag.tagId}" left lab`
      : `OVERDUE: Equipment "${tag.equipment?.name || tag.tagId}" is overdue`;

    const html = `<p>Tag <strong>${tag.tagId}</strong> ${type === 'ALARM' ? 'has exited the lab unintentionally' : 'is overdue and still outside'}.</p>
                <p>Equipment: ${tag.equipment?.name || 'N/A'}</p>`;

    if (!transporter) {
      logger.warn('Email transport unavailable; skipping send', { tagId: tag.tagId, type });
      return null;
    }

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"RFID System" <no-reply@rfid.local>',
      to,
      subject,
      html
    });

    logger.info('Email sent', { tagId: tag.tagId, type, messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) });

    const logType = type === 'ALARM' ? 'EMAIL_SENT' : 'OVERDUE_EMAIL_SENT';
    await AlertLog.create({
      type: logType,
      tag: tag._id,
      tagId: tag.tagId,
      timestamp: new Date(),
      details: `Preview: ${nodemailer.getTestMessageUrl(info)}`
    });

    return info;
  } catch (err) {
    logger.error('Email send failed', { tagId: tag.tagId, type, error: err.message });
    return null;
  }
}

module.exports = { sendAlertEmail };