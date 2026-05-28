import assert from "node:assert/strict";
import {
  classifyCallbackSameNumberIntent,
  createInitialIiziDeterministicState,
  isCallbackDifferentNumberRequest,
  isCallbackSameNumberConfirmation,
  reduceIiziDeterministicTurn,
  resolveIiziDeterministicExactLine,
  IIZI_GENERIC_ROADSIDE_INCIDENT_ET,
  type IiziDeterministicAction,
} from "./iiziDeterministic.js";
import { resolveIiziLocalizedLine } from "./iiziDeterministicConfig.js";
import { normalizeIiziTranscript } from "./iiziDeterministicNormalize.js";

function lineIds(actions: IiziDeterministicAction[]): string[] {
  return actions
    .filter((a): a is Extract<IiziDeterministicAction, { type: "speak_exact" }> => a.type === "speak_exact")
    .map((a) => a.lineId);
}

function run(): void {
  // A: generic roadside exact ET wording
  assert.equal(IIZI_GENERIC_ROADSIDE_INCIDENT_ET, "Sain aru, et vajate autoabi.");
  assert.equal(
    resolveIiziLocalizedLine("incident.generic_roadside", "et"),
    "Sain aru, et vajate autoabi.",
    "registry generic roadside ET",
  );
  assert.notEqual(
    resolveIiziLocalizedLine("incident.generic_roadside", "et")?.includes("teeäär"),
    true,
    "must not contain teeäär",
  );

  // B: deterministic exact lines default to ET (not EN) without explicit language switch
  {
    const bag = createInitialIiziDeterministicState();
    bag.flags.explicitCallerLanguage = null;
    const etLine = resolveIiziDeterministicExactLine("crm.known", bag.flags.explicitCallerLanguage, undefined, "B");
    const enRegistry = resolveIiziLocalizedLine("crm.known", "en");
    assert.equal(etLine?.includes("Leidsin"), true, "forced ET crm line");
    assert.notEqual(etLine, enRegistry, "must not use EN registry without explicit switch");
  }

  // Test F: exact deterministic greeting
  assert.equal(
    resolveIiziLocalizedLine("greeting.initial", "et"),
    "Tere!  Kahjuks kõik klienditeenindajad on hetkel hõivatud ning mina olen Iizi A-I kõnerobot Jaanika. Oskan aidata ainult autoabiga seoses. Kõne salvestatakse. Rääkige Teile sobivas keeles. Kuidas saame Teile abiks olla?",
    "greeting.initial exact text",
  );

  // Test A flow: roadside spoken incident is always generic
  {
    const bagA = createInitialIiziDeterministicState();
    reduceIiziDeterministicTurn({ callId: "A", bag: bagA, event: { type: "crm_prefetch", callerKnown: true } });
    reduceIiziDeterministicTurn({ callId: "A", bag: bagA, event: { type: "greeting_complete" } });
    const turnA = reduceIiziDeterministicTurn({
      callId: "A",
      bag: bagA,
      event: { type: "user_transcript", text: "autorehv katki" },
    });
    const aLines = lineIds(turnA.actions);
    assert.equal(aLines[0], "incident.generic_roadside", "A first incident line is generic");
    assert.equal(aLines.includes("intent.confirm_flat_tire"), false, "A no flat tire confirm");
    const smsTurn = reduceIiziDeterministicTurn({ callId: "A", bag: bagA, event: { type: "combined_sms_result", success: true } });
    assert.deepEqual(lineIds(smsTurn.actions), ["sms.combined.sent_success"], "A sms success line queued");
  }

  const SMS_HELP_ET =
    "Mul ei ole Teie andmeid veel kätte tulnud. Saatsin Teile SMS-i. Palun avage sõnumite rakendus, vajutage lingile, kerige alla, sisestage auto registreerimismärk, kinnitage asukoht ja vajutage Kinnita.";

  // Callback smoke E: 0601116 SMS-help fallback after combined SMS, before form_submitted (tests A–E)
  {
    const bagHelp = createInitialIiziDeterministicState();
    reduceIiziDeterministicTurn({ callId: "help", bag: bagHelp, event: { type: "combined_sms_result", success: true } });
    assert.equal(bagHelp.currentState, "WAITING_FOR_FORM_SUBMITTED");

    const helpA = reduceIiziDeterministicTurn({
      callId: "help",
      bag: bagHelp,
      event: { type: "user_transcript", text: "mis ma tegema pean?" },
    });
    assert.deepEqual(lineIds(helpA.actions), ["form.waiting_sms_help"], "A SMS help line");
    assert.equal(
      helpA.actions.some((a) => a.type === "speak_exact" && a.lineId === "form.not_received_yet"),
      false,
      "A no form.not_received_yet",
    );

    const helpB = reduceIiziDeterministicTurn({
      callId: "help",
      bag: bagHelp,
      event: { type: "user_transcript", text: "kuhu vajutan?" },
    });
    assert.deepEqual(lineIds(helpB.actions), ["form.waiting_sms_help"], "B SMS help line");
    assert.equal(
      helpB.actions.some((a) => a.type === "speak_exact" && a.lineId === "form.not_received_yet"),
      false,
      "B no form.not_received_yet",
    );

    const helpC = reduceIiziDeterministicTurn({
      callId: "help",
      bag: bagHelp,
      event: { type: "user_transcript", text: "No hea, ootame isma tegema beale" },
    });
    assert.deepEqual(lineIds(helpC.actions), ["form.waiting_sms_help"], "C SMS help line");
    assert.equal(
      helpC.actions.some((a) => a.type === "speak_exact" && a.lineId === "form.not_received_yet"),
      false,
      "C no form.not_received_yet",
    );

    assert.equal(resolveIiziLocalizedLine("form.waiting_sms_help", "et"), SMS_HELP_ET, "D SMS help exact ET text");

    reduceIiziDeterministicTurn({
      callId: "help",
      bag: bagHelp,
      event: { type: "form_submitted", submittedReg: "111AAA" },
    });
    const helpE = reduceIiziDeterministicTurn({
      callId: "help",
      bag: bagHelp,
      event: { type: "user_transcript", text: "mis ma tegema pean?" },
    });
    assert.equal(lineIds(helpE.actions).includes("form.waiting_sms_help"), false, "E no SMS help after form");
  }

  const bag = createInitialIiziDeterministicState();
  const callId = "flow-smoke";

  reduceIiziDeterministicTurn({
    callId,
    bag,
    event: { type: "combined_sms_result", success: true },
  });

  reduceIiziDeterministicTurn({
    callId,
    bag,
    event: { type: "location_confirmed", address: "Sihi 46, Tallinn, Harju maakond" },
  });

  const formTurn = reduceIiziDeterministicTurn({
    callId,
    bag,
    event: { type: "form_submitted", submittedReg: "111AAA" },
  });
  assert.deepEqual(lineIds(formTurn.actions), [], "form registration line suppressed");

  const vehicleTurn = reduceIiziDeterministicTurn({
    callId,
    bag,
    event: { type: "vehicle_lookup_result", match: true, coverageInvalid: false },
  });
  const vehicleLines = lineIds(vehicleTurn.actions);
  assert.equal(vehicleLines.filter((id) => id === "vehicle_location.combined.readback").length, 1, "combined readback once");
  assert.equal(vehicleLines.includes("callback.ask_same_number"), true, "callback after readback when no occupant");

  // Callback intent classifier (ASK_CALLBACK_SAME_NUMBER)
  {
    const expectSame = [
      "Pelistamise numbr on sama.",
      "tagasihelistamise number on sama",
      "number on sama",
      "jah sobib",
      "Jaa",
      "sobib",
      "helistamise numbr on sama",
    ];
    for (const text of expectSame) {
      const norm = normalizeIiziTranscript(text);
      assert.equal(
        classifyCallbackSameNumberIntent(norm).intent,
        "same_number",
        `same: ${text}`,
      );
      assert.equal(isCallbackSameNumberConfirmation(norm), true, `isCallbackSame: ${text}`);
      assert.equal(isCallbackDifferentNumberRequest(norm), false, `not different: ${text}`);
    }

    const expectDifferent = [
      "ei",
      "pole sama",
      "number pole sama",
      "soovin teist tagasihelistamise numbrit",
    ];
    for (const text of expectDifferent) {
      const norm = normalizeIiziTranscript(text);
      assert.equal(
        classifyCallbackSameNumberIntent(norm).intent,
        "different_number",
        `different: ${text}`,
      );
      assert.equal(isCallbackDifferentNumberRequest(norm), true, `isCallbackDifferent: ${text}`);
      assert.equal(isCallbackSameNumberConfirmation(norm), false, `not same: ${text}`);
    }

    for (const text of ["halloo", "ma ei kuulnud", "mis"]) {
      const norm = normalizeIiziTranscript(text);
      assert.equal(
        classifyCallbackSameNumberIntent(norm).intent,
        "unknown",
        `unknown: ${text}`,
      );
    }

    const bagJaa = createInitialIiziDeterministicState();
    bagJaa.currentState = "ASK_CALLBACK_SAME_NUMBER";
    const jaaTurn = reduceIiziDeterministicTurn({
      callId: "cb-jaa",
      bag: bagJaa,
      event: { type: "user_transcript", text: "Jaa" },
    });
    const jaaLines = lineIds(jaaTurn.actions);
    assert.equal(jaaLines.includes("callback.same_number_confirmed"), true, "Jaa confirms same");
    assert.equal(jaaLines.includes("handoff.normal_partner"), true, "Jaa handoff");
    assert.equal(jaaLines.includes("closing.ask_additional_info"), true, "Jaa closing ask");
    assert.equal(jaaTurn.actions.some((a) => a.type === "send_callback_sms"), false, "Jaa no callback SMS");

    const bagAsr = createInitialIiziDeterministicState();
    bagAsr.currentState = "ASK_CALLBACK_SAME_NUMBER";
    const asrTurn = reduceIiziDeterministicTurn({
      callId: "cb-asr",
      bag: bagAsr,
      event: { type: "user_transcript", text: "Pelistamise numbr on sama." },
    });
    assert.equal(asrTurn.actions.some((a) => a.type === "send_callback_sms"), false, "ASR same no SMS");
    assert.equal(lineIds(asrTurn.actions).includes("callback.same_number_confirmed"), true, "ASR same path");

    const bagCb = createInitialIiziDeterministicState();
    bagCb.currentState = "ASK_CALLBACK_SAME_NUMBER";
    const diffTurn = reduceIiziDeterministicTurn({
      callId: "cb-diff",
      bag: bagCb,
      event: { type: "user_transcript", text: "soovin teist tagasihelistamise numbrit" },
    });
    assert.deepEqual(diffTurn.actions, [{ type: "send_callback_sms" }], "different -> send_callback_sms");

    const bagNoise = createInitialIiziDeterministicState();
    bagNoise.currentState = "ASK_CALLBACK_SAME_NUMBER";
    const noiseTurn = reduceIiziDeterministicTurn({
      callId: "cb-noise",
      bag: bagNoise,
      event: { type: "user_transcript", text: "halloo" },
    });
    assert.deepEqual(noiseTurn.actions, [{ type: "none" }], "halloo -> no progress");
    assert.equal(bagNoise.currentState, "ASK_CALLBACK_SAME_NUMBER", "halloo stays in ask state");

    const bagUnclear = createInitialIiziDeterministicState();
    bagUnclear.currentState = "ASK_CALLBACK_SAME_NUMBER";
    const unclearTurn = reduceIiziDeterministicTurn({
      callId: "cb-unclear",
      bag: bagUnclear,
      event: { type: "user_transcript", text: "ma ei kuulnud" },
    });
    assert.deepEqual(unclearTurn.actions, [{ type: "none" }], "ma ei kuulnud -> no progress");
  }

  // E: occupant ask once then parse üks
  {
    const bagOcc = createInitialIiziDeterministicState();
    reduceIiziDeterministicTurn({ callId: "occ", bag: bagOcc, event: { type: "combined_sms_result", success: true } });
    reduceIiziDeterministicTurn({
      callId: "occ",
      bag: bagOcc,
      event: { type: "location_confirmed", address: "Test 1, Tallinn" },
    });
    reduceIiziDeterministicTurn({ callId: "occ", bag: bagOcc, event: { type: "form_submitted", submittedReg: "111AAA" } });
    bagOcc.flags.occupantCountRequired = true;
    const vTurn = reduceIiziDeterministicTurn({
      callId: "occ",
      bag: bagOcc,
      event: { type: "vehicle_lookup_result", match: true, coverageInvalid: false },
    });
    const occLines = lineIds(vTurn.actions);
    assert.equal(occLines.filter((id) => id === "occupants.ask").length, 1, "E occupants.ask once");
    assert.equal(bagOcc.flags.occupantQuestionAsked, true, "E occupantQuestionAsked set on queue");
    assert.equal(bagOcc.currentState, "WAITING_FOR_OCCUPANT_COUNT", "E waiting for occupant");
    const ans = reduceIiziDeterministicTurn({
      callId: "occ",
      bag: bagOcc,
      event: { type: "user_transcript", text: "üks" },
    });
    assert.deepEqual(
      lineIds(ans.actions),
      ["occupants.received", "callback.ask_same_number"],
      "E üks -> received + callback ask",
    );
    assert.equal(lineIds(ans.actions).includes("occupants.ask"), false, "E no second occupants.ask");
    const again = reduceIiziDeterministicTurn({
      callId: "occ",
      bag: bagOcc,
      event: { type: "user_transcript", text: "üks" },
    });
    assert.equal(lineIds(again.actions).includes("occupants.ask"), false, "E still no repeat ask");
  }

  // F: unclear occupant answer — one retry window then handoff
  {
    const bagF = createInitialIiziDeterministicState();
    bagF.currentState = "WAITING_FOR_OCCUPANT_COUNT";
    bagF.flags.occupantQuestionAsked = true;
    bagF.flags.occupantCountRequired = true;
    const unclear1 = reduceIiziDeterministicTurn({
      callId: "occ-f",
      bag: bagF,
      event: { type: "user_transcript", text: "mis" },
    });
    assert.deepEqual(unclear1.actions, [{ type: "none" }], "F first unclear allows one retry");
    assert.equal(bagF.flags.occupantClarifyCount, 1, "F clarify count 1");
    const unclear2 = reduceIiziDeterministicTurn({
      callId: "occ-f",
      bag: bagF,
      event: { type: "user_transcript", text: "ei tea" },
    });
    assert.equal(lineIds(unclear2.actions).includes("handoff.human_followup"), true, "F second unclear -> human");
    assert.equal(lineIds(unclear2.actions).includes("occupants.ask"), false, "F no more occupant ask");
  }

  // Closing FSM after handoff
  {
    const bagClose = createInitialIiziDeterministicState();
    bagClose.currentState = "WAITING_FOR_ADDITIONAL_INFO_DECISION";
    bagClose.flags.handoffSpoken = true;

    const declineEi = reduceIiziDeterministicTurn({
      callId: "close-ei",
      bag: bagClose,
      event: { type: "user_transcript", text: "ei" },
    });
    assert.deepEqual(lineIds(declineEi.actions), ["closing.additional_info_declined"], "ei -> declined");
    assert.equal(bagClose.currentState, "CLOSING_END_PENDING", "ei -> end pending");
    assert.equal(bagClose.flags.pendingEndCallAfterLine, "closing.additional_info_declined", "ei pending end");

    const bagDeclineLong = createInitialIiziDeterministicState();
    bagDeclineLong.currentState = "WAITING_FOR_ADDITIONAL_INFO_DECISION";
    const declineLong = reduceIiziDeterministicTurn({
      callId: "close-decline",
      bag: bagDeclineLong,
      event: { type: "user_transcript", text: "ei soovi midagi lisada" },
    });
    assert.deepEqual(
      lineIds(declineLong.actions),
      ["closing.additional_info_declined"],
      "ei soovi midagi lisada -> declined",
    );
    assert.equal(bagDeclineLong.currentState, "CLOSING_END_PENDING", "decline long -> end pending");

    const bagYesContent = createInitialIiziDeterministicState();
    bagYesContent.currentState = "WAITING_FOR_ADDITIONAL_INFO_DECISION";
    const yesContent = reduceIiziDeterministicTurn({
      callId: "close-yes-content",
      bag: bagYesContent,
      event: { type: "user_transcript", text: "jah, lisage et ma olen maja ees" },
    });
    assert.deepEqual(
      lineIds(yesContent.actions),
      ["closing.additional_info_acknowledged"],
      "jah with content -> acknowledged",
    );
    assert.equal(bagYesContent.currentState, "CLOSING_END_PENDING", "yes content -> end pending");
    assert.ok(bagYesContent.flags.additionalInfoNote.length > 0, "yes content note stored");

    const bagYesOnly = createInitialIiziDeterministicState();
    bagYesOnly.currentState = "WAITING_FOR_ADDITIONAL_INFO_DECISION";
    const yesOnly = reduceIiziDeterministicTurn({
      callId: "close-yes-only",
      bag: bagYesOnly,
      event: { type: "user_transcript", text: "jah" },
    });
    assert.deepEqual(lineIds(yesOnly.actions), ["closing.ask_what_to_add"], "jah only -> ask what");
    assert.equal(bagYesOnly.currentState, "WAITING_FOR_ADDITIONAL_INFO_TEXT", "jah only -> wait text");
    const followUp = reduceIiziDeterministicTurn({
      callId: "close-yes-only",
      bag: bagYesOnly,
      event: { type: "user_transcript", text: "ma olen maja ees" },
    });
    assert.deepEqual(
      lineIds(followUp.actions),
      ["closing.additional_info_acknowledged"],
      "follow-up content -> acknowledged",
    );
    assert.equal(bagYesOnly.currentState, "CLOSING_END_PENDING", "follow-up -> end pending");

    const bagJaaClose = createInitialIiziDeterministicState();
    bagJaaClose.currentState = "ASK_CALLBACK_SAME_NUMBER";
    const jaaClose = reduceIiziDeterministicTurn({
      callId: "close-cb",
      bag: bagJaaClose,
      event: { type: "user_transcript", text: "Jaa" },
    });
    const jaaCloseLines = lineIds(jaaClose.actions);
    assert.equal(jaaCloseLines.includes("handoff.normal_partner"), true, "callback Jaa handoff");
    assert.equal(jaaCloseLines.includes("closing.ask_additional_info"), true, "callback Jaa closing ask");
    assert.equal(jaaCloseLines.includes("closing.anything_else"), false, "normal path no anything_else");
  }

  console.log("[iizi-deterministic-flow-smoke] OK (SMS-help + callback + closing)");
}

run();
