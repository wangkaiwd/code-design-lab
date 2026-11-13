import { createParser, parse } from './parser.ts'

const parser = createParser({ separator: '&' })
console.log(parse(parser, 'a=1&b=2'))
