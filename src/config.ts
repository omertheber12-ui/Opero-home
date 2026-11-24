export const XAI_API_ORIGIN = "https://api.x.ai/v1"
export const XAI_CHAT_URL = `${XAI_API_ORIGIN}/chat/completions`
export const XAI_MODELS_URL = `${XAI_API_ORIGIN}/models`

export const BIND_HOST = "127.0.0.1"
export const DEFAULT_PORT = 8787
export const DEFAULT_MODEL = "grok-4.7"
/** Plan and chat stay on the deepest setting. A review is a short verdict, so it uses the fast setting of the same model. */
export const PLANNER_REASONING_EFFORT = "high"
export const ACTOR_REASONING_EFFORT = "high"
export const REVIEW_REASONING_EFFORT = "low"
export const PAGE_TITLE_IS_HEADING =
  "If HEADINGS is empty, PAGE_TITLE is the main heading. doneWhen describes the moment; it is not a phrase to search for on the page. Do not ask to open another address when the browser is already on the step site."

export const BLANK_URL = "about:blank"
export const CHROME_NEW_TAB_URL = "chrome://newtab/"
export const CHROME_NEW_TAB_PREFIX = "chrome://new-tab"
export const CHROME_URL_PREFIX = "chrome://"

export const VIEWPORT_WIDTH = 1280
export const VIEWPORT_HEIGHT = 800
export const SCREENSHOT_QUALITY = 60
export const SCREEN_INTERVAL_MS = 1000
export const GRACE_POLL_MS = 30_000
export const WORK_STATUS_POLL_MS = 1000
export const SUPERVISE_POLL_MS = 2000
export const MISSION_ABORT_MS = 30 * 60 * 1000
export const THREAD_RECENT = 40

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

export const STALL_ACTIONS = 3
export const STRATEGY_LIMIT = 5
export const RECOVERY_LIMIT = 3
export const CHALLENGE_ATTEMPT_LIMIT = 3
export const BUDGET_PER_STEP = 8
export const BUDGET_MIN = 16
export const BUDGET_MAX = 48
export const RECENT_ACTIONS = 2
export const RECENT_RESULTS = 5
export const SPARSE_CONTROLS = 3
export const SPARSE_PAGE_TEXT = 80

export const SCREENSHOT_MASK_VALUE = "••••••••"
export const SCREENSHOT_MASK_ATTR = "data-opero-mask"
export const SCREENSHOT_MASK_ID_PREFIX = "opero-mask-"
export const FAKE_LIVE_VIEW_URL = "https://live.example/view"

export const ON_IT_MESSAGE = "I'm on it."
export const MISSION_ABORTED_QUIET = "That mission was stopped after a long quiet stretch."
export const MISSION_ABORTED_FOR_NEW = "Stopping the previous mission to start this one."
export const STEER_FAILED = "I couldn't read that. The current mission is unchanged."
export const STEER_STILL = "I'm still on this mission."
export const UNREAD_PLAN = "I could not read the planner reply."
export const UNREAD_ACTION = "I could not read the next action."
export const MISSING_GROK_KEY = "Add your Grok API key in the setup card to run live missions."
export const MISSING_GROK_KEY_SHORT = "Add your Grok API key in the setup card first."
export const MISSING_GROK_KEY_ASK = "Add your Grok API key first."
export const MISSING_BROWSERBASE_KEY = "Add BROWSERBASE_API_KEY to .env. Live mode uses Browserbase Chrome."

export const COMMIT_QUESTION = "This step submits, deletes, sends, or changes an account. Should I continue?"
export const PAUSE_QUESTION = "This step is paused. Tell me when to continue."
export const VERIFY_END_QUESTION = "I cannot verify the end on this page. Tell me how to continue, or paste the facts."
export const BUDGET_STOP_QUESTION = "I stopped after many actions without reaching the end."
export const UNKNOWN_COMMIT_QUESTION =
  "The submit may have landed, and I will not send it again. Tell me how to continue."
export const UNKNOWN_COMMIT_AFTER_DONE =
  "The submit may have landed, but I cannot confirm it. I will not send it again."
export const RESTART_QUESTION = "Opero restarted and will not repeat the last action. Tell me how to continue."
export const RESTART_AFTER_SUBMIT =
  "Opero restarted after a submit. I will not send it again. Tell me how to continue."
export const RESTART_WAKE_FAILED = "Opero restarted and the computer could not wake."
export const CLEAR_PLAN_ASK =
  "I still need a clear plan: each step needs a site, an instruction, and what finished looks like."
