-- GFOS kernel migration 1. Applied by the migration owner, never the runtime role.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='gfos_app') THEN CREATE ROLE gfos_app NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='gfos_worker') THEN CREATE ROLE gfos_worker NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
END $$;
CREATE SCHEMA identity;
CREATE SCHEMA workspace;
CREATE SCHEMA ledger;
CREATE SCHEMA audit;
CREATE SCHEMA reporting;

CREATE TABLE identity.principals (
  id uuid PRIMARY KEY, issuer text NOT NULL, subject text NOT NULL,
  UNIQUE(issuer,subject)
);
CREATE TABLE workspace.workspaces (
  id uuid PRIMARY KEY, name text NOT NULL, kind text NOT NULL CHECK(kind IN ('personal','household','joint-capital','employer')),
  synthetic boolean NOT NULL DEFAULT false
);
CREATE TABLE workspace.entities (
  workspace_id uuid NOT NULL REFERENCES workspace.workspaces(id),
  id uuid NOT NULL, name text NOT NULL,
  currency text NOT NULL CHECK(currency IN ('EUR','USD','GBP','TRY','INR','IRR','JPY','BHD')),
  version integer NOT NULL DEFAULT 0 CHECK(version>=0),
  PRIMARY KEY(workspace_id,id)
);
CREATE TABLE workspace.grants (
  workspace_id uuid NOT NULL, entity_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES identity.principals(id),
  role text NOT NULL CHECK(role IN ('owner','viewer')), revoked_at timestamptz,
  PRIMARY KEY(workspace_id,entity_id,actor_id),
  FOREIGN KEY(workspace_id,entity_id) REFERENCES workspace.entities(workspace_id,id)
);
CREATE FUNCTION workspace.has_access(w uuid, e uuid, write_access boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM workspace.grants
    WHERE workspace_id=w AND entity_id=e AND actor_id=nullif(current_setting('app.actor_id',true),'')::uuid
      AND revoked_at IS NULL AND (NOT write_access OR role='owner'));
