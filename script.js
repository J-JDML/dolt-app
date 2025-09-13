'use strict';

// I. CONFIGURAÇÃO E DADOS GLOBAIS
// =================================================================================

let sessionData = {};
let timerInterval;
let ambientPlayer = new Audio();
let currentSound = null;
let isTimerPaused = false;
let reviewSession = [];
let currentReviewIndex = 0;

const levels = [
    { name: "Novato", xp: 0 }, { name: "Iniciante", xp: 60 }, { name: "Aprendiz", xp: 180 },
    { name: "Focado", xp: 360 }, { name: "Dedicado", xp: 600 }, { name: "Persistente", xp: 900 },
    { name: "Mestre", xp: 1500 }, { name: "Lenda", xp: 3000 },
];

const missionPool = {
    daily: [
        { id: 'd01', description: "Estude por 30 minutos", goal: 30, metric: 'studyMinutes', reward: { xp: 20, points: 40 } },
        { id: 'd02', description: "Complete 2 ciclos Pomodoro", goal: 2, metric: 'pomodoroCycles', reward: { xp: 25, points: 50 } },
        { id: 'd03', description: "Complete 1 sessão Feynman", goal: 1, metric: 'feynmanSessions', reward: { xp: 30, points: 60 } },
        { id: 'd04', description: "Revise 5 flashcards", goal: 5, metric: 'flashcardsReviewed', reward: { xp: 15, points: 30 } },
        { id: 'd05', description: "Crie 3 novos flashcards", goal: 3, metric: 'flashcardsCreated', reward: { xp: 15, points: 30 } },
        { id: 'd06', description: "Use um som ambiente durante uma sessão", goal: 1, metric: 'soundUsed', reward: { xp: 10, points: 20 } },
        { id: 'd07', description: "Use a Leitura Ativa (SQ3R) para dominar um tópico", goal: 1, metric: 'sq3rSessions', reward: { xp: 35, points: 70 } },
    ],
    weekly: [
        { id: 'w01', description: "Acumule 240 minutos de foco", goal: 240, metric: 'studyMinutes', reward: { xp: 150, points: 300 } },
        { id: 'w02', description: "Complete 8 ciclos Pomodoro", goal: 8, metric: 'pomodoroCycles', reward: { xp: 120, points: 240 } },
        { id: 'w03', description: "Revise 30 flashcards", goal: 30, metric: 'flashcardsReviewed', reward: { xp: 100, points: 200 } },
        { id: 'w04', description: "Mantenha um streak de 3 dias", goal: 3, metric: 'streak', reward: { xp: 80, points: 160 } },
        { id: 'w05', description: "Estude em 4 dias diferentes da semana", goal: 4, metric: 'studyDays', reward: { xp: 180, points: 360 } },
    ]
};

const defaultUserData = {
    totalPoints: 0, xp: 0,
    unlockedThemes: ['default'], unlockedMuralThemes: ['default'], activeMuralTheme: 'default',
    unlockedFeatures: [], unlockedSounds: [],
    totalStudyMinutes: 0, streakCount: 0, lastLoginDate: null,
    unlockedBadges: [], weeklyStats: {}, pomodoroCyclesCompleted: 0,
    flashcards: [],
    missions: {
        daily: { id: null, progress: 0, completed: false },
        weekly: { id: null, progress: 0, completed: false },
        lastDailyReset: null,
        lastWeeklyReset: null,
    }
};
let userData = JSON.parse(JSON.stringify(defaultUserData));

const notificationSound = new Audio('https://files.catbox.moe/6e2cvh.mp3');
notificationSound.preload = 'auto';

const allBadges = {
    'iniciante': { name: 'Iniciante', icon: '🌱', description: 'Complete 1 hora de foco', requirement: data => data.totalStudyMinutes >= 60 },
    'focado': { name: 'Focado', icon: '🎯', description: 'Complete 5 horas de foco', requirement: data => data.totalStudyMinutes >= 300 },
    'maratonista': { name: 'Maratonista', icon: '🏃‍♂️', description: 'Complete 10 horas de foco', requirement: data => data.totalStudyMinutes >= 600 },
    'consistente': { name: 'Consistente', icon: '🔥', description: 'Mantenha um streak de 7 dias', requirement: data => data.streakCount >= 7 },
    'mestre_pomodoro': { name: 'Mestre Pomodoro', icon: '🍅', description: 'Complete 20 ciclos Pomodoro', requirement: data => data.pomodoroCyclesCompleted >= 20 },
    'colecionador': { name: 'Colecionador', icon: '💰', description: 'Acumule 1000 pontos', requirement: data => data.totalPoints >= 1000 },
    'detetive': { name: 'Detetive do Conhecimento', icon: '🕵️‍♂️', description: 'Complete sua primeira sessão de Leitura Ativa', requirement: data => (data.sq3rSessionsCompleted || 0) >= 1 },
};

const elaborationPrompts = [
    { id: 'connect', question: "Como este conceito se conecta com algo que você já aprendeu antes (em outra matéria ou na vida real)?" },
    { id: 'analogy', question: "Crie uma analogia ou metáfora simples para explicar a ideia principal." },
    { id: 'teach', question: "Imagine que você precisa ensinar isso a um amigo de 10 anos. Escreva a explicação mais simples possível." },
    { id: 'apply', question: "Qual a aplicação prática mais interessante deste conhecimento?" }
];

const activeRecallPrompts = {
    teorico: ["Qual é a principal ideia que você acabou de aprender? Tente explicá-la em 3 frases.", "Como você ensinaria este tópico para alguém que não sabe nada sobre o assunto?", "Quais são os 3 termos mais importantes que você viu e o que eles significam?", "Faça uma analogia ou metáfora para descrever o conceito principal."],
    problemas: ["Qual foi o passo mais difícil que você encontrou? Por quê?", "Descreva o problema que você resolveu com suas próprias palavras.", "Poderia haver uma abordagem diferente ou mais eficiente para resolver este problema?", "Que conhecimento prévio foi essencial para chegar à solução?"],
    pratico: ["O que você faria de diferente na próxima vez para melhorar?", "Qual foi a parte mais fácil e a mais difícil do processo prático?", "Liste 3 dicas que você daria a si mesmo no futuro para executar esta tarefa.", "Como essa habilidade se conecta com outras coisas que você já sabe fazer?"]
};

const unlockableItems = {
    features: { 'themeSwitch': { name: 'Modo Escuro (no timer)', cost: 10, icon: '💡' } },
    themes: {
        'dark': { name: 'Card Tema Noturno', cost: 100, icon: '🌙', rarity: 'Comum' },
        'nature': { name: 'Card Tema Natureza', cost: 250, icon: '🌳', rarity: 'Comum' },
        'ocean': { name: 'Card Tema Oceano', cost: 300, icon: '🌊', rarity: 'Comum' },
        'space': { name: 'Card Tema Espacial', cost: 750, icon: '🚀', rarity: 'Incomum' },
        'retro': { name: 'Card Tema Retrô', cost: 1500, icon: '👾', rarity: 'Raro' }
    },
    muralThemes: {
        'forest': { name: 'Mural Floresta', cost: 500, icon: '🌲' },
        'beach': { name: 'Mural Praia', cost: 500, icon: '🏖️' },
        'lofi': { name: 'Mural Céu Lofi', cost: 1500, icon: '🌃' },
        'zen': { name: 'Mural Jardim Zen', cost: 0, icon: '🏯' },
        'cabin': { name: 'Mural Cabana na Montanha', cost: 0, icon: '🪵'},
        'retroMural': { name: 'Mural Retrô Arcade', cost: 0, icon: '👾'},
    },
    sounds: {
        'rain': { name: 'Som de Chuva', cost: 250, icon: '💧' },
        'wind': { name: 'Som de Vento', cost: 300, icon: '💨' },
        'coffee': { name: 'Som de Cafeteria', cost: 320, icon: '☕' }
    }
};

