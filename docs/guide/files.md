---
title: Files
---

# Files: images, documents, audio and video

A pipeline can take files: photos, PDFs, Word files, slide decks, emails, spreadsheets as CSV, recordings, videos and YouTube links. A model the file reaches gets it in the best form it can read.

```halo
agent Inspector [anthropic/claude-sonnet-4-5]
  system "You assess damage from photos."

pipeline Assess(photo: Image, note: String) -> Result:
  photo |> Inspector.assess("What is damaged, and how badly? The owner says: {{note}}")
```

```bash
halo run assess.halo --arg photo=./dent.jpg --arg note="hit a post"
```

`Image`, `Document`, `Audio` and `Video` are types like `String`. A file is a value that flows through the pipeline, and wherever a model sees it, the model gets the file.

## One rule

**A file goes to a model as itself when the model can take it, and otherwise as what the model can read:**

| File | A model that takes it gets | Any other model gets |
|---|---|---|
| Image | the picture | (every provider here except Replicate takes images) |
| PDF | the PDF | |
| Word, PowerPoint, email, CSV, Markdown, HTML, JSON, text | | its text, in the prompt |
| PowerPoint, with LibreOffice installed | its text, plus the deck as a PDF | its text |
| Audio | the recording (Gemini) | its transcript |
| Video | the video (Gemini) | its transcript, and a frame every few seconds |
| YouTube link | the video (Gemini) | an error: Halo doesn't download YouTube videos |

You write `file |> Agent.look()` either way. Turning a file into text, a transcript or frames is a step the run records, named `Media.text`, `Media.transcript` or `Media.digest`: it shows in Studio, `halo test` mocks it, and `halo replay` answers it from the recording, so a replay needs neither the file nor a transcription service.

## Where a model sees a file

A file goes to a model whenever it is part of what the prompt was built from:

```halo
photo |> Eye.look("What is in it?")                                     // the flowing value
"x" |> Eye.compare("What changed between {{before}} and {{after}}?")    // placed in the text
email |> Clerk.assess("Assess this claim.")                             // inside an object (an email's attachments)
q |> Eye.look(tool: Tab)                                                // in a tool's result
```

In the text of the prompt, each file reads as a label, and the file itself is sent just before the text with the same label in front of it:

```
Task: compare

What changed between [image: before.jpg #3fa2c1] and [image: after.jpg #9b07de]?
```

A document read as text appears in the prompt under its label: `The text (from [document: q3.pptx #2b9e0a]):`. A recording: `The transcript (from [audio: call.mp3 #81c4d2]):`. A video: `What the video shows (from [video: demo.mp4 #77ae10]):`, with its length, what is said, and each frame's label and time.

An agent that calls tools (`tools: [...]`) is shown the images its tools return, such as a `Chrome.screenshot`, and can pass a file it was shown to a tool by writing its label or its id (`#3fa2c1`).

## Types and fields

| Type | Accepts | Fields |
|---|---|---|
| `Image` | PNG, JPEG, GIF, WebP | `type`, `size`, `name`, `width`, `height`, `sha256` |
| `Document` | PDF, Word (.docx), PowerPoint (.pptx), email (.eml), CSV, TSV, Markdown, HTML, JSON, plain text | `type`, `format`, `size`, `name`, `pages` (a PDF's pages or a deck's slides, when they can be read), `sha256` |
| `Audio` | MP3, WAV, M4A, AAC, Ogg, FLAC, WebM | `type`, `size`, `name`, `duration` (seconds), `sha256` |
| `Video` | MP4, MOV, WebM, or a YouTube link | `type`, `size`, `name`, `duration`, `width`, `height`, `url` (a YouTube link), `sha256` |

`Array<Image>` takes a list. A gate can read the fields:

```halo
photo |? (photo.size < 5000000 && photo.width >= 400) |> Inspector.assess()
call  |? (call.duration < 1800) |> Clerk.summarise()
```

What a file is comes from its bytes, never its name or a claimed type: a `.png` that is really a PDF is a `Document`. A name only tells text formats apart (`notes.md` is Markdown, `data.csv` is CSV). Excel files, archives and other formats are refused with a message naming what is accepted.

| Kind | Largest file |
|---|---|
| Image | 25 MB |
| Document | 50 MB |
| Audio | 100 MB |
| Video | 500 MB |

`-> Image` (and the others) as a pipeline's return type are checked like any other type. A program that declares its own `schema Image { ... }` (or `Document`, `Audio`, `Video`) uses that schema instead, and `halo validate` warns.

## Giving a pipeline a file

