const state = {
  data: null,
  topic: null,
  game: null,
  teams: [],
  round: 0,
  selectedTeams: new Set(),
  revealed: false,
  boardsRaised: false,
  timerId: null,
  seconds: 30
};

const $ = (selector) => document.querySelector(selector);
const els = {
  setupScreen: $('#setupScreen'), gameScreen: $('#gameScreen'), setupForm: $('#setupForm'),
  topicSelect: $('#topicSelect'), topicDescription: $('#topicDescription'),
  variantSelect: $('#variantSelect'), variantDescription: $('#variantDescription'), teamInputs: $('#teamInputs'),
  addTeamBtn: $('#addTeamBtn'), topicLabel: $('#topicLabel'), sceneLabel: $('#sceneLabel'),
  roundNumber: $('#roundNumber'), pointValue: $('#pointValue'), progressBar: $('#progressBar'),
  contextBox: $('#contextBox'), speakerBadge: $('#speakerBadge'), promptText: $('#promptText'),
  promptEnglish: $('#promptEnglish'), optionsGrid: $('#optionsGrid'), revealPanel: $('#revealPanel'),
  correctAnswer: $('#correctAnswer'), explanationText: $('#explanationText'), timer: $('#timer'),
  timerValue: $('#timerValue'), timerBtn: $('#timerBtn'), boardsBtn: $('#boardsBtn'), revealBtn: $('#revealBtn'),
  scoreTeams: $('#scoreTeams'), nextBtn: $('#nextBtn'), leaderboardDialog: $('#leaderboardDialog'),
  leaderboardKicker: $('#leaderboardKicker'), leaderboardTitle: $('#leaderboardTitle'),
  leaderboardList: $('#leaderboardList'), continueBtn: $('#continueBtn')
};

async function init() {
  try {
    const [baseResponse, variantsResponse] = await Promise.all([
      fetch('data/conversations.json'),
      fetch('data/variants.json')
    ]);
    if (!baseResponse.ok || !variantsResponse.ok) throw new Error('No se pudo cargar el banco de preguntas.');
    state.data = await baseResponse.json();
    const extraData = await variantsResponse.json();
    state.data.topics.forEach(topic => {
      topic.variants = [{ id: 'A', title: 'Conversación A · Original', description: 'La primera secuencia del tema.', rounds: topic.rounds }];
      extraData.variants.filter(variant => variant.topicId === topic.id).forEach(variant => topic.variants.push(variant));
    });
    state.data.topics.forEach(topic => {
      const option = document.createElement('option');
      option.value = topic.id;
      option.textContent = topic.title;
      els.topicSelect.append(option);
    });
    updateTopicDescription();
    for (let i = 1; i <= 6; i += 1) addTeamInput(`Equipo ${i}`);
  } catch (error) {
    els.setupScreen.innerHTML = `<div class="setup-panel"><h1>No se pudo abrir el juego</h1><p>${error.message}</p><p>Ábrelo desde GitHub Pages para que pueda leer el archivo de conversaciones.</p></div>`;
  }
}

function addTeamInput(value = '') {
  if (els.teamInputs.children.length >= 8) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 24;
  input.value = value;
  input.placeholder = `Equipo ${els.teamInputs.children.length + 1}`;
  input.setAttribute('aria-label', `Nombre del equipo ${els.teamInputs.children.length + 1}`);
  els.teamInputs.append(input);
}

function updateTopicDescription() {
  const topic = state.data.topics.find(item => item.id === els.topicSelect.value);
  els.topicDescription.textContent = topic.description;
  els.variantSelect.innerHTML = '<option value="random">Aleatoria · Surprise me</option>';
  topic.variants.forEach(variant => {
    const option = document.createElement('option');
    option.value = variant.id;
    option.textContent = variant.title;
    els.variantSelect.append(option);
  });
  updateVariantDescription();
}

function updateVariantDescription() {
  const topic = state.data.topics.find(item => item.id === els.topicSelect.value);
  if (els.variantSelect.value === 'random') {
    els.variantDescription.textContent = 'La web elegirá una conversación sin mostrar la letra. / The game will choose for you.';
    return;
  }
  const variant = topic.variants.find(item => item.id === els.variantSelect.value);
  els.variantDescription.textContent = variant.description;
}

function startGame(event) {
  event.preventDefault();
  const names = [...els.teamInputs.querySelectorAll('input')].map(input => input.value.trim()).filter(Boolean);
  if (names.length < 2) return alert('Introduce al menos dos equipos.');
  state.topic = state.data.topics.find(item => item.id === els.topicSelect.value);
  if (els.variantSelect.value === 'random') {
    state.game = state.topic.variants[Math.floor(Math.random() * state.topic.variants.length)];
  } else {
    state.game = state.topic.variants.find(item => item.id === els.variantSelect.value);
  }
  state.teams = names.map((name, index) => ({ id: index, name, score: 0 }));
  state.round = 0;
  els.setupScreen.hidden = true;
  els.gameScreen.hidden = false;
  renderRound();
}

function currentRound() { return state.game.rounds[state.round]; }
function roundPoints() { return state.round < 10 ? 1 : 2; }

