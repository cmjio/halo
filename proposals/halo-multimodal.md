# Halo Multimodal: images and documents as values, and policies that can read them

| | |
|---|---|
| Status | Steps 1 to 4 of the [rollout](#rollout) are built, as [Files](../docs/guide/files.md) (Halo 1.6.0), with the design changes in [What was built](#what-was-built). The rest is a proposal. |
| Date | 19 November 2026 |
| Builds on | Model adapters (`src/runtime/adapter.ts`), policies (`Block`, `Redact`), `Documents`, `Chrome.screenshot`, MCP tool results, schemas, `halo plan` / `replay` / `compare`, the state mirror |

This lives outside `docs/` because everything under `docs/` is published to halolang.com.

## Summary

Halo is text-only. A message to a model is `{ role, content: string }`, and the type reference says multimodal inputs are not supported.

This proposal makes media a value:

- **`Image` and `Document` are types.** A value of one flows through a pipeline like any other. A model sees it when it reaches the prompt: as the flowing value, as an argument, or placed in the text with `{{photo}}`.
- **A `Document` knows its pages, its text, and where each word is.** That is what makes positions exact, and it needs no model.
- **Policies can read media.** `Block`, `Redact` and a new `Flag` can name a tool that looks at an image, so a rule like `Redact(PII)` stays true when the input is a photo.
- **Detection is a tool that returns findings with positions.** Names, addresses, organisations, signatures, logos and objects come back as data a pipeline can gate on, return as JSON, or draw onto the original.

Almost none of this needs new syntax (see [What was tested](#what-was-tested)).

## What exists today

- Adapters for Anthropic, OpenAI-compatible providers, Gemini and Ollama send string content only.
- `Documents` extracts text from text, HTML, CSV, JSON, Word and PDF files, using `pdftotext` when it is installed.
- `Chrome.screenshot` returns `{ mimeType, base64 }` when it isn't given a `path:`. MCP tool results can carry `image` and `audio` items, returned the same way.
- `Block` and `Redact` are patterns over text. `Block(HateSpeech)`, `Tone(...)` and `Anonymize(...)` are listed as not enforced because they would need a model.

### What was tested

The proposed syntax and an image-shaped value were run through Halo 1.5.0.

| Tried | Result |
|---|---|
| `photo: Image`, `-> Image`, `schema Claim { photo: Image }` | Parses. Warns that `Image` is not a declared schema |
| `photo.size < 5000000` in a gate, `{{before}}` in a prompt, `each(page in contract.pages)` | Parses |
| `Flag(SelfHarm)`, `AllowMedia(image, pdf)` | Parses. An unknown rule is an error (since 1.9: a rule that does nothing shouldn't load) |
| `images: [a, b]` on a call, `yield("Approve?", show: a)` | Parses |
| `Block(Nudity, above: 0.8)` | Parses, but reads `above: 0.8` as a second category |
| A list at the head of a pipeline: `[a, b] \|> Eye.look()` | Does not parse |
| A `detector` declaration | Does not parse |
| A 1.5 MB image as `{ mimeType, base64 }` flowing into an agent (model mocked) | Run completes with no warning. The prompt is 2,000,070 characters of base64. `{{photo}}` pastes the whole object into the sentence |
| `Redact(PII)` and `Block(PromptInjection)` over that prompt | 0.9 seconds, no false matches |

Two conclusions. The grammar is not the obstacle; the runtime is. And a value carrying base64 is pasted into a prompt whole when it flows into an agent through the pipeline or a `tool:` argument. (A result an agent's own tool call returns is clipped to 16,000 characters, so a screenshot an agent takes costs at most that much noise, not the whole image. An earlier version of this proposal said tool results had no cap; that was wrong.)

## Goals

- A pipeline that takes an image or a document reads the same as one that takes text.
- No policy becomes quietly untrue because the input is an image.
- Detection returns positions that are exact wherever the page allows it, and says when they are approximate.
- What a page says and what a model infers from it stay visibly separate.
- Replay, compare, checkpoints and the state mirror keep working, with media stored once and referenced by hash.

## Non-goals (for now)

- Realtime voice and live video. A pipeline is request and response.
- Models that answer in images or audio. Generation is a tool that returns an `Image`.
- Identifying people by their face. Faces can be found and blurred, not named.
- Home-made detection of child abuse imagery (see [Limits](#limits)).
- Audio and video as model inputs. `Audio` goes through a transcription tool first.

## Design

### 1. Media values

Types: `Image`, `Document`, `Audio`, and `Media` for any of them. (`File` is already a store, and `Documents` a tool.)

A media value is a reference, never the bytes: `{ sha256, type, size, name }`. The bytes live once in a content-addressed folder under the state directory. Run snapshots, recordings, telemetry and the trace's hash chain carry the reference.

Fields, computed on first read:

| Field | On | Is |
|---|---|---|
| `type`, `size`, `name` | all | The real media type (sniffed from the bytes, not the claimed one), bytes, original name |
| `width`, `height` | `Image` | Pixels |
| `pages` | `Document` | A list of pages; each is an `Image` with `text` and `words` |
| `text` | `Image`, `Document` | The text on it: a PDF's text layer, else OCR |
| `words` | `Image`, `Document` | Each word with its `Box` |
| `images` | `Document` | Embedded pictures with their `Box` (digital PDFs) |

A `Box` is `{ page, x, y, width, height }`, each a fraction of the page, so a result doesn't depend on scan resolution.

Where media comes in:

- `halo run --arg photo=./cat.png`: the parameter's declared type says it is a file.
- `halo serve`: a multipart upload, or a URL. A URL is fetched once at the boundary, checked against private addresses, and stored by hash, so a replay sees the same bytes.
- Tool results: `Chrome.screenshot`, MCP image items, inbound email attachments.

### 2. How a model sees it

One rule: media goes where values go.

```halo
photo |> Inspector.assess("What is damaged?")              // the flowing value
"Compare {{before}} with {{after}}." |> Reviewer.diff()    // placed in the text
email |> Support.reply("Answer this customer.")            // inside an object
```

- A prompt becomes a sequence of parts. `{{photo}}` puts the image at that point.
- An object with media inside is sent with the media lifted out and a label left in its place: `[image 2: invoice.png]`. That label is also what a text log shows, and what a model writes to pass an image to a tool.
- Each adapter translates parts to its provider's format. A model gains an `input` list (`text`, `image`, `pdf`). `halo validate` reports an agent given media on a model that can't read it, including through `@cascade`, `@shadow` and a package's model slots. Media is never dropped silently.
- Provider limits (size, format, page count) are checked before the call. An image over the limit is scaled down, and the run records that it was.
- In a thread or a tool loop, only the newest few images are resent; older ones become their label. `MaxMedia(images: 4, megabytes: 10)` sets the limit as a policy.

### 3. Policies that can read media

Three changes.

**Rules take named arguments.** This fixes the threshold case and lets a rule name the tool that judges:

```halo
tool Eyes : Moderation(openai)

policy Safe : Block(Nudity, Violence, with: Eyes, above: 0.8)
  & Redact(PII, Faces, with: Eyes)
  & Flag(SelfHarm, Abuse, with: Eyes)
```

**Policies fail closed on media.** An agent with a `Block` or `Redact` rule refuses media that no rule of its can read. If the tool a rule names is unavailable, the call is refused. The tool's cost counts toward `MaxSpend`.

**`Flag` records without failing.** A `Block` violation fails the call. For someone describing abuse or self-harm that is the wrong outcome: the run should continue, answer carefully, and bring in a person. `Flag(SelfHarm)` writes the finding to `context.meta.flags`, and the pipeline branches on it.

`Redact` on an image reads its text, runs the existing detectors, and blurs the matching boxes. The blurred copy is what the model, telemetry and Studio get.

The same mechanism makes the text rules listed as not enforced (`Block(HateSpeech)`, `Tone`, `Anonymize`) enforceable.

An agent whose job is to find personal data can't have it redacted on the way in. It needs the opposite: a policy that lets PII in and controls where it goes, and a way to keep the input out of telemetry (`record: findings`), so a private letter is not stored in a prompt log.

### 4. Detection

A `Vision` tool, backed by a model from the project's own providers or a dedicated service:

| Call | Returns |
|---|---|
| `Vision.classify(photo, labels: [...])` | The label and a confidence |
| `Vision.moderate(photo)` | Scores by category |
| `Vision.detect(photo)` | Objects, each with a `Box` |
| `Vision.find(doc, kinds: [...])` | Findings: names, addresses, organisations, dates, amounts, signatures, logos, stamps |
| `Vision.mark(doc, findings)` | The original with a labelled box on each finding |

Positions for text come from the page, not from the model. The model returns the spans it found; the runtime matches each span to `words` and takes the boxes. Positions for pictures come from the PDF when they are embedded, and from the model otherwise, marked approximate.

### 5. A worked case: reading a letter

Upload a letter. Get every name, address and entity with its position, the pictures on it, a summary, how the detections relate, and a marked-up copy.

```halo
schema Finding  { id: String, kind: String, text: String, entity: String, box: Box, confidence: Number }
schema Relation { from: String, to: String, kind: String, why: String, confidence: Number }
schema LetterReport { findings: Array<Finding>, relations: Array<Relation>, summary: String, marked: Document }

pipeline ReadLetter(letter: Document) -> LetterReport:
  letter
    |> Vision.find(kinds: ["person", "address", "organisation", "date", "amount", "signature", "logo", "stamp"]) as findings
    |> Analyst.relate("Which of these refer to the same thing, and how are they connected?") as relations
    |> Analyst.summarise(letter) as summary
    |> Vision.mark(letter, findings) as marked
```

| Asked for | Comes from | How exact |
|---|---|---|
| Names, addresses, entities | A model reads the page text and returns spans; patterns catch emails, phones and postcodes | Good on typed text |
| Positions | Each span matched to word boxes | Exact for typed text |
| Pictures on the page | Embedded images in a digital PDF; a vision model for a scan | Exact for digital, approximate for scans |
| Marked-up copy | Boxes drawn over the original | As exact as the positions |
| Strings or JSON | The schema is the JSON; `format: "text"` renders a readable list | |
| Summary | An agent call | |
| Relationships | A second agent call over the findings, not the image | Inference |

What this case needs beyond the sections above:

- **A mention is not an entity.** "Mr Smith", "John" and "he" are three findings and one person. Each finding carries the `entity` it refers to.
- **Relationships are inference, and say so.** Every relation cites the findings it rests on and gives its reasoning in `why`, with a confidence. The marked-up copy draws inferred links differently from detections, and the summary separates what the letter says from what is inferred.
- **Relating happens after detection, over all pages.** Detection can run per page in parallel. A name on page 1 and an account number on page 3 only connect if one step sees every finding.
- **A file and data come back together.** Over HTTP, `marked` is returned as a link beside the JSON.
- **Schemas need optional fields.** A handwritten word has no reliable box.

## Limits

- **Child abuse imagery** is matched against hash lists that only vetted organisations can use, and finding it brings legal duties to report and not to retain. Halo offers a hook for such a provider and no detector of its own. A deployment that may receive it needs legal advice first.
- **Faces** are restricted by biometric law in several places. Halo finds and blurs them; it does not say whose they are.
- **Boxes from general vision models are approximate.** Blurring a face or a card number reliably needs a dedicated detection service.
- **No detector is certain.** As with the text detectors, these are one layer, not a guarantee.
- **Handwriting** can usually be read by a vision model, but its positions are rough. Skewed or two-column scans need straightening first.
- **Results vary between runs.** Recordings keyed by the document's hash keep replays stable.

## Rollout

1. **Stop base64 reaching a model as text.** Image-shaped tool results become a short label, and any tool result has a size cap. Small, and it fixes a cost problem that exists today.
2. **`Image` and `Document` as types**, the blob folder, inputs from the CLI and `halo serve`, and the Anthropic, OpenAI and Gemini adapters.
3. **Page text with word boxes** on `Document` and `Image`: the PDF text layer, then OCR when it is installed. `Box`, and optional schema fields.
4. **Named arguments in policy rules**, `Block` / `Redact` / `Flag` with a tool, failing closed on media, and `MaxMedia`.
5. **`Vision`**: classify, moderate, detect, find, mark. The letter case as an example and a test.
6. **Around it**: `halo compare` keyed by hash, and pruning files in a state store.

## What was built

Steps 1 to 4 of the rollout shipped in 1.6.0 (step 1 folded into step 2), with Studio thumbnails and the state store carrying files. Building them changed the design above in these ways:

- **No computed fields.** Reading a value's field is synchronous everywhere in the runtime, and a field computed on first read would not be recorded for replay. A reference carries what is cheap to read once (`type`, `size`, `name`, `width`, `height`, `pages`); a document's text is a tool call (`Documents.extract(doc)`), recorded like any other. `pages` as a list, `text`, `words` and `images` as lazy fields are dropped.
- **Labels in text, files beside it.** A media value is a small JSON reference. Wherever a value becomes text it reads as a label (`[image: dent.jpg #3fa2c1]`), and the files among what a prompt was built from are sent with it, each after its own label. Stored conversations, snapshots, recordings and telemetry hold references; bytes are read only when a request is built, so mocks and replays never need them.
- **References are made only from bytes.** A run keeps a list of the files it was given or made; a reference that arrives any other way (in a request, from a model) is refused with `MEDIA_UNKNOWN`.
- **Three ways in.** The CLI reads paths; `halo serve` takes `data:` URIs and https URLs from public addresses only, never paths; tools return `MediaBytes`, and the older `{ mimeType, base64 }` shapes are read too.
- **Fail closed, narrowly.** An agent with `Block` or `Redact` is sent no files unless `AllowMedia(...)` says so; others take files freely. Named arguments in rules, `Flag`, and judging tools are still to come.
- **No raster work.** Halo has no image library, so nothing is resized or blurred: a file over a provider's limit is refused. Blurring on `Redact` and `Vision.mark` need one, and wait for it.
- **`halo push` does not carry files.** They are state, not project; the state store carries them, written as they are made and fetched on demand.

After that: approval pages show the files being approved, hosted packages send and return files inline, and `halo blobs prune` removes files nothing in the state folder mentions. Still open: pruning a state store's own copies, and `halo compare` keyed by file hash.

### More kinds of files

A second round added, under one rule: **a file goes to a model as itself when the model can take it, and otherwise as what the model can read**, with each conversion a recorded `Media` step (mocked by `halo test`, answered by `halo replay`):

- **Tools send files.** POST tools, tool packages and MCP tools send a file's bytes: inline as a `data:` URI in JSON, or as a file part with `body: "multipart"`. An agent passes a file it was shown by writing its label or `#id`.
- **More documents.** `Document` takes Word, PowerPoint, email, CSV, TSV, Markdown, HTML, JSON and text as well as PDF, sniffed from the bytes. They reach models as their text (`Media.text`), where `Redact` and `Block` read them; a deck also goes as a PDF when LibreOffice is installed, and an email's pictures go with it. Uploads: multipart to the run API, and a file picker in Studio.
- **Audio.** An `Audio` type, a `Transcribe` tool (OpenAI or Gemini), and an automatic transcript (`Media.transcript`) for models that can't take audio, priced against `MaxSpend` first. Gemini takes audio directly.
- **Video.** A `Video` type, including YouTube links. Gemini watches it (inline, uploaded to its Files API above 14 MB, or by link); other models get a digest (`Media.digest`): the transcript and about ten frames, via ffmpeg.
- **Text messages.** Webhooks take form posts; a webhook declared with `twilio:` checks Twilio's signature and hands the pipeline `{ from, to, text, media }`, with an optional TwiML reply; an `SMS` tool sends texts.

Not included: Excel and Outlook files, sending pictures by text (MMS), OpenAI's audio-input models (OpenAI gets transcripts), and OCR.

## Open questions

- Is `Flag` the right shape for supporting someone who reports abuse: the run continues and routes to a person?
- Should an agent with no `Block` or `Redact` rule accept media by default, or only with `AllowMedia`?
- Should OCR be bundled, or used only when it is installed, as `pdftotext` is?
- How does `record: findings` interact with `halo replay`, which needs the prompt?
- Which dedicated detection service comes first for accurate boxes?
