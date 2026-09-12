# Prompt Vault

A minimal browser extension that saves your favorite prompts and injects them straight into any AI tool's input box — ChatGPT, Claude, Gemini, and others.

## Features

- **Save** — store a prompt with a title.
- **Edit** — update a saved prompt's title or text anytime.
- **Delete** — remove prompts you no longer need.
- **Inject** — click a saved prompt to drop it straight into the currently focused AI input box.
- Works on (most) AI tool websites — the extension detects the input box automatically.
- A small "PV" logo appears right on the input box (inline with the site's own send/mic button where possible) so you always know where to click.
- Manage and inject prompts from the toolbar popup too, not just the on-page logo.
- Keyboard shortcut: `Ctrl+Shift+P` (`Cmd+Shift+P` on Mac) opens the vault at your last focused input box.
- Clean black-and-white UI, no clutter.

## Install (unpacked)

1. Download/clone this repo.
2. Go to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder.

## How it works

- Click into any AI tool's text box → the PV logo appears next to it.
- Click the logo → pick a saved prompt to inject, or add/edit/delete from the same panel.
- Or open the extension's toolbar icon to manage your vault directly.

## ⚠️ First release — expect some rough edges

This is the first launch of Prompt Vault. Every AI site builds its input box differently, so the logo's placement and injection behavior have been tested on the major tools but may not be perfect everywhere yet.

If you run into a bug, layout issue, or a site where it doesn't work as expected, **please share your feedback or open an issue** — reviews and bug reports genuinely help improve the extension for the next update.

## Tech

- Manifest V3
- Vanilla JS/CSS, no frameworks
- `chrome.storage.local` for saving prompts

## License

Feel free to use, fork, and adapt.
