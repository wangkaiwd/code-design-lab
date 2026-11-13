export class Parser {
  #separator: string

  constructor(options: { separator: string }) {
    this.#separator = options.separator
  }

  parse(input: string) {
    console.log('[impl] parse')
    return Object.fromEntries(input.split(this.#separator).map((pair) => pair.split('=')))
  }

  format(data: Record<string, string>) {
    console.log('[impl] format')
    return Object.entries(data)
      .map(([key, value]) => `${key}=${value}`)
      .join(this.#separator)
  }

  validate(input: string) {
    console.log('[impl] validate')
    return input.split(this.#separator).every((pair) => /^[^=]+=[^=]*$/.test(pair))
  }
}
