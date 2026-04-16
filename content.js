(function () {
    let popupWindow = null, currentVideo = null;
    let originalParent = null, originalSibling = null, placeholder = null;

    const ICONS = {
        play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
        pause: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
        rewind: '<svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>',
        forward: '<svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>',
        fullscreen: '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
        volumeOn: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
        volumeOff: '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'
    };

    function injectStyles() {
        if (document.getElementById('ig-pip-style')) return;
        const style = document.createElement('style');
        style.id = 'ig-pip-style';
        style.textContent = `
            .apple-pip-btn { position: absolute; top: 16px; right: 16px; z-index: 9999; padding: 6px 14px; background: rgba(28,28,30,0.65); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color: #fff; border: 0.5px solid rgba(255,255,255,0.2); border-radius: 999px; cursor: pointer; font: 500 13px -apple-system, sans-serif; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: all 0.2s; }
            .apple-pip-btn:hover { background: rgba(44,44,46,0.85); transform: scale(1.05); }
            .apple-pip-btn:active { transform: scale(0.95); }
            .apple-pip-btn svg { width: 14px; height: 14px; }
        `;
        document.head.appendChild(style);
    }
    injectStyles();

    function restoreVideo() {
        if (currentVideo && originalParent && placeholder) {
            currentVideo.style.cssText = "";
            currentVideo.controls = false;
            currentVideo.muted = true;

            currentVideo.onclick = null;
            currentVideo.ondblclick = null;
            currentVideo.onplay = null;
            currentVideo.onpause = null;
            currentVideo.onvolumechange = null;
            currentVideo.ontimeupdate = null;

            placeholder.parentNode ? placeholder.parentNode.replaceChild(currentVideo, placeholder) : originalParent.insertBefore(currentVideo, originalSibling);
            currentVideo.play().catch(() => { });
        }
        currentVideo = originalParent = originalSibling = placeholder = null;
    }

    function setupCustomPlayer(video, doc) {
        const container = doc.getElementById('video-container');
        container.innerHTML = '';
        container.appendChild(video);
        video.controls = false;

        const playBtn = doc.getElementById('play-btn');
        const muteBtn = doc.getElementById('mute-btn');
        const fsBtn = doc.getElementById('fs-btn');
        const progressBar = doc.getElementById('progress-bar');
        const progressArea = doc.getElementById('progress-area');
        const hoverTime = doc.getElementById('hover-time');
        const hoverBar = doc.getElementById('hover-bar'); // ตัวจับแถบสีเทา
        const centerIcon = doc.getElementById('center-icon');
        const volumeSlider = doc.getElementById('volume-slider');
        const timeDisplay = doc.getElementById('time-display');

        const formatTime = (time) => {
            if (isNaN(time)) return "0:00";
            let min = Math.floor(time / 60);
            let sec = Math.floor(time % 60);
            return `${min}:${sec < 10 ? '0' : ''}${sec}`;
        };

        const showAnim = (iconKey) => {
            centerIcon.innerHTML = ICONS[iconKey];
            centerIcon.classList.remove('animate');
            void centerIcon.offsetWidth;
            centerIcon.classList.add('animate');
            setTimeout(() => centerIcon.classList.remove('animate'), 400);
        };

        const togglePlay = () => {
            if (video.paused) {
                video.__isExtensionPausing = false; // เราสั่งเล่น
                video.play(); showAnim('play');
            } else {
                video.__isExtensionPausing = true;  // เราสั่งหยุด
                video.pause(); showAnim('pause');
            }
        };

        const toggleFullscreen = () => {
            if (doc.fullscreenElement) doc.exitFullscreen();
            else doc.documentElement.requestFullscreen();
        };

        const updatePlayIcon = () => playBtn.innerHTML = video.paused ? ICONS.play : ICONS.pause;
        const updateMuteIcon = () => {
            muteBtn.innerHTML = video.muted || video.volume === 0 ? ICONS.volumeOff : ICONS.volumeOn;
            volumeSlider.value = video.muted ? 0 : video.volume;
        };

        updatePlayIcon();
        updateMuteIcon();
        fsBtn.innerHTML = ICONS.fullscreen;

        video.onplay = updatePlayIcon;
        video.onpause = () => {
            if (!video.__isExtensionPausing && popupWindow && !popupWindow.closed) {
                // ใส่ setTimeout หน่วงเวลา 50ms ป้องกันลูปคำสั่งชนกันรัวๆ
                setTimeout(() => {
                    if (popupWindow && !popupWindow.closed && video.paused) {
                        video.play().catch(()=>{});
                    }
                }, 50);
            } else {
                updatePlayIcon();
            }
        };
        video.onvolumechange = updateMuteIcon;

        video.ontimeupdate = () => {
            if (video.duration) {
                progressBar.style.width = (video.currentTime / video.duration) * 100 + '%';
                timeDisplay.innerText = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
            }
        };

        let clickTimer = null;
        video.onclick = () => {
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            } else {
                clickTimer = setTimeout(() => {
                    togglePlay();
                    clickTimer = null;
                }, 250);
            }
        };

        video.ondblclick = (e) => {
            e.preventDefault();
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            toggleFullscreen();
        };

        // --- ลอจิกการลาก แถบสีเทา และ ป้ายบอกเวลา ---
        let isDragging = false;
        let wasPlaying = false;

        const updateTimeFromMouse = (e) => {
            const rect = progressArea.getBoundingClientRect();
            let pos = (e.clientX - rect.left) / rect.width;
            pos = Math.max(0, Math.min(1, pos));
            video.currentTime = pos * video.duration;

            progressBar.style.width = (pos * 100) + '%';
            timeDisplay.innerText = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
        };

        progressArea.onmousedown = (e) => {
            isDragging = true;
            wasPlaying = !video.paused;
            video.__isExtensionPausing = true; // <--- เพิ่มบรรทัดนี้
            video.pause();
            updateTimeFromMouse(e);
        };

        // อัปเดตแถบสีเทาและเวลาเมื่อเอาเมาส์มาวาง
        progressArea.onmousemove = (e) => {
            const rect = progressArea.getBoundingClientRect();
            let pos = (e.clientX - rect.left) / rect.width;
            pos = Math.max(0, Math.min(1, pos));

            // ทำให้แถบสีเทาวิ่งตามเมาส์
            hoverBar.style.width = (pos * 100) + '%';
            hoverTime.innerText = formatTime(pos * video.duration);
            hoverTime.style.left = (pos * 100) + '%';
        };

        doc.onmousemove = (e) => {
            if (isDragging) {
                updateTimeFromMouse(e);

                // ให้แถบสีเทาและป้ายเวลาวิ่งตามแม้จะลากเมาส์ออกนอกเส้น
                const rect = progressArea.getBoundingClientRect();
                let pos = (e.clientX - rect.left) / rect.width;
                pos = Math.max(0, Math.min(1, pos));

                hoverBar.style.width = (pos * 100) + '%';
                hoverTime.innerText = formatTime(pos * video.duration);
                hoverTime.style.left = (pos * 100) + '%';
            }
        };

        doc.onmouseup = () => {
            if (isDragging) {
                isDragging = false;
                if (wasPlaying) {
                    video.__isExtensionPausing = false; // <--- เพิ่มบรรทัดนี้
                    video.play();
                }
            }
        };

        playBtn.onclick = togglePlay;
        muteBtn.onclick = () => { video.muted = !video.muted; };
        fsBtn.onclick = toggleFullscreen;

        volumeSlider.oninput = (e) => {
            video.volume = e.target.value;
            video.muted = (video.volume === 0);
        };

        doc.onkeydown = (e) => {
            if (e.code === 'Space' || e.code === 'KeyK') { e.preventDefault(); togglePlay(); }
            if (e.code === 'KeyF') { e.preventDefault(); toggleFullscreen(); }
            if (e.code === 'KeyM') { e.preventDefault(); video.muted = !video.muted; }
            if (e.code === 'ArrowRight' || e.code === 'KeyL') { e.preventDefault(); video.currentTime += 5; showAnim('forward'); }
            if (e.code === 'ArrowLeft' || e.code === 'KeyJ') { e.preventDefault(); video.currentTime -= 5; showAnim('rewind'); }
            if (e.code === 'ArrowUp') { e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); }
            if (e.code === 'ArrowDown') { e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); }
        };
    }

    async function launchPopup(newVideo) {
        if (!newVideo || newVideo === currentVideo) return;
        if (popupWindow && !popupWindow.closed) restoreVideo();

        currentVideo = newVideo;
        originalParent = newVideo.parentElement;
        originalSibling = newVideo.nextSibling;

        placeholder = document.createElement("div");
        placeholder.style.cssText = "width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;color:#888;font-size:14px;";
        placeholder.innerText = "Playing in PiP ";
        originalParent.insertBefore(placeholder, newVideo);

        newVideo.style.cssText = "width:100%;height:100%;object-fit:contain;background:#000;";
        newVideo.muted = false;
        newVideo.volume = 0.2;

        if (!popupWindow || popupWindow.closed) {
            popupWindow = window.open("", "IG_Popup_Video", "popup=yes,width=450,height=800,menubar=no,toolbar=no,location=no,status=no,titlebar=no");
            if (!popupWindow) return restoreVideo();

            popupWindow.document.write(`
                <!DOCTYPE html><html><head><title>IG - Custom Player</title><style>
                body { margin:0; background:#000; display:flex; justify-content:center; align-items:center; height:100vh; overflow:hidden; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; user-select:none; cursor: default; }
                body.hide-cursor { cursor: none; }
                #video-container { position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; display:flex; }
                
                #center-icon { position:absolute; top:50%; left:50%; transform:translate(-50%, -50%) scale(1.5); background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); border-radius:50%; padding:20px; color:white; display:flex; justify-content:center; align-items:center; opacity:0; pointer-events:none; transition:opacity 0.2s, transform 0.2s; z-index:3; }
                #center-icon.animate { opacity:1; transform:translate(-50%, -50%) scale(1); }
                #center-icon svg { width:44px; height:44px; fill:white; }
                
                #controls-wrapper { position:absolute; bottom:0; left:0; width:100%; padding:0 12px 12px; background:linear-gradient(transparent, rgba(0,0,0,0.9) 85%); box-sizing:border-box; z-index:4; opacity:0; transition:opacity 0.25s ease; }
                body:hover #controls-wrapper { opacity:1; }
                
                /* แถบพื้นที่ของ Time-line */
                .progress-area { width:100%; height:4px; background:rgba(255,255,255,0.2); cursor:pointer; margin-bottom:12px; position:relative; transition:height 0.1s ease; }
                .progress-area:hover { height:6px; }
                
                /* แถบสีเทา (Hover Preview) */
                .hover-bar { position:absolute; top:0; left:0; height:100%; background:rgba(255,255,255,0.4); width:0%; pointer-events:none; z-index:1; opacity:0; transition:opacity 0.1s ease; }
                .progress-area:hover .hover-bar { opacity:1; }
                
                /* แถบสีแดง (เล่นจริง) */
                .progress-bar { position:absolute; top:0; left:0; height:100%; background:#f00; width:0%; pointer-events:none; z-index:2; }
                
                /* จุดสีแดง (เปลี่ยนให้โชว์ตลอดเวลาเป็น scale(1) และขยายขึ้นเมื่อ hover) */
                .progress-bar::after { content:''; position:absolute; right:-6.5px; top:50%; transform:translateY(-50%) scale(1); width:13px; height:13px; background:#f00; border-radius:50%; transition:transform 0.1s ease; z-index:3; }
                .progress-area:hover .progress-bar::after { transform:translateY(-50%) scale(1.2); }
                
                #hover-time { position:absolute; bottom:14px; left:0; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#fff; padding:4px 8px; font-size:12px; font-weight:500; border-radius:4px; pointer-events:none; opacity:0; transition:opacity 0.1s ease; white-space:nowrap; z-index:4; }
                .progress-area:hover #hover-time { opacity:1; }
                
                .buttons { display:flex; align-items:center; gap:16px; margin-top:4px; }
                .btn { background:none; border:none; color:white; cursor:pointer; padding:0; display:flex; align-items:center; opacity:0.85; transition:opacity 0.2s; }
                .btn:hover { opacity:1; }
                .btn svg { width:26px; height:26px; fill:currentColor; }
                
                .volume-container { display:flex; align-items:center; gap:4px; }
                .volume-slider { width:0; opacity:0; transition:width 0.25s ease, opacity 0.25s ease; }
                .volume-container:hover .volume-slider { width:65px; opacity:1; margin-left:8px; }
                input[type=range] { -webkit-appearance:none; background:transparent; cursor:pointer; }
                input[type=range]::-webkit-slider-runnable-track { width:100%; height:3px; background:rgba(255,255,255,0.3); border-radius:2px; }
                input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; height:12px; width:12px; border-radius:50%; background:#fff; margin-top:-4.5px; box-shadow: 0 0 2px rgba(0,0,0,0.5); }
                
                .time-display { color:#fff; font-size:13px; font-weight:400; font-variant-numeric:tabular-nums; margin-left:8px; }
                .spacer { flex-grow:1; }
                </style></head><body>
                
                <div id="video-container"></div><div id="center-icon"></div>
                <div id="controls-wrapper">
                    <div class="progress-area" id="progress-area">
                        <div class="hover-bar" id="hover-bar"></div>
                        <div class="progress-bar" id="progress-bar"></div>
                        <div id="hover-time">0:00</div>
                    </div>
                    <div class="buttons">
                        <button class="btn" id="play-btn"></button>
                        <div class="volume-container">
                            <button class="btn" id="mute-btn"></button>
                            <input type="range" class="volume-slider" id="volume-slider" min="0" max="1" step="0.05">
                        </div>
                        <div class="time-display" id="time-display">0:00 / 0:00</div>
                        <div class="spacer"></div>
                        <button class="btn" id="fs-btn"></button>
                    </div>
                </div>
                </body></html>
            `);
            popupWindow.document.close();

            let mouseTimer;
            popupWindow.document.body.onmousemove = () => {
                if (!popupWindow || popupWindow.closed) return;

                popupWindow.document.body.classList.remove('hide-cursor');
                clearTimeout(mouseTimer);
                mouseTimer = setTimeout(() => {
                    if (popupWindow && !popupWindow.closed && popupWindow.document.fullscreenElement) {
                        popupWindow.document.body.classList.add('hide-cursor');
                    }
                }, 2000);
            };

            popupWindow.onbeforeunload = () => { restoreVideo(); popupWindow = null; };
        }

        // 1. จำเวลาเดิมก่อนถูกย้ายหน้าต่าง
        const savedTime = newVideo.currentTime;

        setupCustomPlayer(newVideo, popupWindow.document);

        // 1. กระตุ้นเฟรมภาพ (Repaint) เพื่อแก้บัคจอดำค้าง
        newVideo.style.display = 'none';
        void newVideo.offsetHeight;
        newVideo.style.display = 'block';

        // 2. หลอกระบบป้องกันเสียงของเบราว์เซอร์
        newVideo.__isExtensionPausing = false;
        newVideo.muted = true; // ปิดเสียงไปก่อน เบราว์เซอร์จะได้ยอมให้เล่นภาพ

        newVideo.play().then(() => {
            // พอภาพขยับแล้ว ค่อยแอบเปิดเสียงขึ้นมา 20%
            newVideo.muted = false;
            newVideo.volume = 0.2;
        }).catch(() => { });
    }

    function initVideo(video) {
        if (video.dataset.pipReady) return;
        video.dataset.pipReady = "true";

        const btn = document.createElement("button");
        btn.className = "apple-pip-btn";
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="12" y="12" width="7" height="7" rx="1" ry="1"></rect></svg> PiP`;

        btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); launchPopup(video); };

        const parent = video.parentElement;
        if (window.getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
        parent.appendChild(btn);

        video.addEventListener('playing', () => {
            if (popupWindow && currentVideo === video && !popupWindow.closed) {
                video.muted = false;
            } else if (popupWindow && !popupWindow.closed && currentVideo !== video) {
                setTimeout(() => {
                    const r = video.getBoundingClientRect();
                    if (!video.paused && r.top < window.innerHeight && r.bottom > 0 && r.height > 100) launchPopup(video);
                }, 300);
            }
        });
    }

    const observer = new MutationObserver(() => document.querySelectorAll("video").forEach(initVideo));
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(() => document.querySelectorAll("video").forEach(initVideo), 1500);

    function getActiveVideo() {
        const centerY = window.innerHeight / 2;
        return [...document.querySelectorAll("video")].reduce((best, v) => {
            const rect = v.getBoundingClientRect();
            if (rect.height > 100 && v !== currentVideo && rect.top < window.innerHeight && rect.bottom > 0) {
                const dist = Math.abs((rect.top + rect.height / 2) - centerY);
                if (dist < (best.dist || window.innerHeight * 0.3)) return { v, dist };
            }
            return best;
        }, {}).v || null;
    }

    let scrollTimeout;
    window.addEventListener("scroll", () => {
        if (!popupWindow || popupWindow.closed) return;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const nextVideo = getActiveVideo();
            if (nextVideo && nextVideo !== currentVideo) launchPopup(nextVideo);
        }, 400);
    });

    window.addEventListener('unload', () => {
        if (popupWindow && !popupWindow.closed) {
            popupWindow.close();
        }
    });

})();