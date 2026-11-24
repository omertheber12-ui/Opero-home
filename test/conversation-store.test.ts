import { describe, expect, it } from "vitest"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { blankMission } from "../src/domain/mission.js"
import { openConversation } from "../src/store/conversation-store.js"

describe("conversation store", () => {
  it("appends lines and returns them after reload", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-conversation-"))
    const { store } = await openConversation(dir)
    await store.appendMessage("user", "Find the heading")
    await store.appendMessage("agent", "I'm on it.")
    const again = await openConversation(dir)
    expect(again.store.snapshot().messages.map((message) => message.text)).toEqual([
      "Find the heading",
      "I'm on it.",
    ])
    expect(again.store.recentThread()).toEqual([
      { role: "user", text: "Find the heading" },
      { role: "agent", text: "I'm on it." },
    ])
    expect(again.abortedLeftover).toBeNull()
  })

  it("imports a leftover live mission as aborted so it cannot block the next request", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-conversation-"))
    const leftover = blankMission("m-old", "Stuck mission", 2)
    leftover.status = "waiting_on_user"
    leftover.question = "Tell me how to continue"
    leftover.questionReason = "machine"
    const { store, abortedLeftover } = await openConversation(dir, {
      mission: leftover,
      lastActivityMs: Date.now(),
    })
    const mission = store.snapshot().missions[0]
    expect(mission?.id).toBe("m-old")
    expect(mission?.status).toBe("aborted")
    expect(abortedLeftover?.id).toBe("m-old")
    expect(abortedLeftover?.status).toBe("aborted")
    const raw = JSON.parse(await readFile(join(dir, "conversation.json"), "utf8")) as {
      missions: Array<{ status: string }>
    }
    expect(raw.missions[0]?.status).toBe("aborted")
  })

  it("aborts a live mission already on disk when the thread is empty", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-conversation-"))
    const stuck = blankMission("m-stuck", "Old leftover", 2)
    stuck.status = "waiting_on_user"
    stuck.question = "How should I continue?"
    stuck.questionReason = "machine"
    await writeFile(
      join(dir, "conversation.json"),
      JSON.stringify({
        id: "conversation_house",
        messages: [],
        missions: [stuck],
        updatedAt: Date.now(),
      }),
    )
    const { store, abortedLeftover } = await openConversation(dir)
    expect(store.snapshot().missions[0]?.status).toBe("aborted")
    expect(abortedLeftover?.id).toBe("m-stuck")
    expect(abortedLeftover?.status).toBe("aborted")
  })

  it("returns aborted leftover for house sync when conversation already aborted but house is still live", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-conversation-"))
    const aborted = blankMission("m1", "Stuck mission", 2)
    aborted.status = "aborted"
    await writeFile(
      join(dir, "conversation.json"),
      JSON.stringify({
        id: "conversation_house",
        messages: [],
        missions: [aborted],
        updatedAt: Date.now(),
      }),
    )
    const houseLive = blankMission("m1", "Stuck mission", 2)
    houseLive.status = "waiting_on_user"
    houseLive.question = "Tell me how to continue"
    houseLive.questionReason = "machine"
    const { store, abortedLeftover } = await openConversation(dir, {
      mission: houseLive,
      lastActivityMs: Date.now(),
    })
    expect(store.snapshot().missions[0]?.status).toBe("aborted")
    expect(abortedLeftover?.id).toBe("m1")
    expect(abortedLeftover?.status).toBe("aborted")
  })

  it("saves mission status updates", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-conversation-"))
    const { store } = await openConversation(dir)
    const mission = blankMission("m1", "Open example.com", 2)
    mission.status = "running"
    await store.saveMission(mission)
    await store.saveMission({ ...mission, status: "aborted" })
    expect(store.snapshot().missions).toHaveLength(1)
    expect(store.snapshot().missions[0]?.status).toBe("aborted")
  })

  it("keeps a clarifying question in the thread after it is recorded", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-conversation-"))
    const { store } = await openConversation(dir)
    await store.appendMessage("user", "Book me an appointment at the Ministry of Transport.")
    await store.appendMessage("agent", "For which branch and what service?")
    await store.appendMessage("user", "License renewal and Tel Aviv.")
    expect(store.recentThread()).toEqual([
      { role: "user", text: "Book me an appointment at the Ministry of Transport." },
      { role: "agent", text: "For which branch and what service?" },
      { role: "user", text: "License renewal and Tel Aviv." },
    ])
    const again = await openConversation(dir)
    expect(again.store.snapshot().messages.map((message) => message.text)).toEqual([
      "Book me an appointment at the Ministry of Transport.",
      "For which branch and what service?",
      "License renewal and Tel Aviv.",
    ])
  })
})
