/** Writes docs/openapi.json from the spec in code: npm run openapi:export */
import { writeFileSync } from "node:fs";
import { openApiSpec } from "../src/server/openapi/spec";

writeFileSync("docs/openapi.json", JSON.stringify(openApiSpec, null, 2) + "\n");
console.log("docs/openapi.json written");
