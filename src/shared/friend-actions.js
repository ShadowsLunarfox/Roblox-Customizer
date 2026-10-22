/* Use the same native entry points as Roblox's FriendsCarousel, on user clicks only. */
(globalThis.RobloxCustomizerCompatibility?.runFeature || (initialize => initialize()))(() => {
  'use strict';
  const path = () => globalThis.RobloxCustomizerRoutes?.pathname() || location.pathname;
  document.addEventListener('click', event => {
    if (!event.isTrusted || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
      || !/^\/home\/?$/i.test(path())) return;
    const root = document.documentElement;
    if (root.hasAttribute('data-rc-features-disabled') || root.hasAttribute('data-rc-hide-pinned-friends')) return;
    const control = event.target?.closest?.('#rc-pinned-friend-menu [data-rc-friend-action]');
    if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
    const menu = control.closest('#rc-pinned-friend-menu');
    const userId = Number(menu.dataset.userId), action = control.dataset.rcFriendAction;
    if (!Number.isSafeInteger(userId) || userId <= 0 || !menu.matches(':popover-open')
      || !document.querySelector(`#HomeContainer #rc-pinned-friends .rc-pinned-friend[data-user-id="${userId}"]`)) return;
    const report = ok => document.dispatchEvent(new CustomEvent('rc-pinned-friend-action-result', {
      detail: JSON.stringify({ userId, action, ok })
    }));
    let run;
    if (action === 'chat') {
      const service = window.CoreRobloxUtilities?.chatService;
      if (typeof service?.startDesktopAndMobileWebChat === 'function') {
        run = () => service.startDesktopAndMobileWebChat({ userId });
      }
    } else if (action === 'join') {
      const attempt = menu.dataset.gameId || '';
      if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(attempt)) return;
      const roblox = window.Roblox, protocol = roblox?.ProtocolHandlerClientInterface, launcher = roblox?.GameLauncher;
      const device = roblox?.['core-scripts']?.meta?.device?.getDeviceMeta?.();
      if (device?.isInApp && device.isDesktop && typeof launcher?.followPlayerIntoGame === 'function') {
        run = () => launcher.followPlayerIntoGame(userId, attempt, 'JoinUser');
      } else if (typeof protocol?.followPlayerIntoGame === 'function') {
        run = () => protocol.followPlayerIntoGame({ userId, joinAttemptId: attempt, joinAttemptOrigin: 'JoinUser' });
      } else if (typeof launcher?.followPlayerIntoGame === 'function') {
        run = () => launcher.followPlayerIntoGame(userId, attempt, 'JoinUser');
      }
      // The link retains Roblox's native /games/start route when a native launcher isn't exposed.
    }
    if (!run) return;
    event.preventDefault(); control.dataset.rcActionHandled = 'true';
    try {
      const result = run();
      if (typeof result?.then === 'function') result.then(() => report(true), () => report(false));
      else report(true);
    } catch { report(false); }
  }, true);
});
