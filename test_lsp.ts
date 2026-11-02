import { getDiagnostics } from "./src/lsp/diagnostics.js";
import { readFileSync } from "fs";

const content = readFileSync("examples/12-multiple-minds.halo", "utf-8");
console.log("Diagnostics:", getDiagnostics(content));
