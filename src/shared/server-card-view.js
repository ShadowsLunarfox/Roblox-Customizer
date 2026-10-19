/* Build private-server presentation in React before it reaches the page. Roblox keeps
 * ownership of its lists, thumbnails, menus, subscriptions and launch actions. */
(() => {
  'use strict';
  const routePath = value => globalThis.RobloxCustomizerRoutes?.pathname(value) ?? value ?? location.pathname;
  const classes = node => typeof node?.props?.className === 'string' ? node.props.className.split(/\s+/) : [];
  const has = (node, name) => classes(node).includes(name);
  const children = node => Array.isArray(node?.props?.children) ? node.props.children : [node?.props?.children];
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const clone = (node, props) => window.React.cloneElement(node, props);
  const element = (type, props, ...content) => window.React.createElement(type, props, ...content);

  function playerSignature(players) {
    // Detect roster changes without publishing opaque thumbnail tokens in DOM attributes.
    let signature = 2166136261;
    for (const player of Array.isArray(players) ? players : []) {
      const value = `${player.id ?? ''}:${player.playerToken ?? ''};`;
      for (let index = 0; index < value.length; index += 1) {
        signature = Math.imul(signature ^ value.charCodeAt(index), 16777619);
      }
    }
    return signature >>> 0;
  }

  function isPrivateServer(props) {
    const placeId = Number(routePath().match(/^\/games\/(\d+)(?:\/|$)/)?.[1]);
    if (!placeId || props?.placeId != null && props.placeId !== placeId) return false;
    if (!Number.isSafeInteger(props?.vipServerId) || props.vipServerId <= 0) return false;
    if (props.serverListType != null && props.serverListType !== 'private') return false;
    return props.serverListType === 'private' && typeof props.gameServerStatus === 'string'
      || typeof props.onJoinClick === 'function' && typeof props.playerCountStatus === 'string';
  }

  function render(native, props) {
    if (!isPrivateServer(props) || typeof window.React?.createElement !== 'function'
      || typeof window.React?.cloneElement !== 'function') return native;
    let avatar = null, roster = null, actions;
    const compact = native?.type === 'div' && typeof props.onJoinClick === 'function'
      && ['flex', 'items-center', 'justify-between', 'padding-y-medium', 'width-full'].every(name => has(native, name));
    if (compact) {
      const [presentation, controls] = children(native);
      avatar = children(presentation)[0];
      actions = controls;
      if (!avatar?.props || !actions?.props) return native;
      avatar = clone(avatar, { className: 'rc-server-view-native-avatar' });
    } else {
      if (native?.type !== 'li' || !has(native, 'rbx-private-game-server-item')) return native;
      const card = children(native).find(node => has(node, 'card-item'));
      const details = children(card).find(node => has(node, 'game-server-details'));
      roster = children(card).find(node => has(node, 'player-thumbnails-container'));
      if (!details || !roster) return native;
      const content = children(details);
      avatar = content.find(node => node?.props && ('ownerUserId' in node.props || has(node, 'rbx-private-owner')));
      // Remove only known presentation nodes. Retain every native action,
      // warning, occupancy bar and experiment-specific component.
      actions = clone(details, { children: content.filter(node => node !== avatar
        && !has(node, 'rbx-game-status') && !classes(node).some(name => /game-server-status$/.test(name)))
        .map(node => has(node, 'section-header') ? clone(node, {
          children: children(node).filter(child => !has(child, 'font-bold'))
        }) : node) });
      roster = clone(roster, { className: 'rc-server-view-native-players', 'data-rc-i18n-ignore': '' });
    }
    const name = typeof props.name === 'string' ? props.name : '';
    const status = compact ? props.playerCountStatus : props.gameServerStatus;
    const playing = count(props.playing) ?? count(props.currentPlayersCount);
    const owner = typeof props.owner?.name === 'string' ? props.owner.name
      : typeof props.owner?.displayName === 'string' ? props.owner.displayName : '';
    const title = name || 'Private server';
    const summary = element('div', { className: 'rc-server-view-summary rc-private-server-summary' },
      element('div', { className: 'rc-private-server-title',
        ...(name ? { 'data-rc-i18n-ignore': '' } : {}) }, title),
      avatar && element('div', { className: 'rc-server-view-avatar', 'data-rc-i18n-ignore': '' }, avatar),
      element('div', { className: 'rc-private-server-owner', 'data-rc-i18n-ignore': '' }, owner),
      element('div', { className: 'rc-private-server-count' }, status),
      element('div', { className: 'rc-private-server-status', 'data-rc-i18n-ignore': '' }),
      // This empty slot receives supplemental metadata in the isolated script;
      // it never contains native controls or React-managed text.
      element('div', { className: 'rc-server-view-metrics' }));
    const body = element('div', { className: 'rc-server-view-body' }, summary,
      element('div', { className: 'rc-server-view-actions', 'data-rc-i18n-ignore': '' }, actions),
      element('div', { className: 'rc-server-view-roster' }, roster,
        element('div', { className: 'rc-private-server-roster' })));
    const attributes = {
      className: 'rc-server-view rc-private-server-card',
      'data-rc-server-view': 'private',
      // The React presentation already contains the native summary and actions.
      // Do not wait for isolated-script enrichment before its first paint.
      'data-rc-private-server-ready': '',
      'data-rc-server-source': JSON.stringify([name, status, playing, props.maxPlayers,
        props.thumbnailTargetId ?? props.owner?.id, owner,
        playerSignature(props.players)]),
      'data-rc-private-server-compact': undefined,
      'data-rc-server-avatar-placeholder': compact && props.thumbnailTargetId == null
        && props.thumbnailToken == null ? '' : undefined,
      children: body
    };
    attributes['data-private-server-id'] = String(props.vipServerId);
    attributes['data-rc-server-name'] = name;
    attributes['data-rc-server-status'] = status;
    if (playing !== null) attributes['data-rc-playing'] = String(playing);
    if (typeof props.ping === 'number' && Number.isFinite(props.ping) && props.ping > 0 && props.ping <= 10_000) {
      attributes['data-rc-ping'] = String(Math.round(props.ping));
    }
    return clone(native, attributes);
  }

  window.RobloxCustomizerServerView = Object.freeze({ render });
})();
