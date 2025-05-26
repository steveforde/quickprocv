import sendEmail from './email.js';
import generateHtmlTemplate from './emailTemplates/baseHtml.js';

const testRecipient = 'sforde08@gmail.com';
const testSubject = '🧪 Manual Email Test';
const testMessage = 'This is a manual test to verify email content, logo, and delivery.';
const testName = 'Stephen Forde';

const html = generateHtmlTemplate(testSubject, testMessage, testName);

await sendEmail(testRecipient, testSubject, testMessage, html, testName);