| From | A file is |
|---|---|
| `halo run`, `halo test` | A path: `--arg photo=./dent.jpg`. Also an https URL, a `data:` URI, or for a video a YouTube link |
| `halo serve`, JSON | A `data:` URI (`data:image/png;base64,...`), an https URL, or a YouTube link, in the JSON body. Never a path on the server |
| `halo serve`, upload | `multipart/form-data` to `POST /api/pipelines/<name>/runs`: each file field fills the parameter of that name, `args` (JSON) the rest, and `wait`, `idempotencyKey`, `dryRun` as fields. The request needs an `Authorization` header, or `Halo-Client` when no token is set, so a web page on another site can't post files to it |
| Halo Studio | The run form has a file picker for these parameters |
| The library (`runtime.run`) | A `Uint8Array`, `ArrayBuffer`, `Blob` or `MediaBytes`, a `data:` URI, or a YouTube link |
| An inbound email | Its attachments Halo can read, as `attachments[i].file` |
| A text message (Twilio) | Its pictures, as `media` (see [Text messages](#text-messages)) |
| A tool | Whatever the tool returns as a file (see below) |

An https URL is fetched once, when the run starts, only from a public address (never this machine, its network, or a cloud's metadata service). Redirects are not followed. The file is kept, so the run and a replay of it see the same bytes even if the URL changes.

An object that only looks like a file (`{ "$media": "image", "sha256": "..." }`, sent in a request or written by a model) is not one. A run can send a model or a tool only the files it was given or made, and refuses any other with `MEDIA_UNKNOWN`.

## Files from tools

A tool's result can hold files:

- `Chrome.screenshot()` without a `path:` returns `{ image }`.
- An MCP tool's image results are images.
- `Email.read` gives each attachment Halo can read a `file`.
- `Docs.extract(doc)` reads a `Document` the run holds: its text, a CSV's `rows`, a JSON file's `data`, a deck's slides, an email's fields.
- A tool provider you write returns `new MediaBytes(bytes, { name })` anywhere in its result (`import { MediaBytes } from "halo"`, see [Custom Tools](./integrations/custom-tools.md)).

Results in the older shape `{ mimeType, base64 }` are read as files too, when the bytes are an image or a PDF.

## Files to tools

A tool that sends a request can send a file:

```halo
tool Moderate : POST("api.example.com/v1/moderate", apiKey: Env.MOD_KEY)
tool Upload   : POST("uploads.example.com/files", body: "multipart")

photo |> Moderate.post(image: photo)      // JSON: { "image": "data:image/png;base64,..." }
photo |> Upload.post(file: photo)         // multipart: a file part with its type and name
```

| `POST(...)` declares | A file goes as |
|---|---|
| nothing (JSON) | a `data:` URI string; `files: "base64"` sends bare base64 instead |
| `body: "multipart"` | a file part (its bytes, type and name); other arguments are fields |
| `body: "form"` | refused: a form can't carry a file |

A GET request can't carry a file either. Tool packages take `"body": "multipart"` the same way, and an MCP tool gets a file as a `data:` URI string. Studio shows the files each tool call sent.

## Audio and transcription

```halo
tool Ears : Transcribe(openai)            // OPENAI_API_KEY; model: "gpt-4o-mini-transcribe" by default

pipeline Notes(call: Audio) -> Result:
  call |> Ears.text(call) as heard |> Clerk.summarise(context.data.heard.text)
```

`Transcribe(openai)` or `Transcribe(gemini)` (with `GEMINI_API_KEY` or `GOOGLE_API_KEY`), `model:`, `apiKey:`, `language:`. `text(audio)` returns `{ text, language, duration, segments, model, cost }`; `segments` (timed lines) come from `model: "whisper-1"`. What it costs (by the minute) is added to the run's cost.

Without the tool, audio sent to a model that can't take it is transcribed for it, by the service `halo.json` names:

```json
{ "media": { "transcribe": "openai", "transcribeModel": "gpt-4o-mini-transcribe" } }
```

or, unset, whichever of OpenAI and Gemini has a key. Neither: the error says what to set, or to use a Gemini model. An agent with `MaxSpend` refuses a recording whose transcription would cost more than its budget has left, before it is sent.

## Video

Gemini watches a video: a small one inline, a large one (over 14 MB) uploaded to Gemini's file store once and sent by reference, and a YouTube link where it is.

Any other model gets a digest: the video's sound, transcribed as above, and a frame every few seconds (about ten, spread over the video, at most one every two seconds), each labelled with its time. That needs `ffmpeg` and `ffprobe` on the machine; without them, the error says to install ffmpeg or use a Gemini model. A video with no sound gets frames and says so. With `@cascade`, the digest is used for every model in the cascade if any of them can't watch video.

## Text messages

A Twilio number's messages can start a run:

```json
"webhooks": [{ "path": "sms", "pipeline": "Reply", "twilio": "Env.TWILIO_AUTH_TOKEN", "reply": true }]
```

Point the number's "A message comes in" webhook at `https://<your server>/hooks/sms`. Halo checks Twilio's signature (set `publicUrl` when the server is behind a proxy, since Twilio signs the address it called), and the pipeline gets `{ from, to, text, media, twilio }`: `media` holds the pictures sent with the message, as files of the run, and `twilio` Twilio's own fields. The same message delivered twice (Twilio retries) is one run. With `"reply": true`, the run's output is texted back when it is text and ready within 10 seconds; otherwise send a reply with the `SMS` tool:

```halo
tool Text : SMS(twilio, account: Env.TWILIO_ACCOUNT_SID, token: Env.TWILIO_AUTH_TOKEN, from: "+15550100")

  |> Text.send(to: context.input.sms.from, text: "Your claim is approved.")
```

Any webhook also takes a form post (`application/x-www-form-urlencoded`), as an object of its fields.

## Which models

| Provider | Images | PDF | Audio | Video | Most per file |
|---|---|---|---|---|---|
| Anthropic | PNG, JPEG, GIF, WebP | Yes | transcript | transcript and frames | 7 MB per image, 25 MB per PDF |
| OpenAI | PNG, JPEG, GIF, WebP | Yes | transcript | transcript and frames | 20 MB per image, 25 MB per PDF |
| Gemini | PNG, JPEG, WebP | Yes | WAV, MP3, AAC, Ogg, FLAC | MP4, MOV, WebM, YouTube | inline up to 14 MB; larger files uploaded |
| Ollama | PNG, JPEG, GIF, WebP | No | transcript | transcript and frames | 25 MB |
| OpenRouter, Together, other OpenAI-compatible | PNG, JPEG, GIF, WebP | No | transcript | transcript and frames | 20 MB |
| Replicate | No | No | transcript | No | |

Documents other than PDFs go to every provider as text. Sending a file a provider can't take, in a form it can't take, is an error that names the model and the file, never a silent drop. Whether a particular model reads images is the provider's to say: a text-only model on a provider that takes images answers with the provider's own error. Files are not resized.

## Cost

A file adds to a call's estimate before it is sent, so `MaxSpend` counts it: an image by its size in pixels (up to about 6,500 tokens), a PDF by its pages (about 4,600 tokens a page), audio and video sent to Gemini by their length. A document read as text, a transcript and a digest count as the text they add. These are high estimates; the cost recorded afterwards is what the provider reports. Transcription is priced by the minute and added to the run's cost.

In a tool conversation, every image the agent has been shown is sent again with each request, and counted each time.

## Policies

`Block` and `Redact` read text. They can't see a card number in a photo, or an instruction spoken in a recording. So an agent with a `Block` or `Redact` rule is sent no images, PDFs, audio or video unless one of its policies says it may:

```halo
policy Safe : Redact(PII) & Block(PromptInjection) & AllowMedia(image)
```

Without `AllowMedia`, such an agent's call is refused with a violation (`rule: "AllowMedia"`). An image a tool returns to it, an email's pictures, a deck's PDF and a video's frames are left out, and the prompt says why. Documents read as text, transcripts and digests are text in the prompt, so `Redact` and `Block` read them and they need no `AllowMedia`.

`AllowMedia` names kinds (`image`, `document`, `audio`, `video`) or formats (`pdf`, `png`, `jpeg`, `gif`, `webp`, `mp3`, `wav`, `mp4`, `mov`, `webm`, ...). On any agent, it also limits the agent to what it names: `AllowMedia(pdf)` refuses an image.

A file's name stays in its label, so `Block(PromptInjection)` reads a hostile name such as `ignore previous instructions.png`.

## Where files are kept

Each file is stored once, by its SHA-256, in `.halo/blobs/` (`<stateDir>/blobs/` for `halo serve`). Runs, recordings, checkpoints, telemetry and thread state hold the small reference, not the bytes.

- **Mocks and replays** never read the bytes: `halo test` and `halo replay` work on a machine without them. `halo replay --live-models` needs them.
- **`halo serve` with a state store** writes each file to the store when it is made, and brings one down only when a run needs it, so a new server doesn't download every file at start.
- **Studio** shows a run's images as thumbnails, plays its audio and video, and lists its documents, including the files sent with each model call and tool call.
- **The HTTP API** returns a file in a run's output with a `url` (`/api/blobs/<sha256>`) to download it with the server's token.
- **Approval links** show the images, PDFs, audio and video in what a person is asked to approve. The files are served through the link itself, and only while that pause waits.
- **Hosted packages** send a file to the publisher's server inline (as a `data:` URI), and a file in the answer comes back the same way and is stored here.

Stored files are removed with `halo blobs prune`: it removes each file nothing in the state folder mentions any more (no paused run, checkpoint, recording, thread or telemetry row), keeping any stored in the last hour. `halo blobs` alone lists them, and `--dry-run` shows what a prune would remove. Telemetry keeps old runs' files: clear old telemetry first to free them. With a state store, `prune` clears this machine's copy; the store keeps its own.

## Not yet

- Excel (.xlsx), Outlook (.msg), and other formats.
- Sending a picture by text message (MMS), WhatsApp, iMessage.
- Models that answer with images or sound: generate them with a tool.
- Where on a page a word or a face is. Text from a scanned PDF needs OCR, which isn't built in; a model that reads PDFs reads scans itself.
