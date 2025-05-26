import baseHtml from './baseHtml.js';

function generateHtmlTemplate(header, message, buttonLabel = '', buttonUrl = '', userName = '') {
  const buttonHtml = buttonLabel && buttonUrl
    ? `<a href="${buttonUrl}" style="display:inline-block; margin-top: 20px; padding:12px 24px; background-color:#007bff; color:white; text-decoration:none; border-radius:8px;">${buttonLabel}</a>`
    : '';

  const html = baseHtml
    .replace('{{HEADER}}', header)
    .replace('{{MESSAGE}}', userName ? `Hi ${userName},<br><br>${message}` : message)
    .replace('{{BUTTON}}', buttonHtml);

  return html;
}

const templates = {
  welcome: {
    subject: '🎉 Welcome to QuickProCV!',
    html: (userName) =>
      generateHtmlTemplate(
        'Welcome to QuickProCV',
        'Thanks for signing up. Start building your CV in minutes.',
        'Go to Dashboard',
        'https://quickprocv.com/dashboard',
        userName
      )
  },
  reset: {
    subject: '🔐 Password Reset Requested',
    html: (userName) =>
      generateHtmlTemplate(
        'Reset Your Password',
        'Click the button below to reset your password.',
        'Reset Now',
        'https://quickprocv.com/reset',
        userName
      )
  },
  upgrade: {
    subject: '🚀 Upgrade to Pro',
    html: (userName) =>
      generateHtmlTemplate(
        'Unlock Full Access',
        'Upgrade now for full AI features, premium templates, and 2-year access.',
        'Upgrade for €24.99',
        'https://quickprocv.com/upgrade',
        userName
      )
  }
};

export default templates;