$$;
CREATE TABLE ledger.accounts (
  workspace_id uuid NOT NULL, entity_id uuid NOT NULL, id uuid NOT NULL,
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  kind text NOT NULL CHECK(kind IN ('bank','cash','card','loan','income','expense','equity')),
  currency text NOT NULL,
  opened_on date NOT NULL,
  PRIMARY KEY(workspace_id,entity_id,id),
  FOREIGN KEY(workspace_id,entity_id) REFERENCES workspace.entities(workspace_id,id),
  UNIQUE(workspace_id,entity_id,kind,name)
);
CREATE UNIQUE INDEX system_account_kind ON ledger.accounts(workspace_id,entity_id,kind) WHERE kind IN ('income','expense','equity');
CREATE TABLE ledger.journals (
  workspace_id uuid NOT NULL, entity_id uuid NOT NULL, id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES identity.principals(id),
  source_reference text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('opening','income','expense','transfer','borrowing','card_payment','reversal')),
  description text NOT NULL CHECK(length(description) BETWEEN 1 AND 160),
  amount numeric NOT NULL CHECK(amount>0 AND amount<1e26 AND scale(amount)<=12),
  currency text NOT NULL,
  effective_date date NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
  reversal_of uuid,
  PRIMARY KEY(workspace_id,entity_id,id),
  UNIQUE(workspace_id,entity_id,source_reference),
  UNIQUE(workspace_id,entity_id,reversal_of),
  FOREIGN KEY(workspace_id,entity_id) REFERENCES workspace.entities(workspace_id,id),
  FOREIGN KEY(workspace_id,entity_id,reversal_of) REFERENCES ledger.journals(workspace_id,entity_id,id)
);
CREATE TABLE ledger.postings (
  workspace_id uuid NOT NULL, entity_id uuid NOT NULL, journal_id uuid NOT NULL, line_no integer NOT NULL CHECK(line_no>0),
  account_id uuid NOT NULL, side text NOT NULL CHECK(side IN ('debit','credit')),
  amount numeric NOT NULL CHECK(amount>0 AND amount<1e26 AND scale(amount)<=12),
  currency text NOT NULL,
  PRIMARY KEY(workspace_id,entity_id,journal_id,line_no),
  FOREIGN KEY(workspace_id,entity_id,journal_id) REFERENCES ledger.journals(workspace_id,entity_id,id),
  FOREIGN KEY(workspace_id,entity_id,account_id) REFERENCES ledger.accounts(workspace_id,entity_id,id)
);
CREATE TABLE ledger.closed_periods (
  workspace_id uuid NOT NULL, entity_id uuid NOT NULL, through_date date NOT NULL,
  PRIMARY KEY(workspace_id,entity_id),
  FOREIGN KEY(workspace_id,entity_id) REFERENCES workspace.entities(workspace_id,id)
);
CREATE TABLE audit.idempotency (
  workspace_id uuid NOT NULL, entity_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES identity.principals(id),
  operation text NOT NULL, key uuid NOT NULL, request_hash text NOT NULL CHECK(length(request_hash)=64),
  result jsonb NOT NULL, PRIMARY KEY(workspace_id,entity_id,actor_id,operation,key),
  FOREIGN KEY(workspace_id,entity_id) REFERENCES workspace.entities(workspace_id,id)
);
CREATE TABLE audit.events (
  workspace_id uuid NOT NULL, entity_id uuid NOT NULL, id uuid NOT NULL, sequence bigint NOT NULL,
  actor_id uuid NOT NULL REFERENCES identity.principals(id), action text NOT NULL, resource_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(), previous_hash text NOT NULL,
  hash text NOT NULL CHECK(length(hash)=64),
  PRIMARY KEY(workspace_id,entity_id,id), UNIQUE(workspace_id,entity_id,sequence),
  FOREIGN KEY(workspace_id,entity_id) REFERENCES workspace.entities(workspace_id,id)
);
CREATE TABLE audit.outbox (
  workspace_id uuid NOT NULL, entity_id uuid NOT NULL, id uuid NOT NULL, journal_id uuid NOT NULL,
  event_type text NOT NULL CHECK(event_type='journal.posted.v1'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  processed_at timestamptz, attempts integer NOT NULL DEFAULT 0, last_error text,
  PRIMARY KEY(workspace_id,entity_id,id),
  FOREIGN KEY(workspace_id,entity_id,journal_id) REFERENCES ledger.journals(workspace_id,entity_id,id)
);
CREATE TABLE audit.inbox (
  consumer text NOT NULL, event_id uuid NOT NULL, processed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(consumer,event_id)
);
CREATE TABLE audit.checkpoints (
  workspace_id uuid NOT NULL, entity_id uuid NOT NULL, last_event_id uuid NOT NULL, processed_at timestamptz NOT NULL,
  PRIMARY KEY(workspace_id,entity_id)
);
CREATE TABLE reporting.snapshots (
  workspace_id uuid NOT NULL, entity_id uuid NOT NULL, id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES identity.principals(id),
  report_id text NOT NULL CHECK(report_id IN ('R-D01','R-D02')),
  content jsonb NOT NULL, checksum text NOT NULL CHECK(length(checksum)=64),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,entity_id,id),
  FOREIGN KEY(workspace_id,entity_id) REFERENCES workspace.entities(workspace_id,id)
);

CREATE FUNCTION ledger.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_FINANCIAL_RECORD' USING ERRCODE='23514'; END $$;
DO $$ DECLARE name text; BEGIN
  FOREACH name IN ARRAY ARRAY['ledger.journals','ledger.postings','audit.events','audit.idempotency','reporting.snapshots'] LOOP
    EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION ledger.reject_mutation()',name);
  END LOOP;
END $$;
CREATE FUNCTION ledger.check_posting_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE j ledger.journals; a ledger.accounts; c text;
BEGIN
  SELECT * INTO STRICT j FROM ledger.journals WHERE workspace_id=NEW.workspace_id AND entity_id=NEW.entity_id AND id=NEW.journal_id;
  SELECT * INTO STRICT a FROM ledger.accounts WHERE workspace_id=NEW.workspace_id AND entity_id=NEW.entity_id AND id=NEW.account_id;
  SELECT currency INTO STRICT c FROM workspace.entities WHERE workspace_id=NEW.workspace_id AND id=NEW.entity_id;
  IF j.created_xid<>pg_current_xact_id() THEN RAISE EXCEPTION 'SEALED_JOURNAL' USING ERRCODE='23514'; END IF;
  IF c<>NEW.currency OR c<>j.currency OR c<>a.currency THEN RAISE EXCEPTION 'CURRENCY_MISMATCH' USING ERRCODE='23514'; END IF;
  IF j.effective_date<a.opened_on THEN RAISE EXCEPTION 'ACCOUNT_NOT_OPEN' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER posting_insert BEFORE INSERT ON ledger.postings FOR EACH ROW EXECUTE FUNCTION ledger.check_posting_insert();
