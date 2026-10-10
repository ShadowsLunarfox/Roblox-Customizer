(() => {
  'use strict';

  const HOME_CAROUSEL = 'WebHomeFriendsCarousel';
  const FIND_PATH = /^\/v1\/users\/\d+\/friends\/find\/?$/;
  const GAME_PATH = /^\/games\/\d+(?:\/|$)/;
  const INSTANCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const MAX_FRIENDS = 51;
  const MAX_PAGES = 20;
  const componentTypes = new WeakMap();
  const patchedMethods = new WeakMap();
  const watchedProperties = new WeakMap();
  let renderingFriends = null;

  function isHomeFriends(props) {
    return props?.carouselName === HOME_CAROUSEL && 'friendsList' in props;
  }

  function isServerList(props) {
    return GAME_PATH.test(location.pathname) && !!props?.loadMoreGameInstances
      && 'headerTitle' in props;
  }

  function isServerCard(props) {
    return GAME_PATH.test(location.pathname) && props && 'gameServerStatus' in props
      && typeof props.id === 'string' && INSTANCE_ID.test(props.id);
  }

  function mapElements(value, transform, depth = 0) {
    if (depth > 12) return value;
    if (Array.isArray(value)) {
      const next = value.map(item => mapElements(item, transform, depth + 1));
      return next.some((item, index) => item !== value[index]) ? next : value;
    }
    if (!value || typeof value !== 'object' || !value.props) return value;
    const props = value.props;
    const children = mapElements(props.children, transform, depth + 1);
    const updated = transform(value, props);
    if (!updated && children === props.children) return value;
    const nextProps = { ...props, ...updated };
    if (children !== props.children) nextProps.children = children;
    const clone = window.React?.cloneElement;
    return typeof clone === 'function' ? clone(value, nextProps) : { ...value, props: nextProps };
  }

  function exposeServerListMetrics(result, props) {
    if (!Array.isArray(props.gameInstances)) return result;
    const servers = new Map(props.gameInstances.filter(server =>
      typeof server?.id === 'string' && INSTANCE_ID.test(server.id))
      .map(server => [server.id.toLowerCase(), server]));
    if (!servers.size) return result;
    return mapElements(result, (_, elementProps) => {
      if (!isServerCard(elementProps)) return null;
      const server = servers.get(elementProps.id.toLowerCase());
      if (!server) return null;
      const metrics = {};
      if (typeof server.ping === 'number' && Number.isFinite(server.ping)) metrics.ping = server.ping;
      if (Number.isSafeInteger(server.playing) && server.playing >= 0) metrics.playing = server.playing;
      return metrics;
    });
  }

  function exposeServerCardMetrics(result, props) {
    return mapElements(result, (_, elementProps) => {
      if (typeof elementProps.className !== 'string'
        || !elementProps.className.includes('game-server-join-btn')) return null;
      const next = { 'data-rc-instance-id': props.id.toLowerCase() };
      if (typeof props.ping === 'number' && Number.isFinite(props.ping)
        && props.ping > 0 && props.ping <= 10_000) next['data-rc-ping'] = Math.round(props.ping);
      if (Number.isSafeInteger(props.playing) && props.playing >= 0) next['data-rc-playing'] = props.playing;
      return next;
    });
  }

  function wrapComponent(type) {
    if (!type || (typeof type !== 'function' && typeof type !== 'object')) return type;
    if (componentTypes.has(type)) return componentTypes.get(type);
    let wrapped = type;
    if (typeof type === 'function' && !type.prototype?.isReactComponent) {
      wrapped = new Proxy(type, {
        apply(target, receiver, args) {
          const previous = renderingFriends;
          renderingFriends = isHomeFriends(args[0]) ? { props: args[0], matched: false } : null;
          try {
            const result = Reflect.apply(target, receiver, args);
            if (isServerList(args[0]) || isServerCard(args[0])) {
              try {
                return isServerList(args[0])
                  ? exposeServerListMetrics(result, args[0])
                  : exposeServerCardMetrics(result, args[0]);
              } catch { /* Keep Roblox's original server component renderable. */ }
            }
            return result;
          } finally {
            renderingFriends = previous;
          }
        },
      });
    } else if (type.$$typeof === Symbol.for('react.memo')) {
      wrapped = { ...type, type: wrapComponent(type.type) };
    } else if (type.$$typeof === Symbol.for('react.forward_ref')) {
      wrapped = { ...type, render: wrapComponent(type.render) };
    }
    componentTypes.set(type, wrapped);
    componentTypes.set(wrapped, wrapped);
    return wrapped;
  }

  function patchMethod(object, name, handler) {
    if (!object || (typeof object !== 'object' && typeof object !== 'function')) return;
    let methods = patchedMethods.get(object);
    if (!methods) patchedMethods.set(object, methods = new Set());
    if (methods.has(name)) return;

    try {
      const method = object[name];
      if (typeof method !== 'function') return;
      const descriptor = Object.getOwnPropertyDescriptor(object, name);

      if (descriptor && !descriptor.configurable
        && !('value' in descriptor ? descriptor.writable : descriptor.set)) {
        // Webpack's module exports can be non-configurable getter-only properties.
        // They cannot be replaced, so leave the original export untouched.
        methods.add(name);
        return;
      }

      if (descriptor?.get && descriptor.configurable) {
        const proxies = new WeakMap();
        Object.defineProperty(object, name, {
          ...descriptor,
          get() {
            const current = descriptor.get.call(this);
            if (typeof current !== 'function') return current;
            if (!proxies.has(current)) proxies.set(current, new Proxy(current, { apply: handler }));
            return proxies.get(current);
          },
        });
      } else {
        const wrapped = new Proxy(method, { apply: handler });
        if (!descriptor && Object.isExtensible(object)) {
          Object.defineProperty(object, name, {
            configurable: true, enumerable: true, writable: true, value: wrapped,
          });
        } else if (descriptor?.configurable && 'value' in descriptor && !descriptor.writable) {
          Object.defineProperty(object, name, { ...descriptor, value: wrapped });
        } else if (!Reflect.set(object, name, wrapped)) {
          methods.add(name);
          return;
        }
      }
      methods.add(name);
    } catch {
      // A frozen export cannot be patched. Retry only when a new module appears.
      methods.add(name);
    }
  }

  function patchFactory(runtime, name) {
    patchMethod(runtime, name, (target, receiver, args) => {
      if (isHomeFriends(args[1]) || isServerList(args[1]) || isServerCard(args[1])) {
        args[0] = wrapComponent(args[0]);
      }
      return Reflect.apply(target, receiver, args);
    });
  }

  function installReact(react) {
    if (!react) return;
    patchFactory(react, 'createElement');
    patchMethod(react, 'useState', (target, receiver, args) => {
      const result = Reflect.apply(target, receiver, args);
      const frame = renderingFriends;
      // The native FriendsList initializes visibleFriendsList with friendsList,
      // then its ResizeObserver truncates that state to one row. Supply the full
      // hydrated list to that one hook while retaining React's original setter.
      if (frame && !frame.matched && Array.isArray(frame.props.friendsList)
        && args[0] === frame.props.friendsList) {
        frame.matched = true;
        return [frame.props.friendsList, result[1]];
      }
      return result;
    });
  }

  function installJSX(runtime) {
    for (const name of ['jsx', 'jsxs', 'jsxDEV']) patchFactory(runtime, name);
  }

  function friendRequestUrl(config) {
    if (!/(?:^|\/)home\/?$/i.test(location.pathname)) return null;
    try {
      const url = new URL(config?.url, location.href);
      return url.origin === 'https://friends.roblox.com' && FIND_PATH.test(url.pathname)
        && !url.searchParams.has('cursor') ? url : null;
    } catch {
      return null;
    }
  }

  async function readRemainingFriends(first, url, get, receiver, args) {
    if (!Array.isArray(first?.data?.PageItems)) return first;
    const deadline = Date.now() + 4000;
    const items = [];
    const ids = new Set();
    const cursors = new Set();
    let data = first.data;
    let cursor = data.NextCursor;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      for (const friend of data.PageItems) {
        if (!Number.isSafeInteger(friend?.id) || ids.has(friend.id)) continue;
        ids.add(friend.id);
        items.push(friend);
        if (items.length >= MAX_FRIENDS) break;
      }
      cursor = data.NextCursor;
      if (items.length >= MAX_FRIENDS || typeof cursor !== 'string' || !cursor
        || cursors.has(cursor) || page === MAX_PAGES - 1) break;
      cursors.add(cursor);
      const nextUrl = new URL(url);
      nextUrl.searchParams.set('limit', '50');
      nextUrl.searchParams.set('cursor', cursor);
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      let timeout;
      try {
        // Extra rows must not hold up Roblox's already-loaded first page when
        // a later request stalls. This budget covers all additional pages.
        const next = await Promise.race([
          Reflect.apply(get, receiver, [
            { ...args[0], url: nextUrl.href }, ...args.slice(1),
          ]),
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('Friends request timed out')), remaining);
          })
        ]);
        if (!Array.isArray(next?.data?.PageItems)) break;
        data = next.data;
      } catch {
        console.warn('[Roblox Customizer] Could not load the remaining friends; keeping the pages already loaded.');
        break;
      } finally { clearTimeout(timeout); }
    }
    return { ...first, data: { ...first.data, PageItems: items, NextCursor: cursor } };
  }

  function installHttp(http) {
    patchMethod(http, 'get', (target, receiver, args) => {
      const url = friendRequestUrl(args[0]);
      const result = Reflect.apply(target, receiver, args);
      if (!url) return result;
      // Extend the response before Roblox hydrates names, avatars and presence.
      // All rendered friends still go through the official component pipeline.
      return Promise.resolve(result).then(first => readRemainingFriends(first, url, target, receiver, args));
    });
  }

  function watchProperty(object, name, callback) {
    if (!object || (typeof object !== 'object' && typeof object !== 'function')) return;
    callback(object[name]);
    let names = watchedProperties.get(object);
    if (!names) watchedProperties.set(object, names = new Set());
    if (names.has(name)) return;
    names.add(name);
    const descriptor = Object.getOwnPropertyDescriptor(object, name);
    if (descriptor && (!descriptor.configurable || descriptor.get || descriptor.set || !descriptor.writable)) return;
    let value = object[name];
    Object.defineProperty(object, name, {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
      get: () => value,
      set(next) {
        value = next;
        callback(next);
      },
    });
  }

  function connect() {
    watchProperty(window, 'React', installReact);
    watchProperty(window, 'ReactJSX', installJSX);
    watchProperty(window, 'ReactJSXDev', installJSX);
    watchProperty(window, 'Roblox', roblox => {
      watchProperty(roblox, 'core-scripts', core => {
        watchProperty(core, 'http', module => watchProperty(module, 'http', installHttp));
      });
    });
    // Older Roblox deployments expose the same service under CoreUtilities.
    watchProperty(window, 'CoreUtilities', core => watchProperty(core, 'httpService', installHttp));
  }

  // Run launches in Roblox's page context while preserving the user's click gesture.
  document.addEventListener('click', event => {
    if (!event.isTrusted || event.button !== 0 || event.ctrlKey || event.metaKey
      || event.shiftKey || event.altKey || !/^\/home\/?$/i.test(location.pathname)) return;
    const button = event.target?.closest?.('#rc-pinned-games .rc-pinned-game-join[data-rc-pinned-place-id]');
    if (!button) return;
    const placeId = Number(button.getAttribute('data-rc-pinned-place-id'));
    if (!Number.isSafeInteger(placeId) || placeId <= 0) return;
    const launcher = window.Roblox?.GameLauncher;
    if (typeof launcher?.joinMultiplayerGame !== 'function') return;
    event.preventDefault();
    const failed = () => document.dispatchEvent(new CustomEvent('rc-pinned-game-launch-error'));
    try {
      const result = launcher.joinMultiplayerGame(placeId, true, false);
      if (typeof result?.catch === 'function') result.catch(failed);
    } catch { failed(); }
  }, true);

  connect();
  document.addEventListener('load', event => {
    if (event.target?.tagName === 'SCRIPT') connect();
  }, true);
})();
