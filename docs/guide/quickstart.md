# Quickstart

Welcome to Halo! This guide will get you from zero to a working AI agent workflow in under 5 minutes.

## 1. Installation

You can install the Halo CLI globally via npm, bun, or yarn.

```bash
npm install -g @halo-lang/cli
```

## 2. Initialize a Project

Create a new directory for your workflow and run `halo init`.

```bash
halo init my-bot
cd my-bot
```

This will scaffold a basic project structure:
- `src/main.halo`: Your primary workflow file.
- `halo.json`: Configuration for the runtime.
- `.env.example`: Template for your API keys.

## 3. Configure API Keys

Copy the `.env.example` file to `.env` and add your OpenAI or Anthropic API key.

```bash
cp .env.example .env
```

Open `.env` and add:
```env
HALO_API_KEY="sk-..."
```
*(Note: If you use the `--local` flag during init, you can use local Ollama models with no API key needed).*

## 4. Write Your First Pipeline

Open `src/main.halo`. You will see something like this:

```halo
// Define an agent with a specific model and temperature
agent Bot [openai/gpt-4o-mini, temp: 0.7]
  system "You are a helpful pirate assistant. Speak like a pirate."

// Define a pipeline that takes a String and returns a Result
pipeline Chat(message: String) -> Result:
  message
    |> Bot.prompt("Reply to the user: {{message}}")
    |> System.Print()
```

## 5. Run It!

Use the `halo run` command to execute your pipeline directly from the terminal. Pass arguments using the `--args` flag as JSON.

```bash
halo run src/main.halo --args '{"message": "How do I make a cake?"}'
```

**Output:**
```
Ahoy matey! To bake a proper cake, ye'll need some flour, sugar, and a hearty dash of rum...

✅ Execution finished.
```

## Next Steps
- Learn about the [Core Concepts](./concepts.md) of Halo's state-machine architecture.
- Check out the [Escape Hatch SDK](./sdk.md) to learn how to embed this pipeline into your existing Node.js or Next.js app!
