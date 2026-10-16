// Fails if the built dist/ is missing the third-party license notices (shadcn MIT, #106).
import { readFileSync } from "node:fs";

const path = new URL("../dist/THIRD_PARTY_NOTICES.txt", import.meta.url);
const required = ["Copyright (c) 2023 shadcn", "Permission is hereby granted, free of charge"];
let text;
try {
  text = readFileSync(path, "utf8");
} catch {
  console.error("dist/THIRD_PARTY_NOTICES.txt is missing; run the build first.");
  process.exit(1);
}
const missing = required.filter((s) => !text.includes(s));
if (missing.length) {
  console.error(`dist/THIRD_PARTY_NOTICES.txt is missing: ${missing.join("; ")}`);
  process.exit(1);
}
console.log("dist/THIRD_PARTY_NOTICES.txt OK");
