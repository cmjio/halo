import type { PipelineStage } from "./types.js";
import { render } from "./index.js";

/** A stage as one short line, e.g. `Writer.draft` or `|? (score > 3)`. */
export function stageLabel(stage: PipelineStage): string {
  switch (stage.kind) {
    case "expression": return stage.value;
    case "call": return stage.method ? `${stage.callee}.${stage.method}` : stage.callee;
    case "gate": return `|? (${stage.condition})`;
    case "fanout": return `|* { ${stage.stages.map(stageLabel).join(", ")} }`;
    case "branch": return `|? { ${stage.arms.map((a) => `${a.condition === undefined ? "else" : `(${a.condition})`} => ${stageLabel(a.call)}`).join(", ")} }`;
    case "each": return `|* each(${stage.item} in ${render(stage.list)}) => ${stageLabel(stage.call)}`;
    case "interrupt": return "|! yield";
    case "listen": return `~> listen(${stage.target})`;
    case "loop": return `|<> loop(${stage.target}, "${stage.condition}")`;
  }
}
