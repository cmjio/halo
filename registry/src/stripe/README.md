# @halo/stripe

Stripe payments: customers, charges, refunds, and balance.

```halo
use "@halo/stripe" { Stripe }

tool Pay : Stripe()
```

Set `STRIPE_API_KEY`. `Stripe(apiKey: Env.OTHER_KEY)` reads another variable.

`halo add stripe` installs it (short for `halo add @halo/stripe`). `halo tools` then lists its methods and their effects.
