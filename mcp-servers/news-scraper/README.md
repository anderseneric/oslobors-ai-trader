# Newsweb Scraper MCP Server

Scrapes official Oslo Børs news from Newsweb (newsweb.oslobors.no).

## Features

- Scrapes official stock exchange announcements
- Supports single ticker or batch scraping
- Parses: Title, Date, Category, Link, Content
- Works as MCP server or standalone module

## Usage

### As MCP Server

```bash
npm start
```

### As Standalone Module

```javascript
import { scrapeNewsweb, scrapeMultipleTickers } from './scraper.js';

// Single ticker
const news = await scrapeNewsweb('MOWI', 20);

// Multiple tickers
const results = await scrapeMultipleTickers(['MOWI', 'VAR', 'YAR'], 10);
```

### Test

```bash
node scraper.js
```

## MCP Tools

### scrape_newsweb
- Input: `{ ticker: string, limit?: number }`
- Output: Array of news items

### scrape_multiple_tickers
- Input: `{ tickers: string[], limit_per_ticker?: number }`
- Output: Aggregated news from all tickers

## Data Structure

```json
{
  "ticker": "MOWI",
  "title": "Quarterly Report Q4 2024",
  "category": "Report",
  "link": "https://newsweb.oslobors.no/message/...",
  "content": "...",
  "published_date": "2024-12-28T10:00:00.000Z",
  "source": "newsweb"
}
```