const itemConfig = {
    feature: { group: unlockableItems.features, unlockedKey: 'unlockedFeatures' },
    theme: { group: unlockableItems.themes, unlockedKey: 'unlockedThemes' },
    muralTheme: { group: unlockableItems.muralThemes, unlockedKey: 'unlockedMuralThemes'},
    sound: { group: unlockableItems.sounds, unlockedKey: 'unlockedSounds' }
};

const icons = {
    pause: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-500"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
    play: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-500"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
};

// II. SELETORES DO DOM
// =================================================================================

const DOM = {
    screens: {
        welcome: document.getElementById('screen-welcome'),
        intention: document.getElementById('screen-intention'),
        technique: document.getElementById('screen-technique'),
        timer: document.getElementById('screen-timer'),
        promptCategory: document.getElementById('screen-prompt-category'),
        promptResponse: document.getElementById('screen-prompt-response'),
        consolidation: document.getElementById('screen-consolidation'),
        result: document.getElementById('screen-result'),
        review: document.getElementById('screen-review'),
        elaboration: document.getElementById('screen-elaboration'),
        sq3rSurvey: document.getElementById('screen-sq3r-survey'),
        sq3rQuestion: document.getElementById('screen-sq3r-question'),
        sq3rRecite: document.getElementById('screen-sq3r-recite'),
    },
    fixedUI: document.getElementById('fixed-ui-elements'),
    pointsDisplayFixed: document.getElementById('points-display-fixed'),
    pauseBtn: document.getElementById('pause-btn'),
    themeSwitchContainer: document.getElementById('theme-switch-container'),
    themeSwitch: document.getElementById('theme-switch'),
    // Welcome Screen
    startBtn: document.getElementById('start-btn'),
    unlocksBtn: document.getElementById('unlocks-btn'),
    reviewFlashcardsBtn: document.getElementById('review-flashcards-btn'),
    changeMuralThemeBtn: document.getElementById('change-mural-theme-btn'),
    dashboard: {
        levelName: document.getElementById('dashboard-level-name'),
        xpDisplay: document.getElementById('dashboard-xp-display'),
        levelProgress: document.getElementById('dashboard-level-progress'),
        streak: document.getElementById('dashboard-streak'),
        totalTime: document.getElementById('dashboard-total-time'),
        badgesContainer: document.getElementById('dashboard-badges'),
        missionsContainer: document.getElementById('dashboard-missions'),
        chartContainer: document.getElementById('dashboard-chart'),
        chartLabels: document.getElementById('dashboard-chart-labels'),
    },
    // Intention Screen
    intentionInput: document.getElementById('intention-input'),
    intentionNextBtn: document.getElementById('intention-next-btn'),
    intentionBackBtn: document.getElementById('intention-back-btn'),
    // Technique Screen
    techniquePomodoroBtn: document.getElementById('technique-pomodoro'),
    techniqueFeynmanBtn: document.getElementById('technique-feynman'),
    techniqueConnectionsBtn: document.getElementById('technique-connections'),
    techniqueSq3rBtn: document.getElementById('technique-sq3r'),
    // SQ3R Screens
    sq3rSurveyNextBtn: document.getElementById('sq3r-survey-next-btn'),
    sq3rQuestionInputs: document.getElementById('sq3r-question-inputs'),
    sq3rAddQuestionBtn: document.getElementById('sq3r-add-question-btn'),
    sq3rQuestionNextBtn: document.getElementById('sq3r-question-next-btn'),
    sq3rReciteContainer: document.getElementById('sq3r-recite-container'),
    sq3rReciteNextBtn: document.getElementById('sq3r-recite-next-btn'),
    // Timer Screen
    timerDisplay: document.getElementById('timer-display'),
    timerIntentionDisplay: document.getElementById('timer-intention-display'),
    pomodoroInfo: document.getElementById('pomodoro-info'),
    timerStatus: document.getElementById('timer-status'),
    cycleCounter: document.getElementById('cycle-counter'),
    soundButtonsContainer: document.querySelector('#screen-timer .absolute.bottom-6'),
    sq3rQuestionsDisplayTimer: document.getElementById('sq3r-questions-display-timer'),
    sq3rQuestionsListTimer: document.getElementById('sq3r-questions-list-timer'),
    // Elaboration Screen
    elaborationPromptDisplay: document.getElementById('elaboration-prompt-display'),
    elaborationAnswerInput: document.getElementById('elaboration-answer-input'),
    elaborationProgress: document.getElementById('elaboration-progress'),
    elaborationNextBtn: document.getElementById('elaboration-next-btn'),
    // Result Screen
    resultIntention: document.getElementById('result-intention'),
    resultTechnique: document.getElementById('result-technique'),
    defaultResultContainer: document.getElementById('default-result-container'),
    elaborationResultContainer: document.getElementById('elaboration-result-container'),
    sq3rResultContainer: document.getElementById('sq3r-result-container'),
    resultSummary: document.getElementById('result-summary'),
    promptResultContainer: document.getElementById('prompt-result-container'),
    resultPromptQuestion: document.getElementById('result-prompt-question'),
    resultPromptAnswer: document.getElementById('result-prompt-answer'),
    themeSelector: document.getElementById('theme-selector'),
    knowledgeCard: document.getElementById('knowledge-card'),
    downloadCardBtn: document.getElementById('download-card-btn'),
    createFlashcardBtn: document.getElementById('create-flashcard-btn'),
    shareCardBtn: document.getElementById('share-card-btn'),
    backToStartBtn: document.getElementById('back-to-start-btn'),
    // Review Screen
    flashcardContainer: document.getElementById('flashcard-container'),
    reviewRatings: document.getElementById('review-ratings'),
    reviewActions: document.getElementById('review-actions'),
    flashcardFront: document.getElementById('flashcard-front'),
    flashcardBack: document.getElementById('flashcard-back'),
    reviewProgress: document.getElementById('review-progress'),
    showAnswerBtn: document.getElementById('show-answer-btn'),
    reviewFinishBtn: document.getElementById('review-finish-btn'),
    // Modals
    unlocksModal: document.getElementById('unlocks-modal'),
    unlocksCloseBtn: document.getElementById('unlocks-close-btn'),
    storePointsDisplay: document.getElementById('store-points-display'),
    lockedItemsList: document.getElementById('locked-items-list'),
    unlockedItemsList: document.getElementById('unlocked-items-list'),
    infoModal: document.getElementById('info-modal'),
    infoModalTitle: document.getElementById('info-modal-title'),
    infoModalMessage: document.getElementById('info-modal-message'),
    infoModalCloseBtn: document.getElementById('info-modal-close-btn'),
    pomodoroModal: document.getElementById('pomodoro-cycles-modal'),
    cycleOptionsContainer: document.getElementById('cycle-options'),
    cyclesStartBtn: document.getElementById('cycles-start-btn'),
    cyclesCancelBtn: document.getElementById('cycles-cancel-btn'),
    flashcardModal: document.getElementById('create-flashcard-modal'),
    flashcardDeckInput: document.getElementById('flashcard-deck-input'),
    flashcardFrontInput: document.getElementById('flashcard-front-input'),
    flashcardBackInput: document.getElementById('flashcard-back-input'),
    flashcardModalCloseBtn: document.getElementById('flashcard-modal-close-btn'),
    flashcardSaveBtn: document.getElementById('flashcard-save-btn'),
    muralThemeModal: document.getElementById('mural-theme-modal'),
    muralThemeCloseBtn: document.getElementById('mural-theme-close-btn'),
    muralThemeOptions: document.getElementById('mural-theme-options'),
    shareModal: document.getElementById('share-modal'),
    shareModalCloseBtn: document.getElementById('share-modal-close-btn'),
    shareDownloadCardBtn: document.getElementById('share-download-card-btn'),
    shareTwitterBtn: document.getElementById('share-twitter-btn'),
    shareLinkedInBtn: document.getElementById('share-linkedin-btn'),
    // Toast
   toast: document.getElementById('toast'),
toastMessage: document.getElementById('toast-message'),
// Botão Premium e Ativação
premiumBtn: document.getElementById('premium-btn'),
activatePremiumBtn: document.getElementById('activate-premium-btn'),
premiumStatusBadge: document.getElementById('premium-status-badge'),
// Modal de Ativação
activationModal: document.getElementById('activation-modal'),
activationModalCloseBtn: document.getElementById('activation-modal-close-btn'),
premiumKeyInput: document.getElementById('premium-key-input'),
activateKeyBtn: document.getElementById('activate-key-btn'),
};


