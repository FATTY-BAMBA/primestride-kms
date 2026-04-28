import { config } from 'dotenv';
config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Node version:', process.version);
console.log('URL:', url);
console.log('Key length:', key?.length);
console.log('');

console.log('Test 1: Direct fetch to public schema...');
try {
  const r = await fetch(`${url}/rest/v1/profiles?limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  console.log('  ✓ HTTP', r.status, '- bytes:', (await r.text()).length);
} catch (e) {
  console.log('  ✗ ERROR:', e.message);
  console.log('  cause:', e.cause?.message || e.cause);
}

console.log('');
console.log('Test 2: Direct fetch to payroll schema...');
try {
  const r = await fetch(`${url}/rest/v1/labor_insurance_brackets?limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Accept-Profile': 'payroll'
    }
  });
  console.log('  ✓ HTTP', r.status, '- bytes:', (await r.text()).length);
} catch (e) {
  console.log('  ✗ ERROR:', e.message);
  console.log('  cause:', e.cause?.message || e.cause);
}

console.log('');
console.log('Test 3: Via @supabase/supabase-js client...');
try {
  const { createClient } = await import('@supabase/supabase-js');
  const c = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const r = await c.schema('payroll').from('labor_insurance_brackets').select('*').limit(1);
  if (r.error) {
    console.log('  ✗ ERROR:', r.error.message);
    console.log('  details:', r.error);
  } else {
    console.log('  ✓ Got', r.data?.length, 'rows');
  }
} catch (e) {
  console.log('  ✗ THROWN:', e.message);
  console.log('  cause:', e.cause?.message || e.cause);
}
