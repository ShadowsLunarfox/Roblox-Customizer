const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
require('../src/currency/robux-currency-core.js');
require('../src/home/pinned-games-core.js');
require('../src/home/pinned-friends-core.js');
const gameNotes = require('../src/notes/game-notes-core.js');
const playtime = require('../src/playtime/playtime-core.js');
const backup = require('../src/settings/backup-core.js');
const copy = value => JSON.parse(JSON.stringify(value));
function savedData() {
  let history = playtime.observe(null, {id:123,name:'First',displayName:'First player'},
    {userId:123,userPresenceType:2,universeId:456,placeId:789,lastLocation:'Private game'}, 1800000000000, 'live-session');
  history = playtime.observe(history, {id:123,name:'First'},
    {userId:123,userPresenceType:2,universeId:456,placeId:789}, 1800000030000, 'live-session');
  history.accounts.push({userId:321,name:'Second',displayName:'第二个账号',games:copy(history.accounts[0].games)});
  return {customBackground:{source:'none',glassBlur:23,glassOpacity:67,uiLanguage:'zh-TW',
    customAccentColor:'#aabbcc',hideFavorites:true,hiddenRecommendedGames:[{placeId:'111',name:'Hidden'}],
    greetingMorning:'Good morning',showHomeBanner:false,showHomeAvatar:false,showHomeLabel:true,
    showHomeDisplayName:false,showHomeUsername:true,showHomeGreeting:false,showHomeClock:false,
    clockShowDate:false,showHomeMostPlayed:true,showPinnedGames:false,_writer:'do-not-export'},
    robuxCurrency:{enabled:false,currency:'CNY'},pinnedGames:[{universeId:456,placeId:789,name:'Private game',folderId:'favorites',iconUrl:'',updatedAt:123}],
    pinnedGameFolders:[{id:'favorites',name:'我的游戏'}],rcPlaytimeHistory:history,playtimeTrackingEnabled:true,
    rcGameNotes:gameNotes.update(null,{placeId:789,name:'Private game'},'私人攻略\n第二行',12345),
    robuxCurrencyRates:{doNotExport:true},'rc-youtube-cache':{doNotExport:true}};
}
const envelope = data => ({format:backup.FORMAT,version:backup.VERSION,createdAt:'2026-10-13T00:00:00.000Z',extensionVersion:'1.0',data,media:null});

test('friend pins round-trip by account, old backups clear pins, and invalid friend records are rejected', () => {
  const rcPinnedFriends = { version: 1, accounts: [100, 200].map(userId => ({ userId,
    friends: [{ userId: 1, name: 'Friend', displayName: 'Friends', imageUrl: '' }] })) };
  const data = backup.snapshot({ ...savedData(), rcPinnedFriends });
  assert.deepEqual(backup.validate(envelope(data)).data.rcPinnedFriends, rcPinnedFriends);
  const grouped = copy(data); grouped.rcPinnedFriends.accounts[0].groups = [{ id: 'team', name: '一起玩', color: '#648bff', userIds: [1, 2] }];
  assert.deepEqual(backup.validate(envelope(grouped)).data.rcPinnedFriends, rcPinnedFriends, 'Old group metadata does not prevent restoring friend pins');
  const legacy = copy(data); delete legacy.rcPinnedFriends;
  assert.deepEqual(backup.validate(envelope(legacy)).data.rcPinnedFriends, { version: 1, accounts: [] });
  for (const change of [value => value.accounts.push(value.accounts[0]),
    value => value.accounts[0].friends.push(value.accounts[0].friends[0]),
    value => { value.accounts[0].friends[0].imageUrl = 'https://evil.example/track'; }]) {
    const invalid = copy(rcPinnedFriends); change(invalid);
    assert.throws(() => backup.validate(envelope({ ...data, rcPinnedFriends: invalid })));
  }
});
test('backup includes every preference and account, preserves folder links, and excludes caches and live sessions', () => {
  const source = savedData();
  const data = backup.snapshot(source);
  assert.deepEqual(Object.keys(data).sort(), [...backup.KEYS].sort());
  assert.equal(data.customBackground._writer, undefined);
  assert.equal(data.rcPlaytimeHistory.active, null);
  assert.equal(data.rcPlaytimeHistory.accounts.length, 2);
  assert.equal(data.rcPlaytimeHistory.accounts[0].games[0].totalMs, 30000);
  assert.equal(data.pinnedGames[0].folderId, data.pinnedGameFolders[0].id);
  assert.equal(data.customBackground.showPinnedGames, false);
  assert.equal(data.rcGameNotes.notes[0].text, '私人攻略\n第二行');
  assert.deepEqual(backup.validate(copy(envelope(data))).data, data);
  assert.equal(JSON.stringify(data).includes('live-session'), false);
  assert.equal(source.rcPlaytimeHistory.active.browserSessionId, 'live-session', 'Export does not stop live tracking');
  const indonesian = backup.snapshot({ ...source, customBackground: { ...source.customBackground, uiLanguage: 'id' } });
  assert.equal(backup.validate(envelope(indonesian)).data.customBackground.uiLanguage, 'id');
  const japanese = backup.snapshot({ ...source, customBackground: { ...source.customBackground, uiLanguage: 'ja' } });
  assert.equal(backup.validate(envelope(japanese)).data.customBackground.uiLanguage, 'ja');
  const thai = backup.snapshot({ ...source, customBackground: { ...source.customBackground, uiLanguage: 'th' } });
  assert.equal(backup.validate(envelope(thai)).data.customBackground.uiLanguage, 'th');
  const korean = backup.snapshot({ ...source, customBackground: { ...source.customBackground, uiLanguage: 'ko' } });
  assert.equal(backup.validate(envelope(korean)).data.customBackground.uiLanguage, 'ko');
  const defaults = backup.snapshot({});
  assert.equal(defaults.playtimeTrackingEnabled, true);
  assert.deepEqual(defaults.pinnedGames, []);
  assert.equal(backup.validate(envelope(backup.snapshot({...source,playtimeTrackingEnabled:false}))).data.rcPlaytimeHistory.status.kind, 'disabled');
});

