import { Parser } from './class-lib.ts'

const parser = new Parser({ separator: '&' })
console.log(parser.parse('a=1&b=2'))
