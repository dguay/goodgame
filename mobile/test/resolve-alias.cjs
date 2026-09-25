const Module = require('module')
const fs = require('fs')
const path = require('path')

const compiledRoot = path.join(__dirname, '../.test-build')
const original = Module.prototype.require

Module.prototype.require = function (id) {
  if (typeof id === 'string' && id.startsWith('@/')) {
    const base = path.join(compiledRoot, id.slice(2))
    const candidates = [base, `${base}.js`, path.join(base, 'index.js')]
    const found = candidates.find((candidate) => fs.existsSync(candidate))
    if (found) return original.call(this, found)
  }
  return original.apply(this, arguments)
}
