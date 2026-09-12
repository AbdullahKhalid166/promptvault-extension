const STORAGE_KEY = 'pv_prompts';

const listEl = document.getElementById('list');
const newBtn = document.getElementById('newBtn');
const formView = document.getElementById('formView');
const titleInput = document.getElementById('titleInput');
const textInput = document.getElementById('textInput');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');

let editingId = null;

function getPrompts() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([STORAGE_KEY], (res) => resolve(res[STORAGE_KEY] || []));
    } catch (e) { resolve([]); }
  });
}

function setPrompts(prompts) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: prompts }, () => resolve(true));
    } catch (e) { resolve(false); }
  });
}

async function render() {
  const prompts = await getPrompts();
  listEl.innerHTML = '';
  if (prompts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No prompts yet.';
    listEl.appendChild(empty);
    return;
  }
  prompts.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'item';

    const title = document.createElement('span');
    title.className = 'item-title';
    title.textContent = p.title;
    title.title = 'Click to inject into the page\'s input box';
    title.addEventListener('click', () => injectFromPopup(p.text));

    const actions = document.createElement('span');
    actions.className = 'item-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-small';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openForm(p));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-small';
    delBtn.textContent = 'Del';
    delBtn.addEventListener('click', async () => {
      const updated = (await getPrompts()).filter((x) => x.id !== p.id);
      await setPrompts(updated);
      render();
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    item.appendChild(title);
    item.appendChild(actions);
    listEl.appendChild(item);
  });
}

const statusEl = document.getElementById('status');

function showStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.className = isError ? 'status status-error' : 'status status-ok';
  setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'status'; }, 2000);
}

function injectFromPopup(text) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].id) return;
    try {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'PV_INJECT', text }, (resp) => {
        if (chrome.runtime.lastError || !resp || !resp.ok) {
          showStatus('Click an AI input box on the page first.', true);
        } else {
          window.close();
        }
      });
    } catch (e) {
      showStatus('Please refresh the AI site tab and try again.', true);
    }
  });
}

function openForm(existing) {
  editingId = existing ? existing.id : null;
  titleInput.value = existing ? existing.title : '';
  textInput.value = existing ? existing.text : '';
  formView.classList.remove('hidden');
  newBtn.classList.add('hidden');
  titleInput.focus();
}

function closeForm() {
  editingId = null;
  titleInput.value = '';
  textInput.value = '';
  formView.classList.add('hidden');
  newBtn.classList.remove('hidden');
}

newBtn.addEventListener('click', () => openForm(null));
cancelBtn.addEventListener('click', closeForm);

saveBtn.addEventListener('click', async () => {
  const title = titleInput.value.trim() || 'Untitled';
  const text = textInput.value;
  if (!text.trim()) return;
  const prompts = await getPrompts();
  if (editingId) {
    const idx = prompts.findIndex((p) => p.id === editingId);
    if (idx !== -1) {
      prompts[idx].title = title;
      prompts[idx].text = text;
    }
  } else {
    prompts.unshift({ id: Date.now().toString(), title, text });
  }
  await setPrompts(prompts);
  closeForm();
  render();
});

render();
