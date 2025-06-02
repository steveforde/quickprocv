// linkedin-server/email.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import generateHtmlTemplate from './emailTemplates/baseHtml.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logoPath = path.resolve(__dirname, '../assets/branding/logo_email.png');

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

  // 🔍 ADD DEBUG LOGS HERE
  console.log("📤 Sending to:", to);
  console.log("📨 Subject:", subject);
  console.log("🧾 From:", process.env.GMAIL_USER);
  console.log("🖼️ HTML Preview:", html);

  const mailOptions = {
    from: `QuickProCV <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
attachments: [
  {
    filename: 'logo_email.png',
    path: logoPath, // full path to your image file
    cid: 'qprologo' // must match the "cid:" used in your HTML
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







