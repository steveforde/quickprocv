import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// ✅ Load .env before anything else
dotenv.config({ path: './linkedin-server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('SUPABASE_URL:', supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey);
  throw new Error('❌ Missing Supabase credentials. Check your .env file.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default supabase;

