(function () {
    let pipWindow = null;
    let currentVideo = null;
    let originalParent = null;
    let originalSibling = null;
    let placeholder = null;

    // ==========================================
    // ⚙️ ตั้งค่า
    // ==========================================
    const CONFIG = {
        secondScreenOffsetX: 1920, // พิกัดจอที่ 2
        targetWidth: 1080,
        targetHeight: 1920,
        defaultVolume: 0.15 // 🔊 ระดับเสียงเริ่มต้น 15%
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

                if (dist < focusZoneThreshold && dist < bestDistance) {
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

    async function openOrUpdatePiP(newVideo) {
        if (!newVideo) return;
        if (newVideo === currentVideo) return;

        if (!('documentPictureInPicture' in window)) {
            alert("Chrome ของคุณไม่รองรับ Document PiP");
            return;
        }

        try {
            // กรณี 1: สลับวิดีโอ (Switch)
            if (pipWindow) {
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
                placeholder.innerText = "Playing in PiP 🚀";

                originalParent.insertBefore(placeholder, newVideo);

                setupVideoStyle(newVideo);
                pipWindow.document.body.appendChild(newVideo);
                
                newVideo.volume = CONFIG.defaultVolume; 
                newVideo.play();
                return;
            }

            // กรณี 2: เปิดหน้าต่างใหม่ (New Window)
            currentVideo = newVideo;
            originalParent = newVideo.parentElement;
            originalSibling = newVideo.nextSibling;

            placeholder = document.createElement("div");
            Object.assign(placeholder.style, {
                width: "100%", height: "100%", backgroundColor: "black",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#ccc"
            });
            placeholder.innerText = "PiP Mode Active 🚀";
            
            originalParent.insertBefore(placeholder, newVideo);

            // requestWindow ตั้งขนาดมาให้แล้ว ไม่ต้อง resizeTo อีก
            pipWindow = await window.documentPictureInPicture.requestWindow({
                width: CONFIG.targetWidth,
                height: CONFIG.targetHeight,
            });

            setupVideoStyle(newVideo);
            pipWindow.document.body.append(newVideo);
            
            Object.assign(pipWindow.document.body.style, { margin: "0", background: "black" });

            // ใช้ Try-Catch ครอบการย้ายจอ เพื่อไม่ให้ Error หยุดการทำงานของโปรแกรม
            setTimeout(() => {
                try {
                    pipWindow.moveTo(CONFIG.secondScreenOffsetX, 0);
                    // ลบ resizeTo ออก เพื่อแก้ Error
                } catch (e) {
                    console.warn("Auto-move failed (browser restriction):", e);
                }
            }, 100);

            pipWindow.addEventListener("pagehide", () => {
                restoreVideoToPage();
                pipWindow = null;
            });

            newVideo.volume = CONFIG.defaultVolume;
            newVideo.play();

        } catch (err) {
            console.error("PiP Error:", err);
            restoreVideoToPage();
        }
    }

    function addPiPButton() {
        const videos = document.querySelectorAll("video");
        videos.forEach(video => {
            const parent = video.parentElement;
            if (parent.querySelector(".my-pip-btn") || video === currentVideo) return;

            const btn = document.createElement("button");
            btn.className = "my-pip-btn";
            btn.innerText = "PiP 🚀";
            Object.assign(btn.style, {
                position: "absolute", top: "10px", right: "10px", zIndex: "9999",
                padding: "6px 10px", background: "rgba(0,0,0,0.6)", color: "white",
                border: "1px solid rgba(255,255,255,0.3)", borderRadius: "4px", cursor: "pointer"
            });

            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                openOrUpdatePiP(video);
            };

            if (window.getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative';
            }
            parent.appendChild(btn);
        });
    }

    let scrollTimeout;
    function observeForVideoChange() {
        const observer = new MutationObserver(() => {
            addPiPButton();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        window.addEventListener("scroll", () => {
            if (!pipWindow) return;

            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const newActive = getActiveVideo();
                if (newActive && newActive !== currentVideo) {
                    openOrUpdatePiP(newActive);
                }
            }, 400); 
        });
    }

    setInterval(addPiPButton, 1500);
    observeForVideoChange();
})();