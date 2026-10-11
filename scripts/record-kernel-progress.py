"""Record bounded evidence without promoting compound source requirements."""
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def read(path): return json.loads((ROOT / path).read_text())
def write(path, value): (ROOT / path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

test_map = read('docs/verification/test-map.json') if (ROOT / 'docs/verification/test-map.json').exists() else {}
for file, prefix, evidence in [
    ('tests/unit/financial.test.ts', 'UNIT', 'docs/verification/unit-results.json'),
    ('tests/integration/kernel.test.ts', 'DB', 'docs/verification/database-results.json'),
    ('tests/e2e/finance.spec.ts', 'E2E', 'docs/verification/e2e-results.json')]:
    for title in re.findall(r"(?:it|test)\('([^']+)'", (ROOT / file).read_text()):
        existing = next((id for id, v in test_map.items() if v['path']==file and v['title']==title), None)
        next_number = max([int(id.split('-')[1]) for id in test_map if id.startswith(prefix+'-')] or [0]) + 1
        test_map[existing or f'{prefix}-{next_number:02}'] = dict(path=file, title=title, evidence=evidence)
write('docs/verification/test-map.json', test_map)

ledger = ['modules/ledger/src/domain/posting.ts', 'modules/ledger/src/infrastructure/postgres-ledger.ts', 'database/migrations/001_kernel.sql', 'database/migrations/002_posting_templates.sql']
ui = ['apps/web/components/dashboard.tsx', 'apps/web/app/api/[...path]/route.ts']
scope = {
    'FR-ID-005': ('English/Persian routes and canonical digit parsing; other languages/exports/notifications remain pending.', ['UNIT-05', 'E2E-03'], ['packages/localization/src/index.ts'] + ui),
    'FR-WS-001': ('Two synthetic personal workspaces are independently provisioned; user creation and other workspace types pending.', ['DB-02'], ['scripts/seed.ts', 'database/migrations/001_kernel.sql']),
    'FR-FX-001': ('Eight-currency exact minor-unit subset and lossless display; complete historic ISO registry pending.', ['UNIT-01', 'UNIT-05', 'DB-07'], ['packages/financial-math/src/index.ts', 'packages/localization/src/index.ts']),
    'FR-LED-001': ('Income/expense/equity and four user account types; full managed chart templates pending.', ['E2E-02', 'DB-04'], ledger + ui),
    'FR-LED-002': ('Single-currency posted facts are immutable; transaction/functional FX treatment pending.', ['DB-06', 'DB-07'], ledger),
    'FR-LED-003': ('Balanced exact two-leg templates and exact linked reversals; general multi-leg business workflows pending.', ['UNIT-04', 'DB-07'], ledger),
    'FR-LED-004': ('Private prepared commands, posted journals and linked reversals; pending/disputed/reconciliation states pending.', ['DB-06', 'DB-11', 'E2E-04', 'E2E-06'], ledger + ui + ['database/migrations/003_reviewed_drafts.sql', 'database/migrations/005_operation_recovery.sql']),
    'FR-LED-005': ('Own transfers/card settlement implemented; purchase splits/refunds/overpayment/other settlements pending.', ['DB-04', 'DB-05'], ledger + ui),
    'FR-LED-006': ('As-of account/cash balances and explicit opening equity, including larger calculated totals; full historical trial-balance UI pending.', ['DB-06', 'DB-13', 'E2E-01', 'E2E-07'], ledger + ui),
    'FR-LED-009': ('Current commands replay scoped exact receipts; source references remain unique; import duplicate resolution pending.', ['DB-03', 'DB-08', 'DB-11', 'E2E-04', 'E2E-06'], ledger + ui),
    'FR-LED-011': ('Database period boundary rejects earlier postings; close/reopen approval and full ledger export pending.', ['DB-08'], ledger),
    'FR-LED-012': ('Net-receipt basis disclosed; accrual and receivables/payables pending.', ['DB-04'], ledger + ui),
    'FR-RPT-001': ('Five foundation metric contracts documented; full typed runtime registry pending.', ['DB-06'], ['docs/reporting/metrics.json'] + ledger),
    'FR-RPT-004': ('Two manual single-currency immutable snapshots retain source IDs/version/cutoff/checksum; FX/rules/vintages pending.', ['DB-06', 'E2E-01'], ledger + ui),
    'FR-RPT-005': ('Journal details and snapshot source manifest; full authorized source drill-through beyond bounded activity pending.', ['E2E-02', 'E2E-01'], ledger + ui),
    'FR-RPT-007': ('Same-snapshot formula-safe CSV/JSON and current access; XLSX/PDF/redaction pending.', ['DB-06', 'E2E-01'], ui + ledger),
    'FR-RPT-009': ('Entered/unreconciled/net-receipt/incomplete-world provenance; other data/provider state combinations pending.', ['E2E-01'], ledger + ui),
    'FR-RPT-012': ('Foundation methodologies and financial help; full glossary/formula coverage pending.', ['E2E-01'], ['docs/financial-policy.md', 'docs/reporting/README.md'] + ui),
    'FR-SEC-002': ('Current book/object/creator authorization with RLS and revocation; future sensitive-field domains pending.', ['DB-01', 'DB-02', 'DB-06', 'DB-11', 'DB-12'], ledger + ['apps/api/src/main.ts', 'database/migrations/004_consumer_scope.sql']),
    'FR-SEC-006': ('Immutable scoped audit sequence/hash chain; protected checkpoint and full audit completeness pending.', ['DB-10'], ledger),
    'FR-SEC-008': ('Server bearer guard, BFF origin/route controls, parameterized SQL, lockfile audit; complete security lifecycle pending.', ['E2E-05', 'DB-02'], ['apps/api/src/main.ts', 'apps/web/lib/session.ts'] + ui),
    'INV-001': ('Every journal accepted by the enabled kernel balances exactly in its book currency.', ['UNIT-04', 'DB-07'], ledger),
    'INV-002': ('Enabled posted facts are immutable and corrected by linked exact reversals, including after logical restore.', ['DB-06', 'DB-07'], ledger + ['scripts/restore-drill.ts']),
    'INV-003': ('Enabled source references and scoped operation keys cannot produce repeated effects.', ['DB-03', 'DB-08', 'DB-11', 'E2E-04', 'E2E-06'], ledger + ui),
    'INV-004': ('Enabled monetary arithmetic/storage/rendering preserves exact decimals and registered scales, with distinct input/result ranges.', ['UNIT-01', 'UNIT-03', 'UNIT-05', 'DB-07', 'DB-13', 'E2E-07'], ['packages/financial-math/src/index.ts', 'packages/localization/src/index.ts'] + ledger),
    'INV-005': ('Enabled fiat postings enforce currency/date/account context and minor units; assets/FX pending.', ['UNIT-01', 'UNIT-06', 'DB-07'], ledger),
    'INV-006': ('Own bank/cash transfers conserve total cash and do not affect income/spending.', ['DB-05'], ledger),
    'INV-007': ('Loan receipt is debt, and card settlement is liability reduction; full principal/interest schedules pending.', ['DB-04'], ledger),
    'INV-009': ('Enabled reads/writes/snapshot retrieval independently enforce actor/book scope server-side.', ['DB-01', 'DB-02', 'DB-06', 'DB-11'], ledger + ['apps/api/src/main.ts']),
    'INV-011': ('Foundation historical snapshots preserve source identity and exact versioned content; other data types pending.', ['DB-06'], ledger),
    'INV-015': ('Foundation cash bridge/balances reconcile to manual source scope and disclose incompleteness.', ['DB-06', 'E2E-01'], ledger + ui),
    'INV-016': ('Current outbox exposes only delivery IDs; worker lacks financial-table privileges. Broader logs/events still require audit.', ['DB-12'], ['apps/worker/src/process.ts', 'database/migrations/004_consumer_scope.sql'])
}
registry = read('docs/requirements/registry.json')
for r in registry:
    if r['requirement_id'] not in scope: continue
    if r['status'] in ['implemented','tested','accepted']: continue
    text, tests, paths = scope[r['requirement_id']]
    evidence = sorted({test_map[t]['evidence'] for t in tests})
    if r['requirement_id'] in ['INV-002', 'FR-LED-006']: evidence += ['docs/verification/restore-results.json']
    r.update(priority='P0', owner_roles=['ROLE-04','ROLE-05','ROLE-06','ROLE-27','ROLE-28','ROLE-30','ROLE-34','ROLE-36'], status='designed', review_state='agent_self_review_only', design_artifacts=['docs/financial-policy.md','docs/domain/kernel.md','docs/security/threat-model.md'], implementation_paths=paths, test_ids=tests, evidence_paths=evidence, child_obligations=[dict(obligation_id=r['requirement_id']+'-KERNEL-01', text=text, perimeter='enabled development kernel only; parent retains full source scope', status='tested', implementation_paths=paths, test_ids=tests, evidence_paths=evidence, acceptance='pending full-contract and required independent review')])
    r['api_operations'] = ['previewTransaction','postReviewedTransaction','getOverview','recoverOperation']
    r['screens'] = ['overview','record-review','activity','recovery']
    if r['requirement_id'].startswith('FR-RPT-'):
        r['api_operations']=['generateReport','getReportSnapshot'];r['screens']=['reports'];r['scenario_ids']=['SCN-059']
    elif r['requirement_id'] in ['FR-LED-001','FR-LED-006','FR-WS-001']:
        r['api_operations']=['listEntities','prepareOperation','createAccount','getOverview'];r['screens']=['overview','accounts'];r['scenario_ids']=['SCN-001','SCN-003']
    elif r['requirement_id'] in ['FR-LED-004','FR-LED-011','INV-002']:
        r['api_operations']=['prepareOperation','reverseJournal','recoverOperation'];r['scenario_ids']=['SCN-062']
    elif r['requirement_id']=='FR-ID-005':
        r['owner_roles']=['ROLE-25','ROLE-26','ROLE-24'];r['api_operations']=[];r['screens']=['settings','record-review'];r['scenario_ids']=['SCN-063']
    elif r['requirement_id'].startswith('FR-SEC-') or r['requirement_id']=='INV-009':
        r['scenario_ids']=['SCN-003','SCN-059','SCN-064']
    else:r['scenario_ids']=['SCN-006','SCN-009','SCN-042']

catalog = read('docs/reporting/catalog.json')
for r in catalog:
    r['contract_path'] = 'docs/reporting/README.md'
    r['full_contract_source'] = 'docs/sources/GFOS_Roles_and_Super_Mega_Implementation_Prompt_GPT_6_1_Sol_XHigh.md#9'
    if r['report_id'] not in ['R-D01','R-D02'] or r['status']=='accepted': continue
    r.update(status='designed', available=False, metric_dependencies=['M-CASH-ASOF','M-CASH-NET-PERIOD'] if r['report_id']=='R-D01' else ['M-CASH-ASOF','M-ACCOUNT-ASOF'], implementation_paths=ledger + ui, golden_fixture='docs/verification/golden-kernel.json', test_ids=['DB-06','E2E-01'], evidence_paths=['docs/verification/database-results.json','docs/verification/e2e-results.json'], technical_slice=dict(version='0.1.0', status='tested', available=True, export_formats=['csv','json'], full_contract_complete=False))
    rr=next(x for x in registry if x['requirement_id']==r['report_id'])
    rr.update(status='designed',owner_roles=['ROLE-05','ROLE-19','ROLE-20','ROLE-34'],implementation_paths=ledger+ui,test_ids=r['test_ids'],evidence_paths=r['evidence_paths'],metric_ids=r['metric_dependencies'],child_obligations=[dict(obligation_id=r['report_id']+'-FOUNDATION-01',text='Bounded manual single-currency foundation snapshot; full report lifecycle and exports remain pending.',status='tested',implementation_paths=ledger+ui,test_ids=r['test_ids'],evidence_paths=r['evidence_paths'])])
    rr.update(api_operations=['generateReport','getReportSnapshot'],screens=['reports'],scenario_ids=['SCN-059'])

scenarios=read('docs/scenarios/registry.json')
for s in scenarios:
    mapping={'SCN-001':['E2E-02','E2E-06'],'SCN-003':['DB-02'],'SCN-006':['DB-03','E2E-02','E2E-04'],'SCN-009':['DB-05'],'SCN-042':['DB-04'],'SCN-059':['DB-06','E2E-01'],'SCN-062':['DB-06','DB-08','E2E-06'],'SCN-063':['UNIT-05','E2E-03']}
    if s['scenario_id'] not in mapping or s['status']=='accepted': continue
    ids=mapping[s['scenario_id']]
    s.update(status='designed',test_ids=ids,implementation_paths=ledger+ui,evidence_paths=sorted({test_map[t]['evidence'] for t in ids}),preconditions=['Synthetic provisioned book; current owner/viewer scope as specified by test.'],steps=['Execute the linked named tests; consult user help for actual browser steps.'],scope_note='Partial scenario-family coverage. Unexercised variants and all remaining source outcomes remain pending.')

write('docs/requirements/registry.json',registry)
write('docs/reporting/catalog.json',catalog)
write('docs/scenarios/registry.json',scenarios)
operations = {}
for r in registry:
    for operation in r['api_operations']:
        operations.setdefault(operation,[]).append(r['requirement_id'])
write('docs/domain/operation-traceability.json',operations)
write('docs/implementation-status.json',dict(recorded_at=datetime.now(timezone.utc).isoformat(),release_classification='verified_development_kernel_slice',stages_complete=[],source_counts=read('docs/source-manifest.json')['counts'],requirement_lifecycle_counts=dict(Counter(r['status'] for r in registry)),tested_bounded_child_obligations=sum(len(r['child_obligations']) for r in registry if r['child_obligations']),full_source_requirements_accepted=0,full_report_definitions_accepted=0,foundation_reports_enabled=['R-D01','R-D02'],scenario_families_partially_exercised=8,locales_enabled=['en','fa'],other_required_locales_pending=True,coverage_path='docs/providers-and-coverage/status.json',semantic_decomposition_pending_blocks=read('docs/source-manifest.json')['counts']['derived_blocks'],independent_professional_review='not performed',full_release_gate='must fail until original/derived/report/scenario/locale contracts are accepted',next_task='purchase/credit/refund domain slice after semantic decomposition and contract review'))
print('Recorded bounded child evidence; no compound source requirement or full report was promoted to accepted.')
