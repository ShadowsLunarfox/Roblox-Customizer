/* Dismiss extension-owned dialogs without treating an inside drag as an outside click. */
(() => {
  'use strict';
  if (globalThis.RobloxCustomizerDialogs) return;
  const bound = new WeakSet();

  function dismissOnOutside(surface, dismiss) {
    if (!surface || bound.has(surface)) return;
    bound.add(surface);
    const native = surface.localName === 'dialog';
    const panel = native ? surface : surface.querySelector(':scope > [role="dialog"], :scope > [role="alertdialog"]');
    const outside = event => {
      if (event.target !== surface) return false;
      // Native ::backdrop events target the dialog, including its own padding.
      // Touch capture can also retarget an inside release to a custom overlay.
      if (!panel) return true;
      const bounds = panel.getBoundingClientRect();
      return event.clientX < bounds.left || event.clientX >= bounds.right
        || event.clientY < bounds.top || event.clientY >= bounds.bottom;
    };
    const close = dismiss || (() => {
      // Follow the same cancellation and busy guards as Escape. Dismissal must
      // not accept terms or confirm a reset/import on the user's behalf.
      if (surface.dispatchEvent(new Event('cancel', { cancelable: true })) && surface.open) surface.close();
    });
    let pointer = null;
    let pressedOutside = false;
    let releasedOutside = false;
    const reset = () => { pointer = null; pressedOutside = releasedOutside = false; };
    surface.addEventListener('pointerdown', event => {
      reset();
      if (event.button !== 0 || !event.isPrimary) return;
      pointer = event.pointerId;
      pressedOutside = outside(event);
    }, true);
    surface.addEventListener('pointerup', event => {
      if (event.pointerId === pointer) releasedOutside = outside(event);
    }, true);
    surface.addEventListener('pointercancel', reset, true);
    surface.addEventListener('close', reset);
    surface.addEventListener('click', event => {
      const dismisses = event.button === 0 && pressedOutside && releasedOutside && outside(event);
      reset();
      if (!dismisses) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    }, true);
  }

  globalThis.RobloxCustomizerDialogs = Object.freeze({ dismissOnOutside });
})();
