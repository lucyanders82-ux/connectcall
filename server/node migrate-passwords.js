// migrate-passwords.js
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data: users } = await supabase.from('users').select('id, password');
for (const user of users) {
  if (user.password?.startsWith('$2b$')) { console.log(`Skip ${user.id} — already hashed`); continue; }
  const hashed = await bcrypt.hash(user.password || 'pass1234', 12);
  await supabase.from('users').update({ password: hashed }).eq('id', user.id);
  console.log(`Migrated ${user.id}`);
}
console.log('Done');