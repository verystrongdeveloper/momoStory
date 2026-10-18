// Original synthesized UI sound: a short, rounded water-drop "pop".
const fs = require('node:fs');
const path = require('node:path');
const rate = 48000;
const duration = 0.18;
const samples = Math.round(rate * duration);
for (const kind of ['pop', 'bloop', 'bell', 'click', 'soft']) {
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
let phase = 0;
for (let i = 0; i < samples; i++) {
  const t = i / rate;
  // A quick downward pitch bend replaces the previous rising electronic chirp.
  const frequency = kind === 'bloop' ? 420 + 600 * Math.sin(Math.min(1, t / 0.1) * Math.PI / 2)
    : kind === 'bell' ? 1320 : kind === 'click' ? 1700 + 700 * Math.exp(-t * 100)
    : kind === 'soft' ? 280 + 180 * Math.exp(-t * 35) : 470 + 650 * Math.exp(-t * 65);
  phase += 2 * Math.PI * frequency / rate;
  const attack = 1 - Math.exp(-t * 850);
  const release = Math.max(0, 1 - t / (kind === 'bell' || kind === 'soft' ? 0.17 : 0.13));
  const decay = kind === 'click' ? 95 : kind === 'bell' ? 14 : kind === 'soft' ? 22 : 33;
  const envelope = attack * Math.exp(-t * decay) * release * release;
  const tone = Math.sin(phase) + (kind === 'bell' ? 0.2 * Math.sin(phase * 2.756) : 0);
  wav.writeInt16LE(Math.round(tone * envelope * 0.5 * 32767), 44 + i * 2);
}
const output = path.join(__dirname, `../assets/audio/chat-${kind}.wav`);
fs.mkdirSync(path.dirname(output), { recursive: true });
if (!fs.existsSync(output) || !fs.readFileSync(output).equals(wav)) fs.writeFileSync(output, wav);
}
