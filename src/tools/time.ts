import type { Tool } from "./types.js";

export const tools: Tool[] = [
  {
    def: {
      type: "function",
      function: {
        name: "get_current_time",
        description: "Returns the current date and time in ISO 8601 format",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    fn: () => new Date().toISOString(),
  },
];
