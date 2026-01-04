# Oslo Børs AI Trading Platform

An automated swing trading platform for the Norwegian stock market, powered by AI analysis and real-time data from Oslo Børs.

## What it does

- **Automated News Monitoring**: Scrapes official announcements from Newsweb every 15 minutes
- **Daily Stock Screening**: Analyzes all Oslo Børs stocks at market close using technical indicators
- **AI-Powered Analysis**: Uses Claude AI to evaluate stocks and identify opportunities
- **Portfolio Tracking**: Monitor your positions with real-time data from Yahoo Finance

## Built with

**Frontend**: React, TypeScript, Tailwind CSS
**Backend**: Node.js, Express, SQLite
**AI**: Claude API (Anthropic)
**Data**: Newsweb (Oslo Børs), Yahoo Finance

## Quick Start

1. Clone and install:
```bash
npm install
```

2. Set up your `.env` file:
```bash
ANTHROPIC_API_KEY=your_key_here
```
Get your API key at [console.anthropic.com](https://console.anthropic.com/)

3. Start the servers:
```bash
npm run dev        # Backend API
npm run frontend   # React app
npm run agents     # Automated tasks
```

## Project Structure

```
frontend/         React app with charts and portfolio view
backend/          Express API + SQLite database
agents/           Scheduled tasks (news scraper, screener)
mcp-servers/      Data collection servers
```

## How it works

**News Scraper**: Checks Newsweb every 15 minutes for new announcements
**Stock Screener**: Runs daily at 18:00, analyzes RSI, volume, and trends
**AI Analysis**: Claude evaluates stocks based on news and technical data
**Alerts**: Notifies you of significant price moves or news

## API Endpoints

```
GET  /api/portfolio              Your stock positions
GET  /api/stocks/:ticker         Stock details and analysis
GET  /api/news/:ticker           Latest news for a stock
GET  /api/screener/results       Top screening candidates
```

## Database

SQLite with four main tables:
- `portfolio` - Your positions
- `price_history` - Historical stock data
- `news` - Scraped announcements
- `ai_analyses` - Claude analysis results (cached)

## License

MIT
