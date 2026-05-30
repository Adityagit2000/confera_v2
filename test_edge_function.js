import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xwrjqeiqxifjldjuncxl.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_iG28uq1LcHLaNjABdCgDxg_qkY5VV_v';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  try {
    // We need to login to get a valid token since the edge function requires Authorization
    const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'test@example.com', // I don't know the user's email/password, wait!
      password: 'password'
    });
    
    // I don't have a valid user login to get a token!
  } catch (err) {
    console.error(err);
  }
}
test();
