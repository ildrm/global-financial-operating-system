"""Lossless, deterministic extraction. Coverage is scope, never completion."""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAMES = {
    "product": "GFOS_Super_Mega_Product_Specification.md",
    "architecture": "GFOS_Super_Mega_Implementation_Architecture.md",
    "execution": "GFOS_Roles_and_Super_Mega_Implementation_Prompt_GPT_6_1_Sol_XHigh.md",
}
CHECK = "--check" in sys.argv
REFRESH = "--refresh-sources" in sys.argv

def save(path, value):
    target = ROOT / path
    if CHECK:
        assert target.exists(), f"Missing {path}"
        return json.loads(target.read_text())
    if REFRESH and target.exists():
        current = json.loads(target.read_text())
        if path == 'docs/requirements/registry.json':
            existing = {r['requirement_id'] for r in current}
            current += [r for r in value if r['requirement_id'] not in existing]
            target.write_text(json.dumps(current, ensure_ascii=False, indent=2) + '\n')
            return current
        if path != 'docs/source-manifest.json':
            return current
        assert current['sources'] == value['sources'], 'Changed source requires explicit source-version reconciliation.'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    return value

def record(id, doc, section, text, line, digest):
    return dict(requirement_id=id, source_document=doc, source_section=section,
        source_hash=digest, source_line=line, text=text, child_obligations=[],
        priority="P0" if id.startswith("INV-") else "unassigned",
        owner_roles=["ROLE-02"], dependent_requirements=[], design_artifacts=[],
        implementation_paths=[], api_operations=[], screens=[], scenario_ids=[],
        metric_ids=[], test_ids=[], evidence_paths=[], status="specified",
        blocked_reason=None, review_state="pending")

manifest = []
records = []
reports_by_doc = {}
scenarios = []
roles = []
section_counts = {}
for doc, name in NAMES.items():
    data = (ROOT / "docs/sources" / name).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    lines = data.decode().splitlines()
    manifest.append(dict(document=doc, filename=name, path="docs/sources/" + name,
        sha256=digest, version="1.0.0", line_count=len(lines)))
    section = "frontmatter"
    section_counts[doc] = 0
    reports = {}
    derived_counter = {}
    in_code = False
    block = []
    block_start = 0

    def flush():
        nonlocal_dummy = None
        if not block:
            return
        text = "\n".join(block).strip()
        # Preserve every non-explicit prose/table/list/code block, including
        # informative context: no semantic obligation can be lost by filtering.
        if text:
            n = derived_counter.get(section, 0) + 1
            derived_counter[section] = n
            key = f"DER-{doc[0].upper()}-{section}-{n:03}"
            r = record(key, doc, section, text, block_start, digest)
            r["extraction_class"] = "source_block_requires_semantic_review"
            records.append(r)
        block.clear()

    for number, line in enumerate(lines, 1):
        heading = re.match(r"^#{1,6}\s+([\d.]+|[A-Z]\.[\w.]+)\.?\s+", line)
        if line.startswith("#"):
            flush()
            if heading:
                section = heading.group(1).rstrip(".")
                if re.match(r"^#{1,2} \d+\.\s", line):
                    section_counts[doc] += 1
            elif line.startswith("# Appendix"):
                section = line.split()[2].rstrip(".")
            continue
        explicit = re.match(r"^- \*\*(FR-[A-Z]+-\d{3}):\*\*\s*(.*)", line)
        if explicit:
            flush()
            if doc == "product":
                records.append(record(explicit.group(1), doc, section, explicit.group(2), number, digest))
            continue
        invariant = re.match(r"\| (INV-\d{3}) \| (.*?) \| (.*?) \|", line)
        if invariant and doc == "architecture":
            flush()
            r = record(invariant.group(1), doc, section, invariant.group(2), number, digest)
            r["source_enforcement"] = invariant.group(3)
            records.append(r)
            continue
        report = re.match(r"\| `?(R-[A-L]\d{2})`? \| (.*?) \| (.*?) \|", line)
        if report:
            id, title, measures = report.groups()
            assert id not in reports, f"Repeated report {id} in {doc}"
            reports[id] = dict(report_id=id, title=title, required_measures=measures,
                source_document=doc, source_section=section, source_line=number, source_hash=digest)
        scenario = re.match(r"\| (SCN-\d{3}) \| (.*?) \| (.*?) \|", line)
        if scenario:
            id, actor, outcome = scenario.groups()
            scenarios.append(dict(scenario_id=id, journey=actor, required_outcome=outcome,
                source_line=number, source_requirements=[], preconditions=[], steps=[],
                variants=["success", "denied_permission", "duplicate_submit", "timeout_after_commit"],
                implementation_paths=[], test_ids=[], evidence_paths=[], status="specified"))
        role = re.match(r"\| (ROLE-\d{2}) \| (.*?) \| (.*?) \| (.*?) \|", line)
        if role:
            roles.append(dict(role_id=role.group(1), specialty=role.group(2),
                responsibilities=role.group(3), required_outputs=role.group(4)))
        if not line.strip() and not in_code:
            flush()
        else:
            if not block:
                block_start = number
            block.append(line)
            if line.startswith("```"):
                in_code = not in_code
    flush()
    reports_by_doc[doc] = reports

