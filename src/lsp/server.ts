import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InitializeResult,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getDiagnostics } from "./diagnostics.js";
import { getCompletions } from "./completions.js";
import { getHover } from "./hover.js";
import { getDefinition } from "./definition.js";
import { getDocumentHighlights, getDocumentSymbols, getReferences, getRename, prepareRename } from "./symbols.js";
import { fileURLToPath } from "node:url";

// Editors name a transport (--stdio, --node-ipc, ...); `halo lsp` on its own uses stdio.
const connection = process.argv.some((a) => /^--(stdio|node-ipc|socket|pipe)/.test(a))
  ? createConnection(ProposedFeatures.all)
  : createConnection(ProposedFeatures.all, process.stdin, process.stdout);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ['"', "/", "{", ",", ".", "@"]
      },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      documentHighlightProvider: true,
      documentSymbolProvider: true,
      renameProvider: { prepareProvider: true },
    }
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
});

/** A document's file path (undefined for untitled buffers), so `use` lines can be linked. */
function pathOf(uri: string): string | undefined {
  try {
    return uri.startsWith("file:") ? fileURLToPath(uri) : undefined;
  } catch {
    return undefined;
  }
}

/** Unsaved text of every open .halo document, by path: linking reads these before the disk. */
function openBuffers(): Map<string, string> {
  const map = new Map<string, string>();
  for (const doc of documents.all()) {
    const path = pathOf(doc.uri);
    if (path) map.set(path, doc.getText());
  }
  return map;
}

function publish(doc: TextDocument) {
  const diagnostics = getDiagnostics(doc.getText(), pathOf(doc.uri), openBuffers());
  connection.sendDiagnostics({ uri: doc.uri, diagnostics });
}

documents.onDidChangeContent(change => {
  publish(change.document);
  // Files that use this one may have new problems (or fewer).
  for (const other of documents.all()) if (other.uri !== change.document.uri && /\buse\s+["']/.test(other.getText())) publish(other);
});

connection.onCompletion((textDocumentPosition) => {
  const doc = documents.get(textDocumentPosition.textDocument.uri);
  if (!doc) return [];
  return getCompletions(doc.getText(), textDocumentPosition.position, pathOf(doc.uri), openBuffers());
});

connection.onHover((textDocumentPosition) => {
  const doc = documents.get(textDocumentPosition.textDocument.uri);
  if (!doc) return null;
  return getHover(doc.getText(), textDocumentPosition.position, pathOf(doc.uri), openBuffers());
});

connection.onDefinition((params) => {
  const doc = documents.get(params.textDocument.uri);
  const path = doc && pathOf(doc.uri);
  if (!doc || !path) return null;
  return getDefinition(doc.getText(), params.position, path, openBuffers());
});

connection.onReferences((params) => {
  const doc = documents.get(params.textDocument.uri);
  const path = doc && pathOf(doc.uri);
  if (!doc || !path) return [];
  return getReferences(doc.getText(), params.position, path, openBuffers(), params.context.includeDeclaration);
});

connection.onDocumentHighlight((params) => {
  const doc = documents.get(params.textDocument.uri);
  return doc ? getDocumentHighlights(doc.getText(), params.position) : [];
});

connection.onDocumentSymbol((params) => {
  const doc = documents.get(params.textDocument.uri);
  return doc ? getDocumentSymbols(doc.getText()) : [];
});

connection.onPrepareRename((params) => {
  const doc = documents.get(params.textDocument.uri);
  return doc ? prepareRename(doc.getText(), params.position) : null;
});

connection.onRenameRequest((params) => {
  const doc = documents.get(params.textDocument.uri);
  const path = doc && pathOf(doc.uri);
  if (!doc || !path) return null;
  return getRename(doc.getText(), params.position, params.newName, path, openBuffers());
});

documents.onDidClose((e) => connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] }));

documents.listen(connection);
connection.listen();