CREATE FUNCTION ledger.check_journal_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e workspace.entities; original ledger.journals; digits integer;
BEGIN
  SELECT * INTO STRICT e FROM workspace.entities WHERE workspace_id=NEW.workspace_id AND id=NEW.entity_id FOR UPDATE;
  IF NEW.currency<>e.currency THEN RAISE EXCEPTION 'CURRENCY_MISMATCH' USING ERRCODE='23514'; END IF;
  digits=CASE WHEN e.currency='JPY' THEN 0 WHEN e.currency='BHD' THEN 3 ELSE 2 END;
  IF NEW.amount<>round(NEW.amount,digits) THEN RAISE EXCEPTION 'UNSUPPORTED_PRECISION' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT FROM ledger.closed_periods WHERE workspace_id=NEW.workspace_id AND entity_id=NEW.entity_id AND through_date>=NEW.effective_date) THEN
    RAISE EXCEPTION 'PERIOD_CLOSED' USING ERRCODE='23514';
  END IF;
  IF NEW.reversal_of IS NOT NULL THEN
    SELECT * INTO STRICT original FROM ledger.journals WHERE workspace_id=NEW.workspace_id AND entity_id=NEW.entity_id AND id=NEW.reversal_of;
    IF original.kind='reversal' OR NEW.kind<>'reversal' OR NEW.amount<>original.amount OR NEW.effective_date<original.effective_date THEN
      RAISE EXCEPTION 'INVALID_REVERSAL' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.kind='reversal' THEN RAISE EXCEPTION 'MISSING_REVERSAL_LINK' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER journal_insert BEFORE INSERT ON ledger.journals FOR EACH ROW EXECUTE FUNCTION ledger.check_journal_insert();
CREATE FUNCTION ledger.validate_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n integer; balance numeric; j ledger.journals; digits integer;
BEGIN
  SELECT * INTO STRICT j FROM ledger.journals WHERE workspace_id=NEW.workspace_id AND entity_id=NEW.entity_id AND id=NEW.id;
  SELECT count(*),sum(CASE side WHEN 'debit' THEN amount ELSE -amount END) INTO n,balance FROM ledger.postings
    WHERE workspace_id=j.workspace_id AND entity_id=j.entity_id AND journal_id=j.id;
  IF n<2 OR balance<>0 THEN RAISE EXCEPTION 'UNBALANCED_JOURNAL' USING ERRCODE='23514'; END IF;
  digits=CASE WHEN j.currency='JPY' THEN 0 WHEN j.currency='BHD' THEN 3 ELSE 2 END;
  IF EXISTS(SELECT FROM ledger.postings WHERE workspace_id=j.workspace_id AND entity_id=j.entity_id AND journal_id=j.id AND amount<>round(amount,digits))
    THEN RAISE EXCEPTION 'UNSUPPORTED_PRECISION' USING ERRCODE='23514'; END IF;
  IF j.reversal_of IS NOT NULL AND EXISTS(
    (SELECT account_id,side,amount,currency,line_no FROM ledger.postings WHERE workspace_id=j.workspace_id AND entity_id=j.entity_id AND journal_id=j.id
     EXCEPT SELECT account_id,CASE side WHEN 'debit' THEN 'credit' ELSE 'debit' END,amount,currency,line_no FROM ledger.postings WHERE workspace_id=j.workspace_id AND entity_id=j.entity_id AND journal_id=j.reversal_of)
    UNION ALL
    (SELECT account_id,CASE side WHEN 'debit' THEN 'credit' ELSE 'debit' END,amount,currency,line_no FROM ledger.postings WHERE workspace_id=j.workspace_id AND entity_id=j.entity_id AND journal_id=j.reversal_of
     EXCEPT SELECT account_id,side,amount,currency,line_no FROM ledger.postings WHERE workspace_id=j.workspace_id AND entity_id=j.entity_id AND journal_id=j.id)
  ) THEN RAISE EXCEPTION 'REVERSAL_MISMATCH' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER balanced_journal AFTER INSERT ON ledger.journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger.validate_journal();

