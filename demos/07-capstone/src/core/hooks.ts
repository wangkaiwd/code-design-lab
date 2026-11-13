export class Hook<Args extends unknown[]> {
  #taps: { name: string; fn: (...args: Args) => void }[] = []

  tap(name: string, fn: (...args: Args) => void) {
    const tap = { name, fn }
    this.#taps.push(tap)
    return () => {
      this.#taps = this.#taps.filter((item) => item !== tap)
    }
  }

  call(...args: Args) {
    for (const { fn } of this.#taps) fn(...args)
  }
}
