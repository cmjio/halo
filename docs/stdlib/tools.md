# Built-in Tools

Halo ships with a standard library of Tools designed to handle the most common enterprise networking requirements without needing to drop into TypeScript.

## `REST`

Executes a standard HTTP request.

**Parameters:**
- `url`: String (Required)
- `method`: String (Optional, defaults to `"GET"`)
- `headers`: JSON (Optional)

```halo
tool Stripe : REST("api.stripe.com/v1/charges", method: "POST")

agent BillingAgent [openai/gpt-4o]
  equips Stripe
```

## `System.Print`

A debug tool that outputs the current context to the console.

```halo
context |> System.Print()
```

## `BrowserTool` (Coming Soon)

A headless browser automation tool built on Playwright. Allows an agent to navigate to a URL, extract the DOM, and click elements.

```halo
tool Scraper : BrowserTool()
```

## `PostgreSQL` (Coming Soon)

Executes safe, parameterized SQL queries against a Postgres database. 

```halo
tool DB : PostgreSQL(Env.DB_URI)
```
