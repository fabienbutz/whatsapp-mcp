# WhatsApp MCP Server - Development Guide

MCP Server for WhatsApp Web integration. Uses whatsapp-web.js with Puppeteer.

## Quick Start

```bash
npm install      # Install dependencies
npm run build    # Compile TypeScript
npm start        # Start server (usually via Claude Desktop)
```

## Best Practices for whatsapp-web.js

> **Important:** whatsapp-web.js is prone to breaking changes from WhatsApp Web updates. These best practices prevent the most common errors.

### 1. Always use `sendSeen: false` when sending messages

```typescript
// CORRECT
await client.sendMessage(chatId, message, { sendSeen: false });

// WRONG - can throw "markedUnread" error
await client.sendMessage(chatId, message);
```

**Why:** WhatsApp Web regularly changes the `sendSeen` function. With `sendSeen: false`, this error-prone code is skipped.

### 2. Pin the WhatsApp Web version

```typescript
// In src/whatsapp-client.ts
webVersionCache: {
  type: 'remote',
  remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1032570163-alpha.html',
},
```

**Tested version:** `2.3000.1032570163-alpha` (as of January 28, 2026)

**Find newer versions:** https://github.com/wppconnect-team/wa-version/tree/main/html

### 3. Reset procedure for problems

```bash
pkill -f "Google Chrome for Testing"
rm -rf .wwebjs_auth
# Then restart Claude Desktop and scan QR code
```

## Architecture

| File/Folder | Description |
|-------------|-------------|
| `src/whatsapp-client.ts` | WhatsApp Client wrapper (whatsapp-web.js) |
| `src/index.ts` | MCP Server with tools |
| `.wwebjs_auth/` | Puppeteer session data |
| `contacts.json` | Contacts cache |

## Troubleshooting

### "Cannot read properties of undefined (reading 'markedUnread')"

**Symptoms:** Sending fails, loading contacts works

**Solution:** Use `sendSeen: false` with `sendMessage` (see Best Practice #1)

**References:**
- https://github.com/pedroslopez/whatsapp-web.js/issues/5718
- https://github.com/pedroslopez/whatsapp-web.js/issues/5736

### "Cannot read properties of undefined (reading 'getContacts')"

**Symptoms:** Auth OK, `ready` event never fires, all API calls fail

**Solution:** Update WhatsApp Web version (see Best Practice #2), then run reset procedure (see Best Practice #3)

### "The browser is already running..."

**Solution:**
```bash
pkill -f "Google Chrome for Testing"
pkill -f "chromium.*wwebjs_auth"
```

### Contacts are empty (0 contacts)

1. Check `whatsapp_logs` for errors
2. Call `whatsapp_list_contacts` (triggers sync)
3. If other errors occur → apply the corresponding solution

### Ready event doesn't fire

Usually a WhatsApp Web compatibility issue → Update WhatsApp Web version and run reset procedure.
