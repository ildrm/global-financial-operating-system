import { createPool, hash } from '../packages/database/src/index';
import { readdir, readFile } from 'node:fs/promises';
const pool=createPool(process.env.MIGRATION_DATABASE_URL);
const tx=await pool.connect();
try {
  await tx.query("SELECT pg_advisory_lock(68767201)");
  await tx.query("CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  for(const name of (await readdir('database/migrations')).filter(n=>n.endsWith('.sql')).sort()) {
    const content=await readFile('database/migrations/'+name,'utf8');
    const checksum=hash(content);
    const prior=await tx.query<{checksum:string}>('SELECT checksum FROM public.schema_migrations WHERE name=$1',[name]);
    if(prior.rows[0]) {
      if(prior.rows[0].checksum!==checksum) throw new Error('Applied migration changed: '+name);
      continue;
    }
    await tx.query('BEGIN');
    try {
      await tx.query(content);
      await tx.query('INSERT INTO public.schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);
      await tx.query('COMMIT');
      console.log('Applied '+name);
    } catch(error) { await tx.query('ROLLBACK'); throw error; }
  }
} finally { await tx.query('SELECT pg_advisory_unlock(68767201)'); tx.release(); await pool.end(); }

