export const XAI_API_ORIGIN = "https://api.x.ai/v1"
export const XAI_CHAT_URL = `${XAI_API_ORIGIN}/chat/completions`
export const XAI_MODELS_URL = `${XAI_API_ORIGIN}/models`

export const BIND_HOST = "127.0.0.1"
export const DEFAULT_PORT = 8787
export const DEFAULT_MODEL = "grok-4.7"

export const BLANK_URL = "about:blank"
export const CHROME_NEW_TAB_URL = "chrome://newtab/"
export const CHROME_NEW_TAB_PREFIX = "chrome://new-tab"

export const VIEWPORT_WIDTH = 1280
export const VIEWPORT_HEIGHT = 800
export const SCREENSHOT_QUALITY = 60
export const SCREEN_INTERVAL_MS = 1000

export const MAX_TURNS = 40
export const EMPTY_PAGE_WAITS = 2
export const EMPTY_PAGE_WAIT_MS = 800
export const ACTION_WAIT_DEFAULT_MS = 1000
export const ACTION_WAIT_MAX_MS = 5000
export const NAV_TIMEOUT_MS = 45_000
export const PAGE_TEXT_WAIT_MS = 8_000
export const MIN_PAGE_TEXT = 40
export const CHAR_DELAY_MS = 45
export const SCROLL_DELTA = 600
export const MAX_CONTROLS = 80
export const CONTROL_NAME_LIMIT = 80

export const QUEUED_MESSAGE = "Queued until the current mission finishes."
export const UNREAD_PLAN = "I could not read the planner reply."
export const UNREAD_ACTION = "I could not read the next action."
export const MISSING_GROK_KEY = "Add your Grok API key in the setup card to run live missions."
export const MISSING_GROK_KEY_SHORT = "Add your Grok API key in the setup card first."
export const MISSING_GROK_KEY_ASK = "Add your Grok API key first."
export const MISSING_BROWSERBASE_KEY = "Add BROWSERBASE_API_KEY to .env. Live mode uses Browserbase Chrome."