// III. FUNÇÕES AUXILIARES (HELPERS)
// =================================================================================


function checkAndApplyPremiumStatus() {
    if (localStorage.getItem('dolt_plan') === 'premium') {
        userData.isPremium = true;
        // Atualiza a UI para refletir o status premium
        DOM.premiumBtn.classList.add('hidden');
        DOM.activatePremiumBtn.classList.add('hidden');
        DOM.premiumStatusBadge.classList.remove('hidden');
        DOM.premiumStatusBadge.classList.add('flex'); // Garante que será exibido
        
        // Desbloqueia todos os itens na loja visualmente
        // A lógica real de desbloqueio ocorrerá em populateUnlocksModal
        console.log("Status Premium ativo.");
    } else {
        userData.isPremium = false;
        DOM.premiumBtn.classList.remove('hidden');
        DOM.activatePremiumBtn.classList.remove('hidden');
        DOM.premiumStatusBadge.classList.add('hidden');
    }
}

function showToast(message) {
    DOM.toastMessage.innerText = message;
    DOM.toast.classList.remove('hidden');
    setTimeout(() => { DOM.toast.classList.remove('translate-y-20'); }, 10);
    setTimeout(() => {
        DOM.toast.classList.add('translate-y-20');
        setTimeout(() => { DOM.toast.classList.add('hidden'); }, 300);
    }, 3000);
}

function showModal(modalElement, onOk) {
    const okBtn = modalElement.querySelector('.ok-btn, .close-btn, #info-modal-close-btn');
    if (okBtn) {
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        newOkBtn.onclick = () => {
            hideModal(modalElement);
            if (onOk) onOk();
        };
    }
    
    modalElement.classList.remove('hidden');
    setTimeout(() => {
        modalElement.querySelector('div').classList.remove('scale-95', 'opacity-0');
    }, 10);
}

function hideModal(modalElement) {
    modalElement.querySelector('div').classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modalElement.classList.add('hidden');
    }, 300);
}

function showInfoModal(title, message, onOk) {
    DOM.infoModalTitle.innerText = title;
    DOM.infoModalMessage.innerText = message;
    showModal(DOM.infoModal, onOk);
}

function generateStars(cardElement) {
    const oldStars = cardElement.querySelectorAll('.star');
    oldStars.forEach(star => star.remove());

    const numStars = 60;
    const elementWidth = cardElement.offsetWidth;
    const elementHeight = cardElement.offsetHeight;

    for (let i = 0; i < numStars; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.position = 'absolute';
        star.style.backgroundColor = 'white';
        star.style.borderRadius = '50%';
        star.style.zIndex = '0';
        
        const size = (Math.random() * 2 + 1.5) + 'px'; 
        star.style.width = size;
        star.style.height = size;
        
        star.style.left = (Math.random() * elementWidth) + 'px';
        star.style.top = (Math.random() * elementHeight) + 'px';
        
        star.style.opacity = Math.random() * 0.8 + 0.2; 

        cardElement.appendChild(star);
    }
}


// IV. LÓGICA DE DADOS E ESTADO
// =================================================================================

function saveData() {
    localStorage.setItem('doltUserData', JSON.stringify(userData));
}

function loadData() {
    checkAndApplyPremiumStatus();
    const savedData = localStorage.getItem('doltUserData');
    if (savedData) {
        try {
            const parsedData = JSON.parse(savedData);
            userData = { 
                ...defaultUserData, 
                ...parsedData, 
                missions: { ...defaultUserData.missions, ...(parsedData.missions || {}) } 
            };
        } catch (error) {
            console.error("Erro ao carregar dados do localStorage. Usando dados padrão.", error);
            userData = JSON.parse(JSON.stringify(defaultUserData));
        }
    }
    checkAndResetMissions();
    applyMuralTheme(userData.activeMuralTheme);
    updateStreak();
    updateUI();
}

function getUserLevelInfo(xp) {
    let currentLevel = 1;
    let levelName = 'Novato';
    let xpForCurrentLevel = 0;
    let xpForNextLevel = levels[1].xp;

    for (let i = levels.length - 1; i >= 0; i--) {
        if (xp >= levels[i].xp) {
            currentLevel = i + 1;
            levelName = levels[i].name;
            xpForCurrentLevel = levels[i].xp;
            xpForNextLevel = levels[i+1] ? levels[i+1].xp : xpForCurrentLevel;
            break;
        }
    }
    return { level: currentLevel, name: levelName, currentLevelXP: xpForCurrentLevel, nextLevelXP: xpForNextLevel };
}

function updateStreak() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (userData.lastLoginDate !== todayStr) {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (userData.lastLoginDate === yesterdayStr) {
            userData.streakCount++;
        } else {
            userData.streakCount = 1;
        }
        userData.lastLoginDate = todayStr;
        setMissionProgress('streak', userData.streakCount);
        saveData();
    }
}


// V. LÓGICA DE MISSÕES E RECOMPENSAS
// =================================================================================

function checkAndResetMissions() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; 
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

    if (!userData.missions.lastDailyReset || userData.missions.lastDailyReset < startOfDay) {
        const availableMissions = missionPool.daily.filter(m => m.id !== userData.missions.daily.id);
        const newMission = availableMissions[Math.floor(Math.random() * availableMissions.length)];
        userData.missions.daily = { id: newMission.id, progress: 0, completed: false };
        userData.missions.lastDailyReset = now.getTime();
    }

    if (!userData.missions.lastWeeklyReset || userData.missions.lastWeeklyReset < startOfWeek.getTime()) {
        const availableMissions = missionPool.weekly.filter(m => m.id !== userData.missions.weekly.id);
        const newMission = availableMissions[Math.floor(Math.random() * availableMissions.length)];
        userData.missions.weekly = { id: newMission.id, progress: 0, completed: false };
        userData.missions.lastWeeklyReset = now.getTime();
        if (newMission.metric === 'streak') {
            userData.missions.weekly.progress = userData.streakCount;
        }
    }
}

function updateMissionProgress(metric, value) {
    const missionTypes = ['daily', 'weekly'];
    missionTypes.forEach(type => {
        const missionState = userData.missions[type];
        if (!missionState || missionState.completed) return;

        const missionInfo = missionPool[type].find(m => m.id === missionState.id);
        if (missionInfo && missionInfo.metric === metric) {
            missionState.progress += value;
            if (missionState.progress >= missionInfo.goal) {
                completeMission(type);
            }
        }
    });
    saveData();
    renderDashboard();
}

function setMissionProgress(metric, value) {
    const missionTypes = ['daily', 'weekly'];
    missionTypes.forEach(type => {
        const missionState = userData.missions[type];
        if (!missionState || missionState.completed) return;
        const missionInfo = missionPool[type].find(m => m.id === missionState.id);
        if (missionInfo && missionInfo.metric === metric) {
            missionState.progress = Math.max(missionState.progress, value);
            if (missionState.progress >= missionInfo.goal) {
                completeMission(type);
            }
        }
    });
    saveData();
    renderDashboard();
}

function completeMission(type) {
    const missionState = userData.missions[type];
    if (missionState.completed) return;

    const missionInfo = missionPool[type].find(m => m.id === missionState.id);
    if (!missionInfo) return;

    missionState.completed = true;
    userData.xp += missionInfo.reward.xp;
    userData.totalPoints += missionInfo.reward.points;

    showToast(`Missão ${type === 'daily' ? 'Diária' : 'Semanal'} Concluída!`);
    showInfoModal("Recompensa Recebida!", `+${missionInfo.reward.xp} XP e +${missionInfo.reward.points} Pontos 💰`);

    saveData();
}

