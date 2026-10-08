
/* ========================================================
   STATE & CONTROLLERS
   ======================================================== */
const scenes = {
    password: document.getElementById('scene-password'),
    countdown: document.getElementById('scene-countdown'),
    gift: document.getElementById('scene-gift'),
    opening: document.getElementById('scene-opening'),
    letter: document.getElementById('scene-letter'),
    memories: document.getElementById('scene-memories')
};
let activeScene = 'password';
let enteredPin = '';
const CORRECT_PIN = '1810';
function switchScene(nextSceneName) {
    if (scenes[activeScene]) {
        scenes[activeScene].classList.remove('active');
    }
    setTimeout(() => {
        activeScene = nextSceneName;
        if (scenes[activeScene]) {
            scenes[activeScene].classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            onSceneEnter(activeScene);
        }
    }, 350);
}
function onSceneEnter(sceneName) {
    if (sceneName === 'countdown') {
        startCountdown();
    } else if (sceneName === 'letter') {
        startTypewriter();
    }
}
/* ========================================================
   MUSIC CONTROLLER & SMOOTH LOOP
   ======================================================== */
let audioCtx = null;
let synthPlaying = false;
let synthInterval = null;
const audioEl = document.getElementById('bgAudio');
const musicBtn = document.getElementById('musicBtn');
const audioSource = audioEl.querySelector('source');
const audioSrc = audioSource ? audioSource.src : audioEl.currentSrc;
const loopAudio = new Audio(audioSrc);
loopAudio.preload = 'auto';
loopAudio.loop = false;
loopAudio.volume = 0;
audioEl.loop = false;
audioEl.volume = 1;
let activeAudio = audioEl;
let inactiveAudio = loopAudio;
let crossfadeRunning = false;
let fadeFrame = null;
const CROSSFADE_DURATION = 1200;
function initAudio() {
    musicBtn.classList.add('active');
    stopRomanticSynth();
    activeAudio.volume = 1;
    inactiveAudio.volume = 0;
    inactiveAudio.pause();
    inactiveAudio.currentTime = 0;
    activeAudio.play().then(() => {
        musicBtn.classList.add('playing');
    }).catch(err => {
        console.error('Musik gagal diputar:', err);
        startRomanticSynth();
        musicBtn.classList.add('playing');
    });
}
musicBtn.addEventListener('click', () => {
    if (musicBtn.classList.contains('playing')) {
        pauseMusic();
    } else {
        resumeMusic();
    }
});
function resumeMusic() {
    musicBtn.classList.add('active');
    activeAudio.play().then(() => {
        stopRomanticSynth();
        musicBtn.classList.add('playing');
    }).catch(() => {
        startRomanticSynth();
        musicBtn.classList.add('playing');
    });
}
function pauseMusic() {
    activeAudio.pause();
    inactiveAudio.pause();
    stopRomanticSynth();
    if (fadeFrame) {
        cancelAnimationFrame(fadeFrame);
        fadeFrame = null;
    }
    crossfadeRunning = false;
    activeAudio.volume = 1;
    inactiveAudio.volume = 0;
    inactiveAudio.currentTime = 0;
    musicBtn.classList.remove('playing');
}
function checkCrossfade(event) {
    const currentAudio = event.target;
    if (currentAudio !== activeAudio) return;
    if (crossfadeRunning) return;
    if (!currentAudio.duration || !isFinite(currentAudio.duration)) return;
    const remainingTime = currentAudio.duration - currentAudio.currentTime;
    if (remainingTime <= CROSSFADE_DURATION / 1000) {
        startCrossfade();
    }
}
function startCrossfade() {
    if (crossfadeRunning) return;
    crossfadeRunning = true;
    const oldAudio = activeAudio;
    const newAudio = inactiveAudio;
    newAudio.currentTime = 0;
    newAudio.volume = 0;
    newAudio.play().catch(err => {
        console.error('Crossfade gagal:', err);
        crossfadeRunning = false;
    });
    const startTime = performance.now();
    function animateFade(now) {
        const progress = Math.min((now - startTime) / CROSSFADE_DURATION, 1);
        oldAudio.volume = 1 - progress;
        newAudio.volume = progress;
        if (progress < 1) {
            fadeFrame = requestAnimationFrame(animateFade);
        } else {
            oldAudio.pause();
            oldAudio.currentTime = 0;
            oldAudio.volume = 0;
            newAudio.volume = 1;
            activeAudio = newAudio;
            inactiveAudio = oldAudio;
            crossfadeRunning = false;
            fadeFrame = null;
        }
    }
    fadeFrame = requestAnimationFrame(animateFade);
}
audioEl.addEventListener('timeupdate', checkCrossfade);
loopAudio.addEventListener('timeupdate', checkCrossfade);
/* ========================================================
   WEB AUDIO FALLBACK
   ======================================================== */
