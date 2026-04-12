document.getElementById("pip").addEventListener("click", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: enablePiP
  });
});

function enablePiP() {
  const video = document.querySelector("video");

  if (!video) {
    alert("ไม่พบวิดีโอบน Instagram 😢");
    return;
  }

  // ใช้ API ใหม่ (Better Fullscreen PiP)
  if (document.documentPictureInPicture) {
    document.documentPictureInPicture.requestWindow({
      width: screen.width,
      height: screen.height
    }).then(win => {
      const clone = video.cloneNode(true);
      clone.autoplay = true;
      clone.muted = true;
      clone.play();
      win.document.body.appendChild(clone);
    });
  } else {
    // fallback ปกติ
    video.requestPictureInPicture();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggleSwitch');

  // โหลดสถานะเดิมมาแสดง (ค่าเริ่มต้นคือ เปิด)
  chrome.storage.local.get(['isEnabled'], (res) => {
      toggle.checked = res.isEnabled !== false; 
  });

  // เมื่อกดเปลี่ยนสวิตช์ ให้บันทึกค่า
  toggle.addEventListener('change', (e) => {
      chrome.storage.local.set({ isEnabled: e.target.checked });
  });
});
