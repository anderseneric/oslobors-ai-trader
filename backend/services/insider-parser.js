/**
 * Parse insider transaction data from Newsweb news
 */

/**
 * Check if news item is an insider transaction
 */
export function isInsiderTransaction(newsItem) {
  if (!newsItem.title) return false;

  const title = newsItem.title.toLowerCase();
  const category = newsItem.category ? newsItem.category.toLowerCase() : '';

  // Check for insider-related keywords in title or category
  return (
    category.includes('primary insider') ||
    category.includes('pdmr') ||
    category.includes('insider') ||
    title.includes('primary insider') ||
    title.includes('pdmr') ||
    title.includes('managerial responsibilit') ||
    title.includes('mandatory notification of trade') ||
    title.includes('reporting of transaction') ||
    title.includes('incentive program')
  );
}

/**
 * Parse transaction type from title/content
 */
function parseTransactionType(text) {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('kjøp') || lowerText.includes('purchase') || lowerText.includes('buy') || lowerText.includes('bought')) {
    return 'BUY';
  } else if (lowerText.includes('salg') || lowerText.includes('sale') || lowerText.includes('sell') || lowerText.includes('sold')) {
    return 'SELL';
  }

  return 'UNKNOWN';
}

/**
 * Parse insider name from title and content
 * Format examples:
 * - "Primary Insider: John Doe has purchased shares"
 * - "PDMR: Anders Opedal - Kjøp av aksjer"
 * - Content: "Borken AS, a related party to Bengt Arve Rem, board member..."
 */
function parseInsiderName(title, ticker, content = '') {
  const fullText = title + ' ' + content;

  // Try to extract from "related party to [Name]" pattern (common in Newsweb)
  let match = fullText.match(/related party to ([A-ZÆØÅ][a-zæøå]+(?:\s+[A-ZÆØÅ][a-zæøå]+)+)/);
  if (match) {
    return match[1].trim();
  }

  // Try to extract name after "Primary Insider:" or "PDMR:"
  match = title.match(/(?:Primary Insider|PDMR):\s*([^-]+?)(?:\s*-|\s*has|\s*har)/i);
  if (match) {
    const name = match[1].trim();
    // Check if it's a real name (not just "primary insiders")
    if (!name.toLowerCase().includes('primary') && !name.toLowerCase().includes('insider')) {
      return name;
    }
  }

  // Try to extract person name from content (Norwegian/English names)
  // Pattern: Capital letter, lowercase letters, space, Capital letter, lowercase letters
  const nameMatches = fullText.match(/\b([A-ZÆØÅ][a-zæøå]+\s+(?:[A-ZÆØÅ][a-zæøå]+\s+)?[A-ZÆØÅ][a-zæøå]+)\b/g);
  if (nameMatches) {
    for (const name of nameMatches) {
      // Filter out company names and common words
      const lower = name.toLowerCase();
      if (!lower.includes('asa') &&
          !lower.includes('orkla') &&
          !lower.includes('aker') &&
          !lower.includes('mandatory') &&
          !lower.includes('notification') &&
          !lower.includes('board member') &&
          name !== ticker) {
        return name.trim();
      }
    }
  }

  // Try to extract company name from beginning of title as fallback
  match = title.match(/^([^:]+?)(?:\s+ASA)?:/);
  if (match) {
    const companyName = match[1].trim();
    if (companyName !== ticker && companyName.length > 3) {
      return `${companyName} (Insider)`;
    }
  }

  return ticker ? `${ticker} (Insider)` : 'Unknown Insider';
}

/**
 * Parse role from title/content
 */
function parseRole(text) {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('ceo') || lowerText.includes('chief executive')) {
    return 'CEO';
  } else if (lowerText.includes('cfo') || lowerText.includes('chief financial')) {
    return 'CFO';
  } else if (lowerText.includes('chair') || lowerText.includes('styreleder')) {
    return 'Chairman';
  } else if (lowerText.includes('director') || lowerText.includes('styremedlem')) {
    return 'Board Member';
  } else if (lowerText.includes('deputy') || lowerText.includes('nestleder')) {
    return 'Deputy';
  } else if (lowerText.includes('management') || lowerText.includes('ledelse')) {
    return 'Management';
  }

  return null;
}