export const PLAN_NEEDS_FIELDS =
  "The plan needs a site, an instruction, and what finished looks like for every step."
export const REPLAN_INCOMPLETE =
  "The updated plan was incomplete. Each step needs a site, what to do, and what finished looks like on the page. Tell me how to continue."
export const REPLAN_TOO_MANY =
  "The plan changed too many times. Tell me how to continue, or send a clearer mission."
export const STRATEGY_STUCK = "The same strategy stopped making progress."
export const SITE_ERROR_PAGE = "The page is an error page."
export const BUDGET_EXHAUSTED = "The action budget was used up."
export const DECLINED_SUBMIT_NOTE = "The person declined that submit. Choose a different action."
export const EMPTY_PAGE_NOTE =
  "PAGE_DATA is empty. Wait for the page to load, then continue. Do not invent a done summary."
export const UNREAD_ACTION_NOTE =
  'The last reply was not an action. Copy lines from the page into {"type":"done","evidence":"..."}. Prefer click/type with a control number from CONTROLS.'
export const CONTINUE_CONTROLS_NOTE = "Continue toward the end. Prefer click/type with CONTROLS numbers."
export const UNGROUNDED_DONE_BROWSE =
  "That evidence is not on the page. Click or scroll a CONTROLS number to reach the facts, then copy lines from PAGE_DATA. No summary sentence."
export const UNGROUNDED_DONE_COPY =
  'That evidence is not on the page. Copy headline lines exactly from PAGE_DATA into {"type":"done","evidence":"..."}. No summary sentence.'
export const NEED_DIFFERENT_APPROACH = "I need a different approach. Tell me how to continue."
export const NEED_DECISION = "I need a decision before I continue."
export const NEED_VAULT_DETAIL = "I need a detail that is not in the vault."
export const NEED_CODE_OR_PHONE =
  "This step needs a code or a confirmation on your phone. Send it, or take the screen."
export const WRONG_DETAIL_ASK = "The site rejected that detail. I will not try it again."
export const WRONG_ACCOUNT_ASK = "The open account does not match the mission. Tell me how to continue."
export const MISSION_STOPPED = "The mission stopped."
export const PLANNER_FAILED = "The planner failed."
export const COMPUTER_DID_NOT_WAKE = "The computer did not wake."
export const NAVIGATION_FAILED = "Navigation failed."
export const POINTER_CLICK_FAILED = "Pointer click failed."
export const BOT_CHECK_TRYING = "Trying the human check"
export const CHALLENGE_TRY_NOTE = `This page is a human check. Click the checkbox or verification control. If it is not in CONTROLS, use one pointer_click. Coordinates are viewport pixels, ${VIEWPORT_WIDTH} by ${VIEWPORT_HEIGHT}.`
export const BOT_CHECK_THINKING = "I could not finish the check — handing you the browser"
export const BOT_CHECK_STATUS = "Waiting for a person to finish the check"
export const BOT_CHECK_WITH_VIEW =
  "I tried the human check and could not clear it. Open the live view, finish the check, then press I'm done."
export const BOT_CHECK_NO_VIEW =
  "I tried the human check and could not clear it. Take control on the Computer picture, finish the check, then press I'm done."
export const MISSING_DETAIL_PREFIX = "I don't have one saved detail for "
export const OPENING_PREFIX = "Opening "
export const THINKING_PLANNING = "Planning…"
export const THINKING_OPENING_COMPUTER = "Opening the computer…"
export const THINKING_READING = "Reading your message…"
export const THINKING_PROGRESS = "Working on the current step."
export const THINKING_REVIEWING = "Reviewing what went wrong…"
export const STATUS_PLANNING = "Planning the mission"
export const STATUS_OPENING_COMPUTER = "Opening the computer"
export const STATUS_CHOOSING_ACTION = "Choosing the next action"
export const STATUS_MISSION_FINISHED = "Mission finished"
export const DEFAULT_STOP_QUESTION = "I need to stop this mission."
export const DEFAULT_ASK_QUESTION = "I need a decision."
export const WRONG_ACCOUNT_TEMPLATE = (email: string) =>
  `The open account looks different from ${email}. I will not sign out. Tell me how to continue.`
export const RECOVERY_UNAVAILABLE_PREFIX = "Recovery was unavailable. "
export const STALE_REF_NOTE = (ref: number) => `Control ${ref} is not in the current snapshot.`
export const COULD_NOT_OPEN = (url: string, detail: string) => `I could not open ${url}. ${detail}`
