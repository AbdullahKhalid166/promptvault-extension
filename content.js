(() => {
  const STORAGE_KEY = 'pv_prompts';
  let lastTarget = null;
  let logoEl = null;
  let panelEl = null;
  let anchorObserver = null;
  let resizeObserver = null;
  let lastReanchorAt = 0;

  function isEditable(el) {
    if (!el) return false;
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return ['text', 'search', 'email', 'url', ''].includes(type);
    }
    if (el.isContentEditable) return true;
    return false;
  }

  function removeLogo() {
    if (logoEl) { logoEl.remove(); logoEl = null; }
    if (anchorObserver) { anchorObserver.disconnect(); anchorObserver = null; }
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
    closePanel();
  }

  function closePanel() {
    if (panelEl) { panelEl.remove(); panelEl = null; }
  }

  // Try to find a nearby icon-sized button (send / mic / attach) that sits
  // in the same row as the input, so we can slot our logo in right next to
  // it instead of floating a separate element on top of the page.
  function findAnchorButton(target) {
    const targetRect = target.getBoundingClientRect();
    let container = target.parentElement;
    for (let i = 0; i < 6 && container; i++) {
      const candidates = Array.from(container.querySelectorAll('button, [role="button"]'));
      const near = candidates.filter((btn) => {
        if (btn === target || target.contains(btn)) return false;
        const r = btn.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        if (r.width > 80 || r.height > 80) return false; // skip large, non-icon buttons
        const verticallyAligned = Math.abs((r.top + r.height / 2) - (targetRect.top + targetRect.height / 2)) < Math.max(targetRect.height, 60);
        const toTheRight = r.left >= targetRect.left - 4;
        return verticallyAligned && toTheRight;
      });
      if (near.length > 0) {
        near.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        return near[0];
      }
      container = container.parentElement;
    }
    return null;
  }

  function placeLogo(target) {
    removeLogo();
    logoEl = document.createElement('div');
    logoEl.className = 'pv-logo';
    logoEl.title = 'Prompt Vault';
    logoEl.textContent = 'PV';

    const anchor = findAnchorButton(target);
    if (anchor && anchor.parentElement) {
      const parent = anchor.parentElement;
      const beforeH = parent.getBoundingClientRect().height;
      const beforeOverflow = parent.scrollWidth > parent.clientWidth + 1;
      logoEl.classList.add('pv-logo-inline');
      const r = anchor.getBoundingClientRect();
      const s = Math.max(20, Math.min(32, Math.round(Math.min(r.width, r.height)) || 24));
      logoEl.style.width = s + 'px';
      logoEl.style.height = s + 'px';
      logoEl.style.fontSize = Math.max(8, Math.round(s * 0.4)) + 'px';
      parent.insertBefore(logoEl, anchor);

      const afterH = parent.getBoundingClientRect().height;
      const afterOverflow = parent.scrollWidth > parent.clientWidth + 1;
      if (afterH > beforeH + 2 || (afterOverflow && !beforeOverflow)) {
        // Row wrapped or overflowed/overlapped — bail out to floating mode.
        logoEl.remove();
        logoEl.className = 'pv-logo pv-logo-floating';
        document.body.appendChild(logoEl);
        positionFloatingLogo(target);
        watchFloatingTarget(target);
      } else {
        watchAnchorParent(target);
      }
    } else {
      logoEl.classList.add('pv-logo-floating');
      document.body.appendChild(logoEl);
      positionFloatingLogo(target);
      watchFloatingTarget(target);
    }

    target.addEventListener('input', () => {
      if (logoEl && !document.body.contains(logoEl) && lastTarget === target) {
        placeLogo(target);
      }
    });

    logoEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePanel(target);
    });
  }

  // If the host page re-renders and removes our injected logo (common on
  // React-based chat UIs, which often replace whole toolbar subtrees, not
  // just the button), watch broadly and re-anchor fresh when that happens.
  function watchAnchorParent(target) {
    if (anchorObserver) anchorObserver.disconnect();
    anchorObserver = new MutationObserver(() => {
      if (!logoEl || document.body.contains(logoEl)) return;
      const now = Date.now();
      if (now - lastReanchorAt < 200) return; // debounce rapid re-renders
      lastReanchorAt = now;
      if (lastTarget === target && document.body.contains(target)) {
        placeLogo(target);
      }
    });
    anchorObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Floating fallback: reposition fast whenever the box's size or scroll
  // position changes, instead of waiting on a slow polling loop.
  function watchFloatingTarget(target) {
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(() => positionFloatingLogo(target));
    resizeObserver.observe(target);
    target.addEventListener('input', () => positionFloatingLogo(target));
  }

  function positionFloatingLogo(target) {
    if (!logoEl) return;
    const rect = target.getBoundingClientRect();
    const size = 24;
    const gap = 6;
    let top = rect.top + window.scrollY + (rect.height - size) / 2;
    let left = rect.right + window.scrollX + gap;

    if (rect.right + gap + size > window.innerWidth) {
      left = rect.right + window.scrollX - size;
      top = rect.top + window.scrollY - size - gap;
    }
    if (top - window.scrollY < 0) {
      top = rect.bottom + window.scrollY + gap;
      left = rect.right + window.scrollX - size;
    }
    logoEl.style.top = `${top}px`;
    logoEl.style.left = `${left}px`;
  }

  function togglePanel(target) {
    if (panelEl) { closePanel(); return; }
    openPanel(target);
  }

  async function openPanel(target) {
    closePanel();
    if (!isExtCtxValid()) {
      panelEl = document.createElement('div');
      panelEl.className = 'pv-panel';
      panelEl.innerHTML = '<div class="pv-panel-header">Prompt Vault</div><div class="pv-empty">Extension was updated. Please refresh this page to keep using Prompt Vault.</div>';
      document.body.appendChild(panelEl);
      positionPanel();
      return;
    }
    const prompts = await getPrompts();
    panelEl = document.createElement('div');
    panelEl.className = 'pv-panel';

    const header = document.createElement('div');
    header.className = 'pv-panel-header';
    header.textContent = 'Prompt Vault';
    panelEl.appendChild(header);

    const list = document.createElement('div');
    list.className = 'pv-panel-list';

    if (prompts.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pv-empty';
      empty.textContent = 'No prompts yet. Add one below.';
      list.appendChild(empty);
    } else {
      prompts.forEach((p) => {
        const item = document.createElement('div');
        item.className = 'pv-item';

        const titleEl = document.createElement('span');
        titleEl.className = 'pv-item-title';
        titleEl.textContent = p.title;
        titleEl.title = 'Click to inject into the input box';
        titleEl.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          injectPrompt(target, p.text);
          closePanel();
        });

        const actions = document.createElement('span');
        actions.className = 'pv-item-actions';

        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'pv-btn-small';
        editBtn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openEditForm(target, p);
        });

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Del';
        delBtn.className = 'pv-btn-small pv-btn-danger';
        delBtn.addEventListener('mousedown', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await deletePrompt(p.id);
          openPanel(target);
        });

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
        item.appendChild(titleEl);
        item.appendChild(actions);
        list.appendChild(item);
      });
    }

    panelEl.appendChild(list);

    const addBtn = document.createElement('button');
    addBtn.className = 'pv-btn-add';
    addBtn.textContent = '+ New Prompt';
    addBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEditForm(target, null);
    });
    panelEl.appendChild(addBtn);

    document.body.appendChild(panelEl);
    positionPanel();

    document.addEventListener('mousedown', onOutsideClick, true);
  }

  function onOutsideClick(e) {
    if (panelEl && !panelEl.contains(e.target) && e.target !== logoEl) {
      closePanel();
      document.removeEventListener('mousedown', onOutsideClick, true);
    }
  }

  function positionPanel() {
    if (!logoEl || !panelEl) return;
    const rect = logoEl.getBoundingClientRect();
    const panelWidth = 280;
    const panelHeight = panelEl.offsetHeight || 300;

    let left = rect.left + window.scrollX;
    if (left + panelWidth > window.innerWidth) {
      left = window.innerWidth - panelWidth - 10;
    }
    if (left < 4) left = 4;

    let top = rect.bottom + window.scrollY + 6;
    if (rect.bottom + panelHeight + 6 > window.innerHeight) {
      // Not enough room below — open upward instead.
      top = rect.top + window.scrollY - panelHeight - 6;
      if (top < window.scrollY + 4) top = window.scrollY + 4;
    }
    panelEl.style.top = `${top}px`;
    panelEl.style.left = `${left}px`;
  }

  function openEditForm(target, existing) {
    closePanel();
    panelEl = document.createElement('div');
    panelEl.className = 'pv-panel';

    const header = document.createElement('div');
    header.className = 'pv-panel-header';
    header.textContent = existing ? 'Edit Prompt' : 'New Prompt';
    panelEl.appendChild(header);

    const form = document.createElement('div');
    form.className = 'pv-form';

    const titleInput = document.createElement('input');
    titleInput.className = 'pv-input';
    titleInput.placeholder = 'Title';
    titleInput.value = existing ? existing.title : '';

    const textArea = document.createElement('textarea');
    textArea.className = 'pv-textarea';
    textArea.placeholder = 'Prompt text';
    textArea.value = existing ? existing.text : (getCurrentText(target) || '');

    const saveBtn = document.createElement('button');
    saveBtn.className = 'pv-btn-add';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('mousedown', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const title = titleInput.value.trim() || 'Untitled';
      const text = textArea.value;
      if (!text.trim()) return;
      if (existing) {
        await updatePrompt(existing.id, title, text);
      } else {
        await addPrompt(title, text);
      }
      openPanel(target);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'pv-btn-small';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPanel(target);
    });

    form.appendChild(titleInput);
    form.appendChild(textArea);
    const btnRow = document.createElement('div');
    btnRow.className = 'pv-form-btns';
    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);
    form.appendChild(btnRow);
    panelEl.appendChild(form);

    document.body.appendChild(panelEl);
    positionPanel();
    titleInput.focus();

    document.addEventListener('mousedown', onOutsideClick, true);
  }

  function getCurrentText(target) {
    if (!target) return '';
    if (target.tagName && target.tagName.toLowerCase() === 'textarea') return target.value;
    if (target.tagName && target.tagName.toLowerCase() === 'input') return target.value;
    if (target.isContentEditable) return target.innerText;
    return '';
  }

  function injectPrompt(target, text) {
    if (!target || !document.body.contains(target)) return false;
    target.focus();
    const tag = target.tagName ? target.tagName.toLowerCase() : '';
    if (tag === 'textarea' || tag === 'input') {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        tag === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
        'value'
      ).set;
      nativeSetter.call(target, text);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (target.isContentEditable) {
      target.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
      target.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      return false;
    }
    return true;
  }

  // Storage helpers
  function isExtCtxValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local);
    } catch (e) {
      return false;
    }
  }

  function getPrompts() {
    return new Promise((resolve) => {
      if (!isExtCtxValid()) { resolve([]); return; }
      try {
        chrome.storage.local.get([STORAGE_KEY], (res) => {
          if (chrome.runtime.lastError) { resolve([]); return; }
          resolve(res[STORAGE_KEY] || []);
        });
      } catch (e) { resolve([]); }
    });
  }

  function setPrompts(prompts) {
    return new Promise((resolve) => {
      if (!isExtCtxValid()) { resolve(false); return; }
      try {
        chrome.storage.local.set({ [STORAGE_KEY]: prompts }, () => resolve(true));
      } catch (e) { resolve(false); }
    });
  }

  async function addPrompt(title, text) {
    const prompts = await getPrompts();
    prompts.unshift({ id: Date.now().toString(), title, text });
    await setPrompts(prompts);
  }

  async function updatePrompt(id, title, text) {
    const prompts = await getPrompts();
    const idx = prompts.findIndex((p) => p.id === id);
    if (idx !== -1) {
      prompts[idx].title = title;
      prompts[idx].text = text;
    }
    await setPrompts(prompts);
  }

  async function deletePrompt(id) {
    const prompts = await getPrompts();
    await setPrompts(prompts.filter((p) => p.id !== id));
  }

  // Focus/click detection
  document.addEventListener('focusin', (e) => {
    // Ignore our own logo/panel — otherwise focusing our own form fields
    // (e.g. the "New Prompt" title input) re-triggers this handler and
    // tears the panel down mid-use.
    if (e.target.closest && e.target.closest('.pv-panel, .pv-logo')) return;
    if (isEditable(e.target)) {
      lastTarget = e.target;
      placeLogo(e.target);
    }
  });

  document.addEventListener('focusout', (e) => {
    setTimeout(() => {
      const active = document.activeElement;
      const stillRelevant =
        (logoEl && logoEl.matches(':hover')) ||
        (panelEl && panelEl.contains(active));
      if (!stillRelevant && active !== lastTarget) {
        removeLogo();
      }
    }, 150);
  });

  // Keep the panel following the logo (inline mode can shift on reflow)
  window.addEventListener('scroll', () => { if (panelEl) positionPanel(); }, true);
  window.addEventListener('resize', () => { if (panelEl) positionPanel(); });

  // Keyboard shortcut + popup-triggered injection
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      try {
        if (msg && msg.type === 'PV_TOGGLE') {
          if (lastTarget) togglePanel(lastTarget);
        } else if (msg && msg.type === 'PV_INJECT') {
          const ok = injectPrompt(lastTarget, msg.text);
          sendResponse({ ok });
          return true;
        }
      } catch (e) { /* context likely invalidated mid-message; ignore */ }
    });
  } catch (e) { /* extension context not ready/invalidated */ }
})();