function addProgress(minutes, feynmanSessions = 0, sq3rSessions = 0) {
    const xpGained = minutes;
    const pointsGained = minutes * 2;
    
    const oldLevelInfo = getUserLevelInfo(userData.xp);

    userData.xp += xpGained;
    userData.totalPoints += pointsGained;
    userData.totalStudyMinutes += minutes;
    
    const today = new Date().toISOString().split('T')[0];
    const weeklyData = userData.weeklyStats || {};
    weeklyData[today] = (weeklyData[today] || 0) + minutes;
    userData.weeklyStats = weeklyData;

    showToast(`+${xpGained} XP | +${pointsGained} Pontos 💰`);
    
    const newLevelInfo = getUserLevelInfo(userData.xp);
    if (newLevelInfo.level > oldLevelInfo.level) {
         showInfoModal("Subiu de Nível!", `Parabéns, você alcançou o Nível ${newLevelInfo.level}: ${newLevelInfo.name}!`);
    }
    
    updateMissionProgress('studyMinutes', minutes);
    if (feynmanSessions > 0) updateMissionProgress('feynmanSessions', feynmanSessions);
    if (sq3rSessions > 0) {
        userData.sq3rSessionsCompleted = (userData.sq3rSessionsCompleted || 0) + 1;
        updateMissionProgress('sq3rSessions', sq3rSessions);
    }
    
    const now = new Date();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
    const studyDays = Object.keys(userData.weeklyStats).filter(date => new Date(date) >= startOfWeek).length;
    setMissionProgress('studyDays', studyDays);

    checkBadges();
    saveData();
    updateUI();
}

function checkBadges() {
    for (const badgeId in allBadges) {
        if (!userData.unlockedBadges.includes(badgeId)) {
            if (allBadges[badgeId].requirement(userData)) {
                userData.unlockedBadges.push(badgeId);
                showToast(`🏆 Badge Conquistado: ${allBadges[badgeId].name}!`);
            }
        }
    }
}

function tryUnlockItem(type, key) {
   const config = itemConfig[type];
   if (!config) return;
    const item = config.group[key];
    if (userData.totalPoints >= item.cost) {
        userData.totalPoints -= item.cost;
        userData[config.unlockedKey].push(key);
        showToast(`${item.name} desbloqueado!`);
        saveData();
        updateUI();
        populateUnlocksModal();
    } else {
        showToast(`Você precisa de mais ${item.cost - userData.totalPoints} pontos!`);
    }
}

async function handleActivatePremium() {
    const key = DOM.premiumKeyInput.value.trim();
    if (!key) {
        showToast("Por favor, insira sua chave de ativação.");
        return;
    }

    DOM.activateKeyBtn.disabled = true;
    DOM.activateKeyBtn.textContent = 'Verificando...';

    try {
        const response = await fetch('/.netlify/functions/validate-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: key })
        });

        const result = await response.json();

        if (response.ok && result.valid) {
            localStorage.setItem('dolt_plan', 'premium');
            hideModal(DOM.activationModal);
            showInfoModal('Sucesso!', 'Seu Passe Vitalício foi ativado. Bem-vindo(a) ao Premium!', () => {
                // Recarrega o estado da aplicação para aplicar as mudanças
                checkAndApplyPremiumStatus(); // Atualiza a UI imediatamente
            });
        } else {
            throw new Error(result.message || 'Chave inválida.');
        }

    } catch (error) {
        showToast(`Erro: ${error.message}`);
    } finally {
        DOM.activateKeyBtn.disabled = false;
        DOM.activateKeyBtn.textContent = 'Ativar';
        DOM.premiumKeyInput.value = '';
    }
}

// VI. RENDERIZAÇÃO E ATUALIZAÇÃO DA UI
// =================================================================================

function showScreen(screenName) {
    Object.values(DOM.screens).forEach(screen => screen.classList.add('hidden'));

    if (screenName !== 'timer' && document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        DOM.themeSwitch.checked = false;
    }
    if (screenName === 'welcome') {
        applyMuralTheme(userData.activeMuralTheme);
    } else {
        applyMuralTheme('default');
    }

    if (DOM.screens[screenName]) {
        DOM.screens[screenName].classList.remove('hidden');
    }
    
    const showFixedUI = screenName && screenName !== 'welcome' && screenName !== 'review';
    DOM.fixedUI.classList.toggle('hidden', !showFixedUI);
    DOM.pauseBtn.classList.toggle('hidden', screenName !== 'timer');
}

function updateUI() {
    DOM.pointsDisplayFixed.innerText = `💰 ${userData.totalPoints} Pontos`;
    DOM.themeSwitchContainer.classList.toggle('hidden', !userData.unlockedFeatures.includes('themeSwitch'));
    document.querySelectorAll('.sound-btn').forEach(btn => {
        btn.disabled = !userData.unlockedSounds.includes(btn.dataset.sound);
    });
    renderDashboard();
}

function renderDashboard() {
    renderDashboardStats();
    renderDashboardBadges();
    renderMissions();
    renderWeeklyChart();

    const todayStr = new Date().toISOString().split('T')[0];
    const cardsToReview = userData.flashcards.filter(card => card.nextReviewDate <= todayStr);
    DOM.reviewFlashcardsBtn.textContent = `Revisar Flashcards (${cardsToReview.length})`;
    DOM.reviewFlashcardsBtn.disabled = cardsToReview.length === 0;
}

function renderDashboardStats() {
    const levelInfo = getUserLevelInfo(userData.xp);
    const xpProgress = userData.xp - levelInfo.currentLevelXP;
    const xpForLevel = levelInfo.nextLevelXP - levelInfo.currentLevelXP;
    const progressPercentage = xpForLevel > 0 ? (xpProgress / xpForLevel) * 100 : 100;
    DOM.dashboard.levelName.textContent = levelInfo.name;
    DOM.dashboard.xpDisplay.textContent = `${xpProgress}/${xpForLevel} XP`;
    DOM.dashboard.levelProgress.style.width = `${progressPercentage}%`;
    
    DOM.dashboard.streak.textContent = `${userData.streakCount} dia${userData.streakCount !== 1 ? 's' : ''}`;
    const hours = Math.floor(userData.totalStudyMinutes / 60);
    const minutes = userData.totalStudyMinutes % 60;
    DOM.dashboard.totalTime.textContent = `${hours}h ${minutes}m`;
}

function renderDashboardBadges() {
    DOM.dashboard.badgesContainer.innerHTML = '';
    for (const badgeId in allBadges) {
        const badge = allBadges[badgeId];
        const isUnlocked = userData.unlockedBadges.includes(badgeId);
        const badgeEl = document.createElement('div');
        badgeEl.className = 'flex flex-col items-center justify-center text-center';
        badgeEl.innerHTML = `
            <div class="w-16 h-16 rounded-full flex items-center justify-center text-3xl ${isUnlocked ? 'bg-amber-100 dark:bg-amber-900' : 'bg-slate-200 dark:bg-slate-700'}">
                <span class="${!isUnlocked ? 'opacity-30' : ''}">${badge.icon}</span>
            </div>
            <p class="text-sm font-semibold mt-2 dark:text-slate-200">${badge.name}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400" title="${badge.description}">${isUnlocked ? 'Desbloqueado' : 'Bloqueado'}</p>
        `;
        DOM.dashboard.badgesContainer.appendChild(badgeEl);
    }
}

