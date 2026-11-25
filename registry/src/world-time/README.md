# @halo/world-time

Time zones without an API: the time anywhere, and converting a time between zones.

```halo
use "@halo/world-time" { WorldTime }

tool Clock : WorldTime()
```

No key. It runs its own code (time zone arithmetic, no network), so it needs `halo add @halo/world-time --trust`.

`halo add world-time` installs it (short for `halo add @halo/world-time`). `halo tools` then lists its methods and their effects.
