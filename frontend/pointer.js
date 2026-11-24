/** Map a click on a letterboxed picture to image pixels. Padding clicks return null. */
export function mapPictureClick(input) {
  if (input.boxWidth <= 0 || input.boxHeight <= 0 || input.imageWidth <= 0 || input.imageHeight <= 0) return null
  const scale = Math.min(input.boxWidth / input.imageWidth, input.boxHeight / input.imageHeight)
  const drawnWidth = input.imageWidth * scale
  const drawnHeight = input.imageHeight * scale
  const offsetX = (input.boxWidth - drawnWidth) / 2
  const offsetY = (input.boxHeight - drawnHeight) / 2
  const localX = input.clientX - input.boxLeft - offsetX
  const localY = input.clientY - input.boxTop - offsetY
  if (localX < 0 || localY < 0 || localX > drawnWidth || localY > drawnHeight) return null
  return {
    x: Math.round(localX / scale),
    y: Math.round(localY / scale),
  }
}
