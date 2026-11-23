import { describe, expect, it } from "vitest"
import { mapPictureClick } from "../src/chat/pointer.js"

describe("picture clicks", () => {
  it("ignores letterbox padding and maps the painted image", () => {
    const padded = mapPictureClick({
      clientX: 100,
      clientY: 10,
      boxLeft: 0,
      boxTop: 0,
      boxWidth: 1280,
      boxHeight: 800,
      imageWidth: 1280,
      imageHeight: 720,
    })
    expect(padded).toBeNull()

    const onImage = mapPictureClick({
      clientX: 640,
      clientY: 40,
      boxLeft: 0,
      boxTop: 0,
      boxWidth: 1280,
      boxHeight: 800,
      imageWidth: 1280,
      imageHeight: 720,
    })
    expect(onImage).toEqual({ x: 640, y: 0 })
  })

  it("scales a larger screenshot into the frame", () => {
    const point = mapPictureClick({
      clientX: 640,
      clientY: 400,
      boxLeft: 0,
      boxTop: 0,
      boxWidth: 1280,
      boxHeight: 800,
      imageWidth: 2560,
      imageHeight: 1600,
    })
    expect(point).toEqual({ x: 1280, y: 800 })
  })
})