test('retired visibility preferences are discarded without losing other backed-up settings', () => {
  const source = savedData(), original = copy(source);
  const retired = { streamerMode: true, streamerHideRobux: true, streamerHideFriends: true, streamerHideMessages: true };
  const expected = backup.snapshot(source);
  const legacy = { ...source, customBackground: { ...source.customBackground, ...retired } };
  assert.deepEqual(backup.snapshot(legacy), expected);
  assert.deepEqual(backup.validate(envelope({ ...expected, customBackground: { ...expected.customBackground, ...retired } })).data, expected);
  assert.deepEqual(source, original);
  assert.equal(legacy.customBackground.streamerMode, true, 'Reading an old backup never mutates its input');
});

test('server selections are excluded from exports and discarded from legacy imports',()=>{
  const location={country:'SG',city:'Singapore',locationMode:'nearest',latitude:1.35,longitude:103.8};
  const data=backup.snapshot({...savedData(),rcServerLocation:location});
  assert.equal(Object.hasOwn(data,'rcServerLocation'),false);
  assert.equal(backup.KEYS.includes('rcServerLocation'),false);
  const legacy=backup.validate(envelope({...copy(data),rcServerLocation:location}));
  assert.equal(Object.hasOwn(legacy.data,'rcServerLocation'),false);
  assert.deepEqual(legacy.data,data,'Old backups keep other data without restoring server selections');
});
test('backup validates the envelope, nested preferences, complete records and media before any restoration', () => {
  const good = envelope(backup.snapshot(savedData()));
  for (const corrupt of [b=>{b.format='other';},b=>{delete b.data.rcPlaytimeHistory;},b=>{b.data.rcPlaytimeHistory.version=2;},
    b=>{b.data.rcPlaytimeHistory.accounts[0].games[0].totalMs=-1;},b=>{b.data.rcPlaytimeHistory.accounts.push(b.data.rcPlaytimeHistory.accounts[0]);},
    b=>{b.data.pinnedGames[0].folderId='missing';},b=>{b.data.customBackground.glassBlur=100;},b=>{b.data.robuxCurrency.currency='INVALID';},
    b=>{b.data.playtimeTrackingEnabled='false';},b=>{b.data.customBackground.showHomeBanner='false';},
    b=>{b.data.customBackground.showHomeMostPlayed=1;},b=>{b.data.customBackground.showPinnedGames='false';},
    b=>{b.data.customBackground.source='url';b.data.customBackground.url='javascript:alert(1)';},
    b=>{b.data.rcGameNotes.notes[0].text='x'.repeat(gameNotes.MAX_LENGTH+1);},
    b=>{b.data.rcGameNotes.notes.push(b.data.rcGameNotes.notes[0]);},
    b=>{b.data.extra='not a setting';},b=>{b.data.customBackground=JSON.parse('{"__proto__":{"polluted":true}}');}]) {
    const value = copy(good); corrupt(value); assert.throws(()=>backup.validate(value), /Invalid backup/);
  }
  assert.throws(()=>backup.validate({...good,version:99}), /version is not supported/);
  const legacy = copy(good); delete legacy.data.rcGameNotes;
  assert.deepEqual(backup.validate(legacy).data.rcGameNotes, {version:1,notes:[]}, 'Older backups remain importable');
  const media = copy(good);
  media.data.customBackground = {source:'file',fileKey:'original-file',fileName:'wallpaper.png'};
  assert.throws(()=>backup.validate(media), /Invalid backup/);
  media.media = {key:'original-file',name:'wallpaper.png',type:'image/png',size:1,lastModified:0,base64:'YQ=='};
  assert.equal(backup.validate(media).media.base64, 'YQ==');
  for (const patch of [{key:'wrong'}, {size:2}, {base64:'invalid!'}, {type:'text/html'}]) {
    assert.throws(()=>backup.validate({...media,media:{...media.media,...patch}}), /Invalid backup/);
  }
  assert.equal({}.polluted, undefined);
});

