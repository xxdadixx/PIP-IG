(function () {
    let currentVideo = null;
    let videoList = [];   // เก็บ video ทั้งหมด
    let currentIndex = 0; // index video ปัจจุบันใน list


    function getActiveVideo() {
        // หา video ที่กำลัง visible อยู่กลางหน้าจอ
        const videos = [...document.querySelectorAll("video")];

        let centerY = window.innerHeight / 2;

        let best = null;
        let bestDistance = Infinity;

        videos.forEach(v => {
            const rect = v.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            const dist = Math.abs(mid - centerY);

            if (dist < bestDistance && rect.height > 100) {
                best = v;
                bestDistance = dist;
            }
        });

        return best;
    }

    async function openPiP(video) {
        if (!video) return;

        try {
            // ถ้า video ยังไม่พร้อมให้รอ
            if (video.readyState < 2) {
                await new Promise(r => video.addEventListener("loadeddata", r, { once: true }));
            }

            // บังคับให้เล่นก่อน
            await video.play().catch(() => { });

            // ถ้า video นี้เป็นตัวเดิมที่อยู่ใน PiP ไม่ต้องสั่งซ้ำ
            if (document.pictureInPictureElement === video) return;

            // ขอ PiP
            await video.requestPictureInPicture();
        } catch (err) {
            console.warn("PiP Error:", err.message || err);
        }
    }

    function addPiPButton() {
        const videos = document.querySelectorAll("video");

        videos.forEach(video => {
            if (video.dataset.hasPiP) return;

            const btn = document.createElement("button");
            btn.innerText = "PiP ▶";
            btn.style.position = "absolute";
            btn.style.top = "20px";
            btn.style.right = "20px";
            btn.style.zIndex = "99999";
            btn.style.padding = "6px 10px";
            btn.style.background = "rgba(0,0,0,0.6)";
            btn.style.color = "white";
            btn.style.border = "none";
            btn.style.borderRadius = "6px";
            btn.style.cursor = "pointer";

            btn.onclick = () => {
                currentVideo = getActiveVideo();
                openPiP(currentVideo);
            };

            const parent = video.parentElement;
            parent.style.position = "relative";
            parent.appendChild(btn);

            video.dataset.hasPiP = "true";
        });
    }

    function observeForVideoChange() {
        const observer = new MutationObserver(() => {
            // ถ้าไม่ได้อยู่ใน PiP ไม่ต้องทำงาน
            if (!document.pictureInPictureElement) return;

            // หา video ตัวที่กำลัง visible ตอนนี้
            const newVideo = getActiveVideo();

            // ถ้าคือ video ใหม่ → เปลี่ยนไปเล่น video ตัวใหม่ใน PiP
            if (newVideo && newVideo !== currentVideo) {
                currentVideo = newVideo;
                openPiP(newVideo);  // เรียกฟังก์ชัน openPiP เวอร์ชันแก้ error
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        videoList = Array.from(document.querySelectorAll("video"));
        currentIndex = videoList.indexOf(currentVideo);

    }

    function switchPipTo(index) {
        if (index < 0 || index >= videoList.length) return;
        currentIndex = index;
        currentVideo = videoList[currentIndex];
        openPiP(currentVideo);
    }



    // ติดปุ่มตลอดเวลา (เพราะ IG เป็น SPA)
    setInterval(addPiPButton, 1000);

    // คอย detect วิดีโอใหม่ขณะเลื่อน feed
    observeForVideoChange();
})();
