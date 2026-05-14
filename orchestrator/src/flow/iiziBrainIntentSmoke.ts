/**
 * Minimal intent classification smoke — run: npm run intent-classify-smoke
 *
 * Runs via **tsx** (see package.json): native `node --experimental-strip-types` cannot resolve our
 * “.js specifiers → emit” pattern across the TS module graph without a loader.
 */

import assert from "node:assert/strict";

import type { CompiledBrainConfig } from "./iiziBrainConfigTypes.js";
import { classifyIntentFromSpeechHybrid, getDefaultCompiledBrain } from "./iiziBrainSpeechClassify.js";
import type { PathwayIntentClassification } from "./iiziBrainConfigTypes.js";
import type { ResolvedBrainIntent } from "./iiziBrainMerge.js";
import { mergePathwayIntents } from "./iiziBrainMerge.js";
import {
  createInitialIiziBrainState,
  ingestIiziBrainNonemptyUserSpeech,
  ingestIiziBrainTrustedShadowFinal,
  ingestIiziBrainFlow,
  setIiziBrainAwaitingYesNoRoadsideClarification,
  gateIiziCombinedSms,
  deriveExpectedNextActionBrain,
  type IiziBrainRuntimeState,
} from "./iiziBrain.js";
import { resolveFinalIntent, matchYesNoRoadsideClarification } from "./iiziBrainResolver.js";
import {
  setSemanticClassifierForTests,
  type SemanticClassifierInput,
  type SemanticClassifierResult,
} from "./iiziSemanticClassifier.js";
import {
  iiziFuelBatteryTyreOnlyRoadsideIssue,
  iiziMatchedRoadsideOccupantKeyword,
  iiziTowTransportFlowHint,
} from "./iiziInboundOccupantHeuristics.js";

