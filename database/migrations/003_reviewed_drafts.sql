CREATE TABLE ledger.command_drafts (
  workspace_id uuid NOT NULL, entity_id uuid NOT NULL, id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES identity.principals(id), command jsonb NOT NULL,
  request_hash text NOT NULL CHECK(length(request_hash)=64), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,entity_id,id),
  FOREIGN KEY(workspace_id,entity_id) REFERENCES workspace.entities(workspace_id,id)
);
ALTER TABLE ledger.command_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger.command_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY private_drafts ON ledger.command_drafts TO gfos_app
  USING(workspace.has_access(workspace_id,entity_id,true) AND actor_id=nullif(current_setting('app.actor_id',true),'')::uuid)
  WITH CHECK(workspace.has_access(workspace_id,entity_id,true) AND actor_id=nullif(current_setting('app.actor_id',true),'')::uuid);
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON ledger.command_drafts FOR EACH ROW EXECUTE FUNCTION ledger.reject_mutation();
GRANT SELECT,INSERT ON ledger.command_drafts TO gfos_app;

