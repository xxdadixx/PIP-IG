document.addEventListener('DOMContentLoaded', () => {
  const toggleMain = document.getElementById('toggleMain');
  const toggleScroll = document.getElementById('toggleScroll');

  chrome.storage.local.get(['isEnabled', 'isAutoScrollEnabled'], (res) => {
      toggleMain.checked = res.isEnabled !== false; 
      toggleScroll.checked = res.isAutoScrollEnabled !== false; 
  });

  toggleMain.addEventListener('change', (e) => {
      chrome.storage.local.set({ isEnabled: e.target.checked });
  });

  toggleScroll.addEventListener('change', (e) => {
      chrome.storage.local.set({ isAutoScrollEnabled: e.target.checked });
  });
});