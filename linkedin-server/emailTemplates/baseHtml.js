export default function generateHtmlTemplate(header, message, name = '') {
  return `
    <div style="font-family: 'Segoe UI', sans-serif; text-align: center; padding: 40px; background-color: #f9f9f9;">
      <div style="background: white; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <img src="cid:qprologo" alt="Q-Pro Logo" style="height: 60px; margin-bottom: 20px;" />
        <h2 style="color: #007bff;">${header}</h2>
        <p style="font-size: 16px; color: #333; line-height: 1.6;">Hi ${name || 'there'},</p>
        <p style="font-size: 16px; color: #333; line-height: 1.6;">${message}</p>
        <br>
        <p style="font-size: 12px; color: #888;">You're receiving this email because you're using <strong>QuickProCV</strong>.</p>
      </div>
    </div>
  `;
}