function expectHybrid(
  text: string,
  compiled: CompiledBrainConfig,
  expected: ResolvedBrainIntent,
  hint: string,
): void {
  const o = classifyIntentFromSpeechHybrid(text, compiled);
  const d = classifyIntentFromSpeechHybrid(text, compiled);
  const oIntent = (o.intent ?? "unknown") as PathwayIntentClassification;
  const dIntent = (d.intent ?? "unknown") as PathwayIntentClassification;
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

function expectMerge(
  oa: PathwayIntentClassification,
  dg: PathwayIntentClassification,
  expected: ResolvedBrainIntent,
  hint: string,
): void {
  const { resolved, reason } = mergePathwayIntents(oa, dg);
  assert.equal(resolved, expected, `${hint}: merge got ${resolved} reason=${reason} (oa=${oa} dg=${dg})`);
}

/** No intent match — runtime asks / clarifies for unknown workflows. */
function expectNoIntentMatch(text: string, compiled: CompiledBrainConfig, hint: string): void {
  const r = classifyIntentFromSpeechHybrid(text, compiled);
  assert.equal(r.intent, null, `${hint}: expected null intent, got ${r.intent}`);
  assert.equal(r.meta.classifySource, "config", `${hint}: expected config path for compiled default brain`);
}

/**
 * Deterministic semantic-classifier stub used ONLY by smoke tests.
 *
 * Simulates what the real LLM would return for known phonetic ASR errors and a few
 * benign edge cases (oil out, denial, gibberish). This is NOT a runtime classifier —
 * the production path calls OpenAI Chat Completions via {@link classifyIntentSemantic}.
 *
 * The stub deliberately recognizes misheard fuel variants ("tiisel"/"pentiin") so
 * we can prove the resolver lifts regex-unknown to roadside without expanding regex.
 */
function installSmokeSemanticStub(): void {
  setSemanticClassifierForTests(async (input: SemanticClassifierInput): Promise<SemanticClassifierResult> => {
    const oa = (input.openai_transcript || "").toLowerCase();
    const dg = (input.deepgram_transcript || "").toLowerCase();
    const both = `${oa} || ${dg}`;

    const chooseSrcByMatch = (
      rx: RegExp,
    ): SemanticClassifierResult["transcript_source_used"] => {
      const oaHas = rx.test(oa);
      const dgHas = rx.test(dg);
      if (oaHas && dgHas) return "both";
      if (dgHas) return "deepgram";
      if (oaHas) return "openai_realtime";
      return "none";
    };

    if (!oa.trim() && !dg.trim()) {
      return {
        intent: "unknown",
        confidence: 0,
        reason: "stub_empty_inputs",
        normalized_issue: "",
        transcript_source_used: "none",
      };
    }

    const emergencyRx = /(112|kiirabi|politsei|tulekahju|p\u00f5leng)/;
    if (emergencyRx.test(both)) {
      return {
        intent: "emergency_handoff",
        confidence: 0.97,
        reason: "stub_emergency_keyword",
        normalized_issue: "emergency",
        transcript_source_used: chooseSrcByMatch(emergencyRx),
      };
    }

    const denialRx = /(ei\s+vaja\s+(?:auto)?abi|pole\s+abi\s+vaja|pole\s+autoabi\s+vaja)/;
    if (denialRx.test(both)) {
      return {
        intent: "non_roadside",
        confidence: 0.9,
        reason: "stub_denial",
        normalized_issue: "denial",
        transcript_source_used: chooseSrcByMatch(denialRx),
      };
    }

    const officeRx = /(kindlustus|kontor(?:i)?\s+lahti|arve|sales|infot)/;
    if (officeRx.test(both)) {
      return {
        intent: "non_roadside",
        confidence: 0.85,
        reason: "stub_office_or_insurance",
        normalized_issue: "office_or_insurance",
        transcript_source_used: chooseSrcByMatch(officeRx),
      };
    }

    const fuelMishears = /(tiisel|pentiin|diisel|diesel|bensiin|bentsiin|k\u00fctus|fuel|petrol|paak\s+t\u00fchi)/;
    const oilLike = /(\u00f5li\s+(?:sai|on)\s+otsa|oil\s+leak)/;
    const vehicleStranded = /(auto\s+ei\s+k\u00e4ivitu|ei\s+l\u00e4he\s+k\u00e4ima|j\u00e4in\s+teele|puksiir|kraav|rehv\s+katki|t\u00fchi\s+rehv|aku\s+t\u00fchi|v\u00f5tmed\s+autos|uks\s+lukus)/;
    const anyVehicle = new RegExp(
      `(?:${fuelMishears.source})|(?:${oilLike.source})|(?:${vehicleStranded.source})`,
    );

    if (anyVehicle.test(both)) {
      return {
        intent: "roadside",
        confidence: 0.85,
        reason: "stub_vehicle_problem",
        normalized_issue: oilLike.test(both)
          ? "oil_out"
          : fuelMishears.test(both)
            ? "fuel_out"
            : "vehicle_stranded",
        transcript_source_used: chooseSrcByMatch(anyVehicle),
      };
    }

    return {
      intent: "unknown",
      confidence: 0,
      reason: "stub_no_signal",
      normalized_issue: "",
      transcript_source_used: "none",
    };
  });
}

interface ResolverCase {
  hint: string;
  openai_transcript?: string;
  deepgram_transcript?: string;
  expectedIntent: "roadside" | "non_roadside" | "emergency_handoff" | "unknown" | "unknown_conflict";
  expectedClassifierSource?: "regex" | "semantic" | "merge";
  expectedTranscriptSourceUsed?: "deepgram" | "openai_realtime" | "both" | "none";
}

async function runResolverCase(c: ResolverCase): Promise<void> {
  const state: IiziBrainRuntimeState = createInitialIiziBrainState();
  if (c.openai_transcript && c.openai_transcript.trim()) {
    ingestIiziBrainNonemptyUserSpeech(state, c.openai_transcript);
  }
  if (c.deepgram_transcript && c.deepgram_transcript.trim()) {
    ingestIiziBrainTrustedShadowFinal(state, "deepgram", c.deepgram_transcript);
  }
  await resolveFinalIntent(state, { callId: "smoke", call_direction: "inbound" });
  assert.equal(
    state.finalResolvedIntent,
    c.expectedIntent,
    `${c.hint}: expected finalResolvedIntent=${c.expectedIntent} got=${state.finalResolvedIntent} ` +
      `reason=${state.intentResolutionReason} regexOA=${state.openaiRealtimeIntent} regexDG=${state.deepgramShadowIntent} ` +
      `semantic=${state.semanticIntent} conf=${state.semanticConfidence.toFixed(2)} src=${state.transcriptSourceUsed}`,
  );
  if (c.expectedClassifierSource) {
    assert.equal(
      state.classifierSource,
      c.expectedClassifierSource,
      `${c.hint}: expected classifierSource=${c.expectedClassifierSource} got=${state.classifierSource}`,
    );
  }
  if (c.expectedTranscriptSourceUsed) {
    assert.equal(
      state.transcriptSourceUsed,
      c.expectedTranscriptSourceUsed,
      `${c.hint}: expected transcriptSourceUsed=${c.expectedTranscriptSourceUsed} got=${state.transcriptSourceUsed}`,
    );
  }
}

async function run(): Promise<void> {
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

  // Requested phrase coverage (Deepgram-preferred merge uses same hybrid when both pathways see same text)
  expectHybrid("mul on autoabi vaja", compiled, "roadside", "explicit autoabi need");
  expectHybrid("auto ei käivitu", compiled, "roadside", "wont-start phrase");
  expectHybrid("generaator ei tööta", compiled, "roadside", "generator failure roadside cue (ET)");
  expectHybrid("generator ei tööta", compiled, "roadside", "generator failure roadside cue (EN word)");
  expectHybrid("generaator ei lae", compiled, "roadside", "generator not charging / alternator cue");
  expectHybrid("soovin kindlustuse kohta infot", compiled, "non_roadside", "insurance info office line");

  expectNoIntentMatch(
    "Tere tere hommikust kuidas teil läheb mina helistan lihtsalt",
    compiled,
    "random unclear greeting — unknown / clarify at runtime",
  );

  const empty = classifyIntentFromSpeechHybrid("   ", compiled);
  assert.equal(empty.intent, null);

  // Both pathways unclear → merged unknown; SMS must stay blocked until clarified
  const gibberO = classifyIntentFromSpeechHybrid("xyzabc nonsense qwerty", compiled);
  const gibberD = classifyIntentFromSpeechHybrid("xyzabc nonsense qwerty", compiled);
  const gibMerged = mergePathwayIntents(
    (gibberO.intent ?? "unknown") as PathwayIntentClassification,
    (gibberD.intent ?? "unknown") as PathwayIntentClassification,
  );
  assert.equal(gibMerged.resolved, "unknown", "gibberish → both unknown merge");

  // --- Deepgram-preferred pathway merge matrix (OpenAI = first arg, Deepgram = second) ---
  expectMerge("roadside", "roadside", "roadside", "both roadside");
  expectMerge("unknown", "unknown", "unknown", "both unknown");
  expectMerge("roadside", "unknown", "roadside", "OpenAI roadside Deepgram unknown");
  expectMerge("unknown", "roadside", "roadside", "Deepgram roadside OpenAI unknown");
  expectMerge("non_roadside", "unknown", "unknown", "OpenAI non_roadside Deepgram unknown → clarify");
  expectMerge("unknown", "non_roadside", "unknown", "Deepgram non_roadside OpenAI unknown → clarify");
  expectMerge("roadside", "non_roadside", "unknown_conflict", "OpenAI roadside vs Deepgram non_roadside");
  expectMerge("non_roadside", "roadside", "unknown_conflict", "Deepgram roadside vs OpenAI non_roadside");
  expectMerge("roadside", "emergency_handoff", "emergency_handoff", "emergency escalates");
  expectMerge("unknown", "emergency_handoff", "emergency_handoff", "emergency from either pathway");

  // --- Backend semantic resolver smoke (regex + semantic fallback) ---
  // Stub deliberately recognizes phonetic ASR errors that regex must NOT learn.
  installSmokeSemanticStub();

  const resolverCases: ResolverCase[] = [
    // Shipped regex has no "diisel" variant — we explicitly do NOT patch regex for that.
    // Both pathways unknown via regex → semantic recognizes "diisel" → roadside via semantic.
    {
      hint: "diisel otsas (both pathways) → semantic roadside (regex intentionally narrow)",
      openai_transcript: "mul on diisel otsas",
      deepgram_transcript: "mul on diisel otsas",
      expectedIntent: "roadside",
      expectedClassifierSource: "semantic",
      expectedTranscriptSourceUsed: "both",
    },

    // OpenAI misheard "tiisel", Deepgram empty → regex unknown → semantic lifts to roadside.
    {
      hint: "tiisel otsas (OpenAI mishear, Deepgram empty) → semantic roadside",
      openai_transcript: "mul on tiisel otsas",
      deepgram_transcript: "",
      expectedIntent: "roadside",
      expectedClassifierSource: "semantic",
      expectedTranscriptSourceUsed: "openai_realtime",
    },

    // Same pattern for "pentiin" — must resolve without a regex patch.
    {
      hint: "pentiin otsas (OpenAI mishear, Deepgram empty) → semantic roadside",
      openai_transcript: "pentiin on otsas",
      deepgram_transcript: "",
      expectedIntent: "roadside",
      expectedClassifierSource: "semantic",
      expectedTranscriptSourceUsed: "openai_realtime",
    },

    // OpenAI mishear + Deepgram correct → Deepgram regex hits first; source must reflect that.
    {
      hint: "pentiin (OpenAI) vs bensiin otsas (Deepgram) → regex via deepgram",
      openai_transcript: "pentiin on otsas",
      deepgram_transcript: "bensiin on otsas",
      expectedIntent: "roadside",
      expectedClassifierSource: "regex",
      expectedTranscriptSourceUsed: "deepgram",
    },

    // Out-of-vocabulary fuel cue ("õli sai otsa") — regex doesn't and shouldn't match.
    // Semantic recognizes "oil out" as a vehicle problem and lifts to roadside without any regex patch.
    {
      hint: "õli sai otsa → semantic roadside without regex patch",
      openai_transcript: "õli sai otsa ja auto ei sõida edasi",
      deepgram_transcript: "",
      expectedIntent: "roadside",
      expectedClassifierSource: "semantic",
      expectedTranscriptSourceUsed: "openai_realtime",
    },

    // Real staging bug repro: Whisper merged tokens as "Monodiiselotsas".
    // Regex must NOT learn this exact misspelling — semantic resolver must still
    // detect "diisel" within the merged token and lift to roadside.
    {
      hint: "Monodiiselotsas (merged-token ASR) → semantic roadside, no regex patch",
      openai_transcript: "Monodiiselotsas ja auto ei sõida",
      deepgram_transcript: "",
      expectedIntent: "roadside",
      expectedClassifierSource: "semantic",
      expectedTranscriptSourceUsed: "openai_realtime",
    },

    // Office-hours question is non_roadside — shipped regex no longer encodes "kontor lahti",
    // so resolver must reach non_roadside via the semantic classifier (no regex patch).
    {
      hint: "mis kell kontor lahti on → non_roadside via semantic (regex intentionally narrow)",
      openai_transcript: "mis kell kontor lahti on",
      deepgram_transcript: "mis kell kontor lahti on",
      expectedIntent: "non_roadside",
      expectedClassifierSource: "semantic",
      expectedTranscriptSourceUsed: "both",
    },

    // Insurance info — regex hits.
    {
      hint: "soovin kindlustuse kohta infot → non_roadside via regex",
      openai_transcript: "soovin kindlustuse kohta infot",
      deepgram_transcript: "soovin kindlustuse kohta infot",
      expectedIntent: "non_roadside",
      expectedClassifierSource: "regex",
    },

    // Explicit denial — regex hits; semantic must not flip it.
    {
      hint: "ma ei vaja autoabi → non_roadside via regex (denial)",
      openai_transcript: "ma ei vaja autoabi",
      deepgram_transcript: "ma ei vaja autoabi",
      expectedIntent: "non_roadside",
      expectedClassifierSource: "regex",
    },

    // No transcript at all → unknown, semantic must not run.
    {
      hint: "empty transcripts → unknown (no semantic)",
      openai_transcript: "",
      deepgram_transcript: "",
      expectedIntent: "unknown",
      expectedClassifierSource: "regex",
      expectedTranscriptSourceUsed: "none",
    },

    // Gibberish → regex unknown, semantic returns unknown → stays unknown.
    {
      hint: "gibberish → unknown after semantic fallback",
      openai_transcript: "xyzabc nonsense qwerty",
      deepgram_transcript: "xyzabc nonsense qwerty",
      expectedIntent: "unknown",
    },
  ];

  for (const c of resolverCases) {
    await runResolverCase(c);
  }

  // Hard rule: regex emergency_handoff must never be overridden by semantic.
  {
    const state = createInitialIiziBrainState();
    ingestIiziBrainNonemptyUserSpeech(state, "palun kiirabi mul on valu rinnus");
    await resolveFinalIntent(state, { callId: "smoke", call_direction: "inbound" });
    assert.equal(
      state.finalResolvedIntent,
      "emergency_handoff",
      `emergency must remain emergency_handoff (got=${state.finalResolvedIntent} reason=${state.intentResolutionReason})`,
    );
    assert.equal(
      state.classifierSource,
      "regex",
      `emergency must be regex-decided (got=${state.classifierSource})`,
    );
  }

  // Hard rule: regex explicit non_roadside denial must never be flipped to roadside even if
  // OpenAI Realtime hallucinates fuel mishearing in the same turn — denial wins.
  // (We model that by giving Deepgram the denial and OpenAI a fuel mishear; regex on Deepgram
  // matches non_roadside, so resolver Rule 2 picks regex + transcriptSourceUsed=deepgram.)
  {
    const state = createInitialIiziBrainState();
    ingestIiziBrainNonemptyUserSpeech(state, "tiisel otsas");
    ingestIiziBrainTrustedShadowFinal(state, "deepgram", "ma ei vaja autoabi pole abi vaja");
    await resolveFinalIntent(state, { callId: "smoke", call_direction: "inbound" });
    // OpenAI regex=unknown, Deepgram regex=non_roadside → legacy merge => unknown (clarify policy).
    // Resolver therefore falls through to semantic; stub returns non_roadside (denial wins),
    // which the resolver accepts. Either way the outcome must NOT be roadside.
    assert.notEqual(
      state.finalResolvedIntent,
      "roadside",
      `denial must not flip to roadside (got=${state.finalResolvedIntent} reason=${state.intentResolutionReason})`,
    );
  }

  const latchInbound = {
    callId: "latch-smoke",
    call_direction: "inbound" as const,
    preSmsIntentLatchActive: true,
  };

  // --- pre_sms decisive intent latch (IIZI combined inbound semantics) ---
  {
    const state = createInitialIiziBrainState();
    ingestIiziBrainNonemptyUserSpeech(state, "mul on diisel otsas");
    ingestIiziBrainTrustedShadowFinal(state, "deepgram", "mul on diisel otsas");
    await resolveFinalIntent(state, latchInbound);
    assert.equal(state.finalResolvedIntent, "roadside", "latch smoke: diesel → roadside");
    assert.equal(state.preSmsLatchedIntent, "roadside", "latch smoke: preSmsLatchedIntent set");
    ingestIiziBrainNonemptyUserSpeech(state, "xyzabc qwerty nonsense blah");
    ingestIiziBrainTrustedShadowFinal(state, "deepgram", "xyzabc qwerty nonsense blah");
    await resolveFinalIntent(state, latchInbound);
    assert.equal(
      state.finalResolvedIntent,
      "roadside",
      "latch smoke: late gibberish must not downgrade to unknown",
    );
    assert.equal(state.preSmsLatchedIntent, "roadside");
  }

  {
    const state = createInitialIiziBrainState();
    ingestIiziBrainNonemptyUserSpeech(state, "tere tere hommikust kuidas teil läheb");
    ingestIiziBrainTrustedShadowFinal(state, "deepgram", "tere tere hommikust kuidas teil läheb");
    await resolveFinalIntent(state, latchInbound);
    assert.equal(state.finalResolvedIntent, "unknown", "latch smoke: unclear first → unknown");
    setIiziBrainAwaitingYesNoRoadsideClarification(state, true);
    ingestIiziBrainNonemptyUserSpeech(state, "jah");
    await resolveFinalIntent(state, latchInbound);
    assert.equal(state.finalResolvedIntent, "roadside", "latch smoke: clarification jah → roadside");
    assert.equal(state.awaitingYesNoRoadsideClarification, false);
    assert.equal(state.preSmsLatchedIntent, "roadside");
  }

  {
    const state = createInitialIiziBrainState();
    ingestIiziBrainNonemptyUserSpeech(state, "tere jama juttu pikalt");
    ingestIiziBrainTrustedShadowFinal(state, "deepgram", "tere jama juttu pikalt");
    await resolveFinalIntent(state, latchInbound);
    setIiziBrainAwaitingYesNoRoadsideClarification(state, true);
    ingestIiziBrainNonemptyUserSpeech(state, "ei");
    await resolveFinalIntent(state, latchInbound);
    assert.equal(state.finalResolvedIntent, "non_roadside", "latch smoke: clarification ei → non_roadside");
    assert.equal(state.preSmsLatchedIntent, "non_roadside");
  }

  {
    const state = createInitialIiziBrainState();
    ingestIiziBrainNonemptyUserSpeech(state, "tere jama juttu pikalt");
    ingestIiziBrainTrustedShadowFinal(state, "deepgram", "tere jama juttu pikalt");
    await resolveFinalIntent(state, latchInbound);
    setIiziBrainAwaitingYesNoRoadsideClarification(state, true);
    ingestIiziBrainNonemptyUserSpeech(state, "kindlustus");
    await resolveFinalIntent(state, latchInbound);
    assert.equal(state.finalResolvedIntent, "non_roadside", "latch smoke: clarification kindlustus → non_roadside");
    assert.equal(state.preSmsLatchedIntent, "non_roadside");
  }

  assert.equal(matchYesNoRoadsideClarification("kindlustus"), "no", "clarify matcher: kindlustus → no");
  assert.equal(matchYesNoRoadsideClarification("mul on diisel otsas"), "yes", "clarify matcher: diisel cue → yes");

  assert.ok(
    iiziTowTransportFlowHint("vajan puksiir abi") != null &&
      iiziMatchedRoadsideOccupantKeyword("vajan puksiir abi") != null,
    "heuristic: tow cue implies occupant-keyword path",
  );
  assert.ok(
    iiziFuelBatteryTyreOnlyRoadsideIssue("mul on bensiin otsas"),
    "heuristic: fuel-only wording without tow/stranded cues",
  );
  assert.ok(
    !iiziFuelBatteryTyreOnlyRoadsideIssue("auto ei käivitu tee peal"),
    "heuristic: won't-start cue is not fuel-only",
  );

  {
    const state = createInitialIiziBrainState();
    ingestIiziBrainNonemptyUserSpeech(state, "mis kell kontor lahti on");
    ingestIiziBrainTrustedShadowFinal(state, "deepgram", "mis kell kontor lahti on");
    await resolveFinalIntent(state, latchInbound);
    assert.equal(state.finalResolvedIntent, "non_roadside", "smoke: office hours → non_roadside");
    const gate = gateIiziCombinedSms(state);
    assert.equal(gate.allow, false, "non_roadside must not allow combined SMS");
    assert.equal(deriveExpectedNextActionBrain(state), "route_non_roadside_to_human");
  }

  {
    const state = createInitialIiziBrainState();
    ingestIiziBrainNonemptyUserSpeech(state, "mul on diisel otsas");
    ingestIiziBrainTrustedShadowFinal(state, "deepgram", "mul on diisel otsas");
    await resolveFinalIntent(state, latchInbound);
    ingestIiziBrainFlow(state, "combined_sms_sent");
    assert.equal(state.workflowPhase, "waiting_for_form_and_location");
    assert.equal(
      deriveExpectedNextActionBrain(state),
      "wait_for_form_and_location",
      "roadside after combined SMS ingest → wait for form/location",
    );
  }

  {
    const state = createInitialIiziBrainState();
    ingestIiziBrainNonemptyUserSpeech(state, "ma ei vaja autoabi");
    ingestIiziBrainTrustedShadowFinal(state, "deepgram", "ma ei vaja autoabi");
    await resolveFinalIntent(state, latchInbound);
    assert.equal(state.finalResolvedIntent, "non_roadside", "latch smoke: denial → non_roadside");
    ingestIiziBrainNonemptyUserSpeech(state, "xyz nonsense gibberish");
    ingestIiziBrainTrustedShadowFinal(state, "deepgram", "xyz nonsense gibberish");
    await resolveFinalIntent(state, latchInbound);
    assert.equal(
      state.finalResolvedIntent,
      "non_roadside",
      "latch smoke: non_roadside must not downgrade to unknown",
    );
  }

  {
    const state = createInitialIiziBrainState();
    ingestIiziBrainNonemptyUserSpeech(state, "palun kiirabi mul on valu rinnus");
    ingestIiziBrainTrustedShadowFinal(state, "deepgram", "palun kiirabi mul on valu rinnus");
    await resolveFinalIntent(state, latchInbound);
    assert.equal(state.finalResolvedIntent, "emergency_handoff", "latch smoke: emergency");
    ingestIiziBrainNonemptyUserSpeech(state, "asdf qwerty zzz");
    ingestIiziBrainTrustedShadowFinal(state, "deepgram", "asdf qwerty zzz");
    await resolveFinalIntent(state, latchInbound);
    assert.equal(
      state.finalResolvedIntent,
      "emergency_handoff",
      "latch smoke: emergency must not downgrade to unknown",
    );
  }

  // Reset stub so it doesn't leak across test processes.
  setSemanticClassifierForTests(null);

  console.log(
    "OK intent-classify-smoke:",
    "roadside/non_roadside/emergency/empty/unclear/merge-matrix/semantic-resolver/pre_sms_latch/clarify_matcher/heuristics/gates passed.",
  );
}

run().catch((err) => {
  console.error("[intent-classify-smoke] FAIL", err);
  process.exit(1);
});
