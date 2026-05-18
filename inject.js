// inject.js
// Listens for volume updates from the Isolated World and applies them natively
// using an iframe bridge to bypass aggressive proxies (like BVI).
document.addEventListener('BVI_PiP_SyncVolume', function() {
    // 1. Create a pristine environment to extract native browser setters
    let iframe = document.getElementById('ig-pip-pristine-bridge');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'ig-pip-pristine-bridge';
        iframe.style.display = 'none';
        document.documentElement.appendChild(iframe);
    }

    // 2. Extract the un-tampered native setters directly from the browser engine
    const nativeVolumeSet = Object.getOwnPropertyDescriptor(iframe.contentWindow.HTMLMediaElement.prototype, 'volume').set;
    const nativeMutedSet = Object.getOwnPropertyDescriptor(iframe.contentWindow.HTMLMediaElement.prototype, 'muted').set;

    // 3. Apply changes directly, bypassing any BVI interception
    document.querySelectorAll('video[data-pip-sync="true"]').forEach(v => {
        const targetMuted = v.dataset.pipMuted === 'true';
        const targetVolume = parseFloat(v.dataset.pipVolume);

        try {
            nativeMutedSet.call(v, targetMuted);
            nativeVolumeSet.call(v, targetVolume);
        } catch (e) {
            console.error("PiP Audio Sync Error:", e);
        }

        delete v.dataset.pipSync; // Clear processing flag
    });
});