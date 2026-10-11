ALTER TABLE ledger.command_drafts ADD COLUMN operation text NOT NULL DEFAULT 'post'
  CHECK(operation IN ('post','account','reverse'));
ALTER TABLE ledger.command_drafts ADD COLUMN journal_id uuid;
ALTER TABLE ledger.command_drafts ADD CONSTRAINT draft_journal_scope
  FOREIGN KEY(workspace_id,entity_id,journal_id) REFERENCES ledger.journals(workspace_id,entity_id,id);
ALTER TABLE ledger.command_drafts ADD CONSTRAINT draft_operation_shape
  CHECK((operation='reverse' AND journal_id IS NOT NULL) OR (operation<>'reverse' AND journal_id IS NULL));
