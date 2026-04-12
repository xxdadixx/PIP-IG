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
              // เก็บค่าพิกัด Left, Top, Width, Height ไว้ใน option
              opt.value = JSON.stringify(disp.bounds);
              
              // แสดงชื่อให้ดูง่ายๆ เช่น "Screen 1 (3440x1440)"
              opt.text = `Screen ${index + 1} (${disp.bounds.width}x${disp.bounds.height})`;
              
              // ถ้าเคยเลือกจอไว้แล้ว ให้แสดงผลเป็นจอนั้น
              if (res.targetScreenBounds) {
                  const saved = res.targetScreenBounds;
                  if (saved.left === disp.bounds.left && saved.top === disp.bounds.top) {
                      opt.selected = true;
                  }
              } else if (!disp.isPrimary) {
                  // ถ้ายังไม่เคยเลือก ให้เดาเอาจอที่ 2 (จอที่ไม่ใช่จอหลัก) เป็นค่าเริ่มต้น
                  opt.selected = true;
                  chrome.storage.local.set({ targetScreenBounds: disp.bounds });
              }

              screenSelect.appendChild(opt);
          });
      });
  });

  // บันทึกเมื่อมีการเปิด/ปิด หรือเปลี่ยนจอ
  toggleMain.addEventListener('change', (e) => chrome.storage.local.set({ isEnabled: e.target.checked }));
  toggleScroll.addEventListener('change', (e) => chrome.storage.local.set({ isAutoScrollEnabled: e.target.checked }));
  
  screenSelect.addEventListener('change', (e) => {
      const bounds = JSON.parse(e.target.value);
      chrome.storage.local.set({ targetScreenBounds: bounds }); // จำพิกัดหน้าจอที่เลือกลงระบบ
  });
});