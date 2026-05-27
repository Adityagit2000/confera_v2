import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
// For admin tasks we need the service role key which might not be in .env by default.
// Let's check if it exists or use standard fetch to invoke the edge function via URL.
// But wait, we modified the edge function to accept the service role key!
// Let's just pass it via ENV or read it from somewhere. Wait, I can run `supabase status` to get it or just use `process.env.SUPABASE_SERVICE_ROLE_KEY`.

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing URL or SERVICE_ROLE_KEY. Run with: SUPABASE_SERVICE_ROLE_KEY=... node scratch/backfill_prep_plans.js");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function backfill() {
  console.log("Fetching users with completed sessions...");
  const { data: sessions, error } = await supabase
    .from('interview_sessions')
    .select('user_id')
    .eq('status', 'completed');
    
  if (error) {
    console.error("Error fetching sessions:", error);
    return;
  }

  const uniqueUsers = [...new Set(sessions.map(s => s.user_id))];
  console.log(`Found ${uniqueUsers.length} users with completed sessions.`);

  const { data: existingPlans, error: plansError } = await supabase
    .from('prep_plans')
    .select('user_id');

  if (plansError) {
    console.error("Error fetching prep plans:", plansError);
    return;
  }

  const usersWithPlans = new Set(existingPlans.map(p => p.user_id));
  const usersToBackfill = uniqueUsers.filter(u => !usersWithPlans.has(u));

  console.log(`${usersToBackfill.length} users need a prep plan.`);

  for (const userId of usersToBackfill) {
    console.log(`Triggering generate-prep-plan for ${userId}...`);
    try {
      const res = await fetch(`${url}/functions/v1/generate-prep-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`
        },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok) {
        console.error(`Failed for ${userId}:`, data);
      } else {
        console.log(`Success for ${userId}:`, data);
      }
    } catch (err) {
      console.error(`Error invoking for ${userId}:`, err);
    }
    // Rate limit avoidance
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log("Done.");
}

backfill();
