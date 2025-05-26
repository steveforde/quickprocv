// linkedin-server/email.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import generateHtmlTemplate from './emailTemplates/baseHtml.js';

dotenv.config({ path: './linkedin-server/.env' });

// ✅ Define transporter properly
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// ✅ Main export: sendEmail
export default async function sendEmail(to, subject, text = '', messageHtml = '', userName = '') {
  const html = messageHtml || generateHtmlTemplate(subject, text, userName);

  const mailOptions = {
    from: `QuickProCV <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
    attachments: [
      {
        filename: 'logo.png',
        path: './assets/branding/logo.png',
        cid: 'qprologo' // 👈 used as src="cid:qprologo"
      }
    ]
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.response);
    return info;
  } catch (err) {
    console.error('❌ Email error:', err);
    throw err;
  }
}







