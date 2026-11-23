/** Read width and height from a JPEG buffer. Returns null when the buffer is not a JPEG. */
export function jpegSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null
  let offset = 2
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) return null
    const marker = buffer[offset + 1] ?? 0
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2
      continue
    }
    const length = buffer.readUInt16BE(offset + 2)
    if (length < 2 || offset + 2 + length > buffer.length) return null
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      }
    }
    offset += 2 + length
  }
  return null
}
