import type pg from 'pg';
export async function processOutbox(pool:pg.Pool):Promise<number> {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const events=(await client.query<{id:string;workspace_id:string;entity_id:string}>('SELECT id,workspace_id,entity_id FROM audit.outbox WHERE processed_at IS NULL ORDER BY created_at,id LIMIT 50 FOR UPDATE SKIP LOCKED')).rows;
    for(const event of events) {
      const claimed=await client.query("INSERT INTO audit.inbox(consumer,workspace_id,entity_id,event_id) VALUES('ledger-checkpoint-v1',$2,$3,$1) ON CONFLICT DO NOTHING RETURNING event_id",[event.id,event.workspace_id,event.entity_id]);
      if(claimed.rowCount) await client.query('INSERT INTO audit.checkpoints(workspace_id,entity_id,last_event_id,processed_at) VALUES($1,$2,$3,clock_timestamp()) ON CONFLICT(workspace_id,entity_id) DO UPDATE SET last_event_id=excluded.last_event_id,processed_at=excluded.processed_at',[event.workspace_id,event.entity_id,event.id]);
      await client.query('UPDATE audit.outbox SET processed_at=clock_timestamp(),attempts=attempts+1 WHERE id=$1',[event.id]);
    }
    await client.query('COMMIT');return events.length;
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();}
}

