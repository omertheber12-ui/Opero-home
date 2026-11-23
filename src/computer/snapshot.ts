import type { Page } from "playwright"
import { CONTROL_NAME_LIMIT, MAX_CONTROLS } from "../config.js"
import type { PageControl } from "../domain/types.js"

type RawControl = { ref: number; role: string; name: string }

export async function collectControls(page: Page): Promise<PageControl[]> {
  return page.evaluate(({ nameLimit, maxControls }) => {
    const ATTR = "data-opero-ref"
    for (const old of document.querySelectorAll(`[${ATTR}]`)) old.removeAttribute(ATTR)

    const selector =
      'a[href], button, input:not([type="hidden"]), textarea, select, [role="button"], [role="link"], [role="textbox"], [role="searchbox"], [contenteditable="true"]'
    const nodes = Array.from(document.querySelectorAll(selector)) as HTMLElement[]
    const out: RawControl[] = []
    let next = 1

    for (const el of nodes) {
      const style = window.getComputedStyle(el)
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue
      const rect = el.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) continue
      if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) continue

      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const top = document.elementFromPoint(cx, cy)
      if (top && top !== el && !el.contains(top) && !top.contains(el)) continue

      const role = (el.getAttribute("role") || el.tagName.toLowerCase()).slice(0, 24)
      const name = (
        el.getAttribute("aria-label") ||
        el.getAttribute("placeholder") ||
        el.getAttribute("name") ||
        el.getAttribute("title") ||
        (el instanceof HTMLInputElement ? el.value : "") ||
        el.innerText ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, nameLimit)
      if (!name) continue

      el.setAttribute(ATTR, String(next))
      out.push({ ref: next, role, name })
      next += 1
      if (out.length >= maxControls) break
    }
    return out
  }, { nameLimit: CONTROL_NAME_LIMIT, maxControls: MAX_CONTROLS })
}

export function formatControls(controls: PageControl[]): string {
  if (controls.length === 0) return "(no interactive controls visible)"
  return controls.map((control) => `[${control.ref}] ${control.role}: ${control.name}`).join("\n")
}
