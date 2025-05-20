// linkedin-server/email.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config({ path: './linkedin-server/.env' });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

export default async function sendEmail(to, subject, text, html = '') {
  const mailOptions = {
    from: `QuickProCV <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
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


