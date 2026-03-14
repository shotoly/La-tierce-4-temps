document.addEventListener('DOMContentLoaded', function () {
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
  const playPreviousTrackButton = document.getElementById("play-previous");
  const playNextTrackButton = document.getElementById("play-next");
  
  if (!playerTrack) return; // Prevent errors on other pages

  // Simplified array for just the 1 requested file
  const albums = ["Margault"];
  const trackNames = ["Présentation (Audio)"];
  const albumArtworks = ["_1"];
  const trackUrl = ["Présentationtaqt.mp3"];

  let i = playPauseButton.querySelector("i"),
    seekT, seekLoc, seekBarPos, cM, ctMinutes, ctSeconds, curMinutes, curSeconds, durMinutes, durSeconds, playProgress, bTime, nTime = 0, buffInterval = null, tFlag = false, currIndex = -1;

  let audio = new Audio();

  function playPause() {
    setTimeout(function () {
      if (audio.paused) {
        playerTrack.classList.add("active");
        albumArt.classList.add("active");
        checkBuffering();
        i.className = "fas fa-pause";
        audio.play();
      } else {
        playerTrack.classList.remove("active");
        albumArt.classList.remove("active");
        clearInterval(buffInterval);
        albumArt.classList.remove("buffering");
        i.className = "fas fa-play";
        audio.pause();
      }
    }, 150);
  }

  function showHover(event) {
    seekBarPos = sArea.getBoundingClientRect();
    seekT = event.clientX - seekBarPos.left;
    seekLoc = audio.duration * (seekT / sArea.offsetWidth);

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
    audio.currentTime = seekLoc;
    seekBar.style.width = seekT + "px";
    hideHover();
  }

  function updateCurrTime() {
    nTime = new Date().getTime();

    if (!tFlag) {
      tFlag = true;
      trackTime.classList.add("active");
    }

    curMinutes = Math.floor(audio.currentTime / 60);
    curSeconds = Math.floor(audio.currentTime - curMinutes * 60);

    durMinutes = Math.floor(audio.duration / 60);
    durSeconds = Math.floor(audio.duration - durMinutes * 60);

    playProgress = (audio.currentTime / audio.duration) * 100;

    if (curMinutes < 10) curMinutes = "0" + curMinutes;
    if (curSeconds < 10) curSeconds = "0" + curSeconds;

    if (durMinutes < 10) durMinutes = "0" + durMinutes;
    if (durSeconds < 10) durSeconds = "0" + durSeconds;

    if (isNaN(curMinutes) || isNaN(curSeconds)) {
        tProgress.textContent = "00:00";
    } else {
        tProgress.textContent = curMinutes + ":" + curSeconds;
    }

    if (isNaN(durMinutes) || isNaN(durSeconds)) {
        tTime.textContent = "00:00";
    } else {
        tTime.textContent = durMinutes + ":" + durSeconds;
    }

    if (isNaN(curMinutes) || isNaN(curSeconds) || isNaN(durMinutes) || isNaN(durSeconds)) {
      trackTime.classList.remove("active");
    } else {
      trackTime.classList.add("active");
    }

    seekBar.style.width = playProgress + "%";

    if (playProgress == 100) {
      i.className = "fas fa-play";
      seekBar.style.width = "0px";
      tProgress.textContent = "00:00";
      albumArt.classList.remove("buffering", "active");
      clearInterval(buffInterval);
      audio.pause();
    }
  }

  function checkBuffering() {
    clearInterval(buffInterval);
    buffInterval = setInterval(function () {
      if (nTime == 0 || bTime - nTime > 1000) {
        albumArt.classList.add("buffering");
      } else {
        albumArt.classList.remove("buffering");
      }
      bTime = new Date().getTime();
    }, 100);
  }

  function selectTrack(flag) {
    if (flag == 0 || flag == 1) ++currIndex;
    else --currIndex;

    // Loop through tracks
    if (currIndex >= trackUrl.length) currIndex = 0;
    if (currIndex < 0) currIndex = trackUrl.length - 1;

    if (currIndex > -1 && currIndex < trackUrl.length) {
      if (flag == 0) {
          i.className = "fas fa-play";
      } else {
        albumArt.classList.remove("buffering");
        i.className = "fas fa-pause";
      }

      seekBar.style.width = "0px";
      trackTime.classList.remove("active");
      tProgress.textContent = "00:00";
      tTime.textContent = "00:00";

      let currAlbum = albums[currIndex];
      let currTrackName = trackNames[currIndex];
      let currArtwork = albumArtworks[currIndex];

      audio.src = trackUrl[currIndex];

      nTime = 0;
      bTime = new Date().getTime();

      if (flag != 0) {
        audio.play();
        playerTrack.classList.add("active");
        albumArt.classList.add("active");

        clearInterval(buffInterval);
        checkBuffering();
      }

      albumName.textContent = currAlbum;
      trackName.textContent = currTrackName;
      
      const activeImg = albumArt.querySelector("img.active");
      if (activeImg) activeImg.classList.remove("active");
      const nextImg = document.getElementById(currArtwork);
      if (nextImg) nextImg.classList.add("active");
    }
  }

  function initPlayer() {
    selectTrack(0);

    audio.loop = false;

    playPauseButton.addEventListener("click", playPause);

    sArea.addEventListener("mousemove", function (event) {
      showHover(event);
    });

    sArea.addEventListener("mouseout", hideHover);
    sArea.addEventListener("click", playFromClickedPos);

    audio.addEventListener("timeupdate", updateCurrTime);

    playPreviousTrackButton.addEventListener("click", function () {
      selectTrack(-1);
    });
    playNextTrackButton.addEventListener("click", function () {
      selectTrack(1);
    });
  }

  initPlayer();
});
