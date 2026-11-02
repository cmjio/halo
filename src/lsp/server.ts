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

const connection = createConnection(ProposedFeatures.all);
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
        resolveProvider: false
      },
      hoverProvider: true
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

documents.onDidChangeContent(change => {
  const diagnostics = getDiagnostics(change.document.getText());
  connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
});

connection.onCompletion((textDocumentPosition) => {
  const doc = documents.get(textDocumentPosition.textDocument.uri);
  if (!doc) return [];
  return getCompletions(doc.getText(), textDocumentPosition.position);
});

connection.onHover((textDocumentPosition) => {
  const doc = documents.get(textDocumentPosition.textDocument.uri);
  if (!doc) return null;
  return getHover(doc.getText(), textDocumentPosition.position);
});

documents.listen(connection);
connection.listen();
