let ytPlayer;
let ytReady = false;

// Load YouTube IFrame API
function loadYouTubeAPI() {
    return new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
            resolve();
            return;
        }
        
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = function() {
            ytReady = true;
            resolve();
        };
    });
}

function extractYouTubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

window.initVinylPlayer = function(config) {
    const playerTrack = document.getElementById("player-track");
    const albumName = document.getElementById("album-name");
    const trackName = document.getElementById("track-name");
    const albumArt = document.getElementById("album-art");
    const sArea = document.getElementById("seek-bar-container");
    const seekBar = document.getElementById("seek-bar");
    const trackTime = document.getElementById("track-time");
    const seekTime = document.getElementById("seek-time");
    const sHover = document.getElementById("s-hover");
    const playPauseButton = document.getElementById("play-pause-button");
    const tProgress = document.getElementById("current-time");
    const tTime = document.getElementById("track-length");
    
    // Remove next/prev buttons from listeners or just don't crash if they exist
    const playPreviousTrackButton = document.getElementById("play-previous");
    const playNextTrackButton = document.getElementById("play-next");
    
    if (!playerTrack) return;

    // Reset UI
    albumName.textContent = config.album || "Margault";
    trackName.textContent = config.title || "Audio";
    
    // Set cover art
    if (config.coverUrl) {
        let activeImg = albumArt.querySelector("img.active");
        if (activeImg) {
            activeImg.src = config.coverUrl;
        } else {
            activeImg = document.createElement("img");
            activeImg.className = "active";
            albumArt.insertBefore(activeImg, document.getElementById("buffer-box"));
            activeImg.src = config.coverUrl;
        }
    }

    let i = playPauseButton.querySelector("i");
    let isPlaying = false;
    let seekT, seekLoc, seekBarPos, cM, ctMinutes, ctSeconds, curMinutes, curSeconds, durMinutes, durSeconds, playProgress, buffInterval = null;
    let duration = 0;
    let currentTime = 0;
    let mode = 'native'; // 'native' or 'youtube'
    let audio = new Audio();
    
    const ytId = extractYouTubeId(config.audioUrl);
    
    if (ytId) {
        mode = 'youtube';
        // Create hidden div for YouTube
        let ytContainer = document.getElementById('yt-player-container');
        if (!ytContainer) {
            ytContainer = document.createElement('div');
            ytContainer.id = 'yt-player-container';
            ytContainer.style.display = 'none'; // Hidden
            document.body.appendChild(ytContainer);
        }
        
        loadYouTubeAPI().then(() => {
            if (ytPlayer && ytPlayer.destroy) {
                ytPlayer.destroy();
            }
            ytPlayer = new YT.Player('yt-player-container', {
                height: '0',
                width: '0',
                videoId: ytId,
                playerVars: {
                    'playsinline': 1,
                    'controls': 0,
                    'disablekb': 1,
                    'fs': 0,
                    'rel': 0
                },
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange
                }
            });
        });
    } else {
        mode = 'native';
        audio.src = config.audioUrl;
        audio.addEventListener("timeupdate", updateCurrTime);
        audio.addEventListener("loadedmetadata", () => {
            duration = audio.duration;
            updateDurationUI();
        });
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("waiting", showBuffering);
        audio.addEventListener("playing", hideBuffering);
    }

    function onPlayerReady(event) {
        duration = ytPlayer.getDuration();
        updateDurationUI();
        
        // Setup interval for time update since YT doesn't have an event for it
        setInterval(() => {
            if (isPlaying && mode === 'youtube' && ytPlayer && ytPlayer.getCurrentTime) {
                currentTime = ytPlayer.getCurrentTime();
                duration = ytPlayer.getDuration();
                updateCurrTimeUI();
            }
        }, 500);
    }

    function onPlayerStateChange(event) {
        if (event.data == YT.PlayerState.PLAYING) {
            hideBuffering();
        } else if (event.data == YT.PlayerState.BUFFERING) {
            showBuffering();
        } else if (event.data == YT.PlayerState.ENDED) {
            onEnded();
        }
    }

    function showBuffering() {
        albumArt.classList.add("buffering");
    }

    function hideBuffering() {
        albumArt.classList.remove("buffering");
    }

    function playPause() {
        setTimeout(function () {
            if (!isPlaying) {
                isPlaying = true;
                playerTrack.classList.add("active");
                albumArt.classList.add("active");
                i.className = "fas fa-pause";
                
                if (mode === 'native') {
                    audio.play();
                } else if (mode === 'youtube' && ytPlayer && ytPlayer.playVideo) {
                    ytPlayer.playVideo();
                }
            } else {
                isPlaying = false;
                playerTrack.classList.remove("active");
                albumArt.classList.remove("active");
                i.className = "fas fa-play";
                
                if (mode === 'native') {
                    audio.pause();
                } else if (mode === 'youtube' && ytPlayer && ytPlayer.pauseVideo) {
                    ytPlayer.pauseVideo();
                }
            }
        }, 150);
    }

    function showHover(event) {
        seekBarPos = sArea.getBoundingClientRect();
        seekT = event.clientX - seekBarPos.left;
        seekLoc = duration * (seekT / sArea.offsetWidth);

        sHover.style.width = seekT + "px";

        cM = seekLoc / 60;
        ctMinutes = Math.floor(cM);
        ctSeconds = Math.floor(seekLoc - ctMinutes * 60);

        if (ctMinutes < 0 || ctSeconds < 0) return;
        if (ctMinutes < 10) ctMinutes = "0" + ctMinutes;
        if (ctSeconds < 10) ctSeconds = "0" + ctSeconds;

        if (isNaN(ctMinutes) || isNaN(ctSeconds)) {
            seekTime.textContent = "--:--";
        } else {
            seekTime.textContent = ctMinutes + ":" + ctSeconds;
        }

        seekTime.style.left = seekT + "px";
        seekTime.style.marginLeft = "-21px";
        seekTime.style.display = "block";
    }

    function hideHover() {
        sHover.style.width = "0px";
        seekTime.textContent = "00:00";
        seekTime.style.left = "0px";
        seekTime.style.marginLeft = "0px";
        seekTime.style.display = "none";
    }

    function playFromClickedPos() {
        if (!duration) return;
        if (mode === 'native') {
            audio.currentTime = seekLoc;
        } else if (mode === 'youtube' && ytPlayer && ytPlayer.seekTo) {
            ytPlayer.seekTo(seekLoc, true);
        }
        currentTime = seekLoc;
        seekBar.style.width = seekT + "px";
        hideHover();
        updateCurrTimeUI();
    }

    function updateCurrTime() {
        if (mode === 'native') {
            currentTime = audio.currentTime;
            duration = audio.duration;
            updateCurrTimeUI();
        }
    }
    
    function updateDurationUI() {
        durMinutes = Math.floor(duration / 60);
        durSeconds = Math.floor(duration - durMinutes * 60);
        if (durMinutes < 10) durMinutes = "0" + durMinutes;
        if (durSeconds < 10) durSeconds = "0" + durSeconds;
        
        if (isNaN(durMinutes) || isNaN(durSeconds) || !isFinite(durMinutes)) {
            tTime.textContent = "00:00";
        } else {
            tTime.textContent = durMinutes + ":" + durSeconds;
        }
    }

    function updateCurrTimeUI() {
        if (!trackTime.classList.contains("active")) {
            trackTime.classList.add("active");
        }

        curMinutes = Math.floor(currentTime / 60);
        curSeconds = Math.floor(currentTime - curMinutes * 60);
        
        playProgress = (currentTime / duration) * 100;

        if (curMinutes < 10) curMinutes = "0" + curMinutes;
        if (curSeconds < 10) curSeconds = "0" + curSeconds;

        if (isNaN(curMinutes) || isNaN(curSeconds)) {
            tProgress.textContent = "00:00";
        } else {
            tProgress.textContent = curMinutes + ":" + curSeconds;
        }

        seekBar.style.width = playProgress + "%";
    }

    function onEnded() {
        i.className = "fas fa-play";
        isPlaying = false;
        seekBar.style.width = "0px";
        tProgress.textContent = "00:00";
        albumArt.classList.remove("buffering", "active");
        playerTrack.classList.remove("active");
        if (mode === 'native') {
            audio.pause();
            audio.currentTime = 0;
        } else if (mode === 'youtube' && ytPlayer && ytPlayer.stopVideo) {
            ytPlayer.stopVideo();
        }
    }

    // Reset old listeners if any (by replacing elements or just adding new ones safely)
    const newPlayBtn = playPauseButton.cloneNode(true);
    playPauseButton.parentNode.replaceChild(newPlayBtn, playPauseButton);
    newPlayBtn.addEventListener("click", playPause);
    i = newPlayBtn.querySelector("i");
    
    // For simplicity, we just add listeners without cloning for seek area because it's not repeatedly initialized in standard usage 
    // unless we change article. We'll simply let events run or remove them.
    const newSArea = sArea.cloneNode(true);
    sArea.parentNode.replaceChild(newSArea, sArea);
    newSArea.addEventListener("mousemove", showHover);
    newSArea.addEventListener("mouseout", hideHover);
    newSArea.addEventListener("click", playFromClickedPos);

    if (playPreviousTrackButton) {
        const newPrev = playPreviousTrackButton.cloneNode(true);
        playPreviousTrackButton.parentNode.replaceChild(newPrev, playPreviousTrackButton);
        newPrev.addEventListener("click", () => {
             currentTime = 0;
             if(mode === 'native') audio.currentTime = 0;
             else if(mode === 'youtube') ytPlayer.seekTo(0, true);
        });
    }

    if (playNextTrackButton) {
        const newNext = playNextTrackButton.cloneNode(true);
        playNextTrackButton.parentNode.replaceChild(newNext, playNextTrackButton);
        newNext.addEventListener("click", onEnded);
    }
}

// Initialisation globale automatique pour la page d'accueil si le script y est inclus
document.addEventListener('DOMContentLoaded', function () {
    const defaultTrack = document.getElementById("player-track");
    if (defaultTrack && !window.vinylPlayerInitialized) {
        window.vinylPlayerInitialized = true;
        // Vérifie si on est sur index.html (ou la racine absolue)
        if(window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '' || window.location.pathname.endsWith('newon/') || window.location.pathname.endsWith('newon')) {
            // Check if audio exists to configure
            initVinylPlayer({
                title: "Présentation (Audio)",
                album: "Margault",
                coverUrl: "img/vynile.png",
                audioUrl: "Présentationtaqt.mp3"
            });
        }
    }
});
