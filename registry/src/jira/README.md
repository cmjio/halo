# @halo/jira

Jira Cloud issues: search with JQL, read, create, comment, and transition.

```halo
use "@halo/jira" { Jira }

tool Issues : Jira(site: "acme")
```

Set `JIRA_EMAIL` and `JIRA_API_TOKEN`. Declare it with your site: `Jira(site: "acme")` for acme.atlassian.net.

`halo add jira` installs it (short for `halo add @halo/jira`). `halo tools` then lists its methods and their effects.