/**
 * Parse number of shares from content
 * Looks for patterns like "10,000 shares" or "10 000 aksjer"
 */
function parseShares(content) {
  if (!content) return null;

  // Try to find share count patterns
  const patterns = [
    /(\d+[\s,]*\d*)\s*(?:shares|aksjer)/i,
    /(?:number|antall)[:\s]+(\d+[\s,]*\d*)/i,
    /quantity[:\s]+(\d+[\s,]*\d*)/i
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      // Remove spaces and commas
      const shares = match[1].replace(/[\s,]/g, '');
      return parseInt(shares);
    }
  }

  return null;
}

/**
 * Parse price from content
 */
function parsePrice(content) {
  if (!content) return null;

  const patterns = [
    /(?:price|pris)[:\s]+(?:NOK\s*)?(\d+[.,]\d+)/i,
    /(?:@|at)[:\s]+(?:NOK\s*)?(\d+[.,]\d+)/i,
    /(\d+[.,]\d+)\s*(?:NOK|kr)/i
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const price = match[1].replace(',', '.');
      return parseFloat(price);
    }
  }

  return null;
}

/**
 * Parse transaction date from content or published date
 */
function parseTransactionDate(content, publishedDate) {
  if (!content) return publishedDate;

  // Try to find date in format DD.MM.YYYY or YYYY-MM-DD
  const dateMatch = content.match(/(\d{2})[./](\d{2})[./](\d{4})|(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    if (dateMatch[1]) {
      // DD.MM.YYYY format
      return `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    } else {
      // YYYY-MM-DD format
      return `${dateMatch[4]}-${dateMatch[5]}-${dateMatch[6]}`;
    }
  }

  return publishedDate;
}

/**
 * Parse insider transaction from news item
 */
export function parseInsiderTransaction(newsItem) {
  if (!isInsiderTransaction(newsItem)) {
    return null;
  }

  const fullText = newsItem.title + ' ' + (newsItem.content || '');
  const transactionType = parseTransactionType(fullText);

  // If we can't determine type from title/content, check if it's a notification
  // Most insider notifications are about trading (buying or selling)
  // For now, we'll accept transactions even if we can't determine BUY vs SELL
  // and mark them as UNKNOWN for manual review

  const insiderName = parseInsiderName(newsItem.title, newsItem.ticker, newsItem.content);
  const role = parseRole(fullText);
  const shares = parseShares(newsItem.content);
  const price = parsePrice(newsItem.content);
  const transactionDate = parseTransactionDate(newsItem.content, newsItem.published_date);

  // Calculate value if we have shares and price
  let value = null;
  if (shares && price) {
    value = shares * price;
  }

  return {
    ticker: newsItem.ticker,
    insider_name: insiderName,
    role: role,
    transaction_type: transactionType,  // Can be BUY, SELL, or UNKNOWN
    shares: shares,
    price: price,
    value: value,
    transaction_date: transactionDate,
    reported_date: newsItem.published_date,
    source: newsItem.source || 'newsweb',
    news_link: newsItem.link
  };
}

/**
 * Parse multiple news items for insider transactions
 */
export function parseInsiderTransactions(newsItems) {
  const transactions = [];

  for (const newsItem of newsItems) {
    try {
      const transaction = parseInsiderTransaction(newsItem);
      if (transaction) {
        transactions.push(transaction);
      }
    } catch (error) {
      console.error(`Error parsing insider transaction from news ${newsItem.id}:`, error.message);
    }
  }

  return transactions;
}

export default {
  isInsiderTransaction,
  parseInsiderTransaction,
  parseInsiderTransactions
};