original = [r for r in records if r["requirement_id"].startswith("FR-")]
invariants = [r for r in records if r["requirement_id"].startswith("INV-")]
assert len(original) == len({r["requirement_id"] for r in original}) == 273
assert len(invariants) == 18
assert len(roles) == 42
assert len(scenarios) == 64
assert section_counts["product"] == 48 and section_counts["architecture"] == 44
assert section_counts["execution"] == 15
for doc in NAMES:
    assert len(reports_by_doc[doc]) == 122, (doc, len(reports_by_doc[doc]))
    assert set(reports_by_doc[doc]) == set(reports_by_doc["product"])

catalog = []
for id, r in reports_by_doc["product"].items():
    references = [reports_by_doc[d][id] for d in NAMES]
    entry = dict(**r, definition_version="1.0.0", source_references=references,
        source_requirements=["FR-RPT-001", "FR-RPT-004", "FR-RPT-005", "FR-RPT-007"],
        metric_dependencies=[], implementation_paths=[], golden_fixture=None,
        test_ids=[], evidence_paths=[], status="specified", available=False)
    catalog.append(entry)
    records.append(record(id, "product", r["source_section"], r["title"] + ": " + r["required_measures"], r["source_line"], r["source_hash"]))

actual = save("docs/requirements/registry.json", records)
assert len(actual) == len(records), "Missing or duplicated registry records"
assert {r["requirement_id"] for r in actual} == {r["requirement_id"] for r in records}
for expected in records:
    current = next(r for r in actual if r["requirement_id"] == expected["requirement_id"])
    for key in ["text", "source_document", "source_section", "source_hash", "source_line"]:
        assert current[key] == expected[key], f"Source drift {expected['requirement_id']}:{key}"
    if current["status"] in ["implemented", "tested", "accepted"]:
        assert current["implementation_paths"], f"No code evidence {current['requirement_id']}"
        if current["status"] in ["tested", "accepted"]:
            assert current["test_ids"] and current["evidence_paths"]
    for child in current["child_obligations"]:
        if child["status"] in ["tested", "accepted"]:
            assert child["implementation_paths"] and child["test_ids"] and child["evidence_paths"], child["obligation_id"]
        for path in child.get("implementation_paths", []) + child.get("evidence_paths", []):
            assert (ROOT / path).exists(), f"Missing evidence {path}"
actual_catalog = save("docs/reporting/catalog.json", catalog)
assert len(actual_catalog) == 122
assert {r["report_id"] for r in actual_catalog} == {r["report_id"] for r in catalog}
for expected in catalog:
    current = next(r for r in actual_catalog if r["report_id"] == expected["report_id"])
    for key in ["title", "required_measures", "source_references"]:
        assert current[key] == expected[key], f"Report source drift: {expected['report_id']}"
    if current["status"] in ["implemented", "tested", "accepted"]:
        assert current["metric_dependencies"] and current["implementation_paths"] and current["golden_fixture"]
        if current["status"] in ["tested", "accepted"]:
            assert current["test_ids"] and current["evidence_paths"]
actual_scenarios = save("docs/scenarios/registry.json", scenarios)
assert len(actual_scenarios) == 64 and {r["scenario_id"] for r in actual_scenarios} == {r["scenario_id"] for r in scenarios}
actual_roles = save("docs/roles.json", roles)
assert actual_roles == roles, "Role source drift"
if CHECK:
    tests = json.loads((ROOT / 'docs/verification/test-map.json').read_text())
    metrics = json.loads((ROOT / 'docs/reporting/metrics.json').read_text())['metrics']
    metric_ids = {m['metric_id'] for m in metrics}
    operations = {o.get('operationId') for path in json.loads((ROOT / 'docs/domain/openapi.json').read_text())['paths'].values() for o in path.values() if isinstance(o, dict)}
    for id, test in tests.items():
        assert test['title'] in (ROOT / test['path']).read_text(), f'Test reference drift: {id}'
    for r in actual:
        assert set(r['test_ids']) <= tests.keys(), f'Unknown test: {r["requirement_id"]}'
        assert set(r['metric_ids']) <= metric_ids, f'Unknown metric: {r["requirement_id"]}'
        assert set(r['api_operations']) <= operations, f'Unknown API: {r["requirement_id"]}'
        for path in r['implementation_paths'] + r['design_artifacts'] + r['evidence_paths']:
            assert (ROOT / path).exists(), f'Missing artifact: {path}'
    for r in actual_catalog:
        assert set(r['metric_dependencies']) <= metric_ids, r['report_id']
        assert (ROOT / r['contract_path']).exists(), r['report_id']
    for m in metrics:
        for key in ['unit','grain','formula','aggregation','missingness','permission','negative_policy','implementation']:
            assert m.get(key), f'Missing metric policy: {m["metric_id"]}/{key}'
counts = dict(explicit_requirements=len(original), reports=len(catalog), invariants=len(invariants),
    derived_blocks=len([r for r in records if r["requirement_id"].startswith("DER-")]),
    roles=len(roles), scenario_families=len(scenarios), sections=section_counts)
actual_manifest = save("docs/source-manifest.json", dict(sources=manifest, counts=counts,
    note="Derived source blocks preserve full scope; semantic decomposition and ownership review remain pending."))
assert actual_manifest["sources"] == manifest and actual_manifest["counts"] == counts, "Manifest source drift"
print(json.dumps(counts))
