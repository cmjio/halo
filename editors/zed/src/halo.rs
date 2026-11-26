//! Starts Halo's language server, `halo lsp`, for .halo files.
//!
//! It runs the `halo` on the PATH of the project's shell (the one the install script, npm,
//! or Homebrew put there), so the editor checks files with the same Halo that runs them.
//! `lsp.halo.binary.path` in Zed's settings points it at another one (a checkout's
//! `bun index.ts` wrapper, for instance).
use zed_extension_api::{self as zed, settings::LspSettings, LanguageServerId, Result};

struct Halo;

impl zed::Extension for Halo {
    fn new() -> Self {
        Halo
    }

    fn language_server_command(&mut self, id: &LanguageServerId, worktree: &zed::Worktree) -> Result<zed::Command> {
        let binary = LspSettings::for_worktree(id.as_ref(), worktree).ok().and_then(|s| s.binary);
        let args = binary.as_ref().and_then(|b| b.arguments.clone()).unwrap_or_else(|| vec!["lsp".into(), "--stdio".into()]);
        let env = binary.as_ref().and_then(|b| b.env.clone()).map(|e| e.into_iter().collect()).unwrap_or_default();
        let command = match binary.and_then(|b| b.path) {
            Some(path) => path,
            None => worktree.which("halo").ok_or_else(|| {
                "Halo isn't installed, or isn't on your PATH: install it with \
                 `curl -fsSL https://halolang.com/install.sh | sh` (or `npm i -g @halolang/halo`), \
                 then restart the language server"
                    .to_string()
            })?,
        };
        Ok(zed::Command { command, args, env })
    }
}

zed::register_extension!(Halo);
