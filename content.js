(function () {
    let isEnabled = true; 
    let isAutoScrollEnabled = true;

    let popupWindow = null;
    let currentVideo = null;
    let originalParent = null;
    let originalSibling = null;
    let placeholder = null;

    // ==========================================
    // ⚙️ รับคำสั่งจากสวิตช์ Toggle
    // ==========================================
    chrome.storage.local.get(['isEnabled', 'isAutoScrollEnabled'], (res) => {
        isEnabled = res.isEnabled !== false;
        isAutoScrollEnabled = res.isAutoScrollEnabled !== false;
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.isEnabled) {
            isEnabled = changes.isEnabled.newValue;
            if (!isEnabled) {
                document.querySelectorAll(".my-pip-btn").forEach(btn => btn.remove());
                document.querySelectorAll("video").forEach(v => delete v.dataset.pipReady);
                if (popupWindow && !popupWindow.closed) {
                    restoreVideoToPage();
                    popupWindow.close();
                }
            } else {
                addPiPButton(); 
            }
        }
        if (changes.isAutoScrollEnabled) {
            isAutoScrollEnabled = changes.isAutoScrollEnabled.newValue;
        }
    });

    // ==========================================
    // ⚙️ ตั้งค่าพิกัดข้ามจอ
    // ==========================================
    const CONFIG = {
        secondScreenOffsetX: 3540, 
        targetWidth: 1080,         
        targetHeight: 1920,        
        defaultVolume: 0.15        
    };

    function getActiveVideo() {
        const videos = [...document.querySelectorAll("video")];
        const viewportHeight = window.innerHeight;
        const centerY = viewportHeight / 2;
        
        let best = null;
        let bestDistance = Infinity;
        const focusZoneThreshold = viewportHeight * 0.4; 

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

    function scrollToNextVideo() {
        if (!isEnabled || !isAutoScrollEnabled) return;
        
        const videos = [...document.querySelectorAll("video")];
        const currentIdx = videos.indexOf(currentVideo);

        if (currentIdx !== -1 && currentIdx + 1 < videos.length) {
            const nextVideo = videos[currentIdx + 1];
            nextVideo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
            
            const nextBtnSvg = document.querySelector('svg[aria-label="Next"], svg[aria-label="ถัดไป"]');
            if (nextBtnSvg) {
                const btn = nextBtnSvg.closest('button') || nextBtnSvg.closest('a');
                if (btn) btn.click();
            }
        }
    }

    // 🎯 NEW: ฟังก์ชันเล่นวิดีโอแบบป้องกัน Chrome สั่ง Pause
    function safePlay(vid) {
        if (!vid) return;
        vid.muted = false;
        vid.volume = CONFIG.defaultVolume;
        let p = vid.play();
        if (p !== undefined) {
            p.catch(() => {
                // ถ้า Chrome บล็อกเสียง ให้ยอมปิดเสียง แล้วบังคับเล่นภาพต่อ (Auto-next จะได้ไม่พัง)
                vid.muted = true;
                vid.play().catch(()=>{});
            });
        }
    }

    async function openOrUpdatePopup(newVideo) {
        if (!isEnabled || !newVideo || newVideo === currentVideo) return;

        try {
            if (popupWindow && !popupWindow.closed) {
                restoreVideoToPage(); 

                currentVideo = newVideo;
                originalParent = newVideo.parentElement;
                originalSibling = newVideo.nextSibling;

                placeholder = document.createElement("div");
                Object.assign(placeholder.style, {
                    width: "100%", height: "100%", backgroundColor: "black",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#888", fontSize: "14px", fontFamily: "-apple-system, sans-serif"
                });
                placeholder.innerText = "Playing in Popup ";

                originalParent.insertBefore(placeholder, newVideo);

                setupVideoStyle(newVideo);
                popupWindow.document.body.appendChild(newVideo);
                
                safePlay(newVideo); // ใช้ท่าเล่นแบบปลอดภัย
                return;
            }

            currentVideo = newVideo;
            originalParent = newVideo.parentElement;
            originalSibling = newVideo.nextSibling;

            placeholder = document.createElement("div");
            Object.assign(placeholder.style, {
                width: "100%", height: "100%", backgroundColor: "black",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc",
                fontFamily: "-apple-system, sans-serif"
            });
            placeholder.innerText = "Popup Mode Active ";
            originalParent.insertBefore(placeholder, newVideo);

            const features = `width=${CONFIG.targetWidth},height=${CONFIG.targetHeight},left=${CONFIG.secondScreenOffsetX},top=0,menubar=no,toolbar=no,location=no,status=no`;
            popupWindow = window.open("", "IG_Popup_Video", features);

            if (!popupWindow) {
                alert("⚠️ เบราว์เซอร์บล็อก Popup! กรุณากดปุ่ม 'อนุญาตป๊อปอัป (Allow pop-ups)' ที่ช่อง URL มุมขวาบนครับ");
                restoreVideoToPage();
                return;
            }

            setTimeout(() => {
                if (popupWindow && !popupWindow.closed) {
                    popupWindow.moveTo(CONFIG.secondScreenOffsetX, 0);
                    popupWindow.resizeTo(CONFIG.targetWidth, CONFIG.targetHeight);
                }
            }, 300);

            popupWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>IG Video - Popup</title>
                    <style>
                        body { margin: 0; background: black; display: flex; justify-content: center; align-items: center; width: 100vw; height: 100vh; overflow: hidden; }
                        video { width: 100%; height: 100%; object-fit: contain; outline: none; }
                        #fsBtn { 
                            position: absolute; top: 20px; right: 20px; z-index: 9999; 
                            padding: 10px 16px; background: rgba(28, 28, 30, 0.7); color: white; 
                            border: 1px solid rgba(255,255,255,0.1); border-radius: 999px; cursor: pointer; 
                            font-size: 14px; font-weight: 500; font-family: -apple-system, sans-serif;
                            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
                            box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
                        }
                        #fsBtn:hover { background: rgba(44, 44, 46, 0.9); transform: scale(1.05); }
                    </style>
                </head>
                <body>
                    <button id="fsBtn">⛶ Fullscreen</button>
                </body>
                </html>
            `);
            popupWindow.document.close();

            setupVideoStyle(newVideo);
            popupWindow.document.body.appendChild(newVideo);

            const fsBtn = popupWindow.document.getElementById('fsBtn');
            fsBtn.addEventListener('click', () => {
                popupWindow.document.documentElement.requestFullscreen().then(() => {
                    fsBtn.style.display = 'none'; 
                }).catch(err => console.warn("Fullscreen failed:", err));
            });

            popupWindow.document.addEventListener('fullscreenchange', () => {
                if (!popupWindow.document.fullscreenElement) {
                    fsBtn.style.display = 'block';
                }
            });

            popupWindow.addEventListener("beforeunload", () => {
                restoreVideoToPage();
                popupWindow = null;
            });

            safePlay(newVideo); // ใช้ท่าเล่นแบบปลอดภัย

        } catch (err) {
            console.error("Popup Error:", err);
            restoreVideoToPage();
        }
    }

    function checkAndSwitchVideo() {
        if (!isEnabled || !popupWindow || popupWindow.closed) return;
        const newActive = getActiveVideo();
        if (newActive && newActive !== currentVideo) {
            openOrUpdatePopup(newActive);
        }
    }

    function addPiPButton() {
        if (!isEnabled) return;
        
        const videos = document.querySelectorAll("video");
        videos.forEach(video => {
            if (video.dataset.pipReady) return;
            video.dataset.pipReady = "true";

            const parent = video.parentElement;
            
            const btn = document.createElement("button");
            btn.className = "my-pip-btn";
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:-1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg> <span style="margin-left: 6px;">Pop Out</span>`;
            
            Object.assign(btn.style, {
                position: "absolute", top: "14px", right: "14px", zIndex: "9999",
                padding: "8px 14px", background: "rgba(28, 28, 30, 0.55)", color: "#FFFFFF",
                border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "999px", cursor: "pointer",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                fontSize: "13px", fontWeight: "600", display: "flex", alignItems: "center",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                transition: "all 0.25s cubic-bezier(0.25, 1, 0.5, 1)"
            });

            btn.onmouseenter = () => {
                btn.style.transform = "scale(1.05)";
                btn.style.background = "rgba(44, 44, 46, 0.85)";
            };
            btn.onmouseleave = () => {
                btn.style.transform = "scale(1)";
                btn.style.background = "rgba(28, 28, 30, 0.55)";
            };

            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                openOrUpdatePopup(video);
            };

            if (window.getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative';
            }
            parent.appendChild(btn);

            let lastTime = 0;
            let hasScrolled = false; 

            video.addEventListener('timeupdate', () => {
                if (!isEnabled) return;
                if (popupWindow && currentVideo === video && !popupWindow.closed) {
                    
                    const duration = video.duration || 0;
                    const currentTime = video.currentTime;
                    
                    const isLooping = currentTime < lastTime - 1.0;
                    const isNearEnd = duration > 0 && (currentTime >= duration - 0.5);

                    if ((isLooping || isNearEnd) && !hasScrolled) {
                        hasScrolled = true;
                        
                        if (isAutoScrollEnabled) {
                            scrollToNextVideo(); 
                        }
                        
                        setTimeout(() => {
                            hasScrolled = false;
                        }, 3000);
                    } else {
                        // 🎯 ป้องกันการโดน Pause จาก Chrome
                        if (video.muted || video.volume === 0) {
                            safePlay(video);
                        }
                    }
                    lastTime = currentTime;
                }
            });

            video.addEventListener('playing', () => {
                if (!isEnabled) return;
                if (popupWindow && currentVideo === video && !popupWindow.closed) {
                    if (video.muted) safePlay(video);
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
            if (isEnabled) addPiPButton();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        window.addEventListener("scroll", () => {
            if (!isEnabled || !popupWindow || popupWindow.closed) return;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(checkAndSwitchVideo, 400); 
        });
    }

    setInterval(() => {
        if(isEnabled) addPiPButton();
    }, 1500);
    observeForVideoChange();
})();