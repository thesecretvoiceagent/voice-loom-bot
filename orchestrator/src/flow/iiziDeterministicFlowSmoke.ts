import assert from "node:assert/strict";
import {
  createInitialIiziDeterministicState,
  isCallbackDifferentNumberRequest,
  isCallbackSameNumberConfirmation,
  reduceIiziDeterministicTurn,
  type IiziDeterministicAction,
} from "./iiziDeterministic.js";
import { resolveIiziLocalizedLine } from "./iiziDeterministicConfig.js";

function lineIds(actions: IiziDeterministicAction[]): string[] {
  return actions
    .filter((a): a is Extract<IiziDeterministicAction, { type: "speak_exact" }> => a.type === "speak_exact")
    .map((a) => a.lineId);
}

function run(): void {
  // Test F: exact deterministic greeting
  assert.equal(
    resolveIiziLocalizedLine("greeting.initial", "et"),
    "Tere!  Kahjuks kõik klienditeenindajad on hetkel hõivatud ning mina olen Iizi A-I kõnerobot Jaanika. Oskan aidata ainult autoabiga seoses. Kõne salvestatakse. Rääkige Teile sobivas keeles. Kuidas saame Teile abiks olla?",
    "greeting.initial exact text",
  );

  // Test A: roadside spoken incident is always generic
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
    assert.equal(aLines.includes("incident.no_start"), false, "A no no_start spoken line");
    assert.equal(aLines.includes("incident.flat_tire"), false, "A no flat_tire spoken line");
    assert.equal(aLines.includes("crm.known"), true, "A crm line");
    assert.equal(turnA.actions.some((a) => a.type === "send_combined_sms"), true, "A combined sms action");
    assert.equal(aLines.includes("occupants.ask"), false, "A no occupants before form");
    assert.equal(aLines.includes("callback.ask_same_number"), false, "A no callback before form");
    const smsTurn = reduceIiziDeterministicTurn({ callId: "A", bag: bagA, event: { type: "combined_sms_result", success: true } });
    assert.deepEqual(lineIds(smsTurn.actions), ["sms.combined.sent_success"], "A sms success line queued");
    assert.equal(bagA.currentState, "WAITING_FOR_FORM_SUBMITTED", "A final waiting state");
    assert.equal(bagA.flags.occupantCountRequired, false, "A flat tire only does not require occupant count");
  }

  // Test 2: category logic still works (occupant requirement retained)
  {
    const bagB = createInitialIiziDeterministicState();
    reduceIiziDeterministicTurn({ callId: "B", bag: bagB, event: { type: "crm_prefetch", callerKnown: false } });
    reduceIiziDeterministicTurn({ callId: "B", bag: bagB, event: { type: "greeting_complete" } });
    const turnB = reduceIiziDeterministicTurn({
      callId: "B",
      bag: bagB,
      event: { type: "user_transcript", text: "rehv tühi ja ma ei saa liikuda" },
    });
    const bLines = lineIds(turnB.actions);
    assert.equal(bLines[0], "incident.generic_roadside", "B generic spoken incident");
    assert.equal(bLines.includes("crm.unknown"), true, "B crm unknown");
    assert.equal(turnB.actions.some((a) => a.type === "send_combined_sms"), true, "B combined sms action");
    assert.equal(bagB.flags.occupantCountRequired, true, "B occupant required");
    assert.equal(bLines.includes("occupants.ask"), false, "B no early occupant ask");
  }

  const bag = createInitialIiziDeterministicState();
  const callId = "flow-smoke";

  reduceIiziDeterministicTurn({
    callId,
    bag,
    event: { type: "combined_sms_result", success: true },
  });
  assert.equal(bag.currentState, "WAITING_FOR_FORM_SUBMITTED", "combined sms -> waiting form");

  const locationFirst = reduceIiziDeterministicTurn({
    callId,
    bag,
    event: { type: "location_confirmed", address: "Sihi 46, Tallinn" },
  });
  assert.equal(locationFirst.transitionReason, "location_before_vehicle_gate", "location before vehicle is buffered");
  assert.equal(lineIds(locationFirst.actions).length, 0, "no location speech before vehicle match");

  const formTurn = reduceIiziDeterministicTurn({
    callId,
    bag,
    event: { type: "form_submitted", submittedReg: "111AAA" },
  });
  assert.deepEqual(lineIds(formTurn.actions), [], "form registration line suppressed before combined readback");
  assert.equal(bag.currentState, "WAITING_FOR_VEHICLE_LOOKUP", "form -> waiting vehicle lookup");

  const vehicleTurn = reduceIiziDeterministicTurn({
    callId,
    bag,
    event: { type: "vehicle_lookup_result", match: true, coverageInvalid: false },
  });
  const vehicleLines = lineIds(vehicleTurn.actions);
  assert.equal(
    vehicleLines.filter((id) => id === "vehicle_location.combined.readback").length,
    1,
    "single combined vehicle+location readback",
  );
  assert.equal(vehicleLines.includes("vehicle.match_active.readback"), false, "no separate vehicle readback");
  assert.equal(vehicleLines.includes("location.received.readback"), false, "no separate location readback");
  assert.equal(vehicleLines.includes("callback.ask_same_number"), true, "callback ask after combined readback");
  assert.equal(bag.flags.locationConfirmed, true, "pending location consumed after vehicle");

  // Test 4/5: callback ask is mandatory when no occupant gate remains
  assert.equal(
    lineIds(vehicleTurn.actions).includes("callback.ask_same_number"),
    true,
    "D callback ask mandatory after vehicle+location",
  );

  // Test E: same-number callback confirmation and closing order
  const callbackYes = reduceIiziDeterministicTurn({
    callId,
    bag,
    event: { type: "user_transcript", text: "jah" },
  });
  assert.deepEqual(
    lineIds(callbackYes.actions),
    ["callback.same_number_confirmed", "handoff.normal_partner", "closing.anything_else"],
    "E callback yes -> handoff + closing question",
  );
  const closingNo = reduceIiziDeterministicTurn({
    callId,
    bag,
    event: { type: "user_transcript", text: "ei" },
  });
  assert.deepEqual(lineIds(closingNo.actions), ["closing.goodbye"], "E close only after caller no");

  // Test 2: waiting-for-SMS help exact line
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
      "Mul ei ole Teie andmeid veel kätte saanud. Saatsin Teile SMS-i. Palun vajutage lingile, kerige alla, sisestage auto registreerimismärk, kinnitage asukoht ja vajutage Kinnita.",
      "waiting SMS help exact ET text",
    );
  }

  // Test 5/6: callback different vs same number
  {
    const bagCb = createInitialIiziDeterministicState();
    bagCb.currentState = "ASK_CALLBACK_SAME_NUMBER";
    bagCb.flags.incidentCategory = "flat_tire";
    assert.equal(isCallbackDifferentNumberRequest("soovin mõnda muud numbrit"), true, "different number detect");
    const diffTurn = reduceIiziDeterministicTurn({
      callId: "cb-diff",
      bag: bagCb,
      event: { type: "user_transcript", text: "soovin mõnda muud numbrit" },
    });
    assert.deepEqual(diffTurn.actions, [{ type: "send_callback_sms" }], "different number sends callback SMS only");
    assert.equal(bagCb.currentState, "SEND_CALLBACK_SMS", "transition to send callback SMS");

    const bagSame = createInitialIiziDeterministicState();
    bagSame.currentState = "ASK_CALLBACK_SAME_NUMBER";
    assert.equal(isCallbackSameNumberConfirmation("jah sobib"), true, "same number detect");
    const sameTurn = reduceIiziDeterministicTurn({
      callId: "cb-same",
      bag: bagSame,
      event: { type: "user_transcript", text: "jah sobib" },
    });
    assert.equal(sameTurn.actions.some((a) => a.type === "send_callback_sms"), false, "same number no callback SMS");
    assert.equal(lineIds(sameTurn.actions).includes("callback.same_number_confirmed"), true, "same number confirmed line");
  }

  const bag2 = createInitialIiziDeterministicState();
  reduceIiziDeterministicTurn({ callId: "flow-smoke-2", bag: bag2, event: { type: "combined_sms_result", success: true } });
  reduceIiziDeterministicTurn({ callId: "flow-smoke-2", bag: bag2, event: { type: "form_submitted" } });
  const secondForm = reduceIiziDeterministicTurn({
    callId: "flow-smoke-2",
    bag: bag2,
    event: { type: "form_submitted", submittedReg: "222BBB" },
  });
  assert.equal(lineIds(secondForm.actions).includes("form.registration.received"), false, "form line suppressed on resubmit");

  // Test 3: waiting states must never ask occupant/callback early
  const waitFormTurn = reduceIiziDeterministicTurn({
    callId: "WF",
    bag: createInitialIiziDeterministicState(),
    event: { type: "user_transcript", text: "tere" },
  });
  assert.equal(lineIds(waitFormTurn.actions).includes("occupants.ask"), false, "No early occupants ask in waiting flow smoke");

  console.log("[iizi-deterministic-flow-smoke] OK (P0 chain + UX fixes)");
}

run();
