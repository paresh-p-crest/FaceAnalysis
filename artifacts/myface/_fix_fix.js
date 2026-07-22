const fs = require('fs')
const p = 'app/globals.css'
let s = fs.readFileSync(p, 'utf8')
const replacements = [
  ["font-family: 'Inter', system-ui, sans-serif !important", "font-family: 'Inter', Helvetica, Arial, sans-serif !important"],
  ["font-family: 'Inter', system-ui, sans-serif", "font-family: 'Inter', Helvetica, Arial, sans-serif"],
  ["font-family: 'Sora', 'Inter', system-ui, sans-serif !important", "font-family: 'Inter', Helvetica, Arial, sans-serif !important"],
  ["font-family: 'Sora', 'Inter', sans-serif !important", "font-family: 'Inter', Helvetica, Arial, sans-serif !important"],
]
for (const [a, b] of replacements) s = s.split(a).join(b)
fs.writeFileSync(p, s)
console.log('Sora left', (s.match(/Sora/g) || []).length)
console.log('Instrument left', (s.match(/Instrument/g) || []).length)
console.log('Inter Helvetica count', (s.match(/Inter', Helvetica/g) || []).length)
