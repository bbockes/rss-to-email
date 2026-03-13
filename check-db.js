// Quick health check: verifies we can read/write sent_posts (no email, no RSS).
// Run: npm run check-db
// Exit 0 = DB access OK. Exit 1 = failed (e.g. RLS / wrong key).

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const testUrl = '__health_check__';

async function run() {
  const { error: selectError } = await supabase
    .from('sent_posts')
    .select('post_url')
    .eq('post_url', testUrl)
    .maybeSingle();

  if (selectError) {
    console.error('SELECT failed:', selectError.code, selectError.message);
    process.exit(1);
  }

  const { error: insertError } = await supabase
    .from('sent_posts')
    .upsert(
      { post_url: testUrl, post_title: 'health-check', sent_at: new Date().toISOString() },
      { onConflict: 'post_url' }
    );

  if (insertError) {
    console.error('INSERT failed:', insertError.code, insertError.message);
    process.exit(1);
  }

  await supabase.from('sent_posts').delete().eq('post_url', testUrl);
  console.log('Database OK — read/write to sent_posts works.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
