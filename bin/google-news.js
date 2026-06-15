#!/usr/bin/env node

/**
 * google-news-cli
 * A beautiful, zero-dependency command-line interface for Google News.
 * Runs on Node.js using native fetch, readline, and ANSI styling.
 */

import readline from 'readline';
import { exec } from 'child_process';

// ANSI styling helper codes
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  // Foreground Colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Bright Colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // Background Colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
  bgGray: '\x1b[100m'
};

const TOPICS = [
  { code: 'WORLD', name: 'World News' },
  { code: 'NATION', name: 'National News' },
  { code: 'BUSINESS', name: 'Business' },
  { code: 'TECHNOLOGY', name: 'Technology' },
  { code: 'ENTERTAINMENT', name: 'Entertainment' },
  { code: 'SPORTS', name: 'Sports' },
  { code: 'SCIENCE', name: 'Science' },
  { code: 'HEALTH', name: 'Health' }
];

// CLI State Variables
let items = [];
let state = 'LOADING'; // LOADING, LIST, DETAILS, TOPIC_SELECT
let selectedIndex = 0;
let scrollOffset = 0;
const maxVisibleItems = 10;
let currentTopic = null; // null represents Top Stories
let currentSearch = null;
let loadingMessage = 'Fetching news...';
let isPrompting = false;

// Search/Topic selection state
let topicSelectedIndex = 0;
let detailsActionIndex = 0; // 0: Open in Browser, 1: Back to List
let messageBanner = '';
let messageBannerTimeout = null;

// User preferences (can be overridden by CLI args)
let hl = 'en';
let gl = 'US';
let ceid = 'US:en';
let limit = 20;

// Spinner state
let spinnerInterval = null;
let spinnerFrame = 0;
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Text formatting utility to colorize strings
 */
function color(text, colorEsc) {
  return `${colorEsc}${text}${c.reset}`;
}

/**
 * HTML entities decoder and CDATA extractor
 */
function decodeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

/**
 * Relative time formatter for RSS pubDate
 */
function formatTime(dateStr) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * Strips ANSI codes to compute true print width
 */
