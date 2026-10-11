-- Restore-safe sealing, template checks, and actor binding.
CREATE OR REPLACE FUNCTION ledger.check_posting_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE j ledger.journals; a ledger.accounts; c text; original_xmin xid; current_xid xid;
BEGIN
  SELECT * INTO STRICT j FROM ledger.journals WHERE workspace_id=NEW.workspace_id AND entity_id=NEW.entity_id AND id=NEW.journal_id;
  SELECT xmin INTO STRICT original_xmin FROM ledger.journals WHERE workspace_id=NEW.workspace_id AND entity_id=NEW.entity_id AND id=NEW.journal_id;
  current_xid := (pg_current_xact_id()::text::numeric % 4294967296)::text::xid;
  SELECT * INTO STRICT a FROM ledger.accounts WHERE workspace_id=NEW.workspace_id AND entity_id=NEW.entity_id AND id=NEW.account_id;
  SELECT currency INTO STRICT c FROM workspace.entities WHERE workspace_id=NEW.workspace_id AND id=NEW.entity_id;
  IF original_xmin<>current_xid THEN RAISE EXCEPTION 'SEALED_JOURNAL' USING ERRCODE='23514'; END IF;
  IF c<>NEW.currency OR c<>j.currency OR c<>a.currency THEN RAISE EXCEPTION 'CURRENCY_MISMATCH' USING ERRCODE='23514'; END IF;
  IF j.effective_date<a.opened_on THEN RAISE EXCEPTION 'ACCOUNT_NOT_OPEN' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION ledger.validate_template() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE debit_kind text; credit_kind text; first_kind text; n integer; debits numeric; first_id uuid; second_id uuid;
BEGIN
  IF NEW.kind='reversal' THEN RETURN NULL; END IF;
  SELECT count(*),sum(CASE WHEN side='debit' THEN amount ELSE 0 END)
    INTO n,debits FROM ledger.postings WHERE workspace_id=NEW.workspace_id AND entity_id=NEW.entity_id AND journal_id=NEW.id;
  IF n<>2 OR debits<>NEW.amount THEN RAISE EXCEPTION 'POSTING_TEMPLATE_AMOUNT' USING ERRCODE='23514'; END IF;
  SELECT a.kind,p.account_id INTO debit_kind,first_id FROM ledger.postings p JOIN ledger.accounts a
    ON a.workspace_id=p.workspace_id AND a.entity_id=p.entity_id AND a.id=p.account_id
    WHERE p.workspace_id=NEW.workspace_id AND p.entity_id=NEW.entity_id AND p.journal_id=NEW.id AND p.side='debit';
  SELECT a.kind,p.account_id INTO credit_kind,second_id FROM ledger.postings p JOIN ledger.accounts a
    ON a.workspace_id=p.workspace_id AND a.entity_id=p.entity_id AND a.id=p.account_id
    WHERE p.workspace_id=NEW.workspace_id AND p.entity_id=NEW.entity_id AND p.journal_id=NEW.id AND p.side='credit';
  IF (NEW.kind='income' AND NOT(debit_kind IN ('bank','cash') AND credit_kind='income'))
    OR (NEW.kind='expense' AND NOT(debit_kind='expense' AND credit_kind IN ('bank','cash','card')))
    OR (NEW.kind='transfer' AND NOT(debit_kind IN ('bank','cash') AND credit_kind IN ('bank','cash') AND first_id<>second_id))
    OR (NEW.kind='borrowing' AND NOT(debit_kind IN ('bank','cash') AND credit_kind='loan'))
    OR (NEW.kind='card_payment' AND NOT(debit_kind='card' AND credit_kind IN ('bank','cash')))
    OR (NEW.kind='opening' AND NOT(
      (debit_kind IN ('bank','cash','card','loan') AND credit_kind='equity')
      OR (credit_kind IN ('bank','cash','card','loan') AND debit_kind='equity')
    ))
  THEN RAISE EXCEPTION 'POSTING_TEMPLATE_MISMATCH' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER valid_template AFTER INSERT ON ledger.journals DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger.validate_template();
CREATE POLICY journal_actor_binding ON ledger.journals AS RESTRICTIVE FOR INSERT TO gfos_app
  WITH CHECK(actor_id=nullif(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY audit_actor_binding ON audit.events AS RESTRICTIVE FOR INSERT TO gfos_app
  WITH CHECK(actor_id=nullif(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY idempotency_actor_binding ON audit.idempotency AS RESTRICTIVE FOR INSERT TO gfos_app
  WITH CHECK(actor_id=nullif(current_setting('app.actor_id',true),'')::uuid);
REVOKE ALL ON FUNCTION ledger.validate_template() FROM PUBLIC;