function startRomanticSynth() {
    if (synthPlaying) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        synthPlaying = true;
        const notes = [
            261.63, 261.63, 293.66, 261.63, 349.23, 329.63,
            261.63, 261.63, 293.66, 261.63, 392.00, 349.23,
            261.63, 261.63, 523.25, 440.00, 349.23, 329.63, 293.66,
            466.16, 466.16, 440.00, 349.23, 392.00, 349.23
        ];
        let noteIdx = 0;
        synthInterval = setInterval(() => {
            if (!synthPlaying || !audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(notes[noteIdx % notes.length], audioCtx.currentTime);
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 1.2);
            noteIdx++;
        }, 580);
    } catch (e) {
        console.log("Audio synth error", e);
    }
}
function stopRomanticSynth() {
    synthPlaying = false;
    if (synthInterval) {
        clearInterval(synthInterval);
        synthInterval = null;
    }
}
/* ========================================================
   PASSWORD LOGIC
   ======================================================== */
const keypadButtons = document.querySelectorAll('.key-btn[data-key]');
const dots = [
    document.getElementById('dot0'),
    document.getElementById('dot1'),
    document.getElementById('dot2'),
    document.getElementById('dot3')
];
const pwErrorModal = document.getElementById('pwErrorModal');
const btnRetryPin = document.getElementById('btnRetryPin');
function updateDots() {
    dots.forEach((dot, idx) => {
        if (idx < enteredPin.length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
}
keypadButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (pwErrorModal.classList.contains('active')) return;
        if (enteredPin.length < 4) {
            enteredPin += btn.getAttribute('data-key');
            updateDots();
            if (enteredPin.length === 4) {
                checkPin();
            }
        }
    });
});
document.getElementById('keyClear').addEventListener('click', () => {
    resetPinInput();
});
document.getElementById('keyEnter').addEventListener('click', () => {
    checkPin();
});
function checkPin() {
    if (enteredPin === CORRECT_PIN) {
        passcodeSuccess();
    } else {
        triggerPinError();
    }
}
function passcodeSuccess() {
    pwErrorModal.classList.remove('active');
    initAudio();
    spawnConfetti(25);
    setTimeout(() => {
        switchScene('countdown');
    }, 350);
}
function triggerPinError() {
    const card = document.getElementById('pwCard');
    if (card) {
        card.classList.remove('error-shake');
        void card.offsetWidth;
        card.classList.add('error-shake');
    }
    if (navigator.vibrate) {
        try {
            navigator.vibrate([60, 40, 60]);
        } catch (e) {}
    }
    setTimeout(() => {
        pwErrorModal.classList.add('active');
    }, 180);
}
function resetPinInput() {
    enteredPin = '';
    updateDots();
    pwErrorModal.classList.remove('active');
}
btnRetryPin.addEventListener('click', resetPinInput);
pwErrorModal.addEventListener('click', (e) => {
    if (e.target === pwErrorModal) {
        resetPinInput();
    }
});
/* ========================================================
   SCENE 0: COUNTDOWN LOGIC
   ======================================================== */
