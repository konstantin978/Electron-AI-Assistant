import type { Tool } from "./types.js";

const TAVILY_URL = "https://api.tavily.com/search";
const DEFAULT_RESULTS = 5;
const MIN_RESULTS = 1;
const MAX_RESULTS = 10;

type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
};

type TavilyResponse = {
  answer?: string;
  results: TavilyResult[];
};

const formatResults = (data: TavilyResponse): string => {
  const parts: string[] = [];
  if (data.answer) parts.push(`Quick answer: ${data.answer}`);
  if (data.results.length > 0) {
    parts.push("Sources:");
    data.results.forEach((r, i) => {
      parts.push(`${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content}`);
    });
  }
  return parts.join("\n\n") || "No results found.";
};

export const tools: Tool[] = [
  {
    def: {
      type: "function",
      function: {
        name: "web_search",
        description:
          "Search the public web for current information, news, or facts you don't already know. Only call this when the user clearly needs fresh information (recent news, current data, topics beyond your training cutoff). Do NOT use for general knowledge questions you can answer directly.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "The search query, written as a natural-language question or set of keywords",
            },
            max_results: {
              type: "number",
              description: `Number of results to return (${MIN_RESULTS}-${MAX_RESULTS}). Defaults to ${DEFAULT_RESULTS}.`,
            },
          },
          required: ["query"],
        },
      },
    },
    fn: async (args) => {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      if (!query) return "Error: 'query' argument is required";

      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        return "Error: TAVILY_API_KEY is not set. Add it to .env (get a free key at https://tavily.com).";
      }

      const maxResults =
        typeof args.max_results === "number"
          ? Math.max(MIN_RESULTS, Math.min(MAX_RESULTS, args.max_results))
          : DEFAULT_RESULTS;

      try {
        const response = await fetch(TAVILY_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            max_results: maxResults,
            search_depth: "basic",
            include_answer: true,
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          return `Tavily error ${response.status}: ${errBody.slice(0, 200)}`;
        }

        const data = (await response.json()) as TavilyResponse;
        return formatResults(data);
      } catch (err) {
        return `Error searching web: ${(err as Error).message}`;
      }
    },
  },
];
