import { LanglyParser } from "./src/parser/index.ts";
import * as fs from "fs";

const input = fs.readFileSync("examples/45-market-insurance.ly", "utf-8");
try {
  const parser = new LanglyParser();
  const ast = parser.parse(input);
  console.log("Success!");
} catch (e) {
  console.error("Parse Error:");
  console.error(e);
}
