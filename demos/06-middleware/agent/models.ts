import type { ChatModel, Tool } from './create-agent.ts'

export const primaryModel: ChatModel = {
  name: 'primary',
  async invoke() {
    throw new Error('429 Too Many Requests')
  },
}

// 模拟模型：收到问题先查天气，拿到工具结果后给出回答
export const backupModel: ChatModel = {
  name: 'backup',
  async invoke(messages) {
    const last = messages.at(-1)!
    if (last.role === 'tool') return { role: 'ai', content: `查到了，${last.content}`, toolCalls: [] }
    return {
      role: 'ai',
      content: '',
      toolCalls: [{ id: `call_${messages.length}`, name: 'get_weather', args: { city: '杭州' } }],
    }
  },
}

// 每次新建都会让第一次调用超时，用来演示重试
export function createWeatherTool(): Tool {
  let calls = 0
  return {
    name: 'get_weather',
    async invoke({ city }) {
      calls++
      if (calls === 1) throw new Error('timeout')
      return `${city}：晴，22°C`
    },
  }
}
