import { createPool } from '../packages/database/src/index';
if(process.env.NODE_ENV==='production' || process.env.GFOS_DEMO!=='true')throw new Error('This bootstrap is exclusively for a synthetic development deployment.');
const appSecret=process.env.GFOS_RUNTIME_PASSWORD,workerSecret=process.env.GFOS_WORKER_PASSWORD;
if(!appSecret || !workerSecret || appSecret.length<32 || workerSecret.length<32)throw new Error('Generated runtime passwords are required.');
const admin=createPool(process.env.MIGRATION_DATABASE_URL);
try{
 const tx=await admin.connect();
 try{
  await tx.query('BEGIN');
  await tx.query("SELECT set_config('bootstrap.app_secret',$1,true),set_config('bootstrap.worker_secret',$2,true)",[appSecret,workerSecret]);
  await tx.query(`DO $$ BEGIN
   IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='gfos_runtime') THEN
    EXECUTE format('CREATE ROLE gfos_runtime LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS INHERIT',current_setting('bootstrap.app_secret'));
   END IF;
   IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='gfos_background') THEN
    EXECUTE format('CREATE ROLE gfos_background LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS INHERIT',current_setting('bootstrap.worker_secret'));
   END IF;
  END $$`);
  await tx.query('COMMIT');
 }catch(e){await tx.query('ROLLBACK');throw e;}finally{tx.release();}
 await import('./migrate');
 await admin.query('GRANT gfos_app TO gfos_runtime; GRANT gfos_worker TO gfos_background');
 await import('./seed');
}finally{await admin.end();}

