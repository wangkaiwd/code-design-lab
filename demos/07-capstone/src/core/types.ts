import type { LibraryX } from './LibraryX.ts'

export type State = Readonly<{ user: string; count: number }>
export type ChangeEvent = { prev: State; next: State }
export type Options = { initialState: State }
export type Plugin = (x: LibraryX) => void
