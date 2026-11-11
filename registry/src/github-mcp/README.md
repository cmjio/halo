# @halo/github-mcp

GitHub through its official MCP server: repositories, issues, pull requests, code search, and more.

```halo
use "@halo/github-mcp" { GitHubMCP }

tool GH : GitHubMCP()
```

Set `GITHUB_PERSONAL_ACCESS_TOKEN`. It runs GitHub's MCP server in Docker, so it needs Docker and `halo add @halo/github-mcp --trust`.

`halo add github-mcp` installs it (short for `halo add @halo/github-mcp`). `halo tools` then lists its methods and their effects.
