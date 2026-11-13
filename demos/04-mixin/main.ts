import { $, Q } from './core.ts'
import './attributes.ts'
import './events.ts'

const classesOf = (q: Q) => q.elements.map((el) => [...el.classes])

console.log('— 各文件把方法挂到同一个原型上 —')
const list = $('li', 'li')
list.on('classchange', (el) => console.log(`  [event] ${el.tag} classchange`))
list.addClass('active')
console.log('  classes:', classesOf(list))

console.log('\n— 原型上的方法看不出来自哪个文件 —')
console.log(' ', Object.getOwnPropertyNames(Q.prototype))

console.log('\n— 加载第三方插件后，同名方法被静默覆盖 —')
await import('./legacy-plugin.ts')
list.addClass('selected')
console.log('  classes:', classesOf(list))
