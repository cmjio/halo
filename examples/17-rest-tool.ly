// ============================================================
// STEP 17: REST Tool Usage
// ============================================================
// LEARN: How to define and call REST API tools
// WHY:  Integrate external APIs into your pipeline
// ============================================================

// Define a REST API tool
tool WeatherAPI : REST("api.openweathermap.org/data/2.5", apiKey: Env.OWM_KEY)

guardrail NoSensitive : Redact(APIKey) & Redact(Location)

mind Analyst [openai/gpt-4o, temp: 0.3]
  equips WeatherAPI
  requires NoSensitive

stream GetWeather(city: String) -> Result:
  city
    // Call REST API with named args
    // GET https://api.openweathermap.org/data/2.5/weather?q={city}&appid={key}
    |> Analyst.fetch(
        tool: WeatherAPI,
        path: "/weather",
        query: "q={{city}}&units=metric"
      )
    |> Analyst.prompt("Summarize the weather data")
    |> System.Print()

// REST tool syntax:
//   tool Name : REST("base.url", apiKey: Env.KEY)
//
// In pipeline:
//   Mind.method(tool: ToolName, path: "/path", query: "key=value")
