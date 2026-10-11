-- Bind consumer deduplication and checkpoints to the event's tenant and book.
ALTER TABLE audit.inbox ADD COLUMN workspace_id uuid;
ALTER TABLE audit.inbox ADD COLUMN entity_id uuid;
DO $$ BEGIN
 IF EXISTS(SELECT id FROM audit.outbox GROUP BY id HAVING count(*)>1) THEN
   RAISE EXCEPTION 'Ambiguous historical outbox IDs require manual migration review';
 END IF;
END $$;
UPDATE audit.inbox i SET workspace_id=o.workspace_id,entity_id=o.entity_id FROM audit.outbox o WHERE o.id=i.event_id;
ALTER TABLE audit.inbox ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE audit.inbox ALTER COLUMN entity_id SET NOT NULL;
ALTER TABLE audit.inbox DROP CONSTRAINT inbox_pkey;
ALTER TABLE audit.inbox ADD PRIMARY KEY(consumer,workspace_id,entity_id,event_id);
ALTER TABLE audit.inbox ADD FOREIGN KEY(workspace_id,entity_id,event_id) REFERENCES audit.outbox(workspace_id,entity_id,id);
ALTER TABLE audit.checkpoints ADD FOREIGN KEY(workspace_id,entity_id,last_event_id) REFERENCES audit.outbox(workspace_id,entity_id,id);
REVOKE SELECT ON ledger.journals,ledger.postings FROM gfos_worker;

