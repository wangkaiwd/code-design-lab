export type State = Readonly<{ user: string; count: number }>

export type Events = {
  change: { prev: State; next: State }
}
