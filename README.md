# Opero Home

Local house agent: give a mission, Grok plans it, Playwright drives Browserbase Chrome, and the page shows chat, plan, a live screen, and Vault.

## Quick start

```bash
npm install
npm run dev
```

In a second terminal:

```bash
npm run dev:page
```

Open [http://127.0.0.1:8788](http://127.0.0.1:8788). The house socket and health JSON stay on [http://127.0.0.1:8787](http://127.0.0.1:8787). The page ↔ house boundary is documented in [frontend/CONTRACT.md](frontend/CONTRACT.md).

If no Grok key is set, the setup card asks for your xAI API key and saves it to `data/xai.key` on this machine.

Optional: copy `.env.example` to `.env` and set `XAI_API_KEY` and `BROWSERBASE_API_KEY`.

### Demo without Grok or Chrome

```bash
MODEL=fake npm run dev
```

Still start the page with `npm run dev:page` and open 8788.

### Tests

```bash
npm test
```

Runs the house suite, then the frontend suite (`npm test --prefix frontend`).

## Environment

| Variable | Purpose |
|----------|---------|
| `XAI_API_KEY` | Grok / xAI key (or paste in the UI) |
| `BROWSERBASE_API_KEY` | Cloud Chrome. Required for live browsing |
| `BROWSERBASE_PROJECT_ID` | Optional. The key identifies the project when this is unset |
| `OPERO_PLANNER_MODEL` | Default `grok-4.7` |
| `OPERO_ACTOR_MODEL` | Default `grok-4.7` |
| `OPERO_VAULT_KEY` | Auto-generated into `data/vault.key` when unset |
| `PORT` | House bind port. Default `8787` (health + WebSocket) |
| `MODEL` | `live` (default) or `fake` |

## Notes

- Live browsing opens Chrome at Browserbase and attaches over CDP. It does not launch Chrome on this Mac. Network routing through your IP is a separate later knob.
- Each turn the actor gets a numbered list of visible controls and clicks by number. Typing moves the pointer and enters one character at a time. Pixel clicks are fallback only.
- The finish gate posts only page-grounded lines to chat. A paraphrased `done` is recovered from the page or nudged to click/scroll/copy — not accepted as a summary.
- Open **Vault** in the header to save a detail by the case it fits. The value is never shown in chat or sent to the model.
- If a site asks for a person (Google, Cloudflare, or a security verification page), Opero pauses and sends the Browserbase live view. Finish the check there, or take control of the Computer picture, then press I'm done.
- Secrets under `data/` and `.env` stay local and are gitignored.