let countdownInterval = null;
let countdownSecondsLeft = 4;
function startCountdown() {
    const daysEl = document.getElementById('cdDays');
    const hoursEl = document.getElementById('cdHours');
    const minEl = document.getElementById('cdMinutes');
    const secEl = document.getElementById('cdSeconds');
    const btnWrap = document.getElementById('cdBtnWrapper');
    daysEl.textContent = '00';
    hoursEl.textContent = '00';
    minEl.textContent = '00';
    secEl.textContent = String(countdownSecondsLeft).padStart(2, '0');
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        countdownSecondsLeft--;
        if (countdownSecondsLeft <= 0) {
            clearInterval(countdownInterval);
            secEl.textContent = '00';
            setTimeout(() => {
                spawnConfetti(35);
                btnWrap.classList.add('show');
            }, 300);
        } else {
            secEl.textContent = String(countdownSecondsLeft).padStart(2, '0');
        }
    }, 1000);
}
document.getElementById('btnOpenHerGift').addEventListener('click', () => {
    switchScene('gift');
});
/* ========================================================
   SCENE 1: GIFT BOX ANIMATION
   ======================================================== */
const giftTrigger = document.getElementById('giftBoxTrigger');
const giftLid = document.getElementById('giftLid');
const giftSvg = document.getElementById('giftSvgWrapper');
const giftGlow = document.getElementById('giftGlow');
const giftTapHint = document.getElementById('giftTapHint');
const giftSuccessText = document.getElementById('giftSuccessText');
const giftNextBtnWrap = document.getElementById('giftNextBtnWrap');
let giftOpened = false;
giftTrigger.addEventListener('click', () => {
    if (giftOpened) return;
    giftOpened = true;
    giftSvg.classList.add('gift-shaking');
    giftTapHint.style.opacity = '0';
    setTimeout(() => {
        giftSvg.classList.remove('gift-shaking');
        giftLid.classList.add('lid-popped');
        giftGlow.classList.add('exploded');
        spawnConfetti(40);
        setTimeout(() => {
            giftSuccessText.classList.add('show');
            setTimeout(() => {
                giftNextBtnWrap.classList.add('show');
            }, 600);
        }, 800);
    }, 550);
});
document.getElementById('btnGiftNext').addEventListener('click', () => {
    switchScene('opening');
});
/* ========================================================
   SCENE 2: SPECIAL DAY OPENING
   ======================================================== */
document.getElementById('btnReadLetter').addEventListener('click', () => {
    switchScene('letter');
});
/* ========================================================
   SCENE 3: BIRTHDAY LETTER TYPEWRITER & AUTO-SCROLL
   ======================================================== */
const letterText = `Selamat ulang tahun yaa, dudungkuuu tercinta, paling ku lupp lupp... ♡
Hari ini adalah hari yang paling istimewa karena di hari inilah orang paling manis, paling berharga, dan paling aku sayangi lahir ke dunia.
Makasihh yaaaa udahh mau bertahan sampe sekarang, akuu harapp kedepannya kamu mau lebih terbukaa sama akuu, akuu tauu kauu bisaa sendirii, tapii enggaa, sekarang kitaa berduaa, bolehhh ngerasaa kuatt, tapi ga bolehh puraa puraaa kuatt, akuu tauu kamu punyaa trauma, tapii ini akuu, akuu ga sejahatt ituu
buat ngelakuin hal hal buruk yang nyakitin kamu, jangann ngerasa sendirii adaa akuu, aku harapp di perjalanan panjang kuu ada kamu di ujungnya and i will be by you side, I love you always. 🐾

Maafin akuu yaaa sukaa bikinn salah, sukaa bikinn kauu sakitt hatii, kadangg jugaa berlebihann ngomongnyaa maaf yaaa, akuu masihh belum terlaluu pahamm tentangmuu, tapii aku ga pernahh berhentii buatt mahaminn kau.

Semoga di usiamu yang baru ini, setiap langkahmu dipenuhi dengan kebahagiaan, kesehatan yang berlimpah, rezeki yang berkah, dan semua mimpi-mimpimu yang indah bisa terwujud satu per satu.

Jangannn pernah lupaa bahwa apapun yang terjadi, ada akuu yang selaluuu mendukungmuu, menyayangimuuu, dan bersyukur setiap detik memiliki kamuuu di sampingku, bareng teruss samaa aku yahh.

Selamatt ulang tahun dudunggg, kamuu pantess dapetinn yang terbaikk dungg itu sebabnyaa aku adaa... I love you moreee and moree, againn and againn! ✨♡`;
let letterIndex = 0;
let letterInterval = null;
let userInterruptedScroll = false;
const letterCard = document.getElementById('letterCard');
const letterBody = document.getElementById('letterBody');
const cursor = document.getElementById('typingCursor');
const letterNextWrap = document.getElementById('letterNextWrap');
letterCard.addEventListener('touchstart', () => {
    userInterruptedScroll = true;
});
letterCard.addEventListener('wheel', () => {
    userInterruptedScroll = true;
});
function startTypewriter() {
    letterBody.textContent = '';
    letterIndex = 0;
    userInterruptedScroll = false;
    cursor.style.display = 'inline-block';
    letterNextWrap.classList.remove('show');
    if (letterInterval) clearInterval(letterInterval);
    letterInterval = setInterval(() => {
        if (letterIndex < letterText.length) {
            letterBody.textContent += letterText.charAt(letterIndex);
            letterIndex++;
            if (!userInterruptedScroll) {
                letterCard.scrollTop = letterCard.scrollHeight;
            }
        } else {
            clearInterval(letterInterval);
            cursor.style.display = 'none';
            spawnConfetti(25);
            letterCard.style.boxShadow = '0 20px 50px rgba(234, 122, 152, 0.35)';
            setTimeout(() => {
                letterNextWrap.classList.add('show');
            }, 450);
        }
    }, 5);
}
document.getElementById('btnLetterNext').addEventListener('click', () => {
    switchScene('memories');
});
/* ========================================================
   SCENE 4: MEMORIES / LIGHTBOX PHOTO ZOOM
   ======================================================== */
