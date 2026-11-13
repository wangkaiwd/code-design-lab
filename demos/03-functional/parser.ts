export type ParserInstance = Readonly<{ separator: string }>

export function createParser(options: { separator: string }): ParserInstance {
  return { separator: options.separator }
}

// 相关函数放在同一个文件，也能按具名导出 tree-shake。
// 日志仅用于在打包产物中识别实现；独立函数本身不意味着没有副作用。
export function parse(parser: ParserInstance, input: string) {
  console.log('[impl] parse')
  return Object.fromEntries(input.split(parser.separator).map((pair) => pair.split('=')))
}

export function format(parser: ParserInstance, data: Record<string, string>) {
  console.log('[impl] format')
  return Object.entries(data)
    .map(([key, value]) => `${key}=${value}`)
    .join(parser.separator)
}

export function validate(parser: ParserInstance, input: string) {
  console.log('[impl] validate')
  return input.split(parser.separator).every((pair) => /^[^=]+=[^=]*$/.test(pair))
}