function renderMissions() {
    DOM.dashboard.missionsContainer.innerHTML = '';
    const missionTypes = ['daily', 'weekly'];
    missionTypes.forEach(type => {
        const missionState = userData.missions[type];
        const missionInfo = missionPool[type].find(m => m.id === missionState.id);

        if (!missionInfo) {
            DOM.dashboard.missionsContainer.innerHTML += `<div>Carregando missão...</div>`;
            return;
        }
        
        const progress = Math.min(missionState.progress, missionInfo.goal);
        const progressPercentage = (progress / missionInfo.goal) * 100;

        const missionCard = document.createElement('div');
        missionCard.className = "text-left p-4 rounded-lg bg-slate-100 dark:bg-slate-700/50";
        missionCard.innerHTML = `
            <h4 class="font-bold capitalize">${type === 'daily' ? '🎯 Missão Diária' : '🗓️ Missão Semanal'}</h4>
            <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">${missionInfo.description}</p>
            <div class="progress-bar-bg w-full h-4 mt-2">
                <div class="progress-bar-fill ${missionState.completed ? 'completed' : ''}" style="width: ${progressPercentage}%; line-height: 1rem;">
                   ${missionState.completed ? 'Completo!' : progress + '/' + missionInfo.goal}
                </div>
            </div>
            <p class="text-xs text-right font-semibold mt-1 text-amber-500">+${missionInfo.reward.xp} XP / +${missionInfo.reward.points} 💰</p>
        `;
        DOM.dashboard.missionsContainer.appendChild(missionCard);
    });
}

function renderWeeklyChart() {
    DOM.dashboard.chartContainer.innerHTML = '';
    DOM.dashboard.chartLabels.innerHTML = '';
    const today = new Date();
    const weeklyData = [];
    const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        weeklyData.push({ label: dayLabels[date.getDay()], value: userData.weeklyStats[dateStr] || 0 });
    }
    const maxMinutes = Math.max(...weeklyData.map(d => d.value), 1); 
    weeklyData.forEach(day => {
        const barHeight = (day.value / maxMinutes) * 100;
        const barEl = document.createElement('div');
        barEl.className = 'w-8 bg-sky-500 rounded-t-lg hover:bg-sky-400 transition-all';
        barEl.style.height = `${barHeight}%`;
        barEl.title = `${day.value} minutos`;
        DOM.dashboard.chartContainer.appendChild(barEl);
        const labelEl = document.createElement('span');
        labelEl.textContent = day.label;
        DOM.dashboard.chartLabels.appendChild(labelEl);
    });
}

function populateUnlocksModal() {
    DOM.storePointsDisplay.textContent = userData.totalPoints;
    DOM.lockedItemsList.innerHTML = '';
    DOM.unlockedItemsList.innerHTML = '';
    
    const rarityColors = { 'Comum': 'text-gray-500', 'Incomum': 'text-blue-500', 'Raro': 'text-purple-500' };

    const createItemHTML = (id, item, type, isUnlocked) => {
        const div = document.createElement('div');
        div.className = `flex justify-between items-center p-3 rounded-lg ${isUnlocked ? 'bg-green-100 dark:bg-green-900/50' : 'bg-slate-100 dark:bg-slate-700'}`;
        const raritySpan = item.rarity ? `<span class="text-xs font-bold ${rarityColors[item.rarity]} ml-2">${item.rarity}</span>` : '';
        div.innerHTML = `<div class="text-left"><span class="text-lg">${item.icon}</span><span class="font-medium ml-2 dark:text-white">${item.name}</span>${raritySpan}</div> ${isUnlocked ? '<span class="text-sm font-bold text-green-600 dark:text-green-400">DESBLOQUEADO</span>' : `<button data-type="${type}" data-key="${id}" class="buy-btn text-sm font-bold bg-amber-400 text-amber-900 px-3 py-1 rounded-md hover:bg-amber-500">💰 ${item.cost}</button>`}`;
        return div;
    };

    for (const [type, config] of Object.entries(itemConfig)) {
        for (const [key, item] of Object.entries(config.group)) {
            if (key === 'default') continue;
            const isUnlocked = userData[config.unlockedKey].includes(key);
            const el = createItemHTML(key, item, type, isUnlocked);
            if (isUnlocked) {
                DOM.unlockedItemsList.appendChild(el);
            } else {
                DOM.lockedItemsList.appendChild(el);
            }
        }
    }
}

function displayResult() {
    DOM.resultIntention.textContent = sessionData.meta_sessao;
    DOM.resultTechnique.textContent = sessionData.tecnica_escolhida;
    
    DOM.defaultResultContainer.classList.add('hidden');
    DOM.elaborationResultContainer.classList.add('hidden');
    DOM.sq3rResultContainer.classList.add('hidden');

    if (sessionData.tecnica_escolhida === 'Conexões Profundas') {
        DOM.elaborationResultContainer.innerHTML = '';
        elaborationPrompts.forEach(prompt => {
            const answer = sessionData.elaborationAnswers[prompt.id];
            const resultHTML = `
                <div>
                    <p class="text-sm font-semibold text-slate-500 pt-2">${prompt.question}</p>
                    <p class="text-slate-700 italic border-l-4 border-slate-200 pl-4 mt-1">${answer}</p>
                </div>
            `;
            DOM.elaborationResultContainer.innerHTML += resultHTML;
        });
        DOM.elaborationResultContainer.classList.remove('hidden');

    } else if (sessionData.tecnica_escolhida === 'Leitura Ativa (SQ3R)') {
        DOM.sq3rResultContainer.innerHTML = ''; 
        
        sessionData.sq3rQuestions.forEach((question, index) => {
            const answer = sessionData.sq3rAnswers[index] || "Nenhuma resposta fornecida.";
            const qaBlock = `
                <div class="mt-4">
                    <p class="text-sm font-semibold text-slate-500 pt-2">Sua Pergunta:</p>
                    <p class="text-slate-700 italic border-l-4 border-sky-200 dark:border-sky-800 pl-4">${question}</p>
                    <p class="text-sm font-semibold text-slate-500 pt-2 mt-2">Sua Resposta (Recitada):</p>
                    <p class="text-slate-700 italic border-l-4 border-slate-200 pl-4">${answer}</p>
                </div>
            `;
            DOM.sq3rResultContainer.innerHTML += qaBlock;
        });

        const reviewHTML = `
            <div class="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg mt-6">
                <h4 class="font-bold text-center text-lg mb-2 text-slate-800 dark:text-slate-200">Passo 5/5: Revisar (Review)</h4>
                <p class="text-sm text-center text-slate-600 dark:text-slate-400">Compare suas respostas com o material original. Estão corretas e completas? Adicione ou corrija os detalhes finais na sua reflexão abaixo.</p>
            </div>
            <textarea id="sq3r-review-reflection" class="w-full h-24 mt-4 p-3 bg-transparent border-2 border-slate-300 dark:border-slate-600 rounded-lg" placeholder="Escreva sua reflexão final aqui..."></textarea>
        `;
        DOM.sq3rResultContainer.innerHTML += reviewHTML;

        DOM.sq3rResultContainer.classList.remove('hidden');
    } else { // Pomodoro and Feynman
        DOM.resultSummary.textContent = sessionData.resumo_sessao;
        if (sessionData.prompt_question && sessionData.prompt_answer) {
            DOM.resultPromptQuestion.textContent = sessionData.prompt_question;
            DOM.resultPromptAnswer.textContent = sessionData.prompt_answer;
            DOM.promptResultContainer.classList.remove('hidden');
        } else {
            DOM.promptResultContainer.classList.add('hidden');
        }
        DOM.defaultResultContainer.classList.remove('hidden');
    }
    
    setupThemeSelector();
    showScreen('result');
}


// VII. LÓGICA DE TEMAS E ESTILOS
// =================================================================================

function applyMuralTheme(themeName) {
    document.body.className = document.body.className.replace(/theme-mural-\w+/g, '');
    
    const oldStars = document.querySelectorAll('body > .star');
    oldStars.forEach(star => star.remove());

    if (themeName !== 'default') {
        document.body.classList.add(`theme-mural-${themeName}`);
        if (themeName === 'lofi') {
            setTimeout(() => generateStars(document.body), 50);
        }
    }
}

