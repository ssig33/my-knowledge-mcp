#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const KNOWLEDGE_DIR = path.join(os.homedir(), ".config", "my-knowledge-mcp");

const server = new Server(
  {
    name: "my-knowledge-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "add_knowledge",
        description: "Save text content to a file in the knowledge directory",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "The name of the file to save",
            },
            content: {
              type: "string",
              description: "The text content to save",
            },
          },
          required: ["filename", "content"],
        },
      },
      {
        name: "search_knowledge",
        description:
          "Search files in the knowledge directory by keywords. Returns up to 5 results sorted by match count",
        inputSchema: {
          type: "object",
          properties: {
            keywords: {
              type: "array",
              items: {
                type: "string",
              },
              description: "List of keywords to search for",
            },
          },
          required: ["keywords"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "add_knowledge") {
    const filename = request.params.arguments?.filename as string;
    const content = request.params.arguments?.content as string;

    if (!filename || !content) {
      throw new Error("filename and content are required");
    }

    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
    const filePath = path.join(KNOWLEDGE_DIR, filename);
    await fs.writeFile(filePath, content, "utf-8");

    return {
      content: [
        {
          type: "text",
          text: `Successfully saved to ${filePath}`,
        },
      ],
    };
  }

  if (request.params.name === "search_knowledge") {
    const keywords = request.params.arguments?.keywords as string[];

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      throw new Error("keywords array is required and must not be empty");
    }

    try {
      await fs.access(KNOWLEDGE_DIR);
    } catch {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify([]),
          },
        ],
      };
    }

    const files = await fs.readdir(KNOWLEDGE_DIR);
    const results: Array<{
      filename: string;
      score: number;
      content: string;
    }> = [];

    for (const filename of files) {
      const filePath = path.join(KNOWLEDGE_DIR, filename);
      const stat = await fs.stat(filePath);

      if (!stat.isFile()) {
        continue;
      }

      const content = await fs.readFile(filePath, "utf-8");
      const contentLower = content.toLowerCase();

      let score = 0;
      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();
        let pos = 0;
        while ((pos = contentLower.indexOf(keywordLower, pos)) !== -1) {
          score++;
          pos += keywordLower.length;
        }
      }

      if (score > 0) {
        results.push({
          filename,
          score,
          content,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, 5);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(topResults, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("My Knowledge MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
