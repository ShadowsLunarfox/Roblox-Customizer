/* Adapt the original Friends controller's data; Roblox keeps every card, hook and action. */
(() => {
  'use strict';
  let state = null, snapshot = null, frame = null, signature = '', presenceVersion = 0;
  const presences = new Map();
  const path = () => window.RobloxCustomizerRoutes?.pathname() || location.pathname;
  const route = () => `${path()}${location.hash || ''}`;
  const tab = kind => kind === 'requests' ? 'friend-requests' : kind;
  const validId = value => Number.isSafeInteger(value) && value > 0;
  const allowed = props => state?.enabled && route() === state.route && props.metadata?.isMyProfile === true
    && Number(props.metadata.profileUserId) === state.accountId && props.currentTab === tab(state.kind)
    && !document.documentElement?.hasAttribute('data-rc-features-disabled');
  function matches(props) {
    return !!(Array.isArray(props?.friends) && props.metadata && typeof props.setFriends === 'function'
      && typeof props.loadMoreFriends === 'function' && typeof props.enableTabLoader === 'function'
      && typeof props.disableTabLoader === 'function' && typeof props.title === 'string'
      && props.id === undefined && props.isMyProfile === undefined);
  }
  function announce(matched) {
    document.dispatchEvent(new CustomEvent('rc-friends-native-ready', { detail: JSON.stringify({ matched, route: route() }) }));
  }
  function refresh(resetPage = false) {
    if (!snapshot || !allowed(snapshot.props)) return;
    if (resetPage) snapshot.pageSetter?.(1);
    snapshot.props.setFriends(snapshot.raw.slice());
  }
  async function hydrate() {
    const provider = window.RobloxPresence?.getPresenceProvider?.() || window.RobloxPresence?.default?.getPresenceProvider?.();
    if (!state?.apply || state.kind !== 'friends' || typeof provider?.getPresences !== 'function') return;
    const version = ++presenceVersion, owner = state.accountId;
    const missing = state.records.map(item => item.id).filter(id => !presences.has(`${owner}:${id}`));
    try {
      for (let index = 0; index < missing.length; index += 100) {
        const data = await provider.getPresences(missing.slice(index, index + 100));
        if (version !== presenceVersion || !state?.enabled || state.accountId !== owner || route() !== state.route) return;
        for (const item of data || []) if (validId(item.userId)) presences.set(`${owner}:${item.userId}`, item);
      }
      const values = [...presences].filter(([key]) => key.startsWith(`${owner}:`)).map(([, value]) => value);
      const universes = [...new Set(values.map(item => item.universeId).filter(validId))];
      const http = window.CoreUtilities?.httpService || window.Roblox?.['core-scripts']?.http?.http;
      for (let index = 0; index < universes.length && typeof http?.get === 'function'; index += 100) {
        const response = await http.get({ url: 'https://games.roblox.com/v1/games/multiget-playability-status', withCredentials: true, retryable: true }, { universeIds: universes.slice(index, index + 100) });
        if (version !== presenceVersion) return;
        for (const item of response?.data || []) for (const presence of values) if (presence.universeId === item.universeId) presence.isPlayable = item.isPlayable;
      }
    } catch { /* Native loaded records keep their original presence and Join state. */ }
    if (version === presenceVersion) refresh();
  }
  function render(target, receiver, args) {
    const props = args[0];
    snapshot = { props, raw: props.friends, pageSetter: snapshot?.pageSetter };
    const previous = frame;
    frame = { snapshot, hooks: 0, customSort: allowed(props) && state.apply && state.sort !== 'default' };
    try {
      if (allowed(props)) {
        const removed = new Set(state.removedIds);
        let friends = props.friends;
        if (state.apply) {
          const original = new Map(friends.map(item => [item.id, item]));
          const records = new Map(state.records.map(item => [item.id, item]));
          friends = state.ids.filter(id => !removed.has(id)).map(id => {
            const item = original.get(id) || records.get(id);
            if (!item) return null;
            const presence = item.presence || presences.get(`${state.accountId}:${id}`) || { userPresenceType: state.presences[id] };
            return { ...item, presence };
          }).filter(Boolean);
        } else if (removed.size) friends = friends.filter(item => !removed.has(item.id));
        if (friends !== props.friends) args = [{ ...props, friends }, ...args.slice(1)];
        announce(true);
      }
      return Reflect.apply(target, receiver, args);
    } finally { frame = previous; }
  }
  function useState(result, initial) {
    if (frame && frame.hooks++ === 0 && initial === 1 && typeof result?.[1] === 'function') frame.snapshot.pageSetter = result[1];
    return result;
  }
  function useContext(result) {
    return frame?.customSort && Array.isArray(result?.paginatedFriends) && typeof result.setPaginatedFriends === 'function'
      ? { ...result, friendsSort: null } : result;
  }
  function observeWrite(config, result) {
    if (!state?.enabled || !snapshot || !allowed(snapshot.props)) return result;
    let url; try { url = new URL(config?.url, location.href); } catch { return result; }
    if (url.origin !== 'https://friends.roblox.com') return result;
    const match = url.pathname.match(/^\/v1\/users\/(\d+)\/(unfriend|unfollow|accept-friend-request(?:-with-token)?|decline-friend-request)\/?$/);
    if (!match) return result;
    const context = state;
    return Promise.resolve(result).then(response => {
      if (state?.accountId === context.accountId && route() === context.route) document.dispatchEvent(new CustomEvent('rc-friends-native-write', {
        detail: JSON.stringify({ route: context.route, accountId: context.accountId, userId: Number(match[1]), operation: match[2] })
      }));
      return response;
    });
  }
  document.addEventListener('rc-friends-native-view', event => {
    let next; try { next = JSON.parse(event.detail); } catch { return; }
    if (!next?.enabled) {
      const previous = state; state = null; signature = ''; presenceVersion++;
      if (snapshot && previous?.route === route()) snapshot.props.setFriends(snapshot.raw.slice());
      return;
    }
    if (!validId(next.accountId) || !['friends', 'following', 'requests'].includes(next.kind)
      || next.route !== route() || !Array.isArray(next.ids) || !next.ids.every(validId)
      || next.ids.length > 10000 || !Array.isArray(next.removedIds) || !next.removedIds.every(validId)
      || !next.presences || typeof next.presences !== 'object'
      || !Array.isArray(next.records) || next.records.length > 10000 || !next.records.every(item => validId(item?.id))) return;
    const key = JSON.stringify(next);
    if (signature === key) return;
    const ownerChanged = state?.accountId !== next.accountId;
    const resetPage = ownerChanged || state?.kind !== next.kind || state?.filterKey !== next.filterKey;
    state = next; signature = key;
    if (ownerChanged) { presences.clear(); presenceVersion++; }
    refresh(resetPage); hydrate();
    announce(!!snapshot && allowed(snapshot.props));
  });
  window.RobloxCustomizerFriendsNativeView = Object.freeze({ matches, render, useState, useContext, observeWrite });
})();
