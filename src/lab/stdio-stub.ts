// mcp-devkit only imports the stdio transport when a test targets a `command`.
// Demos always use the in-memory transport, so the browser bundle swaps in this stub.
export class StdioClientTransport {
  constructor() {
    throw new Error("The stdio transport needs Node. In the browser, use createTestClient({ server }).");
  }
}