function setupThemeSelector() {
    DOM.themeSelector.innerHTML = '';
    const allThemes = { 'default': { name: 'Padrão', icon: '☀️' }, ...unlockableItems.themes };
    
    userData.unlockedThemes.forEach(key => {
        const theme = allThemes[key];
        if (!theme) return;
        
        const button = document.createElement('button');
        button.className = 'p-2 rounded-lg border-2 border-transparent';
        button.dataset.theme = key;
        button.title = `Tema ${theme.name}`;
        button.innerHTML = `${theme.icon}`;
        
        button.onclick = () => {
            const card = DOM.knowledgeCard;
            card.className = 'bg-white p-8 rounded-2xl shadow-2xl text-left space-y-4 border-4 border-slate-900 transition-colors duration-300';
            
            const oldStars = card.querySelectorAll('.star');
            oldStars.forEach(star => star.remove());

            if (key !== 'default') {
                card.classList.add(`theme-${key}`);
            }
            if (key === 'space') {
                setTimeout(() => generateStars(card), 50); 
            }

            document.querySelectorAll('#theme-selector button').forEach(b => b.classList.replace('border-sky-500', 'border-transparent'));
            button.classList.replace('border-transparent', 'border-sky-500');
        };
        DOM.themeSelector.appendChild(button);
    });

    const firstButton = DOM.themeSelector.querySelector('button');
    if (firstButton) {
        firstButton.click();
    }
}

function populateMuralThemeModal() {
    DOM.muralThemeOptions.innerHTML = '';
    const allThemes = { 'default': { name: 'Padrão', icon: '☀️' }, ...unlockableItems.muralThemes };
    userData.unlockedMuralThemes.forEach(themeKey => {
        const theme = allThemes[themeKey];
        const btn = document.createElement('button');
        btn.className = `p-4 border-2 rounded-lg flex flex-col items-center gap-2 hover:border-sky-500 ${userData.activeMuralTheme === themeKey ? 'border-sky-500' : 'border-slate-300 dark:border-slate-600'}`;
        btn.dataset.theme = themeKey;
        btn.innerHTML = `<span class="text-3xl">${theme.icon}</span><span class="font-semibold">${theme.name}</span>`;
        btn.onclick = () => {
            userData.activeMuralTheme = themeKey;
            applyMuralTheme(themeKey);
            saveData();
            document.querySelectorAll('#mural-theme-options button').forEach(b => b.classList.replace('border-sky-500', 'border-slate-300'));
            btn.classList.replace('border-slate-300', 'border-sky-500');
        };
        DOM.muralThemeOptions.appendChild(btn);
    });
}

// VIII. LÓGICA DE SESSÃO DE ESTUDO
// =================================================================================

function startTimer() {
    showScreen('timer');
    isTimerPaused = false;
    DOM.pauseBtn.innerHTML = icons.pause;
    DOM.timerIntentionDisplay.textContent = `Meta: ${sessionData.meta_sessao}`;
    DOM.pomodoroInfo.classList.add('hidden');
    DOM.sq3rQuestionsDisplayTimer.classList.add('hidden');

    if(sessionData.tecnica_escolhida === 'Leitura Ativa (SQ3R)') {
        DOM.sq3rQuestionsListTimer.innerHTML = '';
        sessionData.sq3rQuestions.forEach(q => {
            const li = document.createElement('li');
            li.textContent = q;
            DOM.sq3rQuestionsListTimer.appendChild(li);
        });
        DOM.sq3rQuestionsDisplayTimer.classList.remove('hidden');
    } else if (sessionData.tecnica_escolhida === 'Pomodoro') {
        DOM.pomodoroInfo.classList.remove('hidden');
    }

    runTimer();
}


function runTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        if (sessionData.duracao_timer > 0) {
            sessionData.duracao_timer--;
            updateTimerDisplay();
        } else {
            clearInterval(timerInterval);
            if (currentSound) ambientPlayer.pause();
            notificationSound.play().catch(e => console.error("Erro ao tocar som:", e));

            if (sessionData.tecnica_escolhida === 'Conexões Profundas') {
                showInfoModal("Sessão de Foco Finalizada!", "Excelente trabalho! Agora, vamos aprofundar seu conhecimento.", () => {
                   addProgress(sessionData.duracao_base);
                   startElaborationSession();
                });
            } else if (sessionData.tecnica_escolhida === 'Pomodoro') {
                handlePomodoroTransition();
            } else if (sessionData.tecnica_escolhida === 'Leitura Ativa (SQ3R)') {
                showInfoModal("Fim da Leitura!", "Ótimo! Agora é hora de recitar o que você aprendeu.", () => {
                   addProgress(sessionData.duracao_base, 0, 1);
                   startSq3rRecite();
                });
            } else { // Feynman
                showInfoModal("Sessão Finalizada!", "Bom trabalho! Agora vamos fortalecer seu aprendizado.", () => {
                   addProgress(sessionData.duracao_base, sessionData.feynmanCount || 0);
                   startActiveRecall();
                });
            }
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(sessionData.duracao_timer / 60);
    const seconds = sessionData.duracao_timer % 60;
    DOM.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startPomodoroCycle() {
    const { pomodoro } = sessionData;
    DOM.pomodoroInfo.classList.remove('hidden');
    if (pomodoro.isFocus) {
        DOM.timerStatus.textContent = "Foco";
        DOM.cycleCounter.textContent = `Ciclo: ${pomodoro.currentCycle}/${pomodoro.totalCycles}`;
        sessionData.duracao_base = 25;
        sessionData.duracao_timer = 5;//1500
    } else {
        DOM.timerStatus.textContent = "Pausa";
        DOM.cycleCounter.textContent = `Descanse...`;
        const isLongBreak = pomodoro.currentCycle % 4 === 0 && pomodoro.currentCycle < pomodoro.totalCycles;
        sessionData.duracao_base = isLongBreak ? 15 : 5;
        sessionData.duracao_timer = isLongBreak ? 900 : 300;
    }
    startTimer();
}

function handlePomodoroTransition() {
    const { pomodoro } = sessionData;
    notificationSound.play().catch(e => console.error("Erro ao tocar som:", e));

    if (pomodoro.isFocus) {
        pomodoro.totalFocusMinutes += sessionData.duracao_base;
        userData.pomodoroCyclesCompleted++;
        updateMissionProgress('pomodoroCycles', 1);

        if (pomodoro.currentCycle >= pomodoro.totalCycles) {
            showInfoModal("Parabéns!", "Você concluiu todos os seus ciclos Pomodoro.", () => {
                addProgress(pomodoro.totalFocusMinutes);
                startActiveRecall();
            });
        } else {
            pomodoro.isFocus = false;
            showInfoModal("Seu tempo acabou, descanse um pouco!", "O período de foco terminou. Hora da pausa.", startPomodoroCycle);
        }
    } else {
        showInfoModal("Fim da Pausa", "Descanso finalizado, volte ao foco!", () => {
            pomodoro.currentCycle++;
            pomodoro.isFocus = true;
            startPomodoroCycle();
        });
    }
}

function startElaborationSession() {
    sessionData.currentElaborationIndex = 0;
    sessionData.elaborationAnswers = {};
    displayElaborationPrompt();
    showScreen('elaboration');
}

function displayElaborationPrompt() {
    const elaborationIndex = sessionData.currentElaborationIndex;
    const prompt = elaborationPrompts[elaborationIndex];
    
    DOM.elaborationPromptDisplay.textContent = prompt.question;
    DOM.elaborationAnswerInput.value = '';
    DOM.elaborationProgress.textContent = `Passo ${elaborationIndex + 1} de ${elaborationPrompts.length}`;

    if (elaborationIndex >= elaborationPrompts.length - 1) {
        DOM.elaborationNextBtn.textContent = 'Finalizar Sessão';
    } else {
        DOM.elaborationNextBtn.textContent = 'Próximo';
    }
}

function startActiveRecall() { showScreen('promptCategory'); }

function generatePrompt(category) {
    const prompts = activeRecallPrompts[category];
    sessionData.prompt_question = prompts[Math.floor(Math.random() * prompts.length)];
    document.getElementById('prompt-question-display').textContent = sessionData.prompt_question;
    showScreen('promptResponse');
}

function setupConsolidation() {
    const question = sessionData.tecnica_escolhida === 'Pomodoro' ? 'Você concluiu seus ciclos. Anote seu progresso geral.' : 'Explique o conceito que você estudou com palavras simples.';
    document.getElementById('consolidation-question').textContent = question;
    DOM.pomodoroInfo.classList.add('hidden');
    showScreen('consolidation');
}

function startSq3rSurvey() {
    sessionData.tecnica_escolhida = 'Leitura Ativa (SQ3R)';
    sessionData.duracao_base = 30; // 30 min para a fase de leitura
    sessionData.duracao_timer = 1800;
    showScreen('sq3rSurvey');
}

function startSq3rQuestion() {
    showScreen('sq3rQuestion');
}

function startSq3rRead() {
    sessionData.sq3rQuestions = Array.from(document.querySelectorAll('.sq3r-question-input'))
        .map(input => input.value.trim())
        .filter(q => q !== '');
    
    if (sessionData.sq3rQuestions.length === 0) {
        showToast("Por favor, adicione pelo menos uma pergunta-chave.");
        return;
    }
    
    startTimer();
}

function startSq3rRecite() {
    DOM.sq3rReciteContainer.innerHTML = '';
    sessionData.sq3rQuestions.forEach((question, index) => {
        const questionBlock = `
            <div class="mb-4">
                <label for="recite-answer-${index}" class="block font-semibold text-slate-700 dark:text-slate-200 mb-2">${index + 1}. ${question}</label>
                <textarea id="recite-answer-${index}" rows="3" class="w-full p-3 bg-transparent border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:focus:border-sky-500" placeholder="Sua resposta..."></textarea>
            </div>
        `;
        DOM.sq3rReciteContainer.innerHTML += questionBlock;
    });
    showScreen('sq3rRecite');
}

function finishSq3rSession() {
    sessionData.sq3rAnswers = Array.from(document.querySelectorAll('#sq3r-recite-container textarea'))
        .map(textarea => textarea.value.trim());
    displayResult();
}


// IX. LÓGICA DE FLASHCARDS
// =================================================================================

function displayReviewCard() {
    DOM.flashcardContainer.classList.remove('flipped');
    DOM.reviewRatings.classList.add('hidden');
    DOM.reviewActions.classList.remove('hidden');
    const card = reviewSession[currentReviewIndex];
    DOM.flashcardFront.textContent = card.front;
    DOM.flashcardBack.textContent = card.back;
    DOM.reviewProgress.textContent = `${currentReviewIndex + 1} / ${reviewSession.length}`;
}

function updateFlashcardReview(card, rating) {
    if (rating === 'again') { card.interval = 1; } 
    else {
        if (rating === 'easy') { card.easeFactor = Math.max(1.3, card.easeFactor + 0.15); }
        card.interval = Math.ceil(card.interval * card.easeFactor);
    }
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + card.interval);
    card.nextReviewDate = nextReview.toISOString().split('T')[0];
    saveData();
}


