import { getHover } from "../src/lsp/hover.js";
import { readFileSync } from "fs";

const sourceText = readFileSync("./examples/17-rest-tool.halo", "utf-8");

// Test hover over WeatherAPI tool
console.log("Hovering WeatherAPI:");
console.log(JSON.stringify(getHover(sourceText, { line: 13, character: 11 }), null, 2));

// Test hover over GetWeather pipeline
console.log("\nHovering GetWeather:");
console.log(JSON.stringify(getHover(sourceText, { line: 16, character: 11 }), null, 2));
