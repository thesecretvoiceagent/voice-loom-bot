/**
 * Minimal intent classification smoke — run: npm run intent-classify-smoke
 *
 * Runs via **tsx** (see package.json): native `node --experimental-strip-types` cannot resolve our
 * “.js specifiers → emit” pattern across the TS module graph without a loader.
 */

import assert from "node:assert/strict";

import type { CompiledBrainConfig } from "./iiziBrainConfigTypes.js";
import { classifyIntentFromSpeechHybrid, getDefaultCompiledBrain } from "./iiziBrainSpeechClassify.js";
import type { ResolvedBrainIntent } from "./iiziBrainMerge.js";
import { mergePathwayIntents } from "./iiziBrainMerge.js";

function expectHybrid(
  text: string,
  compiled: CompiledBrainConfig,
  expected: ResolvedBrainIntent,
  hint: string,
): void {
  const o = classifyIntentFromSpeechHybrid(text, compiled);
  const d = classifyIntentFromSpeechHybrid(text, compiled);
  const oIntent = (o.intent ?? "unknown") as Parameters<typeof mergePathwayIntents>[0];
  const dIntent = (d.intent ?? "unknown") as Parameters<typeof mergePathwayIntents>[1];
  const { resolved } = mergePathwayIntents(oIntent, dIntent);
  assert.equal(resolved, expected, `${hint}: hybrid merge got ${resolved} (oa=${oIntent} dg=${dIntent})`);
  assert.ok(
    o.meta.matchedRuleIds != null && o.meta.matchedRuleIds.length > 0,
    `${hint}: expected matching rule ids in meta`,
  );
  assert.ok(
    ["config", "fallback_builtin"].includes(o.meta.classifySource),
    `${hint}: unexpected classifySource ${o.meta.classifySource}`,
  );
}

/** No intent match — runtime asks / clarifies for unknown workflows. */
function expectNoIntentMatch(text: string, compiled: CompiledBrainConfig, hint: string): void {
  const r = classifyIntentFromSpeechHybrid(text, compiled);
  assert.equal(r.intent, null, `${hint}: expected null intent, got ${r.intent}`);
  assert.equal(r.meta.classifySource, "config", `${hint}: expected config path for compiled default brain`);
}

function run(): void {
  const compiled = getDefaultCompiledBrain();

  expectHybrid(
    "Mul oli liiklusavarii ja puksiir abi vajan teele",
    compiled,
    "roadside",
    "crash + towing wording",
  );
  expectHybrid("Auto ei käivitu ja vajan autoabi teel", compiled, "roadside", "wont-start + autoabi phrase");
  expectHybrid("Mul on rehv katki ja sõidan teel", compiled, "roadside", "flat tire");

  expectHybrid("Ma ei saa autosse sisse võtmed autos", compiled, "roadside", "lockout / keys inside wording");

  expectHybrid("Tule tõesti kiire puksiir", compiled, "roadside", "towing keyword puksiir");

  expectHybrid(
    "Täna hommikul oli avarii suur männ teel",
    compiled,
    "roadside",
    "avarii (default shipped config: accident cues are roadside)",
  );

  expectHybrid("Mul on teiega kindlustuse pakkumine arutada", compiled, "non_roadside", "insurance offer non-roadside");

  expectHybrid("Ma helistan selle pärast arve küsimusega", compiled, "non_roadside", "arve küsimus non-roadside");

  expectHybrid("Pole abi vaja, see oli kontori küsimus", compiled, "non_roadside", "explicit non roadside");

  expectHybrid("Palun kiirabi, mul on tõsine valu rinnus", compiled, "emergency_handoff", "medical escalation");

  expectHybrid("Helistage homme töö ajal tagasi palun", compiled, "non_roadside", "callback wording");

  expectNoIntentMatch(
    "Tere tere hommikust kuidas teil läheb mina helistan lihtsalt",
    compiled,
    "random unclear greeting — unknown / clarify at runtime",
  );

  const empty = classifyIntentFromSpeechHybrid("   ", compiled);
  assert.equal(empty.intent, null);

  console.log("OK intent-classify-smoke:", "roadside/non_roadside/emergency/empty/unclear scenarios passed.");
}

run();
