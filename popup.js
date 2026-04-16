document.addEventListener('DOMContentLoaded', () => {
    const toggleMain = document.getElementById('toggleMain');
    const toggleScroll = document.getElementById('toggleScroll');
    const screenSelect = document.getElementById('screenSelect');
  
    // ดึงค่าที่เคยตั้งไว้
    chrome.storage.local.get(['isEnabled', 'isAutoScrollEnabled', 'targetScreenBounds'], (res) => {
        toggleMain.checked = res.isEnabled !== false; 
        toggleScroll.checked = res.isAutoScrollEnabled !== false; 
  
        // 🎯 สแกนหาหน้าจอทั้งหมดในระบบ
        chrome.system.display.getInfo((displays) => {
            screenSelect.innerHTML = ''; // ล้างค่า Loading ออก
            
            displays.forEach((disp, index) => {
                const opt = document.createElement('option');
                opt.value = JSON.stringify(disp.bounds);
                opt.text = `Screen ${index + 1} (${disp.bounds.width}x${disp.bounds.height})`;
                
                if (res.targetScreenBounds) {
                    const saved = res.targetScreenBounds;
                    if (saved.left === disp.bounds.left && saved.top === disp.bounds.top) {
                        opt.selected = true;
                    }
                } else if (!disp.isPrimary) {
                    opt.selected = true;
                    chrome.storage.local.set({ targetScreenBounds: disp.bounds });
                }
  
                screenSelect.appendChild(opt);
            });

            // ถ้าไม่มีค่าในระบบเลย ให้จำค่าของจอแรกไว้เป็น Default
            if (!res.targetScreenBounds && displays.length > 0) {
                chrome.storage.local.set({ targetScreenBounds: displays[0].bounds });
            }
        });
    });
  
    // บันทึกเมื่อมีการเปิด/ปิด หรือเปลี่ยนจอ
    toggleMain.addEventListener('change', (e) => chrome.storage.local.set({ isEnabled: e.target.checked }));
    toggleScroll.addEventListener('change', (e) => chrome.storage.local.set({ isAutoScrollEnabled: e.target.checked }));
    screenSelect.addEventListener('change', (e) => chrome.storage.local.set({ targetScreenBounds: JSON.parse(e.target.value) }));
});