// X. EVENT LISTENERS
// =================================================================================

// Navegação Principal e Modais
DOM.startBtn.addEventListener('click', () => showScreen('intention'));
DOM.backToStartBtn.addEventListener('click', () => { showScreen('welcome'); renderDashboard(); });
DOM.unlocksBtn.addEventListener('click', () => {
    populateUnlocksModal();
    showModal(DOM.unlocksModal);
});
DOM.unlocksCloseBtn.addEventListener('click', () => hideModal(DOM.unlocksModal));
DOM.unlocksModal.addEventListener('click', (e) => {
    const buyBtn = e.target.closest('.buy-btn');
    if(buyBtn) tryUnlockItem(buyBtn.dataset.type, buyBtn.dataset.key);
});
DOM.changeMuralThemeBtn.addEventListener('click', () => {
    populateMuralThemeModal();
    showModal(DOM.muralThemeModal);
});
DOM.muralThemeCloseBtn.addEventListener('click', () => hideModal(DOM.muralThemeModal));

// Fluxo da Sessão de Estudo
DOM.intentionInput.addEventListener('input', () => { DOM.intentionNextBtn.disabled = DOM.intentionInput.value.trim() === ''; });
DOM.intentionNextBtn.addEventListener('click', () => {
    sessionData.meta_sessao = DOM.intentionInput.value.trim();
    showScreen('technique');
});
DOM.intentionBackBtn.addEventListener('click', () => {
    showScreen('welcome');
    renderDashboard();
});

DOM.techniqueConnectionsBtn.addEventListener('click', () => {
    sessionData.tecnica_escolhida = 'Conexões Profundas';
    sessionData.duracao_base = 30;
    sessionData.duracao_timer = 1800;
    sessionData.feynmanCount = 0;
    startTimer();
});
DOM.techniqueFeynmanBtn.addEventListener('click', () => {
    sessionData.tecnica_escolhida = 'Feynman';
    sessionData.duracao_base = 45;
    sessionData.duracao_timer = 2700;
    sessionData.feynmanCount = 1;
    startTimer();
});
DOM.techniqueSq3rBtn.addEventListener('click', startSq3rSurvey);

// Fluxo SQ3R
DOM.sq3rSurveyNextBtn.addEventListener('click', startSq3rQuestion);
DOM.sq3rQuestionInputs.addEventListener('input', () => {
    const questions = Array.from(document.querySelectorAll('.sq3r-question-input')).map(i => i.value.trim());
    DOM.sq3rQuestionNextBtn.disabled = questions.every(q => q === '');
});
DOM.sq3rAddQuestionBtn.addEventListener('click', () => {
    if (DOM.sq3rQuestionInputs.children.length < 5) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'sq3r-question-input w-full p-3 bg-transparent border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:focus:border-sky-500 fade-in';
        input.placeholder = `Pergunta ${DOM.sq3rQuestionInputs.children.length + 1}...`;
        DOM.sq3rQuestionInputs.appendChild(input);
    } else {
        showToast("Máximo de 5 perguntas atingido.");
    }
});
DOM.sq3rQuestionNextBtn.addEventListener('click', startSq3rRead);
DOM.sq3rReciteNextBtn.addEventListener('click', finishSq3rSession);


// Lógica Pomodoro
DOM.techniquePomodoroBtn.addEventListener('click', () => showModal(DOM.pomodoroModal));
DOM.cyclesCancelBtn.addEventListener('click', () => hideModal(DOM.pomodoroModal));
DOM.cyclesStartBtn.addEventListener('click', (e) => {
    const totalCycles = parseInt(e.target.dataset.selectedCycles);
    if (!totalCycles) return;
    hideModal(DOM.pomodoroModal);
    sessionData.tecnica_escolhida = 'Pomodoro';
    sessionData.pomodoro = { totalCycles, currentCycle: 1, isFocus: true, totalFocusMinutes: 0 };
    startPomodoroCycle();
});
DOM.cycleOptionsContainer.addEventListener('click', (e) => {
    const cycleButton = e.target.closest('button');
    if (cycleButton && cycleButton.dataset.cycles) {
        document.querySelectorAll('#cycle-options button').forEach(b => b.classList.remove('bg-sky-500', 'text-white', 'border-sky-500'));
        cycleButton.classList.add('bg-sky-500', 'text-white', 'border-sky-500');
        DOM.cyclesStartBtn.disabled = false;
        DOM.cyclesStartBtn.dataset.selectedCycles = cycleButton.dataset.cycles;
    }
});

// Tela do Timer
DOM.pauseBtn.addEventListener('click', () => {
    isTimerPaused = !isTimerPaused;
    if (isTimerPaused) {
        clearInterval(timerInterval);
        if(currentSound) ambientPlayer.pause();
        DOM.pauseBtn.innerHTML = icons.play;
    } else {
        if (currentSound) ambientPlayer.play();
        DOM.pauseBtn.innerHTML = icons.pause;
        runTimer();
    }
});

