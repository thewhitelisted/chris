export function invalidXmlChar(text) {
  for (const char of text) {
    const code = char.codePointAt(0)
    const control = code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d
    if (control || code === 0xfffe || code === 0xffff || (code >= 0xd800 && code <= 0xdfff)) {
      return `U+${code.toString(16).toUpperCase().padStart(4, '0')}`
    }
  }
  return null
}
