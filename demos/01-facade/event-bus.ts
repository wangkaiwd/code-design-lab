type Handler<T> = (payload: T) => void

export class EventBus<Events extends Record<string, unknown>> {
  #handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {}

  on<K extends keyof Events>(type: K, handler: Handler<Events[K]>) {
    const handlers = (this.#handlers[type] ??= new Set())
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
    }
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]) {
    this.#handlers[type]?.forEach((handler) => handler(payload))
  }
}
