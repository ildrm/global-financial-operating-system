import pg from 'pg';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const envFile=fileURLToPath(new URL('../../../.env',import.meta.url));
if(existsSync(envFile)) process.loadEnvFile(envFile);
export { sql, drizzle };
export type Transaction = pg.PoolClient;
export function createPool(url=process.env.DATABASE_URL): pg.Pool {
  if(!url) throw new Error('DATABASE_URL is required.');
  return new pg.Pool({connectionString:url,max:10,connectionTimeoutMillis:5000,statement_timeout:10000});
}
export function canonical(value:unknown):string {
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if(value!==null && typeof value==='object') return '{'+Object.entries(value)
    .filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b))
    .map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  const encoded=JSON.stringify(value);
  if(encoded===undefined) throw new Error('Unserializable hash input.');
  return encoded;
}
export function hash(value:unknown):string { return createHash('sha256').update(canonical(value)).digest('hex'); }
export async function transaction<T>(pool:pg.Pool, actorId:string, run:(tx:Transaction)=>Promise<T>):Promise<T> {
  for(let attempt=0;attempt<3;attempt++) {
    const tx=await pool.connect();
    try {
      await tx.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      await tx.query('SELECT set_config($1,$2,true)', ['app.actor_id',actorId]);
      const result=await run(tx);
      await tx.query('COMMIT');
      return result;
    } catch(error) {
      await tx.query('ROLLBACK');
      if(error instanceof pg.DatabaseError && ['40001','40P01'].includes(error.code ?? '') && attempt<2) continue;
      throw error;
    } finally { tx.release(); }
  }
  throw new Error('Transaction retry limit exceeded.');
}
export async function setScope(tx:Transaction,workspaceId:string,entityId:string):Promise<void> {
  await tx.query('SELECT set_config($1,$2,true),set_config($3,$4,true)',
    ['app.workspace_id',workspaceId,'app.entity_id',entityId]);
}

