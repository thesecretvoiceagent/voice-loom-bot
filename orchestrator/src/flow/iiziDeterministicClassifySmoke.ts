/**
 * Multilingual IIZI classifier smoke — run: npm run iizi-deterministic-smoke
 */

import assert from "node:assert/strict";
import { classifyIiziTranscript, createInitialIiziDeterministicState } from "./iiziDeterministic.js";
import type { IiziLanguage, IiziRoadsideCategory } from "./iiziDeterministicTypes.js";

type Expect = {
  category?: IiziRoadsideCategory | "unsafe" | "not_roadside" | "unclear";
  lang: IiziLanguage;
};

function expectClassify(text: string, exp: Expect, hint: string): void {
  const bag = createInitialIiziDeterministicState();
  const c = classifyIiziTranscript(text, bag, "smoke");
  if (exp.category === "unsafe") {
    assert.equal(c.finalBackendIntent, "unsafe", `${hint}: intent`);
  } else if (exp.category === "not_roadside") {
    assert.equal(c.finalBackendIntent, "not_roadside_assistance", `${hint}: intent`);
  } else if (exp.category === "unclear") {
    assert.equal(c.finalBackendIntent, "unclear", `${hint}: intent`);
  } else {
    assert.equal(c.finalBackendIntent, "roadside_assistance", `${hint}: intent`);
    assert.equal(c.triggerCategory, exp.category, `${hint}: category`);
  }
  assert.equal(c.iiziLanguage, exp.lang, `${hint}: lang (got ${c.iiziLanguage})`);
}

function run(): void {
  // ET
  expectClassify("mul oli avarii", { category: "accident", lang: "et" }, "et avarii");
  expectClassify("auto ei käivitu", { category: "no_start", lang: "et" }, "et no_start");
  expectClassify("reff katki", { category: "flat_tire", lang: "et" }, "et flat fuzzy");
  expectClassify("õli lekib", { category: "mechanical_issue", lang: "et" }, "et oil");
  expectClassify("generaator on katki", { category: "mechanical_issue", lang: "et" }, "et alternator");
  expectClassify("mul on kindlustuse küsimus", { category: "not_roadside", lang: "et" }, "et insurance");

  // EN
  expectClassify("I had an accident", { category: "accident", lang: "en" }, "en accident");
  expectClassify("my car wont start", { category: "no_start", lang: "en" }, "en no_start");
  expectClassify("flat tire", { category: "flat_tire", lang: "en" }, "en flat");
  expectClassify("I need a tow truck", { category: "tow_needed", lang: "en" }, "en tow");
  expectClassify("oil is leaking", { category: "mechanical_issue", lang: "en" }, "en oil");
  expectClassify("alternator is broken", { category: "mechanical_issue", lang: "en" }, "en alternator");
  expectClassify("I have an insurance question", { category: "not_roadside", lang: "en" }, "en insurance");

  // RU
  expectClassify("машина не заводится", { category: "no_start", lang: "ru" }, "ru no_start");
  expectClassify("нужен эвакуатор", { category: "tow_needed", lang: "ru" }, "ru tow");
  expectClassify("спустило колесо", { category: "flat_tire", lang: "ru" }, "ru flat");
  expectClassify("течет масло", { category: "mechanical_issue", lang: "ru" }, "ru oil");
  expectClassify("генератор не работает", { category: "mechanical_issue", lang: "ru" }, "ru alternator");
  expectClassify("у меня вопрос по страховке", { category: "not_roadside", lang: "ru" }, "ru insurance");

  // Unsafe
  expectClassify("keegi sai viga", { category: "unsafe", lang: "et" }, "unsafe et");
  expectClassify("someone is injured", { category: "unsafe", lang: "en" }, "unsafe en");
  expectClassify("кто-то пострадал", { category: "unsafe", lang: "ru" }, "unsafe ru");

  console.log("[iizi-deterministic-smoke] OK (multilingual et/en/ru)");
}

run();
