# HFviewer

HFviewer is a userscript that improves browsing on HF by replacing traditional tables with a modern, image-based card layout. It is inspired by EMPViewer and is designed to make browsing large lists faster, cleaner, and more visual.

## Features

- Converts HF tables into a **grid-based card view**
- Large **cover images** with lazy loading
- Displays key info at a glance:
  - Title
  - Category
  - Size
  - S & L
  - Status icons (free, bookmarks, new, etc.)
- **Content preferences**:
  - Like / dislike tags
  - Like / dislike categories
  - Highlight liked
  - Blur or hide disliked
- **View controls**:
  - Minimal mode
  - Adjustable column count
  - Preserve original HF tags or show fewer tags
- Preferences are saved locally in your browser

## Installation

### 1. Install a userscript manager

HFviewer requires a userscript manager. Recommended: **Tampermonkey** (Chrome, Firefox, Edge)

### 2. Install HFviewer

Open the [raw](https://github.com/lunnicingus/HF-viewer/raw/main/HFviewer.user.js) userscript in the browser after the extension is installed. The userscript manager should prompt to install the script.

In case this does not happen, click the Tampermonkey toolbar icon ➡️ `Create a new script...`, copy the contents of the script into the editor and save it.

## Usage

Visit any supported HF page. The table will automatically be replaced with the HFviewer card layout.

At the top of the page, HFviewer adds a control bar where you can:

- Toggle **Minimal** mode
- Set the number of columns
- Preserve original HF tags
- Open **Content Preferences**

### Content Preferences

You can define:

- Tags you like
- Tags you dislike
- Categories you like
- Categories you dislike
- Option to hide disliked completely

Preferences are stored in `localStorage` under `HFviewer_settings`.

## Security & Privacy

- No network requests or telemetry
- No access to cookies or credentials
- No downloads or tracker interaction
- Uses only local browser storage for settings

HFviewer only reads data already visible on HF pages and re-renders it
in a different layout.

## Credits

- Inspired by **EMPViewer**
- Uses **Preact** and **HTM**
- Original author: `lunnicingus`
- Additional edits and fixes by nhj4365
