// Run in the isolated browser to create a small, changing MP4 without a codec fixture dependency.
module.exports = async function animatedVideo() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  const stream = canvas.captureStream(20);
  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType: 'video/mp4' });
  const stopped = new Promise(resolve => { recorder.onstop = resolve; });
  recorder.ondataavailable = event => chunks.push(event.data);
  recorder.start();
  for (let i = 0; i < 16; i++) {
    context.fillStyle = i % 2 ? 'red' : 'blue';
    context.fillRect(0, 0, 32, 32);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  recorder.stop();
  await stopped;
  stream.getTracks().forEach(track => track.stop());
  return new Blob(chunks, { type: 'video/mp4' });
};
