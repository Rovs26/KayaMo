import process from 'node:process';

const required = [
  'RUN_DB_TESTS',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
];

const missing = required.filter((name) => {
  if (name === 'RUN_DB_TESTS') return process.env[name] !== '1';
  return !process.env[name];
});

if (missing.length > 0) {
  throw new Error(
    `Database integration tests require a disposable Supabase environment. Missing or invalid: ${missing.join(', ')}`,
  );
}
