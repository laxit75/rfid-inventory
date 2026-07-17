const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const Recipient = require('../models/Recipient');
const AlertLog = require('../models/AlertLog');
const logger = require('../utils/logger');

let transporter;

function buildTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    logger.warn('SMTP credentials missing; falling back to Ethereal for local development');
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

function renderTemplate(templatePath, vars) {
  try {
    const t = fs.readFileSync(path.join(__dirname, '..', 'emailTemplates', templatePath), 'utf8');
    return Object.keys(vars).reduce((out, k) => out.split(`{{${k}}}`).join(vars[k] || ''), t);
  } catch (err) {
    logger.error('Template render failed', { templatePath, error: err.message });
    return '';
  }
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

async function deliverAlertEmail(tag, type) {
  const recipients = await Recipient.find({});
  if (recipients.length === 0) {
    logger.warn('No recipients configured; skipping email', { tagId: tag.tagId, type });
    return null;
  }

  const to = recipients.map(r => r.email).join(',');
  const subject = type === 'ALARM'
    ? `ALARM: Equipment "${tag.equipment?.name || tag.tagId}" left lab`
    : `OVERDUE: Equipment "${tag.equipment?.name || tag.tagId}" is overdue`;

  const vars = {
    tagId: tag.tagId,
    equipmentName: tag.equipment?.name || 'N/A',
    zoneName: (tag.currentZone && tag.currentZone.name) || (tag.assignedZone && tag.assignedZone.name) || 'N/A',
    timestamp: new Date().toISOString(),
    details: tag.notes || '',
    overdueSince: tag.overdueSince ? tag.overdueSince.toISOString() : ''
  };

  const templateFile = type === 'ALARM' ? 'alert.html' : 'overdue.html';
  const html = renderTemplate(templateFile, vars);

  if (!transporter) {
    throw new Error('Email transport is unavailable');
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
}

module.exports = { deliverAlertEmail };
