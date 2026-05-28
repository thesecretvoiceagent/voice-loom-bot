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

  const SMS_HELP_ET =
    "Mul ei ole veel Teie andmeid. Palun avage SMS, vajutage lingile, sisestage registreerimisnumber, kinnitage asukoht ja vajutage Kinnita.";

  // A: aggressive SMS-help after combined SMS, before form
  {
    const bagHelp = createInitialIiziDeterministicState();
    reduceIiziDeterministicTurn({ callId: "help", bag: bagHelp, event: { type: "combined_sms_result", success: true } });
    assert.equal(bagHelp.flags.combinedSmsSuccess, true);
    assert.equal(bagHelp.currentState, "WAITING_FOR_FORM_SUBMITTED");

    for (const text of [
      "mis ma tegema pean",
      "ootame isma tegema beale",
      "xyz unclear noise",
    ]) {
      const t = reduceIiziDeterministicTurn({
        callId: "help",
        bag: bagHelp,
        event: { type: "user_transcript", text },
      });
      assert.deepEqual(lineIds(t.actions), ["form.waiting_sms_help"], `SMS help for: ${text}`);
      assert.equal(t.actions.some((a) => a.type === "speak_exact" && a.lineId === "form.not_received_yet"), false);
    }

    assert.equal(resolveIiziLocalizedLine("form.waiting_sms_help", "et"), SMS_HELP_ET, "SMS help exact ET");

    reduceIiziDeterministicTurn({
      callId: "help",
      bag: bagHelp,
      event: { type: "form_submitted", submittedReg: "111AAA" },
    });
    const afterForm = reduceIiziDeterministicTurn({
      callId: "help",
      bag: bagHelp,
      event: { type: "user_transcript", text: "mis ma tegema pean" },
    });
    assert.equal(lineIds(afterForm.actions).includes("form.waiting_sms_help"), false, "no SMS help after form");
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

  assert.equal(
    resolveIiziLocalizedLine("callback.ask_same_number", "et"),
    "Kas tagasihelistamise number on sama? Palun vasta täislausega.",
    "callback ask exact ET",
  );

  assert.equal(isCallbackSameNumberConfirmation("jah number on sama"), true, "jah number on sama");
  assert.equal(isCallbackDifferentNumberRequest("ei number ei ole sama"), true, "ei number ei ole sama");

  const callbackYes = reduceIiziDeterministicTurn({
    callId,
    bag,
    event: { type: "user_transcript", text: "Jah, number on sama" },
  });
  const yesLines = lineIds(callbackYes.actions);
  assert.equal(yesLines.includes("handoff.normal_partner"), true, "handoff after same callback");
  assert.equal(yesLines.includes("closing.ask_additional_info"), true, "closing question after handoff");
  assert.equal(yesLines.includes("callback.same_number_confirmed"), false, "no legacy same-number line");
  assert.equal(yesLines.includes("closing.anything_else"), false, "no legacy anything_else");

  // D: callback different number + SMS success line
  {
    const bagCb = createInitialIiziDeterministicState();
    bagCb.currentState = "ASK_CALLBACK_SAME_NUMBER";
    const diffTurn = reduceIiziDeterministicTurn({
      callId: "cb-diff",
      bag: bagCb,
      event: { type: "user_transcript", text: "Soovin teist tagasihelistamise numbrit" },
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

  // B: empty callback turn does not re-ask
  {
    const bagEmpty = createInitialIiziDeterministicState();
    bagEmpty.currentState = "ASK_CALLBACK_SAME_NUMBER";
    bagEmpty.flags.callbackQuestionAsked = true;
    const empty = reduceIiziDeterministicTurn({
      callId: "cb-empty",
      bag: bagEmpty,
      event: { type: "user_transcript", text: " " },
    });
    assert.deepEqual(empty.actions, [{ type: "none" }], "empty callback turn waits");
    assert.equal(lineIds(empty.actions).includes("callback.ask_same_number"), false);
  }

  // D: closing flow after additional-info question
  {
    const bagClose = createInitialIiziDeterministicState();
    bagClose.currentState = "WAITING_FOR_ADDITIONAL_INFO_DECISION";
    const decline = reduceIiziDeterministicTurn({
      callId: "close-decline",
      bag: bagClose,
      event: { type: "user_transcript", text: "ei soovi lisada" },
    });
    assert.equal(bagClose.currentState, "CLOSING_END_PENDING");
    assert.deepEqual(lineIds(decline.actions), ["closing.additional_info_declined"]);
    assert.equal(
      resolveIiziLocalizedLine("closing.additional_info_declined", "et"),
      "Okei, aitäh. Helistame peatselt tagasi.",
    );
    assert.equal(bagClose.flags.pendingEndCallAfterLine, "closing.additional_info_declined");

    const bagNote = createInitialIiziDeterministicState();
    bagNote.currentState = "WAITING_FOR_ADDITIONAL_INFO_DECISION";
    const withNote = reduceIiziDeterministicTurn({
      callId: "close-note",
      bag: bagNote,
      event: { type: "user_transcript", text: "jah, palun öelge et olen maja ees" },
    });
    assert.equal(bagNote.flags.additionalInfoNote.includes("maja ees"), true);
    assert.deepEqual(lineIds(withNote.actions), ["closing.additional_info_acknowledged"]);

    const bagYesOnly = createInitialIiziDeterministicState();
    bagYesOnly.currentState = "WAITING_FOR_ADDITIONAL_INFO_DECISION";
    const yesOnly = reduceIiziDeterministicTurn({
      callId: "close-yes",
      bag: bagYesOnly,
      event: { type: "user_transcript", text: "jah" },
    });
    assert.equal(bagYesOnly.currentState, "WAITING_FOR_ADDITIONAL_INFO_TEXT");
    assert.deepEqual(lineIds(yesOnly.actions), ["closing.ask_what_to_add"]);
    const noteTurn = reduceIiziDeterministicTurn({
      callId: "close-yes",
      bag: bagYesOnly,
      event: { type: "user_transcript", text: "olen maja ees" },
    });
    assert.equal(bagYesOnly.flags.additionalInfoNote.includes("maja ees"), true);
    assert.deepEqual(lineIds(noteTurn.actions), ["closing.additional_info_acknowledged"]);
  }

  // speechEpoch bumps on state transition (stale exact-speech retry guard)
  {
    const bagEpoch = createInitialIiziDeterministicState();
    const e0 = bagEpoch.speechEpoch;
    reduceIiziDeterministicTurn({
      callId: "epoch",
      bag: bagEpoch,
      event: { type: "user_transcript", text: "jah number on sama" },
    });
    bagEpoch.currentState = "ASK_CALLBACK_SAME_NUMBER";
    reduceIiziDeterministicTurn({
      callId: "epoch",
      bag: bagEpoch,
      event: { type: "user_transcript", text: "jah number on sama" },
    });
    assert.ok(bagEpoch.speechEpoch > e0, "speechEpoch increments on transition");
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
