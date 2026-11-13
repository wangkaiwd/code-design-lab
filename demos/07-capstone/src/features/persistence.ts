import type { LibraryX } from '../core/LibraryX.ts'
import type { State } from '../core/types.ts'

// 存储介质用适配器隔离（第 5 种手段），持久化功能不关心存到哪里。
export interface Storage {
  get(key: string): Promise<string | undefined>
  set(key: string, value: string): Promise<void>
}

const KEY = 'libraryx:state'

// 显式返回可选能力，不修改实例，也不为未安装功能的实例声明方法。
export function createPersistence(x: Pick<LibraryX, 'getState' | 'setState'>, storage: Storage) {
  return {
    async save() {
      await storage.set(KEY, JSON.stringify(x.getState()))
    },
    async restore() {
      const saved = await storage.get(KEY)
      // 本例只读取由 save 写入的 State JSON；外部数据的 schema 校验不在此例范围内。
      if (saved !== undefined) x.setState(JSON.parse(saved) as State)
    },
  }
}

export function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    async get(key) {
      return map.get(key)
    },
    async set(key, value) {
      map.set(key, value)
    },
  }
}
