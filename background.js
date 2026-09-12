chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-vault') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'PV_TOGGLE' });
      }
    });
  }
});