function realLength(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

/**
 * Centers text inside a defined column width
 */
function centerText(text, width) {
  const len = realLength(text);
  if (len >= width) return text;
  const padLeft = Math.floor((width - len) / 2);
  const padRight = width - len - padLeft;
  return ' '.repeat(padLeft) + text + ' '.repeat(padRight);
}

/**
 * Opens a URL in the system's default browser
 */
function openURL(url) {
  if (!url) return;
  // Clean URL to prevent command injection
  const safeUrl = url.replace(/"/g, '%22');
  const platform = process.platform;
  let cmd;
  if (platform === 'win32') {
    cmd = `start "" "${safeUrl}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${safeUrl}"`;
  } else {
    cmd = `xdg-open "${safeUrl}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      showTemporaryMessage(color(`Failed to open URL: ${err.message}`, c.brightRed));
    } else {
      showTemporaryMessage(color('Article successfully opened in your browser!', c.brightGreen));
    }
  });
}

/**
 * Set a transient status message at the bottom
 */
function showTemporaryMessage(msg) {
  messageBanner = msg;
  if (messageBannerTimeout) clearTimeout(messageBannerTimeout);
  messageBannerTimeout = setTimeout(() => {
    messageBanner = '';
    render();
  }, 4000);
  render();
}

/**
 * Simple XML parser to extract RSS items
 */
function parseRSS(xml) {
  const parsedItems = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[1];
    
    const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceMatch = itemContent.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    
    let rawTitle = titleMatch ? titleMatch[1].trim() : 'No Title';
    rawTitle = decodeHTML(rawTitle);
    
    let link = linkMatch ? linkMatch[1].trim() : '';
    let pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';
    
    let source = sourceMatch ? sourceMatch[1].trim() : '';
    source = decodeHTML(source);
    
    // Clean publisher name out of the title if present
    let title = rawTitle;
    if (source) {
      const sourceEscaped = source.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const cleanRegex = new RegExp(`\\s*-\\s*${sourceEscaped}$`, 'i');
      title = title.replace(cleanRegex, '');
    }
    if (!source) {
      // Sometimes source is missing in tag but written as "Title - Source"
      const dashParts = title.split(' - ');
      if (dashParts.length > 1) {
        source = dashParts.pop().trim();
        title = dashParts.join(' - ').trim();
      } else {
        source = 'Google News';
      }
    }
    
    parsedItems.push({ title, link, pubDate, source });
  }
  return parsedItems;
}

/**
 * Constructs the Google News RSS URL based on state
 */
function getFeedURL() {
  if (currentSearch) {
    return `https://news.google.com/rss/search?q=${encodeURIComponent(currentSearch)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  }
  if (currentTopic) {
    return `https://news.google.com/rss/headlines/section/topic/${currentTopic.toUpperCase()}?hl=${hl}&gl=${gl}&ceid=${ceid}`;
  }
  return `https://news.google.com/rss?hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

/**
 * Fetches and parses news
 */
async function loadNews() {
  startLoading(currentSearch ? `Searching for "${currentSearch}"...` : `Fetching ${currentTopic ? currentTopic + ' news' : 'top stories'}...`);
  
  try {
    const url = getFeedURL();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const xml = await res.text();
    
    items = parseRSS(xml);
    selectedIndex = 0;
    scrollOffset = 0;
    state = 'LIST';
  } catch (err) {
    state = 'LIST';
    items = [];
    showTemporaryMessage(color(`Error: ${err.message}`, c.brightRed));
  } finally {
    stopLoading();
    render();
  }
}

/**
 * Loading Spinner Management
 */
function startLoading(message) {
  state = 'LOADING';
  loadingMessage = message;
  spinnerFrame = 0;
  
  if (spinnerInterval) clearInterval(spinnerInterval);
  spinnerInterval = setInterval(() => {
    spinnerFrame = (spinnerFrame + 1) % spinnerFrames.length;
    render();
  }, 80);
}

function stopLoading() {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
}

/**
 * Header rendering box
 */
function drawHeader(titleText) {
  const cols = Math.min(process.stdout.columns || 80, 90);
  const contentWidth = cols - 4;
  
  const accentColor = c.brightCyan;
  const topBorder = color('┌' + '─'.repeat(contentWidth) + '┐', c.gray);
  const midContent = color('│', c.gray) + color(centerText(titleText, contentWidth), c.bold + accentColor) + color('│', c.gray);
  const botBorder = color('└' + '─'.repeat(contentWidth) + '┘', c.gray);
  
  return `${topBorder}\n${midContent}\n${botBorder}`;
}

/**
 * Boxen-like card drawer
 */
function drawBox(lines, boxTitle = '', borderStyle = c.gray) {
  const cols = Math.min(process.stdout.columns || 80, 90);
  const contentWidth = cols - 4;
  let out = '';
  
  // Top border
  if (boxTitle) {
    const paddedTitle = ` ${boxTitle} `;
    const titleLen = realLength(paddedTitle);
    const leftLen = Math.floor((contentWidth - titleLen) / 2);
    const rightLen = contentWidth - titleLen - leftLen;
    out += color('┌' + '─'.repeat(leftLen) + paddedTitle + '─'.repeat(rightLen) + '┐\n', borderStyle);
  } else {
    out += color('┌' + '─'.repeat(contentWidth) + '┐\n', borderStyle);
  }
  
  // Lines
  for (const line of lines) {
    const len = realLength(line);
    const padding = Math.max(0, contentWidth - len);
    out += color('│ ', borderStyle) + line + ' '.repeat(padding) + color(' │\n', borderStyle);
  }
  
  // Bottom border
  out += color('└' + '─'.repeat(contentWidth) + '┘', borderStyle);
  return out;
}

/**
 * Standard word wrapping utility
 */
function wrapText(text, maxLength) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + word).length > maxLength) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }
  return lines;
}

/**
 * The main rendering engine for raw TUI Mode
 */
function render() {
  if (isPrompting && state !== 'TOPIC_SELECT') return; // Readline input takes over
  
  console.clear();
  const cols = Math.min(process.stdout.columns || 80, 90);
  
  // 1. Render Top Header
  let headerTitle = 'GOOGLE NEWS';
  if (currentTopic) {
    const topicObj = TOPICS.find(t => t.code === currentTopic);
    headerTitle += ` • ${topicObj ? topicObj.name.toUpperCase() : currentTopic}`;
  } else if (currentSearch) {
    headerTitle += ` • SEARCH: ${currentSearch.toUpperCase()}`;
  } else {
    headerTitle += ' • TOP STORIES';
  }
  console.log(drawHeader(headerTitle));
  console.log();
  
  // 2. Render Body based on State
  if (state === 'LOADING') {
    const spinChar = color(spinnerFrames[spinnerFrame], c.bold + c.brightYellow);
    console.log(centerText(`${spinChar}  ${color(loadingMessage, c.bold)}`, cols));
    console.log('\n'.repeat(4));
    
  } else if (state === 'LIST') {
    if (items.length === 0) {
      console.log(centerText(color('No articles found.', c.bold + c.brightRed), cols));
      console.log();
    } else {
      // Adjust scroll offset
      if (selectedIndex < scrollOffset) {
        scrollOffset = selectedIndex;
      } else if (selectedIndex >= scrollOffset + maxVisibleItems) {
        scrollOffset = selectedIndex - maxVisibleItems + 1;
      }
      
      const visibleItems = items.slice(scrollOffset, scrollOffset + maxVisibleItems);
      
      visibleItems.forEach((item, idx) => {
        const globalIdx = scrollOffset + idx;
        const isSelected = globalIdx === selectedIndex;
        
        const indexStr = `${globalIdx + 1}.`.padStart(3);
        const sourceStr = color(`[${item.source}]`, c.bold + c.brightGreen);
        const timeStr = color(`(${formatTime(item.pubDate)})`, c.dim + c.gray);
        
        // Truncate title to fit line width
        // Max space for title: cols - index(3) - spacing(2) - source/time length
        const metaLength = realLength(sourceStr) + realLength(timeStr) + 8;
        const maxTitleWidth = cols - metaLength;
        
        let titleStr = item.title;
        if (titleStr.length > maxTitleWidth) {
          titleStr = titleStr.slice(0, maxTitleWidth - 3) + '...';
        }
        
        if (isSelected) {
          const line = `${color('➔', c.bold + c.brightCyan)} ${color(indexStr, c.brightCyan)} ${color(titleStr, c.bold + c.brightWhite)} ${sourceStr} ${timeStr}`;
          console.log(line);
        } else {
          const line = `  ${color(indexStr, c.gray)} ${color(titleStr, c.white)} ${sourceStr} ${timeStr}`;
          console.log(line);
        }
      });
      
      console.log();
      // Pagination Indicator
      const pag = color(`Showing ${scrollOffset + 1}-${Math.min(scrollOffset + maxVisibleItems, items.length)} of ${items.length} articles`, c.dim + c.gray);
      console.log(centerText(pag, cols));
    }
    
    // Help footer
    console.log('\n' + color('─'.repeat(cols), c.gray));
    const shortcuts = [
      `${color('↑↓', c.bold + c.brightCyan)} Nav`,
      `${color('Enter', c.bold + c.brightCyan)} Select`,
      `${color('S', c.bold + c.brightCyan)} Search`,
      `${color('T', c.bold + c.brightCyan)} Topic`,
      `${color('R', c.bold + c.brightCyan)} Refresh`,
      `${color('Q/Esc', c.bold + c.brightCyan)} Quit`
    ].join('   ');
    console.log(centerText(shortcuts, cols));
    
  } else if (state === 'DETAILS') {
    const item = items[selectedIndex];
    const cardLines = [];
    const textWidth = cols - 8;
    
    // Title wraps
    const wrappedTitle = wrapText(item.title, textWidth);
    wrappedTitle.forEach(l => cardLines.push(color(l, c.bold + c.brightWhite)));
    cardLines.push('');
    
    cardLines.push(`${color('Source:', c.dim + c.gray)} ${color(item.source, c.bold + c.brightGreen)}`);
    cardLines.push(`${color('Published:', c.dim + c.gray)} ${color(new Date(item.pubDate).toLocaleString(), c.white)} (${formatTime(item.pubDate)})`);
    cardLines.push('');
    
    // Link wraps
    cardLines.push(color('Link:', c.dim + c.gray));
    const wrappedLink = wrapText(item.link, textWidth);
    wrappedLink.forEach(l => cardLines.push(color(l, c.underline + c.brightBlue)));
    
    console.log(drawBox(cardLines, 'ARTICLE DETAILS', c.brightCyan));
    console.log();
    
    // Draw Actions list
    const actions = ['Open Article in Browser', 'Back to Article List'];
    actions.forEach((action, idx) => {
      const isSelected = idx === detailsActionIndex;
      if (isSelected) {
        console.log(centerText(`${color('➔', c.bold + c.brightCyan)} ${color(action, c.bold + c.brightWhite)}`, cols));
      } else {
        console.log(centerText(`  ${color(action, c.gray)}`, cols));
      }
    });
    
    console.log('\n' + color('─'.repeat(cols), c.gray));
    console.log(centerText(`${color('↑↓', c.bold + c.brightCyan)} Select Action   ${color('Enter', c.bold + c.brightCyan)} Confirm   ${color('Esc/Backspace', c.bold + c.brightCyan)} Back`, cols));
    
  } else if (state === 'TOPIC_SELECT') {
    console.log(centerText(color('SELECT TOPIC', c.bold + c.brightYellow), cols));
    console.log();
    
    TOPICS.forEach((topic, idx) => {
      const isSelected = idx === topicSelectedIndex;
      const displayStr = topic.name;
      if (isSelected) {
        console.log(centerText(`${color('➔', c.bold + c.brightCyan)} ${color(displayStr, c.bold + c.brightWhite)}`, cols));
      } else {
        console.log(centerText(`  ${color(displayStr, c.gray)}`, cols));
      }
    });
    
    console.log('\n' + color('─'.repeat(cols), c.gray));
    console.log(centerText(`${color('↑↓', c.bold + c.brightCyan)} Navigate Topics   ${color('Enter', c.bold + c.brightCyan)} Confirm   ${color('Esc/Backspace', c.bold + c.brightCyan)} Back`, cols));
  }
  
  // 3. Render transient messages
  if (messageBanner) {
    console.log();
    console.log(centerText(messageBanner, cols));
  } else {
    console.log('\n');
  }
}

/**
 * Set up process.stdin keypress listening for interactive menu
 */
function initInteractiveMode() {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  
  process.stdin.on('keypress', (str, key) => {
    // Standard crash/exit handler
    if (key.ctrl && key.name === 'c') {
      cleanupAndExit();
    }
    
    if (isPrompting && state !== 'TOPIC_SELECT') return; // Let readline prompt handle input
    
    if (state === 'LIST') {
      if (key.name === 'up') {
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        render();
      } else if (key.name === 'down') {
        selectedIndex = (selectedIndex + 1) % items.length;
        render();
      } else if (key.name === 'return') {
        if (items[selectedIndex]) {
          state = 'DETAILS';
          detailsActionIndex = 0;
          render();
        }
      } else if (key.name === 'escape' || key.sequence === 'q' || key.sequence === 'Q') {
        cleanupAndExit();
      } else if (key.sequence === 's' || key.sequence === 'S') {
        promptSearch();
      } else if (key.sequence === 't' || key.sequence === 'T') {
        promptTopic();
      } else if (key.sequence === 'r' || key.sequence === 'R') {
        loadNews();
      }
    } else if (state === 'DETAILS') {
      if (key.name === 'up' || key.name === 'down') {
        detailsActionIndex = 1 - detailsActionIndex; // Toggle between 0 and 1
        render();
      } else if (key.name === 'return') {
        if (detailsActionIndex === 0) {
          openURL(items[selectedIndex].link);
        } else {
          state = 'LIST';
          render();
        }
      } else if (key.name === 'escape' || key.name === 'backspace' || key.sequence === 'b' || key.sequence === 'B') {
        state = 'LIST';
        render();
      }
    } else if (state === 'TOPIC_SELECT') {
      if (key.name === 'up') {
        topicSelectedIndex = (topicSelectedIndex - 1 + TOPICS.length) % TOPICS.length;
        render();
      } else if (key.name === 'down') {
        topicSelectedIndex = (topicSelectedIndex + 1) % TOPICS.length;
        render();
      } else if (key.name === 'return') {
        currentTopic = TOPICS[topicSelectedIndex].code;
        currentSearch = null;
        isPrompting = false;
        loadNews();
      } else if (key.name === 'escape' || key.name === 'backspace') {
        state = 'LIST';
        isPrompting = false;
        render();
      }
    }
  });
  
  // Listen for terminal resize to redraw correctly
  process.stdout.on('resize', () => {
    render();
  });
  
  loadNews();
}

/**
 * Restore terminal and exit
 */
function cleanupAndExit() {
  stopLoading();
  console.clear();
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  console.log(color('Thank you for using Google News CLI! Have a great day!', c.bold + c.brightCyan));
  process.exit(0);
}

/**
 * Standard Non-Interactive CLI Mode
 */
async function runCommandLineMode() {
  const spinnerChars = ['|', '/', '-', '\\'];
  let spinIdx = 0;
  
  const loadingInterval = setInterval(() => {
    process.stdout.write(`\r${color(spinnerChars[spinIdx], c.brightYellow)} Fetching news headlines...`);
    spinIdx = (spinIdx + 1) % spinnerChars.length;
  }, 100);
  
  try {
    const url = getFeedURL();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const xml = await res.text();
    const parsedItems = parseRSS(xml);
    
    clearInterval(loadingInterval);
    process.stdout.write('\r\x1b[K'); // Clear line
    
    // Print Beautiful Header
    const cols = 80;
    let titleText = 'GOOGLE NEWS';
    if (currentTopic) {
      const topicObj = TOPICS.find(t => t.code === currentTopic);
      titleText += ` - Topic: ${topicObj ? topicObj.name : currentTopic}`;
    } else if (currentSearch) {
      titleText += ` - Search: "${currentSearch}"`;
    } else {
      titleText += ' - Top Stories';
    }
    
    console.log('\n' + color('═'.repeat(cols), c.brightCyan));
    console.log(color(centerText(titleText.toUpperCase(), cols), c.bold + c.brightWhite));
    console.log(color('═'.repeat(cols), c.brightCyan) + '\n');
    
    if (parsedItems.length === 0) {
      console.log(color('No headlines found matching criteria.', c.bold + c.brightRed));
      console.log();
      return;
    }
    
    const displayLimit = Math.min(limit, parsedItems.length);
    for (let i = 0; i < displayLimit; i++) {
      const item = parsedItems[i];
      const indexStr = `${i + 1}.`.padEnd(3);
      console.log(`${color(indexStr, c.brightCyan)} ${color(item.title, c.bold + c.white)}`);
      console.log(`    Source: ${color(item.source, c.brightGreen)}  |  Time: ${color(formatTime(item.pubDate), c.gray)}`);
      console.log(`    Link:   ${color(item.link, c.underline + c.brightBlue)}`);
      console.log();
    }
    
  } catch (err) {
    clearInterval(loadingInterval);
    process.stdout.write('\r\x1b[K');
    console.error(color(`Error fetching headlines: ${err.message}`, c.bold + c.brightRed));
    process.exit(1);
  }
}

/**
 * Minimal Command-Line Arguments Parser
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let isInteractive = true;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--search' || arg === '-s') {
      currentSearch = args[++i];
      isInteractive = false;
    } else if (arg === '--topic' || arg === '-t') {
      const topicArg = args[++i];
      if (topicArg) {
        const matchedTopic = TOPICS.find(t => t.code.toLowerCase() === topicArg.toLowerCase() || t.name.toLowerCase() === topicArg.toLowerCase());
        if (matchedTopic) {
          currentTopic = matchedTopic.code;
        } else {
          console.error(color(`Warning: Unknown topic "${topicArg}". Falling back to Top Stories.`, c.brightYellow));
          console.error(`Available topics: ${TOPICS.map(t => t.code.toLowerCase()).join(', ')}\n`);
        }
      }
      isInteractive = false;
    } else if (arg === '--limit' || arg === '-l') {
      const limitVal = parseInt(args[++i], 10);
      if (!isNaN(limitVal) && limitVal > 0) {
        limit = limitVal;
      }
    } else if (arg === '--hl') {
      hl = args[++i] || hl;
    } else if (arg === '--gl') {
      gl = args[++i] || gl;
    } else if (arg === '--ceid') {
      ceid = args[++i] || ceid;
    } else if (arg === '--interactive' || arg === '-i') {
      isInteractive = true;
    } else {
      // Unrecognized positional arg could be a direct search query
      if (!currentSearch && !currentTopic) {
        currentSearch = arg;
        isInteractive = false;
      }
    }
  }
  
  return isInteractive;
}

function printHelp() {
  const cols = 80;
  console.log('\n' + color('═'.repeat(cols), c.brightCyan));
  console.log(color(centerText('GOOGLE NEWS CLI - HELP GUIDE', cols), c.bold + c.brightWhite));
  console.log(color('═'.repeat(cols), c.brightCyan) + '\n');
  
  console.log(`${c.bold}USAGE:${c.reset}`);
  console.log(`  agy-node bin/google-news.js [options]\n`);
  
  console.log(`${c.bold}OPTIONS:${c.reset}`);
  console.log(`  ${color('-h, --help', c.brightCyan).padEnd(30)} Display this help manual`);
  console.log(`  ${color('-i, --interactive', c.brightCyan).padEnd(30)} Force interactive TUI mode (default if no args specified)`);
  console.log(`  ${color('-s, --search <query>', c.brightCyan).padEnd(30)} Get latest news matching a search query (CLI mode)`);
  console.log(`  ${color('-t, --topic <topic>', c.brightCyan).padEnd(30)} Get news filtering by topic (CLI mode)`);
  console.log(`  ${color('-l, --limit <count>', c.brightCyan).padEnd(30)} Set limit on headlines returned in CLI mode (default: 20)`);
  console.log(`  ${color('--hl <lang>', c.brightCyan).padEnd(30)} Set Google News language parameter (e.g. en, es, fr)`);
  console.log(`  ${color('--gl <country>', c.brightCyan).padEnd(30)} Set Google News country parameter (e.g. US, GB, ES, IN)`);
  console.log(`  ${color('--ceid <ceid>', c.brightCyan).padEnd(30)} Set Google News custom edition ID (default gl:hl)`);
  console.log();
  
  console.log(`${c.bold}AVAILABLE TOPICS:${c.reset}`);
  console.log(`  ${TOPICS.map(t => color(t.code.toLowerCase(), c.brightGreen)).join(', ')}\n`);
  
  console.log(`${c.bold}INTERACTIVE SHORTCUTS (TUI MODE):${c.reset}`);
  console.log(`  ${color('Arrow Up/Down', c.brightCyan).padEnd(25)} Navigate lists and actions`);
  console.log(`  ${color('Enter', c.brightCyan).padEnd(25)} Select / Confirm choice`);
  console.log(`  ${color('S', c.brightCyan).padEnd(25)} Open search input prompt`);
  console.log(`  ${color('T', c.brightCyan).padEnd(25)} Open topic switcher menu`);
  console.log(`  ${color('R', c.brightCyan).padEnd(25)} Refresh news feed`);
  console.log(`  ${color('Esc / Q / Backspace', c.brightCyan).padEnd(25)} Back / Quit application`);
  console.log('\n' + color('─'.repeat(cols), c.gray));
}

// Entry Point
const startInteractive = parseArgs();
if (startInteractive) {
  initInteractiveMode();
} else {
  runCommandLineMode();
}
