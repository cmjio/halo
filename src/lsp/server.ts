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
import { getSignatureHelp, type ProviderLookup } from "./tools.js";
import { loadPackageProviders } from "../registry/resolver.js";
import { projectRoot } from "../linker/node.js";
import type { ProviderInfo } from "../runtime/tools.js";
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
      signatureHelpProvider: { triggerCharacters: ["(", ","], retriggerCharacters: [":"] },
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

/**
 * Installed packages' providers (their methods, for completion), by project. Loaded once per
 * project and again after a minute, so a package installed meanwhile shows up.
 */
const packageInfo = new Map<string, { at: number; info: Map<string, ProviderInfo> }>();
function lookupFor(path: string | undefined): ProviderLookup | undefined {
  if (!path) return undefined;
  const root = projectRoot(path);
  const cached = packageInfo.get(root);
  if (!cached || Date.now() - cached.at > 60_000) {
    const entry = { at: Date.now(), info: cached?.info ?? new Map<string, ProviderInfo>() };
    packageInfo.set(root, entry);
    loadPackageProviders(root)
      .then((loaded) => {
        entry.info = new Map(loaded.filter((p) => p.info).map((p) => [p.name, p.info!]));
      })
      .catch(() => {});
  }
  const info = packageInfo.get(root)!.info;
  return (provider) => info.get(provider);
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
  const path = pathOf(doc.uri);
  const diagnostics = getDiagnostics(doc.getText(), path, openBuffers(), lookupFor(path));
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
  const path = pathOf(doc.uri);
  return getCompletions(doc.getText(), textDocumentPosition.position, path, openBuffers(), lookupFor(path));
});

connection.onHover((textDocumentPosition) => {
  const doc = documents.get(textDocumentPosition.textDocument.uri);
  if (!doc) return null;
  const path = pathOf(doc.uri);
  return getHover(doc.getText(), textDocumentPosition.position, path, openBuffers(), lookupFor(path));
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

connection.onSignatureHelp((params) => {
  const doc = documents.get(params.textDocument.uri);
  const path = doc && pathOf(doc.uri);
  return doc ? getSignatureHelp(doc.getText(), params.position, path, openBuffers(), lookupFor(path)) : null;
});

documents.onDidClose((e) => connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] }));

documents.listen(connection);
connection.listen();