test('font preferences require a matching, bounded binary attachment and keep legacy backups readable', () => {
  const value = envelope(backup.snapshot(savedData()));
  Object.assign(value.data.customBackground, { customFontEnabled: true, fontFileKey: 'font-key', fontFileName: 'My font.woff2' });
  value.font = { key: 'font-key', name: 'My font.woff2', type: 'font/woff2', size: 1, lastModified: 0, base64: 'YQ==' };
  assert.deepEqual(backup.validate(value).font, value.font);
  for (const change of [b => { delete b.font; }, b => { b.font.key = 'other'; }, b => { b.font.type = 'text/html'; },
    b => { b.font.base64 = 'invalid!'; }, b => { b.font.size = 33 * 1024 * 1024; },
    b => { b.data.customBackground.fontFileKey = '../font'; }, b => { b.data.customBackground.fontFileName = 'font.html'; },
    b => { b.data.customBackground.customFontEnabled = 'yes'; }, b => { b.font.name = 'different.woff2'; }]) {
    const invalid = copy(value); change(invalid); assert.throws(() => backup.validate(invalid), /Invalid backup/);
  }
  value.data.customBackground.customFontEnabled = false;
  assert.deepEqual(backup.validate(value).font, value.font, 'A disabled font is kept for later use');
  assert.equal(backup.validate(envelope(backup.snapshot(savedData()))).font, null, 'Older backups need no font attachment');
});

function worker() {
  const state = savedData();
  const listeners = [], changes = [];
  let writes = 0, fail = false, sessionClears = 0;
  const chrome = {runtime:{id:'extension',onMessage:{addListener:fn=>listeners.push(fn)},getManifest:()=>({version:'1.0'})},
    storage:{local:{async get(keys){return copy(keys===null?state:Object.fromEntries(keys.filter(key=>key in state).map(key=>[key,state[key]])));},
      async set(data){if(fail)throw new Error('Storage full');writes++;Object.assign(state,copy(data));},
      async remove(keys){if(fail)throw new Error('Storage full');writes++;for(const key of keys)delete state[key];},
      async clear(){if(fail)throw new Error('Storage full');writes++;for(const key of Object.keys(state))delete state[key];}},
      session:{async clear(){sessionClears++;}},onChanged:{addListener:fn=>changes.push(fn)}}};
  const context = vm.createContext({chrome,URL,crypto,Date,setTimeout,clearTimeout});
  for (const file of ['src/currency/robux-currency-core.js','src/home/pinned-games-core.js','src/background/pinned-games-background.js',
    'src/home/pinned-friends-core.js','src/background/pinned-friends-background.js',
    'src/playtime/playtime-core.js','src/background/playtime-background.js',
    'src/notes/game-notes-core.js','src/background/game-notes-background.js','src/settings/backup-core.js','src/background/backup-background.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'),context,{filename:file});
  }
  const sender = {id:'extension',url:'https://www.roblox.com/home',frameId:0};
  const message = (action, data, source = sender) => new Promise(resolve => {
    const listener = listeners.at(-1);
    if (!listener({type:'rc-data-backup',action,data},source,result=>resolve(copy(result)))) resolve(undefined);
  });
  return {state,message,context,get writes(){return writes;},get sessionClears(){return sessionClears;},fail(value){fail=value;}};
}
test('backup worker restores only validated user data and retains old values on validation/storage errors', async () => {
  const w = worker();
  const before = copy(w.state);
  const exported = await w.message('export');
  assert.equal(exported.ok, true);
  assert.equal(exported.data.rcPlaytimeHistory.active, null);
  assert.equal(w.writes, 0);
  assert.equal((await w.message('import',{})).ok, false);
  assert.deepEqual(w.state,before);
  w.fail(true);
  assert.equal((await w.message('import',exported.data)).ok, false);
  assert.deepEqual(w.state,before);
  w.fail(false);
  exported.data.customBackground.hideFavorites=false;
  assert.equal((await w.message('import',exported.data)).ok,true);
  assert.equal(w.state.customBackground.hideFavorites,false);
  assert.equal(w.state.rcPlaytimeHistory.active,null);
  assert.deepEqual(w.state.robuxCurrencyRates,before.robuxCurrencyRates);
  assert.equal(w.writes,1,'Restore writes all data in one storage operation');
  for (const sender of [{id:'other',url:'https://www.roblox.com/home'}, {id:'extension',url:'https://evil.example/home'},
    {id:'extension',url:'http://www.roblox.com/home'}, {id:'extension',url:'https://www.roblox.com/home',frameId:2}]) {
    assert.equal(await w.message('export',undefined,sender),undefined);
  }
});
test('restore waits for pending game and playtime writes, so old operations cannot overwrite imported history', async () => {
  const w = worker();
  let finishPin, finishPoll;
  const pinGate = new Promise(resolve=>{finishPin=resolve;});
  const pollGate = new Promise(resolve=>{finishPoll=resolve;});
  const pin = w.context.RobloxCustomizerPinnedGamesBackground.withStorageLock(async()=>{await pinGate;w.state.pinnedGames=[];});
  const poll = w.context.RobloxCustomizerPlaytimeBackground.withStorageLock(async()=>{await pollGate;w.state.rcPlaytimeHistory=playtime.normalize(null);});
  const data = backup.snapshot(savedData());
  const restored = w.message('import',data);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.writes,0);
  finishPin(); await pin;
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.writes,0,'Waits for both independent writers');
  finishPoll(); await poll;
  assert.equal((await restored).ok,true);
  assert.deepEqual(w.state.rcPlaytimeHistory,data.rcPlaytimeHistory);
  assert.deepEqual(w.state.pinnedGames,data.pinnedGames);
});
test('import and reset wait for pending note writes before replacing or removing notes', async () => {
  for (const action of ['import', 'reset']) {
    const w = worker();
    let finish;
    const pending = w.context.RobloxCustomizerGameNotesBackground.withStorageLock(async () => {
      await new Promise(resolve => { finish = resolve; });
      w.state.rcGameNotes = gameNotes.update(null, {placeId:111,name:'Late'}, 'Late write');
    });
    const incoming = backup.snapshot(savedData());
    const result = w.message(action, action === 'import' ? incoming : undefined);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(w.writes, 0);
    finish(); await pending;
    assert.equal((await result).ok, true);
    assert.deepEqual(w.state.rcGameNotes, action === 'import' ? incoming.rcGameNotes : undefined);
  }
});

