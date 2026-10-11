import { readFile, writeFile } from 'node:fs/promises';
import { locales } from '../packages/localization/src/index';
interface Requirement {requirement_id:string;status:string;review_state:string;extraction_class?:string;child_obligations:unknown[]}
interface Report {report_id:string;status:string;available:boolean;metric_dependencies:string[];implementation_paths:string[];test_ids:string[];golden_fixture:string|null}
interface Scenario {scenario_id:string;status:string}
const requirements:Requirement[]=JSON.parse(await readFile('docs/requirements/registry.json','utf8'));
const reports:Report[]=JSON.parse(await readFile('docs/reporting/catalog.json','utf8'));
const scenarios:Scenario[]=JSON.parse(await readFile('docs/scenarios/registry.json','utf8'));
const failures:{id:string;reason:string}[]=[];
for(const r of requirements){
 if(r.status!=='accepted'&&r.status!=='not_applicable_with_approved_reason')failures.push({id:r.requirement_id,reason:'Full source obligation is not accepted.'});
 if(r.extraction_class==='source_block_requires_semantic_review'&&!r.child_obligations.length)failures.push({id:r.requirement_id,reason:'Derived block still requires semantic decomposition.'});
}
for(const r of reports)if(r.status!=='accepted'||!r.metric_dependencies.length||!r.implementation_paths.length||!r.test_ids.length||!r.golden_fixture)failures.push({id:r.report_id,reason:'Full report definition/implementation/export/golden/acceptance contract is incomplete.'});
for(const r of scenarios)if(r.status!=='accepted')failures.push({id:r.scenario_id,reason:'Consequential scenario success/failure/retry contract is not accepted.'});
for(const l of locales)if(!l.available)failures.push({id:'locale:'+l.code,reason:'Required locale is unavailable.'});
// This gate is deliberately stronger than the kernel verification command.
// A successful build is never promoted to completion of the entire GFOS scope.
const result={checkedAt:new Date().toISOString(),release:'full-integrated-GFOS',passed:failures.length===0,failures};
await writeFile('docs/verification/full-release-gate.json',JSON.stringify(result,null,2)+'\n');
console.log(result.passed?'PASS: full GFOS release gate.':'FAIL: '+failures.length+' full-release coverage checks remain; see docs/verification/full-release-gate.json.');
process.exitCode=result.passed?0:1;
