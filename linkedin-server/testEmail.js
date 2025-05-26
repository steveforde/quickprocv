import sendEmail from './email.js';
import templates from './emailTemplates/templates.js';

const testUser = {
  email: 'sforde08@gmail.com',
  name: 'Stephen'
};

async function testEmails() {
  const keys = Object.keys(templates);
  for (const key of keys) {
    const tpl = templates[key];
    console.log(`📤 Sending: ${tpl.subject}`);
    const html = tpl.html(testUser.name); // pass name
    await sendEmail(testUser.email, tpl.subject, '', html, testUser.name);
  }
  console.log('✅ All test emails sent.');
}

testEmails();