const polaroids = document.querySelectorAll('.polaroid-item');
const lightboxModal = document.getElementById('lightboxModal');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxClose = document.getElementById('lightboxCloseBtn');
polaroids.forEach(p => {
    p.addEventListener('click', () => {
        const fullImg = p.getAttribute('data-img');
        const caption = p.getAttribute('data-caption');
        lightboxImg.src = fullImg;
        lightboxCaption.textContent = caption;
        lightboxModal.classList.add('active');
    });
});
function closeLightbox() {
    lightboxModal.classList.remove('active');
}
lightboxClose.addEventListener('click', closeLightbox);
lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal) closeLightbox();
});
/* ========================================================
   PARTICLES & CONFETTI UTILITY
   ======================================================== */
const ambientCont = document.getElementById('ambient-container');
for (let i = 0; i < 28; i++) {
    const part = document.createElement('div');
    part.className = 'particle';
    const isStar = Math.random() > 0.4;
    part.textContent = isStar ? '✦' : '♡';
    part.style.color = isStar ? 'rgba(255, 230, 240, 0.7)' : 'rgba(234, 122, 152, 0.65)';
    part.style.fontSize = (Math.random() * 10 + 9) + 'px';
    part.style.left = (Math.random() * 100) + '%';
    part.style.animationDuration = (Math.random() * 8 + 6) + 's';
    part.style.animationDelay = (Math.random() * 5) + 's';
    ambientCont.appendChild(part);
}
function spawnConfetti(count = 30) {
    const colors = ['#ea7a98', '#d896a8', '#fdf2ea', '#ffd166', '#a582b5', '#ffffff'];
    for (let i = 0; i < count; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti-piece';
        const size = Math.random() * 8 + 6;
        conf.style.width = size + 'px';
        conf.style.height = (size * 1.4) + 'px';
        conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        conf.style.left = (Math.random() * 92 + 4) + 'vw';
        conf.style.top = (Math.random() * 20 + 5) + 'vh';
        conf.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        conf.style.transform = `rotate(${Math.random() * 360}deg)`;
        conf.style.animationDuration = (Math.random() * 1.5 + 1.6) + 's';
        document.body.appendChild(conf);
        setTimeout(() => conf.remove(), 2600);
    }
}
/* ========================================================
   KEYBOARD CONTROLS
   ======================================================== */
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pwErrorModal.classList.contains('active')) {
        resetPinInput();
        return;
    }
    if (e.key === 'Escape') {
        closeLightbox();
        return;
    }
    if (e.key === 'Enter' && activeScene === 'password' && !pwErrorModal.classList.contains('active')) {
        checkPin();
    }
});