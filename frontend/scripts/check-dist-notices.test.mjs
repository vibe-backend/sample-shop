import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHADCN_MIT, checkNotices } from "./check-dist-notices.mjs";

const pub = readFileSync(new URL("../public/THIRD_PARTY_NOTICES.txt", import.meta.url), "utf8");
const sentences = SHADCN_MIT.replace(/\s+/g, " ")
  .split(/(?<=\.)\s+/)
  .filter((s) => s.length > 0);

describe("check-dist-notices (#112)", () => {
  it("canonical text matches the shipped public notices", () => {
    expect(checkNotices(pub, pub)).toEqual([]);
  });

  it("tolerates rewrapped whitespace in public, but dist must be identical", () => {
    const rewrapped = pub.replace(/\n(?=\w)/g, " ");
    expect(checkNotices(rewrapped, rewrapped)).toEqual([]);
    expect(checkNotices(pub, rewrapped)).toHaveLength(1);
  });

  it.each(sentences.map((s) => [s]))("fails when a sentence is removed: %s", (sentence) => {
    const flat = pub.replace(/\s+/g, " ");
    expect(flat.includes(sentence)).toBe(true);
    const broken = flat.replace(sentence, "");
    expect(checkNotices(broken, broken).length).toBeGreaterThan(0);
  });

  it("fails when dist or public is missing", () => {
    expect(checkNotices(pub, undefined)).toHaveLength(1);
    expect(checkNotices(undefined, undefined)).toHaveLength(2);
  });
});
