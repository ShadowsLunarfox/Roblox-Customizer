const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome } = require('./helpers/chrome.cjs');

test('Outside dismissal handles mouse/touch gestures, nested overlays, native padding and cancellation guards',
  { skip: !process.env.CHROME_BIN, timeout: 20000 }, async t => {
    const browser = await isolatedChrome(t, 'dialogs');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.evaluate(fs.readFileSync(path.join(__dirname, '../src/shared/dialogs.js'), 'utf8'));
    await browser.evaluate(`(() => {
      document.head.innerHTML='<style>body{margin:0}#behind{position:fixed;top:0;left:0;width:12px;height:12px;padding:0}'
        +'dialog{box-sizing:border-box;width:240px;height:210px;padding:24px;border:1px solid #777;border-radius:12px}'
        +'.layer{position:fixed;inset:0;display:grid;place-items:center;background:#0006;z-index:1}'
        +'.panel{box-sizing:border-box;width:240px;height:210px;padding:24px;background:white;border:1px solid #777}'
        +'input{max-width:100%}#opener{position:fixed;bottom:5px;left:20px}</style>';
      document.body.innerHTML='<button id="behind">Behind</button><button id="opener">Open</button>';
      window.behindClicks=0;window.veto=false;window.cancelCalls=0;window.layerCloses=0;
      document.querySelector('#behind').onclick=()=>behindClicks++;
      window.openNative=(owned=true)=>{
        document.querySelector('#opener').focus();
        const dialog=document.createElement('dialog');dialog.id='test-dialog';
        dialog.innerHTML='<p>Dialog text</p><input aria-label="Input" value="Keep this text">';
        dialog.addEventListener('cancel',event=>{cancelCalls++;if(veto)event.preventDefault()});
        dialog.addEventListener('close',()=>{dialog.remove();document.querySelector('#opener').focus()},{once:true});
        document.body.append(dialog);
        if(owned){RobloxCustomizerDialogs.dismissOnOutside(dialog);RobloxCustomizerDialogs.dismissOnOutside(dialog)}
        dialog.showModal();
      };
      window.openLayer=(id,parent=document.body)=>{
        const layer=document.createElement('div');layer.id=id;layer.className='layer';
        layer.innerHTML='<section class="panel" role="dialog"><p>Layer text</p><input aria-label="Layer input" value="Keep layer text"></section>';
        parent.append(layer);RobloxCustomizerDialogs.dismissOnOutside(layer,()=>{layerCloses++;layer.remove()});
      };
    })()`);
    const outside = { x: 5, y: 5 };
    const press = (point, button = 'left') => browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', button, buttons: button === 'left' ? 1 : 2, clickCount: 1, ...point });
    const release = (point, button = 'left') => browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button, clickCount: 1, ...point });
    const drag = async (from, to) => {
      await press(from);
      await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, ...to });
      await release(to);
    };
    const point = selector => browser.evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+6,y:r.top+6}})()`);
    const touch = async (start, end = start) => {
      await browser.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, radiusX: 1, radiusY: 1, id: 1 }] });
      if (start !== end) await browser.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...end, radiusX: 1, radiusY: 1, id: 1 }] });
      await browser.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    for (const width of [1280, 360]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false });
      await browser.evaluate('openNative()');
      const padding = await point('#test-dialog');
      await browser.clickAt(padding);
      await browser.click('#test-dialog input');
      await drag(padding, outside); await drag(outside, padding);
      await press(outside, 'right'); await release(outside, 'right');
      assert.equal(await browser.evaluate("document.querySelector('#test-dialog').open"), true, 'Inside padding, controls, drags and right clicks keep the window open');
      await press(outside);
      await browser.evaluate("document.querySelector('#test-dialog').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true}))");
      await release(outside);
      assert.equal(await browser.evaluate("document.querySelector('#test-dialog').open"), true, 'A cancelled pointer gesture does not dismiss');
      await browser.evaluate('veto=true;cancelCalls=0');
      await browser.clickAt(outside);
      assert.equal(await browser.evaluate("document.querySelector('#test-dialog').open"), true, 'Busy/cancellation guards can refuse dismissal');
      assert.equal(await browser.evaluate('cancelCalls'), 1, 'Registering twice never handles dismissal twice');
      await browser.evaluate('veto=false');
      await browser.clickAt(outside);
      await browser.waitFor("!document.querySelector('#test-dialog')");
      assert.equal(await browser.evaluate('document.activeElement.id'), 'opener');
      assert.equal(await browser.evaluate('behindClicks'), 0, 'Closing does not click through to the page');

      await browser.evaluate('openNative(false)');
      await browser.clickAt(outside);
      assert.equal(await browser.evaluate("document.querySelector('#test-dialog').open"), true, 'An unregistered native Roblox dialog is unaffected');
      await browser.evaluate("document.querySelector('#test-dialog').close()");
      await browser.waitFor("!document.querySelector('#test-dialog')");
      await browser.evaluate("openLayer('outer');openLayer('inner',document.querySelector('#outer'))");
      const layerPadding = await point('#inner .panel');
      await browser.clickAt(layerPadding); await drag(layerPadding, outside); await drag(outside, layerPadding);
      assert.equal(await browser.evaluate("!!document.querySelector('#inner')"), true, 'A custom overlay also preserves inside gestures');
      await browser.clickAt(outside);
      assert.equal(await browser.evaluate("!!document.querySelector('#inner')"), false);
      assert.equal(await browser.evaluate("!!document.querySelector('#outer')"), true, 'Only the top nested overlay closes');
      await browser.clickAt(outside);
      assert.equal(await browser.evaluate("!!document.querySelector('#outer')"), false);

      await browser.send('Emulation.setTouchEmulationEnabled', { enabled: true });
      await browser.evaluate('openNative()');
      await touch(await point('#test-dialog'));
      assert.equal(await browser.evaluate("document.querySelector('#test-dialog').open"), true);
      await touch(outside);
      await browser.waitFor("!document.querySelector('#test-dialog')");
      await browser.evaluate("openLayer('touch-layer')");
      await touch(outside, await point('#touch-layer .panel'));
      assert.equal(await browser.evaluate("!!document.querySelector('#touch-layer')"), true, 'Touch capture must not turn an inside release into an outside click');
      await touch(outside);
      await browser.waitFor("!document.querySelector('#touch-layer')");
      await browser.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
    assert.deepEqual(browser.errors, []);
  });
