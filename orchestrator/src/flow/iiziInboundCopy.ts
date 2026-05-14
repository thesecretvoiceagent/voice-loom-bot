/**
 * Deterministic Estonian copy + policy strings for IIZI combined inbound voice flow.
 * Keep prompts and controlled-response instructions aligned with these constants.
 */

/** Controlled assistant turn after `non_roadside` intent — no SMS, no office number offers. */
export const IIZI_NON_ROADSIDE_HANDOFF_INSTRUCTION_ET =
  "Ütle AINULT üks lühike lause eesti keeles, sõna-sõnalt (ärge lisage tervitust ega küsimusi): " +
  "See liin on mõeldud autoabi jaoks. Edastan Teie pöördumise klienditeenindusele, kes võtab Teiega ühendust esimesel võimalusel. " +
  "Ära küsi kontorinumbrit ega paku kontakti numbrit. Ära luba ega saada ühtegi SMS-i.";

/** Required occupant-count wording (accident / tow / stranded / non-movable / ei käivitu / ei liigu jms). */
export const IIZI_OCCUPANT_COUNT_QUESTION_ET = "Mitu inimest on autos koos juhiga?";

/** Default inbound callback = same CLI; statement (not a question). */
export const IIZI_DEFAULT_SAME_CALLBACK_LINE_ET =
  "Kasutame tagasihelistamiseks sama numbrit, millelt helistasite.";

/** Substrings the assistant must never say (Estonian variants). */
export const IIZI_FORBIDDEN_OFFICE_PHRASE_SUBSTRINGS = [
  "kontori number",
  "kontorinumber",
  "kontori numbri",
  "kontorinumbri",
] as const;

/** For docs / tests — forbidden list as one regex-friendly note. */
export const IIZI_FORBIDDEN_OFFICE_PHRASES_PROMPT_BLOCK = `Ei tohi kunagi kasutada ega väänata neid sõnastikke (eesti keeles): ${IIZI_FORBIDDEN_OFFICE_PHRASE_SUBSTRINGS.join(
  ", ",
)}. Ära paku kontorinumbrit ega küsi, kas helistaja soovib kontorinumbrit.`;

/** Returns which forbidden substrings appear in `text` (case-insensitive). */
export function findForbiddenIiziOfficePhraseViolationsEt(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const sub of IIZI_FORBIDDEN_OFFICE_PHRASE_SUBSTRINGS) {
    if (lower.includes(sub.toLowerCase())) hits.push(sub);
  }
  return hits;
}