CREATE INDEX journals_by_date ON ledger.journals(workspace_id,entity_id,effective_date,id);
CREATE INDEX postings_by_account ON ledger.postings(workspace_id,entity_id,account_id,journal_id);
CREATE INDEX pending_outbox ON audit.outbox(created_at,id) WHERE processed_at IS NULL;

ALTER TABLE identity.principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.principals FORCE ROW LEVEL SECURITY;
CREATE POLICY own_identity ON identity.principals TO gfos_app USING(issuer=current_setting('app.issuer',true) AND subject=current_setting('app.subject',true));
ALTER TABLE workspace.grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.grants FORCE ROW LEVEL SECURITY;
CREATE POLICY own_grants ON workspace.grants TO gfos_app USING(actor_id=nullif(current_setting('app.actor_id',true),'')::uuid);
ALTER TABLE workspace.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.workspaces FORCE ROW LEVEL SECURITY;
CREATE POLICY own_workspace ON workspace.workspaces TO gfos_app USING(EXISTS(SELECT FROM workspace.grants WHERE workspace_id=id AND revoked_at IS NULL));
ALTER TABLE workspace.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace.entities FORCE ROW LEVEL SECURITY;
CREATE POLICY entity_read ON workspace.entities FOR SELECT TO gfos_app USING(workspace.has_access(workspace_id,id));
CREATE POLICY entity_write ON workspace.entities FOR UPDATE TO gfos_app USING(workspace.has_access(workspace_id,id,true)) WITH CHECK(workspace.has_access(workspace_id,id,true));
DO $$ DECLARE name text; BEGIN
  FOREACH name IN ARRAY ARRAY['ledger.accounts','ledger.journals','ledger.postings','ledger.closed_periods','audit.idempotency','audit.events','audit.outbox','reporting.snapshots'] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',name);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',name);
    EXECUTE format('CREATE POLICY scoped_read ON %s FOR SELECT TO gfos_app USING(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND entity_id=nullif(current_setting(''app.entity_id'',true),'''')::uuid AND workspace.has_access(workspace_id,entity_id))',name);
    EXECUTE format('CREATE POLICY scoped_insert ON %s FOR INSERT TO gfos_app WITH CHECK(workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid AND entity_id=nullif(current_setting(''app.entity_id'',true),'''')::uuid AND workspace.has_access(workspace_id,entity_id,true))',name);
  END LOOP;
END $$;
-- Snapshot reads are additionally creator-scoped. Generation is permitted to viewers by a specific policy.
DROP POLICY scoped_read ON reporting.snapshots;
DROP POLICY scoped_insert ON reporting.snapshots;
CREATE POLICY snapshot_read ON reporting.snapshots FOR SELECT TO gfos_app USING(workspace.has_access(workspace_id,entity_id) AND actor_id=nullif(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY snapshot_insert ON reporting.snapshots FOR INSERT TO gfos_app WITH CHECK(workspace.has_access(workspace_id,entity_id) AND actor_id=nullif(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY outbox_worker ON audit.outbox TO gfos_worker USING(true) WITH CHECK(true);
CREATE POLICY worker_journals ON ledger.journals FOR SELECT TO gfos_worker USING(true);
CREATE POLICY worker_postings ON ledger.postings FOR SELECT TO gfos_worker USING(true);
GRANT USAGE ON SCHEMA identity,workspace,ledger,audit,reporting TO gfos_app;
GRANT SELECT ON identity.principals,workspace.workspaces,workspace.entities,workspace.grants TO gfos_app;
GRANT UPDATE(version) ON workspace.entities TO gfos_app;
GRANT SELECT,INSERT ON ledger.accounts,ledger.journals,ledger.postings,audit.idempotency,audit.events,audit.outbox,reporting.snapshots TO gfos_app;
GRANT SELECT ON ledger.closed_periods TO gfos_app;
GRANT USAGE ON SCHEMA ledger,audit TO gfos_worker;
GRANT SELECT,UPDATE(processed_at,attempts,last_error) ON audit.outbox TO gfos_worker;
GRANT SELECT ON ledger.journals,ledger.postings TO gfos_worker;
GRANT SELECT,INSERT ON audit.inbox TO gfos_worker;
GRANT SELECT,INSERT,UPDATE ON audit.checkpoints TO gfos_worker;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ledger FROM PUBLIC;

