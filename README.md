# WhatsApp MCP Server

A Model Context Protocol (MCP) server that enables LLMs to interact with WhatsApp through the WhatsApp Web interface. Works with any MCP-compatible client (Claude Desktop, Claude Code, etc.).

> **Warning**: This uses the unofficial whatsapp-web.js library which violates WhatsApp's Terms of Service. Use at your own risk - account bans are possible.

## Features

- **Send Messages**: Send text messages to any WhatsApp contact or phone number
- **Read Messages**: Fetch message history from any chat
- **Contact Management**: List and search contacts
- **Search**: Search for messages across chats
- **QR Code Display**: View QR code directly in Claude for easy authentication
- **Message Interactions**: React with emojis, quote-reply, edit, and delete messages
- **Typing Indicator**: Show typing or recording state in chats
- **Media Handling**: Send and receive images, documents, and other media
- **Voice Transcription**: Transcribe voice messages using OpenAI Whisper
- **Auto-Recovery**: Detects browser crashes and allows reconnection without re-auth

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
      "args": ["/absolute/path/to/whatsapp-mcp/build/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-your-openai-key-here"
      }
    }
  }
}
```

> **Note**: The `OPENAI_API_KEY` is optional and only needed for voice message transcription.

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
| `whatsapp_reconnect` | Reconnect if browser crashed (keeps auth) |
| `whatsapp_reset_auth` | Reset authentication and scan new QR code |
| `whatsapp_react` | React to a message with an emoji |
| `whatsapp_reply` | Quote-reply to a specific message |
| `whatsapp_delete_message` | Delete a message (for everyone or locally) |
| `whatsapp_edit_message` | Edit a sent text message |
| `whatsapp_typing_indicator` | Show typing/recording indicator in a chat |
| `whatsapp_download_media` | Download media (image, video, audio) from a message |
| `whatsapp_send_image` | Send an image from URL or base64 data |
| `whatsapp_send_document` | Send a document/file from URL or base64 data |
| `whatsapp_transcribe_audio` | Transcribe voice messages using OpenAI Whisper |

## Usage Examples

Once connected, you can ask Claude things like:

- "Show me my recent WhatsApp messages"
- "Send 'Hello!' to +49151234567"
- "Send a message to John saying I'll be late"
- "What are the last 10 messages from [name]?"
- "Search my WhatsApp for messages about 'meeting'"
- "Check my WhatsApp connection status"
- "Send this image to John" (with an image URL)
- "React with a thumbs up to the last message from [name]"
- "Reply to [name]'s last message saying thanks"
- "Delete the last message I sent to [name]"
- "Transcribe the last voice message from [name]"
- "What did [name] say in their voice message?"

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

### Browser Crashed / "Detached Frame" Error
If `whatsapp_status` shows `browser_crashed` or you see "detached frame" errors:
1. Run `whatsapp_reconnect` - this restarts the browser while keeping your auth session
2. If that fails, use `whatsapp_reset_auth` and scan a new QR code
3. As a last resort, restart Claude Desktop

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
