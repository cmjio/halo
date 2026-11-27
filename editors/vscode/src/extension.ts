import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // The server is implemented in the bundled server.js file
  const serverModule = context.asAbsolutePath(
    path.join('server.js')
  );

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] }
    }
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: 'file', language: 'halo' }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    }
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'haloLanguageServer',
    'Halo Language Server',
    serverOptions,
    clientOptions
  );

  // In Restricted Mode the server doesn't start: it reads the project's installed packages, and a
  // folder nobody has trusted yet shouldn't get that far. It starts once the folder is trusted.
  if (workspace.isTrusted) {
    client.start();
  } else {
    context.subscriptions.push(workspace.onDidGrantWorkspaceTrust(() => client.start()));
  }
}

export function deactivate(): Thenable<void> | undefined {
  if (!client || !client.isRunning()) {
    return undefined;
  }
  return client.stop();
}
