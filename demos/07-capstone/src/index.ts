import { LibraryX } from './core/LibraryX.ts'
import type { Options } from './core/types.ts'

export function createX(options: Options) {
  return new LibraryX(options)
}

export type { LibraryX }
export type { Options, Plugin, State } from './core/types.ts'
