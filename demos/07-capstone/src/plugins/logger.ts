import type { Plugin } from '../core/types.ts'

export const logger: Plugin = (x) => {
  x.hooks.init.tap('logger', ({ initialState }) => console.log('  [logger] init', initialState))
  x.hooks.change.tap('logger', ({ prev, next }) => console.log('  [logger] change', prev, '→', next))
}
