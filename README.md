# WhatsApp MCP Server

A Model Context Protocol (MCP) server that enables LLMs to interact with WhatsApp through the WhatsApp Web interface. Works with any MCP-compatible client (Claude Desktop, Claude Code, etc.).

> **Warning**: This uses the unofficial whatsapp-web.js library which violates WhatsApp's Terms of Service. Use at your own risk - account bans are possible.

## Features

- **Send Messages**: Send text messages to any WhatsApp contact or phone number
- **Read Messages**: Fetch message history from any chat
- **Contact Management**: List and search contacts
- **Search**: Search for messages across chats
- **QR Code Display**: View QR code directly in Claude for easy authentication

## Prerequisites

- Node.js 18 or higher
- A WhatsApp account
- Chrome/Chromium (installed automatically by Puppeteer)

## Installation

```bash
# Clone the repository
git clone https://github.com/fabienbutz/whatsapp-mcp.git
cd whatsapp-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

### Claude Desktop

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["/absolute/path/to/whatsapp-mcp/build/index.js"]
    }
  }
}
```

### Other MCP Clients

For other MCP-compatible clients, configure the server with:
- **Command**: `node`
- **Args**: `["/absolute/path/to/whatsapp-mcp/build/index.js"]`

## First-Time Setup

1. Start the MCP server (via Claude Desktop or directly with `npm start`)
2. Ask Claude to check the WhatsApp status - it will show a QR code
3. Open WhatsApp on your phone
4. Go to **Settings → Linked Devices → Link a Device**
5. Scan the QR code
6. Once authenticated, the session is saved locally in `.wwebjs_auth/`

## Available Tools

| Tool | Description |
|------|-------------|
| `whatsapp_status` | Check connection status and contact count |
| `whatsapp_get_qr_code` | Display QR code for authentication |
| `whatsapp_send_message` | Send a message to a phone number |
| `whatsapp_send_to_contact` | Send a message to a contact by name |
| `whatsapp_list_contacts` | List all saved contacts |
| `whatsapp_find_contact` | Search for a contact by name |
| `whatsapp_get_messages` | Get messages from a specific chat |
| `whatsapp_get_recent_messages` | Get recent messages from all chats |
| `whatsapp_fetch_more_messages` | Load more message history for a chat |
| `whatsapp_search_messages` | Search messages by text |
| `whatsapp_sync_history` | Request a history sync |
| `whatsapp_logs` | View server logs for debugging |
| `whatsapp_reset_auth` | Reset authentication and scan new QR code |

## Usage Examples

Once connected, you can ask Claude things like:

- "Show me my recent WhatsApp messages"
- "Send 'Hello!' to +49151234567"
- "Send a message to John saying I'll be late"
- "What are the last 10 messages from [name]?"
- "Search my WhatsApp for messages about 'meeting'"
- "Check my WhatsApp connection status"

## Phone Number Format

Phone numbers should be in international format **without** the leading `+`:
- German: `4915123456789` (not `+4915123456789`)
- US: `14155551234`

## Rate Limiting

To reduce ban risk:
- Avoid sending more than 10-20 automated messages per day
- Don't send messages to unknown contacts
- Use primarily for responding to incoming messages
- Let your account "age" with normal usage before automation

## Troubleshooting

### QR Code Not Showing
- Ask Claude to call `whatsapp_get_qr_code` - it will display the QR code as an image
- Check `whatsapp_logs` for errors

### Authentication Fails
- Delete the `.wwebjs_auth/` folder and restart
- Make sure WhatsApp Web isn't open in a browser
- Kill any lingering Chrome processes: `pkill -f "Google Chrome for Testing"`

### Messages Not Sending
- Check `whatsapp_logs` for the specific error
- Most likely a WhatsApp Web API change - see [CLAUDE.md](CLAUDE.md) for known issues and fixes

### Puppeteer Errors
- Ensure Chrome/Chromium is available
- On Linux, you may need additional dependencies:
  ```bash
  apt-get install -y chromium-browser
  ```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Run built version
npm start
```

See [CLAUDE.md](CLAUDE.md) for development best practices and known issues with whatsapp-web.js.

## License

MIT - see [LICENSE](LICENSE)

## Disclaimer

This project is not affiliated with WhatsApp or Meta. Using unofficial clients may result in your account being banned. This is intended for personal use and experimentation only.
