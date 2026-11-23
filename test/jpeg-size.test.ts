import { describe, expect, it } from "vitest"
import { jpegSize } from "../src/computer/jpeg-size.js"

describe("jpeg size", () => {
  it("reads width and height from a start-of-frame marker", () => {
    const jpeg = Buffer.from([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x02, 0x00, 0x03, 0x01, 0x01, 0x11, 0x00,
      0xff, 0xd9,
    ])
    expect(jpegSize(jpeg)).toEqual({ width: 3, height: 2 })
    expect(jpegSize(Buffer.from("screenshot"))).toBeNull()
  })
})
