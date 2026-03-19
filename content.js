(function () {
    let popupWindow = null;
    let currentVideo = null;
    let originalParent = null;
    let originalSibling = null;
    let placeholder = null;

    // ==========================================
    // ⚙️ ตั้งค่า (ใส่ขนาดจอของคุณได้เต็มที่เลย)
    // ==========================================
    const CONFIG = {
        secondScreenOffsetX: 1920, // พิกัดจอที่ 2
        targetWidth: 1080,         // ความกว้างที่ต้องการ
        targetHeight: 1920,        // ความสูงที่ต้องการ
        defaultVolume: 0.15        // ระดับเสียง 15%
    };

    function getActiveVideo() {
        const videos = [...document.querySelectorAll("video")];
        const viewportHeight = window.innerHeight;
        const centerY = viewportHeight / 2;
        
        let best = null;
        let bestDistance = Infinity;
        const focusZoneThreshold = viewportHeight * 0.3; 

        videos.forEach(v => {
            const rect = v.getBoundingClientRect();
            if (rect.height > 100 && v !== currentVideo && rect.top < viewportHeight && rect.bottom > 0) {
                const mid = rect.top + rect.height / 2;
                const dist = Math.abs(mid - centerY);
                if (dist < focusZoneThreshold && dist <= bestDistance) {
                    best = v;
                    bestDistance = dist;
                }
            }
        });
        return best;
    }

    function setupVideoStyle(video) {
        video.style.width = "100vw";
        video.style.height = "100vh";
        video.style.objectFit = "contain";
        video.style.background = "black";
        video.controls = true;
        video.muted = false;
        video.volume = CONFIG.defaultVolume;
    }

    function resetVideoStyle(video) {
        video.style.width = "";
        video.style.height = "";
        video.style.objectFit = "";
        video.style.background = "";
        video.controls = false;
        video.muted = true;
    }

    function restoreVideoToPage() {
        if (currentVideo && originalParent && placeholder) {
            resetVideoStyle(currentVideo);
            if (placeholder.parentNode) {
                placeholder.parentNode.replaceChild(currentVideo, placeholder);
            } else {
                originalParent.insertBefore(currentVideo, originalSibling);
            }
            currentVideo.muted = true;
            currentVideo.play().catch(()=>{});
        }
        currentVideo = null;
        originalParent = null;
        originalSibling = null;
        placeholder = null;
    }

    async function openOrUpdatePopup(newVideo) {
        if (!newVideo) return;
        if (newVideo === currentVideo) return;

        try {
            // กรณี 1: มีหน้าต่าง Popup เปิดอยู่แล้ว -> สลับวิดีโอ (Switch)
            if (popupWindow && !popupWindow.closed) {
                restoreVideoToPage(); 

                currentVideo = newVideo;
                originalParent = newVideo.parentElement;
                originalSibling = newVideo.nextSibling;

                placeholder = document.createElement("div");
                Object.assign(placeholder.style, {
                    width: "100%", height: "100%", backgroundColor: "black",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#888", fontSize: "14px"
                });
                placeholder.innerText = "Playing in Popup 🚀";

                originalParent.insertBefore(placeholder, newVideo);

                setupVideoStyle(newVideo);
                popupWindow.document.body.appendChild(newVideo);
                
                newVideo.volume = CONFIG.defaultVolume; 
                newVideo.play().catch(()=>{});
                return;
            }

            // กรณี 2: เปิดหน้าต่าง Popup ใหม่
            currentVideo = newVideo;
            originalParent = newVideo.parentElement;
            originalSibling = newVideo.nextSibling;

            placeholder = document.createElement("div");
            Object.assign(placeholder.style, {
                width: "100%", height: "100%", backgroundColor: "black",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc"
            });
            placeholder.innerText = "Popup Mode Active 🚀";
            originalParent.insertBefore(placeholder, newVideo);

            // 🎯 ใช้ window.open สร้างหน้าต่างใหม่ที่สามารถกำหนดขนาดและพิกัดได้
            const features = `width=${CONFIG.targetWidth},height=${CONFIG.targetHeight},left=${CONFIG.secondScreenOffsetX},top=0,menubar=no,toolbar=no,location=no,status=no`;
            popupWindow = window.open("", "IG_Popup_Video", features);

            // ดักจับกรณีผู้ใช้ยังไม่ได้อนุญาต Popup
            if (!popupWindow) {
                alert("⚠️ เบราว์เซอร์บล็อก Popup! กรุณากดปุ่ม 'อนุญาตป๊อปอัป (Allow pop-ups)' ที่ช่อง URL มุมขวาบนครับ");
                restoreVideoToPage();
                return;
            }

            // 🎯 เขียนโครงสร้าง HTML และปุ่ม Fullscreen ลงในหน้าต่าง Popup
            popupWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>IG Video - Popup</title>
                    <style>
                        body { margin: 0; background: black; display: flex; justify-content: center; align-items: center; width: 100vw; height: 100vh; overflow: hidden; }
                        video { width: 100%; height: 100%; object-fit: contain; outline: none; }
                        #fsBtn { position: absolute; top: 20px; right: 20px; z-index: 9999; padding: 12px 20px; background: rgba(255,0,50,0.9); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: 0.2s; }
                        #fsBtn:hover { background: red; transform: scale(1.05); }
                    </style>
                </head>
                <body>
                    <button id="fsBtn">🔲 ขยายเต็มจอไร้ขอบ (Fullscreen)</button>
                </body>
                </html>
            `);
            popupWindow.document.close();

            // ย้ายวิดีโอเข้าไป
            setupVideoStyle(newVideo);
            popupWindow.document.body.appendChild(newVideo);

            // 🎯 ระบบจัดการปุ่ม Fullscreen (กดแล้วจะซ่อนปุ่มให้ดูเนียนตา)
            const fsBtn = popupWindow.document.getElementById('fsBtn');
            fsBtn.addEventListener('click', () => {
                popupWindow.document.documentElement.requestFullscreen().then(() => {
                    fsBtn.style.display = 'none'; 
                }).catch(err => console.warn("Fullscreen failed:", err));
            });

            // ถ้าผู้ใช้กด ESC ออกจากเต็มจอ ให้โชว์ปุ่มกลับมา
            popupWindow.document.addEventListener('fullscreenchange', () => {
                if (!popupWindow.document.fullscreenElement) {
                    fsBtn.style.display = 'block';
                }
            });

            // ถ้าผู้ใช้กด (X) ปิดหน้าต่าง Popup
            popupWindow.addEventListener("beforeunload", () => {
                restoreVideoToPage();
                popupWindow = null;
            });

            newVideo.volume = CONFIG.defaultVolume;
            newVideo.play().catch(()=>{});

        } catch (err) {
            console.error("Popup Error:", err);
            restoreVideoToPage();
        }
    }

    function checkAndSwitchVideo() {
        if (!popupWindow || popupWindow.closed) return;
        const newActive = getActiveVideo();
        if (newActive && newActive !== currentVideo) {
            openOrUpdatePopup(newActive);
        }
    }

    function addPiPButton() {
        const videos = document.querySelectorAll("video");
        videos.forEach(video => {
            if (video.dataset.pipReady) return;
            video.dataset.pipReady = "true";

            const parent = video.parentElement;
            
            const btn = document.createElement("button");
            btn.className = "my-pip-btn";
            btn.innerText = "Popup 🚀"; // เปลี่ยนชื่อปุ่ม
            Object.assign(btn.style, {
                position: "absolute", top: "10px", right: "10px", zIndex: "9999",
                padding: "6px 10px", background: "rgba(0,0,0,0.6)", color: "white",
                border: "1px solid rgba(255,255,255,0.3)", borderRadius: "4px", cursor: "pointer"
            });

            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                openOrUpdatePopup(video);
            };

            if (window.getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative';
            }
            parent.appendChild(btn);

            // ระบบแก้เสียงหายตอนวนลูป ยังอยู่ครบ
            let lastTime = 0;
            video.addEventListener('timeupdate', () => {
                if (popupWindow && currentVideo === video && !popupWindow.closed) {
                    if (video.currentTime < lastTime - 0.5) {
                        video.muted = false; 
                        if (video.volume === 0) video.volume = CONFIG.defaultVolume;
                    }
                    lastTime = video.currentTime;
                }
            });

            video.addEventListener('playing', () => {
                if (popupWindow && currentVideo === video && !popupWindow.closed) {
                    video.muted = false;
                    return;
                }
                if (!popupWindow || popupWindow.closed || currentVideo === video) return;
                
                setTimeout(() => {
                    const rect = video.getBoundingClientRect();
                    const isVisible = rect.top < window.innerHeight && rect.bottom > 0 && rect.height > 100;
                    if (!video.paused && isVisible) {
                        openOrUpdatePopup(video);
                    }
                }, 300);
            });
        });
    }

    let scrollTimeout;
    function observeForVideoChange() {
        const observer = new MutationObserver(() => {
            addPiPButton();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        window.addEventListener("scroll", () => {
            if (!popupWindow || popupWindow.closed) return;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(checkAndSwitchVideo, 400); 
        });
    }

    setInterval(addPiPButton, 1500);
    observeForVideoChange();
})();