function shuffledOptions(item) {
  const options = item.options.map((text, originalIndex) => ({ text, isCorrect: originalIndex === item.correct }));
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

function renderRound() {
  stopTimer();
  state.seconds = 30;
  state.selectedTeams.clear();
  state.revealed = false;
  state.boardsRaised = false;
  const item = currentRound();
  els.topicLabel.textContent = state.topic.title.toUpperCase();
  els.sceneLabel.textContent = item.scene;
  els.roundNumber.textContent = state.round + 1;
  els.pointValue.textContent = `+${roundPoints()}`;
  els.progressBar.style.width = `${((state.round + 1) / state.game.rounds.length) * 100}%`;
  els.contextBox.innerHTML = `<strong>${item.context.es}</strong><span>${item.context.en}</span>`;
  els.speakerBadge.textContent = item.speaker;
  els.promptText.textContent = item.prompt.es;
  els.promptEnglish.textContent = item.prompt.en;
  state.currentOptions = shuffledOptions(item);
  els.optionsGrid.innerHTML = '';
  state.currentOptions.forEach((option, index) => {
    const card = document.createElement('div');
    card.className = 'option';
    card.dataset.index = index;
    card.innerHTML = `<span class="option-letter">${String.fromCharCode(65 + index)}</span><span class="option-text">${option.text}</span>`;
    els.optionsGrid.append(card);
  });
  els.revealPanel.hidden = true;
  els.correctAnswer.textContent = '';
  els.explanationText.textContent = '';
  els.timerValue.textContent = state.seconds;
  els.timer.classList.remove('warning');
  els.timerBtn.textContent = 'Iniciar tiempo';
  els.boardsBtn.disabled = false;
  els.boardsBtn.textContent = '¡Arriba las respuestas!';
  els.revealBtn.disabled = true;
  els.revealBtn.textContent = 'Revelar respuesta';
  els.nextBtn.disabled = true;
  renderScorePanel();
}

function renderScorePanel() {
  els.scoreTeams.innerHTML = '';
  state.teams.forEach(team => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `team-score${state.selectedTeams.has(team.id) ? ' selected' : ''}`;
    button.disabled = !state.revealed;
    button.innerHTML = `<span><strong>${team.name}</strong><small>${team.score} puntos</small></span><span class="check">✓</span>`;
    button.addEventListener('click', () => toggleTeam(team.id));
    els.scoreTeams.append(button);
  });
}

function toggleTeam(teamId) {
  if (state.selectedTeams.has(teamId)) state.selectedTeams.delete(teamId);
  else state.selectedTeams.add(teamId);
  renderScorePanel();
}

function raiseBoards() {
  if (state.boardsRaised) return;
  stopTimer();
  state.boardsRaised = true;
  els.boardsBtn.disabled = true;
  els.boardsBtn.textContent = 'Respuestas arriba';
  els.revealBtn.disabled = false;
}

function revealAnswer() {
  if (state.revealed || !state.boardsRaised) return;
  stopTimer();
  state.revealed = true;
  const item = currentRound();
  const correctIndex = state.currentOptions.findIndex(option => option.isCorrect);
  const correctCard = els.optionsGrid.children[correctIndex];
  correctCard.classList.add('correct');
  els.correctAnswer.textContent = `${String.fromCharCode(65 + correctIndex)} · ${state.currentOptions[correctIndex].text}`;
  els.explanationText.textContent = item.explanation;
  els.revealPanel.hidden = false;
  els.revealBtn.disabled = true;
  els.revealBtn.textContent = 'Respuesta revelada';
  els.nextBtn.disabled = false;
  renderScorePanel();
}

function awardAndContinue() {
  const points = roundPoints();
  state.teams.forEach(team => { if (state.selectedTeams.has(team.id)) team.score += points; });
  const completedRound = state.round + 1;
  const finished = completedRound === state.game.rounds.length;
  state.round += 1;
  if (completedRound % 5 === 0 || finished) showLeaderboard(finished);
  else renderRound();
}

function showLeaderboard(finished) {
  const sorted = [...state.teams].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  els.leaderboardKicker.textContent = finished ? 'RESULTADO FINAL' : `TRAS LA RONDA ${state.round}`;
  els.leaderboardTitle.textContent = finished ? '¡Tenemos ganador!' : 'Así va la partida';
  els.leaderboardList.innerHTML = sorted.map((team, index) => `
    <div class="leader-row"><span class="leader-rank">${index + 1}</span><span class="leader-name">${team.name}</span><span class="leader-points">${team.score} pt</span></div>
  `).join('');
  els.continueBtn.innerHTML = finished ? 'Nueva partida <span>↻</span>' : 'Continuar <span>→</span>';
  els.continueBtn.dataset.finished = String(finished);
  els.leaderboardDialog.showModal();
}

function continueGame() {
  const finished = els.continueBtn.dataset.finished === 'true';
  els.leaderboardDialog.close();
  if (finished) window.location.reload();
  else renderRound();
}

function toggleTimer() {
  if (state.timerId) { stopTimer(); els.timerBtn.textContent = 'Continuar tiempo'; return; }
  els.timerBtn.textContent = 'Pausar';
  state.timerId = window.setInterval(() => {
    state.seconds -= 1;
    els.timerValue.textContent = state.seconds;
    if (state.seconds <= 10) els.timer.classList.add('warning');
    if (state.seconds <= 0) { stopTimer(); els.timerBtn.textContent = 'Tiempo terminado'; }
  }, 1000);
}

function stopTimer() {
  if (state.timerId) window.clearInterval(state.timerId);
  state.timerId = null;
}

els.topicSelect.addEventListener('change', updateTopicDescription);
els.variantSelect.addEventListener('change', updateVariantDescription);
els.addTeamBtn.addEventListener('click', () => addTeamInput());
els.setupForm.addEventListener('submit', startGame);
els.timerBtn.addEventListener('click', toggleTimer);
els.boardsBtn.addEventListener('click', raiseBoards);
els.revealBtn.addEventListener('click', revealAnswer);
els.nextBtn.addEventListener('click', awardAndContinue);
els.continueBtn.addEventListener('click', continueGame);

init();
