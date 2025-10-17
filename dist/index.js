#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var import_server = require("@modelcontextprotocol/sdk/server/index.js");
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio.js");
var import_types = require("@modelcontextprotocol/sdk/types.js");
var fs = __toESM(require("fs/promises"));
var path = __toESM(require("path"));
var os = __toESM(require("os"));
var KNOWLEDGE_DIR = path.join(os.homedir(), ".config", "my-knowledge-mcp");
var server = new import_server.Server(
  {
    name: "my-knowledge-mcp",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);
server.setRequestHandler(import_types.ListToolsRequestSchema, async () => {
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
              description: "The name of the file to save"
            },
            content: {
              type: "string",
              description: "The text content to save"
            }
          },
          required: ["filename", "content"]
        }
      },
      {
        name: "search_knowledge",
        description: "Search files in the knowledge directory by keywords. Returns up to 5 results sorted by match count",
        inputSchema: {
          type: "object",
          properties: {
            keywords: {
              type: "array",
              items: {
                type: "string"
              },
              description: "List of keywords to search for"
            }
          },
          required: ["keywords"]
        }
      }
    ]
  };
});
server.setRequestHandler(import_types.CallToolRequestSchema, async (request) => {
  var _a, _b, _c;
  if (request.params.name === "add_knowledge") {
    const filename = (_a = request.params.arguments) == null ? void 0 : _a.filename;
    const content = (_b = request.params.arguments) == null ? void 0 : _b.content;
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
          text: `Successfully saved to ${filePath}`
        }
      ]
    };
  }
  if (request.params.name === "search_knowledge") {
    const keywords = (_c = request.params.arguments) == null ? void 0 : _c.keywords;
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
            text: JSON.stringify([])
          }
        ]
      };
    }
    const files = await fs.readdir(KNOWLEDGE_DIR);
    const results = [];
    for (const filename of files) {
      const filePath = path.join(KNOWLEDGE_DIR, filename);
      const stat2 = await fs.stat(filePath);
      if (!stat2.isFile()) {
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
          content
        });
      }
    }
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, 5);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(topResults, null, 2)
        }
      ]
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});
async function main() {
  const transport = new import_stdio.StdioServerTransport();
  await server.connect(transport);
  console.error("My Knowledge MCP Server running on stdio");
}
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