test('reset clears all extension storage after pending game and playtime writes', async () => {
  const w = worker();
  let finishPin, finishPoll;
  const pin = w.context.RobloxCustomizerPinnedGamesBackground.withStorageLock(() => new Promise(resolve => { finishPin = resolve; }));
  const poll = w.context.RobloxCustomizerPlaytimeBackground.withStorageLock(() => new Promise(resolve => { finishPoll = resolve; }));
  const reset = w.message('reset');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(w.writes, 0);
  finishPin(); await pin;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(w.writes, 0);
  finishPoll(); await poll;
  assert.equal((await reset).ok, true);
  assert.deepEqual(w.state, {});
  assert.equal(w.sessionClears, 1);
  assert.equal(w.writes, 1);
  for (const sender of [{id:'other',url:'https://www.roblox.com/home'},
    {id:'extension',url:'https://evil.example/home'}]) {
    assert.equal(await w.message('reset', undefined, sender), undefined);
  }
  assert.equal(w.writes, 1);
});

test('reset preserves a genuine terms acceptance without exporting or importing it', async () => {
  const w = worker();
  w.state.robloxCustomizerTermsAccepted = true;
  const exported = await w.message('export');
  assert.equal(Object.hasOwn(exported.data, 'robloxCustomizerTermsAccepted'), false);
  assert.equal((await w.message('import', exported.data)).ok, true);
  assert.equal(w.state.robloxCustomizerTermsAccepted, true);
  assert.equal((await w.message('reset')).ok, true);
  assert.deepEqual(w.state, { robloxCustomizerTermsAccepted: true });
});

test('import and reset serialize with pending friend pin writes', async () => {
  for (const action of ['import', 'reset']) {
    const w = worker(); let finish;
    const pending = w.context.RobloxCustomizerPinnedFriendsBackground.withStorageLock(async () => {
      await new Promise(resolve => { finish = resolve; });
      w.state.rcPinnedFriends = { version: 1, accounts: [{ userId: 100, friends: [] }] };
    });
    const incoming = backup.snapshot(savedData());
    const result = w.message(action, action === 'import' ? incoming : undefined);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(w.writes, 0); finish(); await pending;
    assert.equal((await result).ok, true);
    assert.deepEqual(w.state.rcPinnedFriends, action === 'import' ? incoming.rcPinnedFriends : undefined);
  }
});
