# Apple Books MCP Server Setup

## Quick Setup for Claude Desktop

1. **Install dependencies:**

```bash
npm install
```

2. **Configure Claude Desktop:**

Edit the configuration file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "apple-books": {
      "command": "node",
      "args": ["/Users/karanarqq/projects/apple-books-mcp/index.js"]
    }
  }
}
```

3. **Restart Claude Desktop**

## Available MCP Tools

After setup, you can use these tools in Claude:

### Get all books

```
Use the get_books tool
```

### Search for specific books

```
Use the search_books tool with query: "author or title"
```

### Get annotations/highlights

```
Use the get_annotations tool
```


## Troubleshooting

- Make sure you have proper permissions to access Apple Books database
- Check that Node.js 18+ is installed
- Verify the path in the configuration is correct
- Restart Claude Desktop after configuration changes
