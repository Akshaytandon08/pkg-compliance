// The Resources menu's documents: the files exist, their names are the ones the
// user sees, the gate treats them the way we claim it does, and the strings that
// reach the screen pass the language guardrail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { RESOURCES } from "../src/lib/resources.ts";
import { isGatedPath } from "../src/lib/access-gate.ts";
import { findLanguageViolations } from "../src/lib/report/language.ts";

test("every offered document is actually in public/, and is not empty", () => {
  assert.ok(RESOURCES.length > 0, "an empty menu would render a menu with nothing in it");
  for (const r of RESOURCES) {
    const path = new URL(`../public${r.href}`, import.meta.url);
    assert.ok(existsSync(path), `${r.href} is offered in the nav but not present in public/`);
    assert.ok(statSync(path).size > 0, `${r.href} is a zero-byte file`);
  }
});

test("the filename the user receives is the plain-language one", () => {
  for (const r of RESOURCES) {
    const filename = r.href.split("/").pop()!;
    assert.match(filename, /^[A-Za-z0-9-]+\.docx$/, `${filename}: no spaces, versions or internal tokens in a downloaded name`);
    assert.doesNotMatch(filename, /\bv?\d+[._]\d+\b|final|draft|copy/i, `${filename}: carries working-file cruft`);
  }
});

test("the documents stay BEHIND the gate — they are internal guidance, not public", () => {
  // The bypass list is the public surface. Adding /docs there would publish
  // these files; the brief's condition for adding it ("only if the gate would
  // otherwise block a logged-in user") is not met, because Basic Auth is sent by
  // the browser on every same-origin request, downloads included.
  for (const r of RESOURCES) {
    assert.equal(isGatedPath(r.href), true, `${r.href} must not be in the access-gate bypass`);
  }
  // And the genuinely public surfaces are still bypassed, so this change did not
  // disturb them.
  assert.equal(isGatedPath("/passport/abc123"), false);
  assert.equal(isGatedPath("/evidence/abc123"), false);
});

test("every string the menu renders passes the language guardrail", () => {
  for (const r of RESOURCES) {
    for (const text of [r.label, r.description, r.meta]) {
      assert.deepEqual(findLanguageViolations(text), [], `"${text}" trips the guardrail`);
    }
  }
});

test("each entry carries its one-line description and its format/version line", () => {
  for (const r of RESOURCES) {
    assert.ok(r.description.trim().length > 0, `${r.label}: no description`);
    assert.ok(!r.description.includes("\n"), `${r.label}: the description is one line`);
    assert.match(r.meta, /^Word document · v\d+\.\d+ · \d{1,2} \w+ \d{4}$/, `${r.label}: meta line is not in the agreed shape`);
  }
});

test("the nav renders no raw identifier — labels only, and the files download", () => {
  const src = readFileSync(new URL("../src/app/_components/AppNav.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /\.replace\(\/_\/g/, "underscore-stripping instead of a label");
  // `key={r.href}` and `href={r.href}` are attribute uses and are fine; what must
  // not happen is the path reaching the screen as text. Strip the two legitimate
  // attribute positions, then nothing referencing the path may remain.
  const withoutAttributes = src.replace(/(?:key|href)=\{\s*r\.href\s*\}/g, "");
  assert.doesNotMatch(withoutAttributes, /\{\s*r\.href\s*\}/, "renders the file path as visible text");
  // A link to a static file must carry `download`, or the browser navigates to
  // the .docx instead of saving it.
  assert.match(src, /download/, "the resource links must download rather than navigate");
});
