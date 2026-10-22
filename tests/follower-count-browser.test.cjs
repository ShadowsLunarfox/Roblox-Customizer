const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');

test('isolated follower script corrects native redraws without access to React internals',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const markup = `<!doctype html><html lang="en"><meta charset="utf-8"><body>
      <div id="friends-web-app" hidden><section class="friends-content"><div class="container-header"><div class="friends-subtitle">
      <h2>Followers (500+)</h2><button id="native-tooltip" onclick="tooltipClicks++">?</button></div></div></section></div>
      <script>window.React=Object.freeze({privateRuntime:true});window.tooltipClicks=0;window.originalTooltip=document.querySelector('#native-tooltip');</script></body></html>`;
    const server = http.createServer((request, response) => { response.setHeader('Content-Type','text/html; charset=utf-8');response.end(markup); });
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections();server.close(resolve); }));
    const browser = await isolatedChrome(t,'follower-count-isolated');
    await browser.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/users/friends#!/followers`});
    await waitForDocument(browser,'.friends-subtitle h2');
    const { frameTree } = await browser.send('Page.getFrameTree');
    const { executionContextId } = await browser.send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:'follower-count-content-script'});
    const isolated = async expression => {
      const result=await browser.send('Runtime.evaluate',{contextId:executionContextId,expression,returnByValue:true,awaitPromise:true});
      if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
      return result.result.value;
    };
    assert.equal(await isolated('typeof window.React'),'undefined','The content script cannot rely on private page globals');
    await isolated(`globalThis.pending=[];globalThis.calls=[];globalThis.resume=[];globalThis.chrome={runtime:{lastError:null}};
      globalThis.RobloxCustomizerRuntime={sendMessage(message,callback){calls.push(message);pending.push(callback)},onResume(listener){resume.push(listener)}};void 0;`);
    for(const file of ['src/shared/routes.js','src/home/follower-count.js'])await isolated(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'));
    const settle = () => isolated('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    await settle();
    assert.equal(await isolated('calls[0].action'),'follower-count');
    await isolated('pending.shift()({ok:true,userId:100,count:16810358})');
    await browser.evaluate("document.querySelector('#friends-web-app').hidden=false");
    await browser.waitFor("document.querySelector('h2').textContent==='Followers (16,810,358)'");
    await browser.click('#native-tooltip');
    assert.equal(await browser.evaluate('tooltipClicks'),1);
    await browser.evaluate("document.querySelector('h2').innerHTML='追蹤者 <span>(500+)</span>';void 0");
    await browser.waitFor("document.querySelector('h2').textContent==='追蹤者 (16,810,358)'");
    assert.equal(await browser.evaluate("originalTooltip===document.querySelector('#native-tooltip')"),true);
    await settle();assert.equal(await isolated('calls.length'),1,'Native redraws do not create a request loop');
    await isolated('resume.forEach(listener=>listener());void 0');
    await isolated('pending.shift()({ok:true,userId:100,count:0})');
    await browser.waitFor("document.querySelector('h2').textContent==='追蹤者 (0)'");
    await isolated('resume.forEach(listener=>listener());void 0');
    await browser.evaluate("history.pushState({},'','#!/following');document.querySelector('h2').textContent='Following (500+)';dispatchEvent(new PopStateEvent('popstate'));void 0");
    await settle();await isolated('pending.shift()({ok:true,userId:100,count:999999})');
    assert.equal(await browser.evaluate("document.querySelector('h2').textContent"),'Following (500+)','An old response cannot overwrite another tab');
    await browser.evaluate("history.pushState({},'','/users/200/friends#!/followers');document.querySelector('h2').textContent='Followers (500+)';dispatchEvent(new PopStateEvent('popstate'));void 0");
    await settle();await isolated('pending.shift()({ok:true,userId:200,count:42})');
    await browser.waitFor("document.querySelector('h2').textContent==='Followers (42)'");
    await browser.evaluate("document.documentElement.setAttribute('data-rc-features-disabled','')");
    await browser.waitFor("document.querySelector('h2').textContent==='Followers (500+)'");
    await browser.evaluate("document.documentElement.removeAttribute('data-rc-features-disabled')");
    await settle();await isolated('pending.shift()({ok:false,error:"Unavailable"})');
    assert.equal(await browser.evaluate("document.querySelector('h2').textContent"),'Followers (500+)','An API failure cannot invent zero followers');
    assert.deepEqual(browser.errors,[]);
  });
