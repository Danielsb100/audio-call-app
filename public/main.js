// Configuration
const PEER_SERVER_HOST = window.location.hostname;
const PEER_SERVER_PORT = window.location.port || (window.location.protocol === 'https:' ? 443 : 80);
const PEER_PATH = '/peerjs';

// State Variables
let peer = null;
let localStream = null;
let currentCall = null;
let callDurationInterval = null;
let secondsElapsed = 0;

// Web Audio API for Visualizer
let audioContext = null;
let analyser = null;
let dataArray = null;
let animationFrameId = null;

// DOM Elements
const statusText = document.getElementById('status-text');
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const callSection = document.getElementById('call-section');
const myIdInput = document.getElementById('my-id');
const remoteIdInput = document.getElementById('remote-id');
const displayMyId = document.getElementById('display-my-id');
const remoteAvatarChar = document.getElementById('remote-avatar-char');
const callingName = document.getElementById('calling-name');
const callTimer = document.getElementById('call-timer');
const remoteAudio = document.getElementById('remote-audio');
const incomingModal = document.getElementById('incoming-modal');
const incomingCaller = document.getElementById('incoming-caller');

// Buttons
const btnLogin = document.getElementById('btn-login');
const btnCall = document.getElementById('btn-call');
const btnMute = document.getElementById('btn-mute');
const btnHangup = document.getElementById('btn-hangup');
const btnAnswer = document.getElementById('btn-answer');
const btnReject = document.getElementById('btn-reject');

// Initialization: Get Microphone Access
async function initMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        statusText.innerText = 'Microfone pronto. Conecte-se para começar.';
    } catch (err) {
        console.error('Falha ao acessar o microfone:', err);
        statusText.innerText = 'Erro: Sem acesso ao microfone.';
        alert('Por favor, permita o acesso ao microfone para usar o VozLink.');
    }
}

// PeerJS Initialization
function initPeer(id) {
    statusText.innerText = 'Conectando ao PeerServer...';
    
    peer = new Peer(id, {
        host: PEER_SERVER_HOST,
        port: PEER_SERVER_PORT,
        path: PEER_PATH,
        secure: window.location.protocol === 'https:'
    });

    peer.on('open', (id) => {
        statusText.innerText = 'Conectado e Pronto';
        displayMyId.innerText = id;
        switchSection('dashboard');
    });

    peer.on('call', (call) => {
        // "Busy" Logic: If already in a call, reject the new one
        if (currentCall) {
            console.log('Recebendo outra chamada, mas estou ocupado.');
            call.answer(); // Answer with no stream
            call.close();  // Close immediately
            return;
        }

        // Handle incoming call
        incomingCaller.innerText = call.peer;
        incomingModal.style.display = 'flex';
        
        btnAnswer.onclick = () => {
            incomingModal.style.display = 'none';
            answerCall(call);
        };
        
        btnReject.onclick = () => {
            incomingModal.style.display = 'none';
            call.answer(); 
            call.close(); 
        };
    });

    peer.on('error', (err) => {
        console.error('Erro no Peer:', err.type);
        statusText.innerText = `Erro: ${err.type}`;
        if (err.type === 'peer-unavailable') {
            alert('Usuário não encontrado.');
            resetUI();
        }
    });
}

// Call Handling
function makeCall() {
    const remoteId = remoteIdInput.value.trim();
    if (!remoteId) return alert('Digite o ID do amigo.');
    
    if (!localStream) return alert('Microfone não detectado.');

    statusText.innerText = `Chamando ${remoteId}...`;
    remoteAvatarChar.innerText = remoteId.charAt(0).toUpperCase();
    callingName.innerText = remoteId;
    
    currentCall = peer.call(remoteId, localStream);
    setupCallListeners(currentCall);
    switchSection('call');
    startTimer();
}

function answerCall(call) {
    currentCall = call;
    currentCall.answer(localStream);
    statusText.innerText = `Em chamada com ${call.peer}`;
    remoteAvatarChar.innerText = call.peer.charAt(0).toUpperCase();
    callingName.innerText = call.peer;
    
    setupCallListeners(currentCall);
    switchSection('call');
    startTimer();
}

function setupCallListeners(call) {
    call.on('stream', (remoteStream) => {
        remoteAudio.srcObject = remoteStream;
        setupVisualizer(remoteStream);
    });

    call.on('close', () => {
        resetUI();
    });
}

// Audio Visualizer Logic
function setupVisualizer(stream) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 32;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    const bars = document.querySelectorAll('.bar');
    
    function draw() {
        if (!currentCall) {
            cancelAnimationFrame(animationFrameId);
            return;
        }
        
        animationFrameId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        bars.forEach((bar, index) => {
            // Get frequency value (scaled)
            const val = dataArray[index] || 0;
            const height = Math.max(5, (val / 255) * 30); // Scale to 30px
            bar.style.height = `${height}px`;
            bar.style.opacity = 0.3 + (val / 255) * 0.7;
            // Stop the CSS animation so it doesn't conflict
            bar.style.animation = 'none';
        });
    }

    draw();
}

function hangup() {
    if (currentCall) {
        currentCall.close();
    }
    resetUI();
}

// UI Utilities
function switchSection(section) {
    [loginSection, dashboardSection, callSection].forEach(s => s.classList.remove('active'));
    
    if (section === 'login') loginSection.classList.add('active');
    if (section === 'dashboard') dashboardSection.classList.add('active');
    if (section === 'call') callSection.classList.add('active');
}

function resetUI() {
    stopTimer();
    switchSection('dashboard');
    statusText.innerText = 'Conectado e Pronto';
    if (currentCall) currentCall = null;
    remoteAudio.srcObject = null;
    
    // Reset visualizer bars
    const bars = document.querySelectorAll('.bar');
    bars.forEach(bar => {
        bar.style.height = '5px';
        bar.style.animation = 'dance 0.8s infinite ease-in-out alternate';
    });
}

function startTimer() {
    secondsElapsed = 0;
    callTimer.innerText = '00:00';
    callDurationInterval = setInterval(() => {
        secondsElapsed++;
        const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
        const secs = String(secondsElapsed % 60).padStart(2, '0');
        callTimer.innerText = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(callDurationInterval);
}

// Event Listeners
btnLogin.addEventListener('click', () => {
    const id = myIdInput.value.trim();
    if (id) initPeer(id);
    else alert('Por favor, digite um ID.');
});

btnCall.addEventListener('click', makeCall);

btnHangup.addEventListener('click', hangup);

btnMute.addEventListener('click', () => {
    const enabled = localStream.getAudioTracks()[0].enabled;
    if (enabled) {
        localStream.getAudioTracks()[0].enabled = false;
        btnMute.innerText = '🔇';
        btnMute.style.backgroundColor = 'var(--danger)';
    } else {
        localStream.getAudioTracks()[0].enabled = true;
        btnMute.innerText = '🎤';
        btnMute.style.backgroundColor = 'var(--glass-bg)';
    }
});

// Start
initMedia();
