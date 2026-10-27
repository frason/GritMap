import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseReceiverCapabilities, gateTransferExtensions } from "./receiverCapabilities.ts";
const caps=JSON.parse(readFileSync(new URL("../../fixtures/contracts/receiver-capabilities-v1.json",import.meta.url),"utf8"));
const plan=JSON.parse(readFileSync(new URL("../../fixtures/contracts/plan-ceilings-transfer-v1.json",import.meta.url),"utf8"));
const record=JSON.parse(readFileSync(new URL("../../fixtures/contracts/segment-record-v1.json",import.meta.url),"utf8"));
test("shared extensions only pass an explicit valid receiver advertisement",()=>{
 const input={...plan,segmentRecord:record};
 assert.deepEqual(gateTransferExtensions(input,caps),input);
 for(const legacy of [undefined,null,{}, {...caps,v:2},{...caps,features:[]},{...caps,unknown:1}]) {
  const output=gateTransferExtensions(input,legacy);
  assert.equal(output.segmentRecord,undefined);
  const baseline=output.baselinePacingPlan as Record<string,unknown>;
  assert.equal(baseline.replan,undefined);
  assert.ok((baseline.zones as Record<string,unknown>[]).every(z=>z.ceilingPowerWatts===undefined));
 }
 assert.ok(plan.baselinePacingPlan.replan); // original not mutated
});
test("capability limits and versions fail closed",()=>{
 assert.deepEqual(parseReceiverCapabilities(caps),caps);
 for(const bad of [{...caps,maxManifestBytes:1025},{...caps,maxRecordBytes:8193},{...caps,versionCode:"74"},{...caps,features:["private data"]}]) assert.equal(parseReceiverCapabilities(bad),undefined);
});
