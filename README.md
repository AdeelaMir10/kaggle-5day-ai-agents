# Google News CLI

A stunning, zero-dependency command-line interface and terminal user interface (TUI) for Google News, built entirely in native Node.js. 

This application uses the native Node.js `fetch` API, raw keyboard events for scrolling and menus, and custom ANSI color escapes for beautiful formatting—requiring **zero npm package installations**.

---

## Features

- 📰 **Interactive TUI Dashboard**: Keyboard-driven UI to scroll through stories, view full details, and select actions.
- 🔍 **Live Search**: Press `S` in the TUI or pass a search term via the command line.
- 🏷️ **Topic Filtering**: Switch between topics (World, National, Business, Technology, Science, Health, Sports, Entertainment) interactively or via CLI flags.
- 🌐 **Browser Integration**: Select any article to open it directly in your default browser.
- 🌍 **Localization Support**: Adjust language and country configurations dynamically.
- ⚡ **Zero-Dependency & Fast**: Instant start times, no `node_modules` required.

---

## How to Run

Since Node.js is running through the local wrapper cmdlet `agy-node`, run the application using:

```bash
# Launch the Interactive Dashboard (TUI)
agy-node bin/google-news.js

# Launch TUI directly with a Topic
agy-node bin/google-news.js --topic technology

# Run in command line mode to search for a term
agy-node bin/google-news.js --search "quantum computing" --limit 10

# View command-line help
agy-node bin/google-news.js --help
```

---

## Command Line Arguments

| Argument | Shorthand | Description | Default |
| :--- | :--- | :--- | :--- |
| `--help` | `-h` | Display help guidelines | - |
| `--interactive` | `-i` | Force interactive TUI mode | (Default) |
| `--search <query>` | `-s` | Query search terms (CLI mode) | - |
| `--topic <topic>` | `-t` | Filter news by topic (CLI mode) | - |
| `--limit <limit>` | `-l` | Limit of stories printed in CLI mode | `20` |
| `--hl <lang>` | - | Set Google News language | `en` |
| `--gl <country>` | - | Set Google News country | `US` |

Available topics: `world`, `nation`, `business`, `technology`, `entertainment`, `sports`, `science`, `health`.

---

## Interactive Shortcuts (TUI Mode)

- `Arrow Up` / `Arrow Down` : Navigate articles or menus.
- `Enter` : Open details for the selected article or execute a chosen menu option.
- `S` : Trigger interactive keyword search.
- `T` : Open interactive topic selector menu.
- `R` : Refresh the current news feed.
- `Backspace` / `Esc` / `B` : Go back to the article list from details or topic menu.
- `Q` / `Esc` (on main list) : Exit and close the application.
