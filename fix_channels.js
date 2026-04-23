const fs = require('fs')

const filePath = 'G:\\PetBiz-ERP\\src\\pages\\Financials.jsx'
const buf = fs.readFileSync(filePath)

// Helper: find byte sequence in buffer
function findSeq(buf, seq, start = 0) {
  outer: for (let i = start; i <= buf.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) {
      if (buf[i + j] !== seq[j]) continue outer
    }
    return i
  }
  return -1
}

function replaceSeq(buf, oldSeq, newSeq) {
  const idx = findSeq(buf, oldSeq)
  if (idx === -1) return { buf, found: false }
  const result = Buffer.concat([buf.slice(0, idx), Buffer.from(newSeq), buf.slice(idx + oldSeq.length)])
  return { buf: result, found: true }
}

// Big5 bytes:
// 電商 = B9 71 B0 D3
// 市集 = A5 AB B6 B0
// 社群 = AA E7 B8 D5
// 寄賣點銷售 = B1 BC BB C4 C2 49 BB DA B0 DD
// 大宗/B2B = A4 6A A9 D7 2F 42 32 42
// 其他營收 = A8 E4 A5 58 C1 60 A6 C9

// 1. Replace CHANNELS array
// old: ['電商', '市集']
// B9 71 B0 D3 = 電商, A5 AB B6 B0 = 市集
const oldChannels = [
  0x27, 0xB9, 0x71, 0xB0, 0xD3, 0x27, 0x2C, 0x20, 0x27, 0xA5, 0xAB, 0xB6, 0xB0, 0x27
]
// new grouped structure
const newChannels = Buffer.from(
  "[\n  { group: '\u7dda\u4e0a', options: ['\u96fb\u5546', '\u793e\u7fa4'] },\n  { group: '\u7dda\u4e0b', options: ['\u5e02\u96c6', '\u5bc4\u8ce3\u9ede\u92b7\u552e'] },\n  { group: '\u5176\u4ed6', options: ['\u5927\u5b97/B2B', '\u5176\u4ed6\u71df\u6536'] },\n]\nconst CHANNELS_FLAT = CHANNELS.flatMap(g => g.options)",
  'utf8'
)

// Find the bracket start of ['電商', '市集']
const bracketSeq = [0x5B, 0x27, 0xB9, 0x71, 0xB0, 0xD3, 0x27, 0x2C, 0x20, 0x27, 0xA5, 0xAB, 0xB6, 0xB0, 0x27, 0x5D]
let r = replaceSeq(buf, bracketSeq, newChannels)
console.log('CHANNELS found:', r.found)
let out = r.buf

// 2. Replace channelColor
// old: { '電商': 'orange', '市集': 'green' }
const oldColorSeq = [
  0x7B, 0x20, 0x27, 0xB9, 0x71, 0xB0, 0xD3, 0x27, 0x3A, 0x20, 0x27, 0x6F, 0x72, 0x61, 0x6E, 0x67, 0x65, 0x27, 0x2C, 0x20,
  0x27, 0xA5, 0xAB, 0xB6, 0xB0, 0x27, 0x3A, 0x20, 0x27, 0x67, 0x72, 0x65, 0x65, 0x6E, 0x27, 0x20, 0x7D
]
const newColorStr = "{\n    '\u96fb\u5546': 'orange', '\u793e\u7fa4': 'orange',\n    '\u5e02\u96c6': 'green',  '\u5bc4\u8ce3\u9ede\u92b7\u552e': 'green',\n    '\u5927\u5b97/B2B': 'blue', '\u5176\u4ed6\u71df\u6536': 'gray',\n  }"
r = replaceSeq(out, oldColorSeq, Buffer.from(newColorStr, 'utf8'))
console.log('channelColor found:', r.found)
out = r.buf

// 3. Replace revForm initial channel: '電商' (B9 71 B0 D3)
// Find: channel: '電商' in useState
// 27 B9 71 B0 D3 27 = '電商'
const oldRevChannel = [0x63, 0x68, 0x61, 0x6E, 0x6E, 0x65, 0x6C, 0x3A, 0x20, 0x27, 0xB9, 0x71, 0xB0, 0xD3, 0x27]
const newRevChannel = Buffer.from("channel: '\u96fb\u5546'", 'utf8')
// Replace all occurrences
let searchFrom = 0
let replaceCount = 0
while (true) {
  const idx = findSeq(out, oldRevChannel, searchFrom)
  if (idx === -1) break
  out = Buffer.concat([out.slice(0, idx), newRevChannel, out.slice(idx + oldRevChannel.length)])
  searchFrom = idx + newRevChannel.length
  replaceCount++
}
console.log('revForm channel replaced:', replaceCount, 'times')

// 4. Replace CHANNELS.map(c => <option key={c}>{c}</option>)
const oldMapSeq = Buffer.from('{CHANNELS.map(c => <option key={c}>{c}</option>)}', 'utf8')
const newMapStr = `{CHANNELS.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.options.map(c => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                ))}`
r = replaceSeq(out, [...oldMapSeq], Buffer.from(newMapStr, 'utf8'))
console.log('CHANNELS.map found:', r.found)
out = r.buf

fs.writeFileSync(filePath, out)
console.log('Done. Size:', out.length)
