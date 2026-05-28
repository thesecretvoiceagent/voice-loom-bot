import assert from "node:assert/strict";
import {
  createInitialIiziDeterministicState,
  reduceIiziDeterministicTurn,
  type IiziDeterministicAction,
} from "./iiziDeterministic.js";

function lineIds(actions: IiziDeterministicAction[]): string[] {
  return actions
    .filter((a): a is Extract<IiziDeterministicAction, { type: "speak_exact" }> => a.type === "speak_exact")
    .map((a) => a.lineId);
}

function run(): void {
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
  assert.deepEqual(lineIds(formTurn.actions), ["form.registration.received"], "form line spoken once");
  assert.equal(bag.currentState, "WAITING_FOR_VEHICLE_LOOKUP", "form -> waiting vehicle lookup");

  const vehicleTurn = reduceIiziDeterministicTurn({
    callId,
    bag,
    event: { type: "vehicle_lookup_result", match: true, coverageInvalid: false },
  });
  assert.deepEqual(
    lineIds(vehicleTurn.actions),
    ["vehicle.match_active.readback", "location.received.readback", "callback.ask_same_number"],
    "vehicle match then pending location then callback gate",
  );
  assert.equal(bag.flags.locationConfirmed, true, "pending location consumed after vehicle");

  const bag2 = createInitialIiziDeterministicState();
  reduceIiziDeterministicTurn({ callId: "flow-smoke-2", bag: bag2, event: { type: "combined_sms_result", success: true } });
  reduceIiziDeterministicTurn({ callId: "flow-smoke-2", bag: bag2, event: { type: "form_submitted" } });
  const secondForm = reduceIiziDeterministicTurn({
    callId: "flow-smoke-2",
    bag: bag2,
    event: { type: "form_submitted", submittedReg: "222BBB" },
  });
  assert.equal(
    lineIds(secondForm.actions).includes("form.registration.received"),
    true,
    "reg payload form is not deduped by generic key",
  );

  console.log("[iizi-deterministic-flow-smoke] OK");
}

run();
