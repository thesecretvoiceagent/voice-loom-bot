import assert from "node:assert/strict";
import {
  createInitialIiziDeterministicState,
  isCallbackDifferentNumberRequest,
  isCallbackSameNumberConfirmation,
  reduceIiziDeterministicTurn,
  resolveIiziDeterministicExactLine,
  IIZI_GENERIC_ROADSIDE_INCIDENT_ET,
  type IiziDeterministicAction,
} from "./iiziDeterministic.js";
import { resolveIiziLocalizedLine } from "./iiziDeterministicConfig.js";

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

  const callbackYes = reduceIiziDeterministicTurn({
    callId,
    bag,
    event: { type: "user_transcript", text: "jah" },
  });
  assert.equal(lineIds(callbackYes.actions).includes("callback.same_number_confirmed"), true, "callback yes");

  // C: waiting-for-SMS help exact line
  {
    const bagHelp = createInitialIiziDeterministicState();
    reduceIiziDeterministicTurn({ callId: "help", bag: bagHelp, event: { type: "combined_sms_result", success: true } });
    const helpTurn = reduceIiziDeterministicTurn({
      callId: "help",
      bag: bagHelp,
      event: { type: "user_transcript", text: "mida ma tegema pean" },
    });
    assert.deepEqual(lineIds(helpTurn.actions), ["form.waiting_sms_help"], "waiting SMS help line");
    assert.equal(
      resolveIiziLocalizedLine("form.waiting_sms_help", "et"),
      "Mul ei ole Teie andmeid veel kätte tulnud. Saatsin Teile SMS-i. Palun avage sõnumite rakendus, vajutage lingile, kerige alla, sisestage auto registreerimismärk, kinnitage asukoht ja vajutage Kinnita.",
      "C waiting SMS help exact ET text",
    );
  }

  // D: callback different number phrases
  assert.equal(isCallbackDifferentNumberRequest("tahan uut tagasihelistamise numbrit"), true, "D tahan uut");
  assert.equal(isCallbackDifferentNumberRequest("soovin teist tagasihelistamise numbrit"), true, "D soovin teist");
  {
    const bagCb = createInitialIiziDeterministicState();
    bagCb.currentState = "ASK_CALLBACK_SAME_NUMBER";
    const diffTurn = reduceIiziDeterministicTurn({
      callId: "cb-diff",
      bag: bagCb,
      event: { type: "user_transcript", text: "soovin teist tagasihelistamise numbrit" },
    });
    assert.deepEqual(diffTurn.actions, [{ type: "send_callback_sms" }], "D sends callback SMS action only");
    const smsOk = reduceIiziDeterministicTurn({
      callId: "cb-diff",
      bag: bagCb,
      event: { type: "callback_sms_result", success: true },
    });
    assert.deepEqual(lineIds(smsOk.actions), ["callback.different_number_sms_sent"], "D callback SMS success line");
    assert.equal(
      resolveIiziLocalizedLine("callback.different_number_sms_sent", "et"),
      "Saatsin Teile SMS-i, kuhu saate sisestada tagasihelistamise numbri. Palun avage oma sõnumite rakendus, vajutage lingile ning sisestage tagasihelistamise number.",
      "D exact callback SMS spoken line",
    );
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

  console.log("[iizi-deterministic-flow-smoke] OK (P0 chain + UX fixes A-F)");
}

run();
