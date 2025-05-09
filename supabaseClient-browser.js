const supabaseUrl = window.SUPABASE_URL;
const supabaseKey = window.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  throw new Error('❌ Supabase credentials missing. Define them in your HTML.');
}

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
export default supabase;




