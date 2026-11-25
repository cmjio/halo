# @halo/cloudflare

Cloudflare: Workers, KV, D1, R2, Pages and Queues in an account; DNS records, settings and cache purges in a zone.

```halo
use "@halo/cloudflare" { Cloudflare, CloudflareZone }

tool CF : Cloudflare(account: "<account id>")
tool Zone : CloudflareZone(zone: "<zone id>")
```

Set `CLOUDFLARE_API_TOKEN`. Declare `Cloudflare` with your account ID and `CloudflareZone` with a zone ID.

`halo add cloudflare` installs it (short for `halo add @halo/cloudflare`). `halo tools` then lists its methods and their effects.
