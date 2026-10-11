import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type pg from 'pg';
import { createPool } from '@gfos/database';
import { processOutbox } from './process';
@Module({providers:[{provide:'WORKER_POOL',useFactory:()=>createPool(process.env.WORKER_DATABASE_URL)}]})
class WorkerModule {}
const app=await NestFactory.createApplicationContext(WorkerModule,{logger:['error','warn']});
const pool=app.get<pg.Pool>('WORKER_POOL');
let stopping=false;
process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
console.log('GFOS durable outbox worker ready.');
while(!stopping) {
  try {await processOutbox(pool);} catch {console.error('OUTBOX_PROCESSING_FAILED');}
  await new Promise<void>(resolve=>setTimeout(resolve,1000));
}
await pool.end();await app.close();

