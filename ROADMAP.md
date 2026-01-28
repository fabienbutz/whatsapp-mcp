# WhatsApp MCP Server - Roadmap

## Completed

### v0.8 - Core Features
- [x] QR Code authentication with display in Claude
- [x] Send/receive text messages
- [x] Contact management and search
- [x] Message history and search
- [x] Session persistence (.wwebjs_auth)

### v0.9 - Media & Transcription
- [x] Download media from messages (images, videos, audio, documents)
- [x] Send images (URL or base64)
- [x] Send documents/files
- [x] Voice message transcription (OpenAI Whisper)

---

## In Progress

### v0.10 - Enhanced Media
- [ ] Send videos
- [ ] Send audio files
- [ ] Send stickers
- [ ] Forward messages between chats
- [ ] Reply to specific messages

---

## Planned

### v0.11 - Group Features
- [ ] Create groups
- [ ] Add/remove group participants
- [ ] Group admin functions
- [ ] List group members
- [ ] Group settings (name, description, photo)

### v0.12 - Advanced Messaging
- [ ] Message reactions (emoji)
- [ ] Edit sent messages
- [ ] Delete messages
- [ ] Pin/unpin messages
- [ ] Mark messages as read/unread

### v1.0 - Stable Release
- [ ] All core features stable
- [ ] Comprehensive error handling
- [ ] Full documentation
- [ ] Test coverage

### v1.1 - Status & Presence
- [ ] View contact status updates (Stories)
- [ ] Post status updates
- [ ] Online/offline presence detection
- [ ] "Last seen" information
- [ ] Typing indicators

### v1.2 - Business Features
- [ ] WhatsApp Business API support
- [ ] Quick replies / Templates
- [ ] Labels for chats
- [ ] Catalog integration
- [ ] Automated responses

### v1.3 - Multi-Device & Sync
- [ ] Multi-account support
- [ ] Cross-device message sync
- [ ] Backup/restore conversations
- [ ] Export chat history (JSON/CSV)

---

## Future Ideas

### AI Integration
- [ ] Smart reply suggestions
- [ ] Message summarization (long chats)
- [ ] Language translation
- [ ] Sentiment analysis
- [ ] Spam/scam detection

### Automation
- [ ] Scheduled messages
- [ ] Auto-responder rules
- [ ] Webhook notifications for new messages
- [ ] Integration with n8n/Zapier

### Security & Privacy
- [ ] End-to-end encryption verification
- [ ] Message expiry settings
- [ ] Block/unblock contacts
- [ ] Privacy settings management

---

## Contributing

Have ideas for new features? Open an issue on GitHub!

## Notes

- Features depend on whatsapp-web.js capabilities
- Some features may not be possible due to WhatsApp Web limitations
- Business features require WhatsApp Business account