DOM.soundButtonsContainer.addEventListener('click', (e) => {
    const button = e.target.closest('.sound-btn');
    if (!button || button.disabled) return;
    
    const soundName = button.dataset.sound;
    const soundSrc = {
        rain: 'https://www.soundjay.com/nature/sounds/rain-02.mp3',
        wind: 'https://www.soundjay.com/nature/sounds/windy-forest-ambience-01.mp3',
        coffee: 'https://www.soundjay.com/ambient/sounds/food-court-1.mp3',
    };
    
    const isPlayingThisSound = currentSound === soundSrc[soundName] && !ambientPlayer.paused;
    document.querySelectorAll('.sound-btn').forEach(btn => btn.classList.remove('bg-slate-300', 'dark:bg-slate-600'));
    ambientPlayer.pause();

    if (isPlayingThisSound) { 
        currentSound = null; 
    } else {
        updateMissionProgress('soundUsed', 1);
        ambientPlayer.src = soundSrc[soundName];
        ambientPlayer.loop = true;
        ambientPlayer.play().then(() => {
            currentSound = soundSrc[soundName];
            button.classList.add('bg-slate-300', 'dark:bg-slate-600');
        }).catch(error => console.error("Erro ao tocar áudio:", error));
    }
});

DOM.themeSwitch.addEventListener('change', (e) => {
    document.documentElement.classList.toggle('dark', e.target.checked);
});

// Fluxo de Elaboração e Consolidação
DOM.elaborationNextBtn.addEventListener('click', () => {
    const elaborationIndex = sessionData.currentElaborationIndex;
    const promptId = elaborationPrompts[elaborationIndex].id;
    const answer = DOM.elaborationAnswerInput.value.trim() || "Nenhuma reflexão adicionada.";
    
    sessionData.elaborationAnswers[promptId] = answer;

    if (elaborationIndex >= elaborationPrompts.length - 1) {
        displayResult();
    } else {
        sessionData.currentElaborationIndex++;
        displayElaborationPrompt();
    }
});

document.querySelectorAll('.prompt-category-btn').forEach(btn => btn.addEventListener('click', (e) => {
    const category = e.currentTarget.dataset.category;
    sessionData.prompt_category = category;
    generatePrompt(category);
}));
document.getElementById('regenerate-prompt-btn').addEventListener('click', () => generatePrompt(sessionData.prompt_category));
document.getElementById('prompt-continue-btn').addEventListener('click', () => {
    sessionData.prompt_answer = document.getElementById('prompt-answer-input').value.trim() || "Nenhuma resposta fornecida.";
    setupConsolidation();
});
document.getElementById('consolidation-finish-btn').addEventListener('click', () => {
    sessionData.resumo_sessao = document.getElementById('consolidation-input').value.trim() || "Nenhuma reflexão adicionada.";
    displayResult();
});

// Tela de Resultados
DOM.downloadCardBtn.addEventListener('click', () => {
   const card = DOM.knowledgeCard;
    let bgColor = '#FFFFFF';
    if (card.classList.contains('theme-dark')) { bgColor = '#1E293B'; } 
    else if (card.classList.contains('theme-nature')) { bgColor = '#F0FFF4'; }
    else if (card.classList.contains('theme-ocean')) { bgColor = '#E0F7FA'; }
    else if (card.classList.contains('theme-space')) { bgColor = '#1A202C'; }
    else if (card.classList.contains('theme-retro')) { bgColor = '#FDF6E3'; }
    html2canvas(card, { scale: 2, backgroundColor: bgColor }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'dolt-card-de-foco.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
});
DOM.createFlashcardBtn.addEventListener('click', () => {
    DOM.flashcardDeckInput.value = sessionData.meta_sessao || '';
    DOM.flashcardFrontInput.value = ''; 
    DOM.flashcardBackInput.value = '';
    showModal(DOM.flashcardModal);
});

// Lógica de Flashcards
DOM.flashcardModalCloseBtn.addEventListener('click', () => hideModal(DOM.flashcardModal));
DOM.flashcardSaveBtn.addEventListener('click', () => {
    const deck = DOM.flashcardDeckInput.value.trim(), 
          front = DOM.flashcardFrontInput.value.trim(), 
          back = DOM.flashcardBackInput.value.trim();

    if (!deck || !front || !back) { showToast("Preencha todos os campos do flashcard!"); return; }
    const today = new Date().toISOString().split('T')[0];
    userData.flashcards.push({ id: Date.now(), deck, front, back, nextReviewDate: today, interval: 1, easeFactor: 2.5 });
    updateMissionProgress('flashcardsCreated', 1);
    saveData();
    showToast("Flashcard salvo com sucesso!");
    DOM.flashcardFrontInput.value = ''; 
    DOM.flashcardBackInput.value = ''; 
    DOM.flashcardFrontInput.focus();
});
DOM.reviewFlashcardsBtn.addEventListener('click', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    reviewSession = userData.flashcards.filter(card => card.nextReviewDate <= todayStr);
    if (reviewSession.length > 0) {
        currentReviewIndex = 0;
        displayReviewCard();
        showScreen('review');
    } else { showToast("Nenhum card para revisar hoje!"); }
});
DOM.showAnswerBtn.addEventListener('click', () => {
    DOM.flashcardContainer.classList.add('flipped');
    DOM.reviewRatings.classList.remove('hidden');
    DOM.reviewActions.classList.add('hidden');
});
document.querySelectorAll('.review-rating-btn').forEach(btn => btn.addEventListener('click', (e) => {
    updateFlashcardReview(reviewSession[currentReviewIndex], e.target.dataset.rating);
    updateMissionProgress('flashcardsReviewed', 1);
    currentReviewIndex++;
    if (currentReviewIndex < reviewSession.length) { 
        setTimeout(displayReviewCard, 400); 
    } else { 
        showInfoModal("Revisão Concluída!", "Você revisou todos os cards de hoje.", () => { 
            showScreen('welcome'); 
            renderDashboard(); 
        }); 
    }
}));
DOM.reviewFinishBtn.addEventListener('click', () => { showScreen('welcome'); renderDashboard(); });

// NOVA LÓGICA DE COMPARTILHAMENTO
function setupAndShowShareModal() {
    const shareText = `Acabei de completar uma sessão de estudos sobre "${sessionData.meta_sessao}" usando a técnica ${sessionData.tecnica_escolhida} com o app Dolt! #estudos #foco #produtividade`;
    const encodedText = encodeURIComponent(shareText);
    const appUrl = encodeURIComponent(window.location.href);

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    DOM.shareTwitterBtn.href = twitterUrl;

    const linkedInUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${appUrl}&title=${encodeURIComponent('Sessão de Estudos Concluída!')}&summary=${encodedText}`;
    DOM.shareLinkedInBtn.href = linkedInUrl;

    showModal(DOM.shareModal);
}

DOM.shareCardBtn.addEventListener('click', setupAndShowShareModal);
DOM.shareModalCloseBtn.addEventListener('click', () => hideModal(DOM.shareModal));
DOM.shareDownloadCardBtn.addEventListener('click', () => {
    DOM.downloadCardBtn.click();
});

DOM.activatePremiumBtn.addEventListener('click', () => showModal(DOM.activationModal));
DOM.activationModalCloseBtn.addEventListener('click', () => hideModal(DOM.activationModal));
DOM.activateKeyBtn.addEventListener('click', handleActivatePremium);


// XI. INICIALIZAÇÃO
// =================================================================================

// Preenche as opções de ciclo Pomodoro dinamicamente
for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.className = 'w-12 h-12 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center font-bold text-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors';
    btn.innerText = i;
    btn.dataset.cycles = i;
    DOM.cycleOptionsContainer.appendChild(btn);
}

// Carrega os dados do usuário quando a página é carregada
window.onload = loadData;


