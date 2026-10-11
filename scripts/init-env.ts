import { existsSync,writeFileSync,mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if(existsSync('.env'))throw new Error('.env already exists; keep its keys and settings.');
const secret=()=>randomBytes(32).toString('hex');
const admin=secret(),app=secret(),worker=secret();
writeFileSync('.env',[
 'NODE_ENV=development','GFOS_DEMO=true',
 'POSTGRES_PASSWORD='+admin,'GFOS_RUNTIME_PASSWORD='+app,'GFOS_WORKER_PASSWORD='+worker,
 'DATABASE_URL=postgresql://gfos_runtime:'+app+'@127.0.0.1:55432/gfos',
 'WORKER_DATABASE_URL=postgresql://gfos_background:'+worker+'@127.0.0.1:55432/gfos',
 'MIGRATION_DATABASE_URL=postgresql://gfos_migrator:'+admin+'@127.0.0.1:55432/gfos',
 'DEMO_API_TOKEN='+secret(),'SESSION_SECRET='+secret(),
 'API_INTERNAL_URL=http://127.0.0.1:4000','WEB_ORIGIN=http://localhost:3000',
 'GARAGE_DEFAULT_ACCESS_KEY=GK'+randomBytes(16).toString('hex'),
 'GARAGE_DEFAULT_SECRET_KEY='+secret(),'GARAGE_DEFAULT_BUCKET=gfos-documents',
].join('\n')+'\n',{mode:0o600});
mkdirSync('.local-data',{recursive:true});
writeFileSync('.local-data/garage.toml',[
 'metadata_dir = "/var/lib/garage/meta"','data_dir = "/var/lib/garage/data"','db_engine = "sqlite"',
 'replication_factor = 1','rpc_bind_addr = "[::]:3901"','rpc_public_addr = "storage:3901"',
 'rpc_secret = "'+secret()+'"','[s3_api]','s3_region = "garage"','api_bind_addr = "[::]:3900"',
 '[admin]','api_bind_addr = "[::]:3903"','admin_token = "'+secret()+'"',
].join('\n')+'\n',{mode:0o600});
console.log('Created private development configuration; existing configuration is never overwritten.');

