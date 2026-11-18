(() => {
  'use strict';
  const video = document.getElementById('background');
  let port = null;
  let objectUrl = null;
  let paused = false;
  let lastProgress = 0;

  function play() {
    if (paused) return;
    video.muted = true;
    if (video.paused || video.ended) video.play().catch(() => {});
  }

  addEventListener('message', event => {
    if (port || event.source !== parent || event.data?.type !== 'rc-background-connect' || !event.ports[0]) return;
    port = event.ports[0];
    port.onmessage = message => {
      const data = message.data;
      if (data?.type === 'load') {
        video.pause();
        video.removeAttribute('src');
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = data.file instanceof Blob ? URL.createObjectURL(data.file) : null;
        const url = objectUrl || data.url;
        if (typeof url !== 'string' || !/^(?:blob:|https?:)/.test(url)) {
          port.postMessage({ type: 'error' });
          return;
        }
        paused = data.paused === true;
        video.autoplay = !paused;
        video.style.setProperty('--rc-background-fit', data.fit === 'contain' ? 'contain' : 'cover');
        video.src = url;
        play();
      } else if (data?.type === 'pause') {
        paused = true;
        video.autoplay = false;
        video.pause();
      } else if (data?.type === 'play') {
        paused = false;
        video.autoplay = true;
        play();
      } else if (data?.type === 'fit') {
        video.style.setProperty('--rc-background-fit', data.fit === 'contain' ? 'contain' : 'cover');
      }
    };
    port.start();
  });

  video.addEventListener('loadeddata', () => {
    port?.postMessage({ type: 'ready' });
    play();
  });
  video.addEventListener('timeupdate', () => {
    if (paused || video.readyState < 2 || Date.now() - lastProgress < 1000) return;
    lastProgress = Date.now();
    port?.postMessage({ type: 'progress' });
  });
  video.addEventListener('error', () => port?.postMessage({ type: 'error' }));
})();
