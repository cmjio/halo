# @acme/hosted-replies

Ticket tagging that runs on your models, and reply drafting that runs on Acme's.

```halo
use "@acme/hosted-replies" { Tag, DraftReply } with models(fast: anthropic/claude-haiku-4-5)

pipeline Answer(ticket: String):
  ticket |> DraftReply(ticket: ticket, tone: "warm")
```

## Model slots

- `fast`: tags tickets with a topic. Any small chat model works.

## Hosted

`DraftReply` is a hosted pipeline: it runs on Acme's server (`hosted.endpoint`), on Acme's
models. Calling it **sends your inputs to Acme**. Set `ACME_REPLIES_KEY` to the key Acme
issued you.

To test without the network, mock it by name: `{ "DraftReply": { "reply": { "text": "...", "tone": "warm" }, "confidence": 0.9 } }`.
