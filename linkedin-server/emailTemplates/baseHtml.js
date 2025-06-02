// File: linkedin-server/emailTemplates/baseHtml.js
export default function generateHtmlTemplate(header, message) {
  // Define some common styles to reduce repetition and ensure consistency
  const textCellStyle = "font-family: 'Segoe UI', Arial, sans-serif; text-align: center;";
  const linkStyle = "color: #007bff; text-decoration: none;"; // Example link style

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>QuickProCV Notification</title>
  <style type="text/css">
    body { margin: 0; padding: 0; width: 100% !important; background-color: #f9f9f9; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    td[align="center"] p, td[align="center"] h2 {
        text-align: center;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #f9f9f9;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f9f9f9;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table width="600" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="padding: 30px 40px;">


<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
  <tr>
    <td align="center" style="padding-bottom: 20px;">
      <table cellpadding="0" cellspacing="0" width="160" role="presentation" style="margin: 0 auto;">
        <tr>
          <td align="center">
            <img 
              src="cid:qprologo" 
              width="120" 
              style="display: block; width: 120px; height: auto; border: 0; outline: none; text-decoration: none;" 
              alt="QuickProCV Logo" />
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>





              <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="${textCellStyle} color: #007bff; font-size: 22px; font-weight: 600; padding-bottom: 16px; text-align: center;">
                    ${header}
                  </td>
                </tr>
              </table>
          

        
              <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="${textCellStyle} font-size: 16px; color: #333; line-height: 1.6; padding-bottom: 24px; text-align: center;">
                    ${message.replace(/\n/g, '<br />')}
                  </td>
                </tr>
              </table>
          

        
              <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="${textCellStyle} font-size: 12px; color: #888; padding-top: 30px; text-align: center;">
                    You're receiving this email because you're using <strong style="color: #333;">QuickProCV</strong>.
                  </td>
                </tr>
              </table>
            

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}