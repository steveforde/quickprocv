// proConfirmationHtml.js
export default function generateProConfirmationHtml(userName = 'QuickProCV User') {
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Welcome to QuickProCV Pro!</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
          font-family: 'Segoe UI', Arial, sans-serif;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: #fff;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          text-align: center;
        }
        .logo {
          margin-bottom: 20px;
        }
        .title {
          font-size: 24px;
          color: #007bff;
          margin-bottom: 10px;
        }
        .message {
          font-size: 16px;
          color: #333;
          margin-bottom: 30px;
        }
        .footer {
          font-size: 12px;
          color: #888;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <img class="logo" src="cid:qprologo" alt="QuickProCV Logo" width="100" />
        <div class="title">Welcome to Pro, ${userName}!</div>
        <div class="message">
          🎉 Thanks for upgrading! You now have full access to all features, including <strong>100 AI generations per month</strong> for the next 2 years.<br /><br />
          Log in now to explore your new benefits.
        </div>
        <div class="footer">
          You’re receiving this because you joined <strong>QuickProCV Pro</strong>.
        </div>
      </div>
    </body>
  </html>
  `;
}

