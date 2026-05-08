/**
 * Regression smoke (manual CI): orchestrator/`npm run intent-classify-smoke`
 * (Node 22+: --experimental-strip-types). Käivitage kataloogist orchestrator /
 * või WSL/tee kus npm ei kaota UNC cwd (Windows CMD UNC → node ei leia faili).
 */
import assert from "node:assert/strict";
import type { IntentClassification } from "./iiziBrain.ts";
import { classifyIntentFromSpeech } from "./iiziBrain.ts";

const cases: ReadonlyArray<{ phrase: string; expect: IntentClassification | null }> = [
  {
    phrase: "Ja hallo, mul sai bentsiin otsa ja ma ei saa oma autosse sisse ka.",
    expect: "roadside",
  },
  {
    phrase: "mul sai kütus otsa",
    expect: "roadside",
  },
  {
    phrase: "bensiin otsas ja auto ei käivitu",
    expect: "roadside",
  },
  {
    phrase: "aku tühi, rehv katki",
    expect: "roadside",
  },
  {
    phrase: "vaja autoabi ja puksiir kraavist",
    expect: "roadside",
  },
  {
    phrase: "ainult kontori küsimus, ei ole auto abi",
    expect: "non_roadside",
  },
  {
    phrase:
      "Sooviksin teada hindu, aga kütus on otsas ja võtmed jäid autosse.",
    expect: "roadside",
  },
];

let failed = 0;
for (const { phrase, expect: want } of cases) {
  const got = classifyIntentFromSpeech(phrase);
  try {
    assert.equal(got, want, phrase);
    console.log(`[iiziBrainIntentSmoke] ok want=${want} got=${got}`);
  } catch (e) {
    failed++;
    console.error(`[iiziBrainIntentSmoke] FAIL want=${want} got=${got} phrase="${phrase}"`, e);
  }
}

if (failed > 0) {
  process.exit(1);
}
