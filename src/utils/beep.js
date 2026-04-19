/**
 * 播放一個短促的嗶聲（掃碼成功提示）
 * 使用 Web Audio API 合成，無需音效檔
 * @param {number} freq  頻率 Hz，預設 880（高亮清脆）
 * @param {number} ms    持續毫秒，預設 120
 */
export function beep(freq = 880, ms = 120) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + ms / 1000);
    osc.onended = () => ctx.close();
  } catch {
    // 瀏覽器不支援或使用者未互動時靜默忽略
  }
}
