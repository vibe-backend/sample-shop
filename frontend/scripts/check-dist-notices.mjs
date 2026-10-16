// Fails unless the built dist/ ships the complete third-party license notices (shadcn MIT, #106, #112).
// public/THIRD_PARTY_NOTICES.txt must contain the full canonical MIT text below (whitespace-normalised),
// and dist/THIRD_PARTY_NOTICES.txt must be a byte-for-byte copy of it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Canonical copy of shadcn@4.21.4 LICENSE.md (https://unpkg.com/shadcn@4.21.4/LICENSE.md).
export const SHADCN_MIT = `MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const normalise = (s) => s.replace(/\s+/g, " ").trim();

/** Returns a list of problems; empty means the notices are complete. */
export function checkNotices(publicText, distText) {
  const errors = [];
  if (publicText === undefined) errors.push("public/THIRD_PARTY_NOTICES.txt is missing.");
  else if (!normalise(publicText).includes(normalise(SHADCN_MIT)))
    errors.push("public/THIRD_PARTY_NOTICES.txt does not contain the complete shadcn MIT license text.");
  if (distText === undefined) errors.push("dist/THIRD_PARTY_NOTICES.txt is missing; run the build first.");
  else if (publicText !== undefined && distText !== publicText)
    errors.push("dist/THIRD_PARTY_NOTICES.txt differs from public/THIRD_PARTY_NOTICES.txt.");
  return errors;
}

const read = (rel) => {
  try {
    return readFileSync(new URL(rel, import.meta.url), "utf8");
  } catch {
    return undefined;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = checkNotices(read("../public/THIRD_PARTY_NOTICES.txt"), read("../dist/THIRD_PARTY_NOTICES.txt"));
  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  console.log("dist/THIRD_PARTY_NOTICES.txt OK (full MIT text, identical to public/)");
}
