#!/usr/bin/env node
/* The booking form's phone number, as it is sent: the country-code picker
 * plus what the guest typed. Runs the real combineDial out of klar-embed.js.
 *
 *   node tools/dial_check.js            exit 0 = every case holds
 *
 * Why: a guest who typed a foreign number with the 00 prefix under the default
 * +358 had it stored as a Finnish number that is not theirs, or was refused
 * (klar-console audit 2026-11-19, WIDGET-01).
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const src = fs.readFileSync(path.join(__dirname, "..", process.argv[2] || "klar-embed.js"), "utf8");
const m = src.match(/function combineDial\(dial, local\) \{[\s\S]*?\n  \}/);
assert(m, "combineDial not found in klar-embed.js");
const combineDial = new Function(m[0] + "; return combineDial;")();

const cases = [
  // [picker, typed, sent]
  ["+358", "040 123 4567", "+358401234567"], // the ordinary Finnish guest
  ["+358", "401234567", "+358401234567"],
  ["+358", "+46 70 123 45 67", "+46701234567"], // a typed + wins over the picker
  ["+46", "070 123 45 67", "+46701234567"], // picker changed, trunk zero dropped
  ["+358", "0046 70 123 45 67", "+46701234567"], // 00 means +, not "Finland"
  ["+358", "001 415 555 0132", "+14155550132"],
  ["+358", "0044 7911 123456", "+447911123456"],
  ["+358", "00358 40 123 4567", "+358401234567"],
];
let failed = 0;
for (const [dial, typed, want] of cases) {
  const got = combineDial(dial, typed);
  if (got !== want) {
    failed++;
    console.log(`FAIL  picker ${dial}, typed "${typed}": sent ${got}, should be ${want}`);
  }
}
if (failed) {
  console.log(`${failed} of ${cases.length} case(s) failed`);
  process.exit(1);
}
console.log(`OK  ${cases.length} phone cases`);
