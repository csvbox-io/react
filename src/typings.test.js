import fs from 'fs'
import path from 'path'

// Reads the files instead of importing the component: the typings are written by hand, so this is
// what catches them drifting from the class (a renamed or removed member).
const typings = fs.readFileSync(path.join(__dirname, '../@types/csvbox__react.d.ts'), 'utf8')
const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8')

const classBody = typings.slice(typings.indexOf('export class CSVBoxButton'))
const declared = Array.from(classBody.matchAll(/^\s{8}(\w+)\??[(:]/gm))
  .map(m => m[1])
  .filter(name => name !== 'constructor')

describe('CSVBoxButton typings', () => {
  it('declare members', () => {
    expect(declared.length).toBeGreaterThan(5)
  })

  declared.forEach(name => {
    it(`${name} exists on the component`, () => {
      const isMethod = new RegExp('^\\t' + name + '\\(', 'm').test(source)
      const isField = new RegExp('this\\.' + name + '\\s*=').test(source)
      expect(isMethod || isField).toBe(true)
    })
  })

  it('does not declare the misspelled enableInitator', () => {
    expect(typings).not.toMatch(/enableInitator/)
  })
})
