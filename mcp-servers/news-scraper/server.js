import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

const NEWSWEB_BASE_URL = process.env.NEWSWEB_BASE_URL || 'https://newsweb.oslobors.no/search?issuer=';

class NewswebScraperServer {
  constructor() {
    this.server = new Server(
      {
        name: 'newsweb-scraper',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'scrape_newsweb',
          description: 'Scrape official Oslo Børs news from Newsweb for a given ticker',
          inputSchema: {
            type: 'object',
            properties: {
              ticker: {
                type: 'string',
                description: 'Stock ticker symbol (e.g., MOWI, VAR, YAR)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of news items to return (default: 20)',
                default: 20,
              },
            },
            required: ['ticker'],
          },
        },
        {
          name: 'scrape_multiple_tickers',
          description: 'Scrape news for multiple tickers in parallel',
          inputSchema: {
            type: 'object',
            properties: {
              tickers: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of ticker symbols',
              },
              limit_per_ticker: {
                type: 'number',
                description: 'Max news items per ticker (default: 10)',
                default: 10,
              },
            },
            required: ['tickers'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === 'scrape_newsweb') {
          return await this.scrapeNewsweb(args.ticker, args.limit || 20);
        } else if (name === 'scrape_multiple_tickers') {
          return await this.scrapeMultipleTickers(args.tickers, args.limit_per_ticker || 10);
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async scrapeNewsweb(ticker, limit = 20) {
    try {
      const url = `${NEWSWEB_BASE_URL}${ticker.toUpperCase()}`;
      console.log(`[Newsweb] Scraping: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      const newsItems = [];

      // Parse the news items from Newsweb
      // Note: This selector may need adjustment based on actual Newsweb HTML structure
      $('.message, .news-item, .announcement, article').each((index, element) => {
        if (index >= limit) return false;

        const $item = $(element);

        // Try multiple selectors to find title
        const title = $item.find('.title, .headline, h2, h3, a').first().text().trim();

        // Try to find the link
        const linkElem = $item.find('a').first();
        const link = linkElem.attr('href') || '';
        const fullLink = link.startsWith('http') ? link : `https://newsweb.oslobors.no${link}`;

        // Try to find date
        const dateText = $item.find('.date, .time, time, .published').first().text().trim();

        // Try to find category/type
        const category = $item.find('.category, .type, .tag').first().text().trim();

        // Try to get content/summary
        const content = $item.find('.content, .summary, .description, p').first().text().trim();

        if (title) {
          newsItems.push({
            ticker: ticker.toUpperCase(),
            title,
            category: category || 'General',
            link: fullLink,
            content: content || '',
            published_date: dateText || new Date().toISOString(),
            source: 'newsweb',
          });
        }
      });

      // If the above selectors didn't work, try a more generic approach
      if (newsItems.length === 0) {
        // Look for any links that might be news items
        $('a').each((index, element) => {
          if (index >= limit) return false;

          const $link = $(element);
          const href = $link.attr('href');

          // Filter for actual news links (containing /message/ or /news/ etc)
          if (href && (href.includes('/message/') || href.includes('/news/') || href.includes('/announcement/'))) {
            const title = $link.text().trim();
            if (title && title.length > 10) {
              const fullLink = href.startsWith('http') ? href : `https://newsweb.oslobors.no${href}`;
              newsItems.push({
                ticker: ticker.toUpperCase(),
                title,
                category: 'General',
                link: fullLink,
                content: '',
                published_date: new Date().toISOString(),
                source: 'newsweb',
              });
            }
          }
        });
      }

      console.log(`[Newsweb] Found ${newsItems.length} news items for ${ticker}`);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              ticker: ticker.toUpperCase(),
              count: newsItems.length,
              news: newsItems,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error(`[Newsweb] Error scraping ${ticker}:`, error.message);
      throw error;
    }
  }

  async scrapeMultipleTickers(tickers, limitPerTicker = 10) {
    try {
      const results = await Promise.allSettled(
        tickers.map(ticker => this.scrapeNewsweb(ticker, limitPerTicker))
      );

      const allNews = [];
      const errors = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const data = JSON.parse(result.value.content[0].text);
          allNews.push(...data.news);
        } else {
          errors.push({
            ticker: tickers[index],
            error: result.reason.message,
          });
        }
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              total_tickers: tickers.length,
              total_news: allNews.length,
              news: allNews,
              errors: errors.length > 0 ? errors : undefined,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('[Newsweb] Error in batch scraping:', error.message);
      throw error;
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Newsweb Scraper MCP Server running on stdio');
  }
}

const server = new NewswebScraperServer();
server.run().catch(console.error);
