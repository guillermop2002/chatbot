# 🤖 AI Chatbot Infrastructure

A complete serverless chatbot infrastructure built with Cloudflare Workers, Pages, and KV storage. Transform any website into an intelligent chatbot in seconds using Groq's powerful Qwen model.

## ✨ Features

- **Instant Setup**: Paste any URL and get a chatbot in seconds
- **Serverless**: Runs entirely on Cloudflare's edge network
- **Embeddable**: Simple script tag integration
- **AI-Powered**: Uses Groq's fast Qwen 2.5 32B model
- **Responsive**: Works on desktop and mobile
- **Free Tier**: Leverages Cloudflare's generous free limits

## 🚀 Quick Start

### 1. Prerequisites

- Cloudflare account (free tier works)
- Groq API account (free tier available)
- Node.js installed locally

### 2. Clone and Setup

```bash
git clone <your-repo-url>
cd chatbot-infrastructure
npm install
```

### 3. Configure Cloudflare

1. **Install Wrangler CLI:**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare:**
   ```bash
   wrangler login
   ```

3. **Verify KV Namespace:**
   The KV namespace is already configured in `wrangler.toml` with ID `e8e11114553c4d0fa4b8b58fe8c361b6`. If you need to create a new one:
   ```bash
   wrangler kv:namespace create "BOTS_KV"
   ```
   Then update the ID in `wrangler.toml`.

### 4. Set Up Groq API

1. **Get Groq API Key:**
   - Sign up at [Groq Console](https://console.groq.com/)
   - Create an API key
   - Copy the API key (starts with `gsk_`)

2. **Set Environment Variable:**
   ```bash
   wrangler secret put GROQ_API_KEY
   ```
   When prompted, paste your Groq API key.

### 5. Deploy

1. **Deploy the Worker:**
   ```bash
   npm run deploy
   ```

2. **Deploy the Pages Site:**
   ```bash
   npm run pages:deploy
   ```

3. **Update Frontend Configuration:**
   - Open `script.js`
   - Replace `YOUR_SUBDOMAIN` in the `WORKER_URL` variable with your actual Worker subdomain
   - The URL format is: `https://bot-engine.YOUR_SUBDOMAIN.workers.dev`

## 📖 How to Use

1. **Visit your deployed Pages site**
2. **Paste any website URL** you want to create a chatbot for
3. **Click "Create Chatbot"** and wait for processing
4. **Copy the generated script tag** and embed it on your website
5. **Done!** Your chatbot is live and ready to answer questions

## 🏗️ Architecture

### Frontend (`index.html`)
- Clean, responsive interface for URL input
- Real-time feedback during bot creation
- Copy-to-clipboard functionality for embed codes

### Widget (served by Worker at `/widget.js`)
- Embeddable chat interface
- Smooth animations and responsive design
- Connects to Worker API for chat functionality

### Worker (`worker/worker.js`)
- **`/api/create`**: Scrapes URLs, processes content, stores in KV
- **`/api/chat`**: Handles chat messages with vector similarity search
- **`/widget.js`**: Serves the embeddable widget script

### Storage (Cloudflare KV)
- Stores bot configurations and scraped content
- Fast global edge caching
- Simple key-value structure

## 🔧 Configuration

### Environment Variables

Set via Cloudflare dashboard or Wrangler CLI:

```bash
wrangler secret put GROQ_API_KEY
```

### KV Namespace

Already configured in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "BOTS_KV"
id = "e8e11114553c4d0fa4b8b58fe8c361b6"
```

## 🎯 API Endpoints

### POST `/api/create`
Creates a new chatbot from a URL.

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "botId": "abc123",
  "title": "Example Site",
  "embedCode": "<script src=\".../widget.js\" data-bot-id=\"abc123\"></script>"
}
```

### POST `/api/chat`
Sends a message to a chatbot.

**Request:**
```json
{
  "id": "abc123",
  "message": "How can I contact support?"
}
```

**Response:**
```json
{
  "response": "You can contact support by..."
}
```

### GET `/widget.js`
Serves the embeddable widget script.

## 🛠️ Development

```bash
# Start local development
npm run dev

# Test Pages locally
npm run pages:dev
```

## 📊 Limitations

- **Content Size**: Works best with websites under 1MB of text content
- **Languages**: Optimized for English content (Qwen model supports multiple languages)
- **Rate Limits**: Subject to Cloudflare and Groq API limits
- **Embedding Quality**: Uses simple character-frequency based embeddings for demo purposes

## 🔒 Security

- CORS enabled for cross-origin requests
- Input validation on all endpoints
- Rate limiting via Cloudflare
- API keys stored as encrypted secrets

## 📈 Scaling

The infrastructure automatically scales with Cloudflare's edge network:
- **Workers**: Handle millions of requests
- **KV**: Global replication and caching
- **Pages**: CDN-delivered static assets

## 🚨 Troubleshooting

### Common Issues

1. **"Bot not found" error:**
   - Check if the KV namespace ID is correct in `wrangler.toml`
   - Ensure the Worker is deployed successfully

2. **Groq API errors:**
   - Verify your API key is set correctly: `wrangler secret list`
   - Check your Groq account has available credits

3. **CORS errors:**
   - Ensure the Worker URL in `script.js` matches your deployed Worker

4. **Widget not loading:**
   - Check the embed code has the correct Worker URL
   - Verify the bot ID exists in KV storage

### Debug Commands

```bash
# Check secrets
wrangler secret list

# View KV data
wrangler kv:key list --binding BOTS_KV

# View Worker logs
wrangler tail
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- Check the [Issues](https://github.com/your-username/chatbot-infrastructure/issues) page
- Review Cloudflare Workers documentation
- Check Groq API documentation

---

Built with ❤️ using Cloudflare's edge platform and Groq's AI models
