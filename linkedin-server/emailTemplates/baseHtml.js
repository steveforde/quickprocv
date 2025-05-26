const baseHtml = `
  <div style="font-family: 'Segoe UI', sans-serif; text-align: center; padding: 40px; background-color: #f9f9f9;">
    <div style="background: white; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
      <img src="cid:qprologo" alt="Q-Pro Logo" style="height: 60px; margin-bottom: 20px;" />
      <h2 style="color: #007bff;">{{HEADER}}</h2>
      <p style="font-size: 16px; color: #333; line-height: 1.6;">{{MESSAGE}}</p>
      {{BUTTON}}
      <br>
      <p style="font-size: 12px; color: #888;">You're receiving this email because you’re using <strong>QuickProCV</strong>.</p>
    </div>
  </div>
`;

export default baseHtml;



