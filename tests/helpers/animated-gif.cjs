module.exports = function animatedGif() {
  const bytes = [...Buffer.from('GIF89a'), 2, 0, 2, 0, 128, 0, 0, 255, 0, 0, 0, 0, 255,
    33, 255, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0];
  for (const color of [0, 1]) {
    let bits = 0;
    [4, color, 4, color, 4, color, 4, color, 5].forEach((code, i) => { bits |= code << (3 * i); });
    bytes.push(33, 249, 4, 0, 8, 0, 0, 0, 44, 0, 0, 0, 0, 2, 0, 2, 0, 0,
      2, 4, bits & 255, bits >>> 8 & 255, bits >>> 16 & 255, bits >>> 24 & 255, 0);
  }
  return Buffer.from([...bytes, 59]);
};
