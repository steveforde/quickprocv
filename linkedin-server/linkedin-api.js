import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();


const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const PROXYCURL_KEY = process.env.PROXYCURL_API_KEY;

app.post('/api/linkedin-import', async (req, res) => {
  const { url } = req.body;

  if (!url || !url.startsWith('https://www.linkedin.com/in/')) {
    return res.status(400).json({ error: 'Invalid LinkedIn URL' });
  }

  try {
    const response = await fetch(`https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PROXYCURL_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Failed to fetch from Proxycurl');

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('LinkedIn import error:', err);
    res.status(500).json({ error: 'Failed to import LinkedIn profile.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ LinkedIn Import API running on http://localhost:${PORT}`);
});
