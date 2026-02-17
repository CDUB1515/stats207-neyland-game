// Stats 207 Neyland Football Quiz Game (UT vs Alabama theme)
// Requirements kept:
// - Every 5 correct answers triggers a scoring event.
// - Until UT reaches 49: scoring event = TD+XP (7) and say "INTO THE CHECKERBOARD!"
// - After UT reaches 49: next scoring event = FG (3) to end 52–49
// - TD triggers stiff-arm cutscene; Win triggers storm + goalposts down
//
// Football realism upgrades:
// - 4 downs, 10 yards to gain
// - Correct answers gain yards; wrong answers lose yards and consume a down
// - Turnover on downs on 4th down failure
// - Punt option (strategic), FG option when in range (but only counts as FINAL 3 after 49)
// - Drive starts on UT 25, aim for checkerboard (goal line at 100)

const UT_TARGET = 52;
const BAMA_SCORE = 49;
const CORRECTS_PER_SCORE = 5;

// Football field model: 0 = own goal line, 100 = opponent goal line
const DRIVE_START = 25;
const FIRST_DOWN_YARDS = 10;

const state = {
  utScore: 0,
  bamaScore: BAMA_SCORE,

  // quiz scoring progress
  correctTowardScore: 0,
  totalCorrect: 0,

  // football drive state
  ballOn: DRIVE_START,           // 0..100 (UT -> Bama end)
  down: 1,                       // 1..4
  toGo: FIRST_DOWN_YARDS,         // yards to first down
  quarter: 1,
  clockSec: 15 * 60,             // fake clock for vibe

  // question state
  questionIndex: 0,
  usedIds: new Set(),
  locked: false,
  gameOver: false,
};

const el = {
  utScore: document.getElementById("utScore"),
  bamaScore: document.getElementById("bamaScore"),

  meterbar: document.getElementById("meterbar"),
  streakText: document.getElementById("streakText"),

  driveBar: document.getElementById("driveBar"),
  downDist: document.getElementById("downDist"),
  clockLine: document.getElementById("clockLine"),
  driveText: document.getElementById("driveText"),

  qTopic: document.getElementById("qTopic"),
  qNumber: document.getElementById("qNumber"),
  questionText: document.getElementById("questionText"),
  answers: document.getElementById("answers"),
  log: document.getElementById("log"),

  skipBtn: document.getElementById("skipBtn"),
  resetBtn: document.getElementById("resetBtn"),

  sprites: document.getElementById("sprites"),
  sceneTitle: document.getElementById("sceneTitle"),
  sceneCaption: document.getElementById("sceneCaption"),

  goalposts: document.getElementById("goalposts"),
  storm: document.getElementById("storm"),
};

// --- Question bank (keep yours; add more anytime) ---
const QUESTIONS = [
  // Two-way tables
  { id:"twoway_1", topic:"Two-Way Tables",
    q:"Promotions table:\nUp to 39: Promoted 24, Not 76 (Total 100)\n40+: Promoted 36, Not 64 (Total 100)\nOverall 200.\nWhat percent of ALL employees were promoted?",
    choices:["12%","24%","30%","60%"], answer:2,
    explain:"Total promoted=60. 60/200=30%." },
  { id:"twoway_2", topic:"Conditional Percent",
    q:"Using the same table, what percent of PROMOTED employees were 40 and over?",
    choices:["40%","50%","60%","75%"], answer:2,
    explain:"36/60=60%." },

  // Mean/median/IQR
  { id:"center_1", topic:"Mean",
    q:"Data: 10, 12, 14, 9, 15, 11, 13, 16. What is the mean?",
    choices:["12.5","12.0","13.0","11.5"], answer:0,
    explain:"Sum=100. 100/8=12.5." },
  { id:"center_2", topic:"Median",
    q:"Data: 63, 68, 71, 71, 75, 80, 81. What is the median?",
    choices:["71","72","75","74"], answer:0,
    explain:"7 values → 4th value is 71." },
  { id:"spread_1", topic:"IQR",
    q:"Q1 = 18 and Q3 = 31. IQR = ?",
    choices:["13","49","18","31"], answer:0,
    explain:"31−18=13." },

  // Z scores / normal
  { id:"z_1", topic:"Z-Score",
    q:"Normal mean 6.0, SD 1.5. Value 8.4. z = ?",
    choices:["1.60","1.40","−1.60","−1.40"], answer:0,
    explain:"(8.4−6)/1.5=1.6." },
  { id:"z_2", topic:"Z Interpretation",
    q:"If z = 1.60, best interpretation is:",
    choices:[
      "1.60 minutes above mean",
      "1.60 standard deviations above mean",
      "60% wait longer",
      "1.60 SD below mean"
    ],
    answer:1,
    explain:"z is measured in SD units from the mean." },

  // Correlation/outliers
  { id:"corr_1", topic:"Correlation",
    q:"Before computing correlation r, the correct conditions are:",
    choices:[
      "Two quantitative; straight enough; no strong outliers",
      "Two categorical; random; large n",
      "Normal; equal variances; independent samples",
      "One categorical + one quantitative; straight enough"
    ],
    answer:0,
    explain:"Correlation needs 2 quantitative variables + roughly linear + no outliers." },
  { id:"corr_2", topic:"Outliers & r",
    q:"Adding an outlier to a scatterplot can:",
    choices:[
      "Only increase r",
      "Only decrease r",
      "Only flip sign",
      "Cause any of these depending on location"
    ],
    answer:3,
    explain:"Outliers can change r in multiple ways." },

  // Variable types
  { id:"type_1", topic:"Variable Types",
    q:"Which is an identifier variable (I)?",
    choices:["Number of gallons","Day of week","Transaction number","Type of gas"],
    answer:2,
    explain:"Transaction number is a label." },
];

// Shuffle deck
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
let deck = shuffle(QUESTIONS);

// --- helpers ---
function ordinalDown(d){
  return d===1?"1st":d===2?"2nd":d===3?"3rd":"4th";
}
function clamp(x,min,max){ return Math.max(min, Math.min(max,x)); }

function formatBallOn(y){
  // show as UT xx until midfield; then "BAMA xx"
  if (y < 50) return `UT ${y}`;
  if (y === 50) return `50`;
  return `BAMA ${100 - y}`;
}

function tickClock(playType="play"){
  // purely for vibe: each play burns 20–35 seconds
  const burn = playType==="punt" ? 40 : playType==="fg" ? 25 : 25 + Math.floor(Math.random()*11);
  state.clockSec = Math.max(0, state.clockSec - burn);
  if (state.clockSec === 0){
    state.quarter = Math.min(4, state.quarter + 1);
    state.clockSec = 15 * 60;
  }
}

function updateUI(){
  el.utScore.textContent = state.utScore;
  el.bamaScore.textContent = state.bamaScore;

  // score streak meter (5 correct = score event)
  el.meterbar.style.width = `${(state.correctTowardScore / CORRECTS_PER_SCORE) * 100}%`;
  el.streakText.textContent = `${state.correctTowardScore} / ${CORRECTS_PER_SCORE} correct`;

  // drive progress bar: 0..100 to endzone
  el.driveBar.style.width = `${clamp(state.ballOn,0,100)}%`;

  el.downDist.textContent = `${ordinalDown(state.down)} & ${state.toGo} • Ball on ${formatBallOn(state.ballOn)}`;

  const mm = String(Math.floor(state.clockSec/60)).padStart(2,"0");
  const ss = String(state.clockSec%60).padStart(2,"0");
  el.clockLine.textContent = `Q${state.quarter} ${mm}:${ss} • Crowd: checked-out (for now)`;

  el.skipBtn.disabled = state.gameOver;
}

function logMsg(msg, kind="info"){
  const color = kind==="good" ? "var(--good)" : kind==="bad" ? "var(--bad)" : "var(--muted)";
  el.log.innerHTML = `<span style="color:${color};font-weight:800">${msg}</span>`;
}

function lockAnswers(lock){
  state.locked = lock;
  [...el.answers.querySelectorAll("button")].forEach(b => b.disabled = lock);
}

function resetSpritePositions(){
  const hy = document.getElementById("hyatt");
  const sa = document.getElementById("saban");
  if(hy) hy.style.transform = "";
  if(sa) sa.style.transform = "";
  const arm = hy?.querySelector(".arm");
  if(arm) arm.style.transform = "";
}

function playScoreCutscene(points){
  el.sprites.classList.remove("play-td");
  void el.sprites.offsetWidth;
  el.sprites.classList.add("play-td");

  if(points===7){
    el.sceneTitle.textContent = "TOUCHDOWN VOLS!";
    el.sceneCaption.textContent = "Hyatt stiff-arms (cartoon) — and Tennessee cashes in.";
  } else {
    el.sceneTitle.textContent = "FIELD GOAL IS GOOD!";
    el.sceneCaption.textContent = "Three points. Enough to seal 52–49.";
  }
}

function endGameWin(){
  state.gameOver = true;
  lockAnswers(true);

  el.driveText.textContent = "FINAL: TENNESSEE 52 — ALABAMA 49. Neyland erupts.";
  el.sceneTitle.textContent = "VOLS WIN! FIELD STORM!";
  el.sceneCaption.textContent = "The fans pour in… and the goalposts are coming down!";

  el.storm.classList.add("storming");
  el.goalposts.classList.add("posts-down");
  logMsg("FINAL SCORE: 52–49. GO VOLS. 🟧⬜", "good");
  updateUI();
}

// --- Football drive logic ---
function resetDrive(why="New drive"){
  state.ballOn = DRIVE_START;
  state.down = 1;
  state.toGo = FIRST_DOWN_YARDS;
  el.driveText.textContent = `${why}. Ball on UT 25. Let’s march.`;
}

function gainYards(yards){
  state.ballOn = clamp(state.ballOn + yards, 0, 100);
  state.toGo = Math.max(0, state.toGo - yards);

  if(state.ballOn >= 100){
    // Reached end zone — BUT we only award points via the 5-correct scoring rule.
    // So treat this as "goal-line achieved" flavor, keep playing until score event triggers.
    state.ballOn = 100;
  }

  if(state.toGo === 0){
    // first down!
    state.down = 1;
    state.toGo = FIRST_DOWN_YARDS;
    el.driveText.textContent = `FIRST DOWN! Ball on ${formatBallOn(state.ballOn)}. Keep it rolling.`;
  }
}

function loseYards(yards){
  state.ballOn = clamp(state.ballOn - yards, 0, 100);
  state.toGo += yards; // makes it harder
}

function nextDown(){
  state.down += 1;
  if(state.down >= 5){
    turnoverOnDowns();
  } else {
    el.driveText.textContent = `${ordinalDown(state.down)} down. Need ${state.toGo} yards.`;
  }
}

function turnoverOnDowns(){
  tickClock("turnover");
  el.driveText.textContent = "Turnover on downs. Defense holds. New drive starts.";
  logMsg("Turnover on downs. Resetting drive to UT 25.", "bad");
  resetDrive("Turnover on downs");
}

function puntBall(){
  // Punt flips field position; simple model
  tickClock("punt");
  const net = 40 + Math.floor(Math.random()*16); // 40–55
  state.ballOn = clamp(state.ballOn - net, 5, 60); // keep it reasonable
  state.down = 1;
  state.toGo = FIRST_DOWN_YARDS;
  el.driveText.textContent = `PUNT. Net ${net} yards. New drive starts (field flips).`;
  logMsg(`Punt net ${net}. New drive.`, "info");
}

function inFieldGoalRange(){
  // simple: if ballOn >= 65 (i.e., opponent 35 or closer)
  return state.ballOn >= 65;
}

// Scoring events (still strictly 5 correct per score)
function scoreEvent(){
  let points = 0;

  if(state.utScore < 49){
    points = 7;
    state.utScore += 7;
    logMsg("INTO THE CHECKERBOARD! (+7)", "good");
    playScoreCutscene(7);
    resetDrive("Touchdown drive");
  } else if(state.utScore === 49){
    // final FG to 52
    points = 3;
    state.utScore += 3;
    logMsg("FIELD GOAL… AND IT’S GOOD! (+3) INTO THE CHECKERBOARD!", "good");
    playScoreCutscene(3);
    resetDrive("Championship kick");
  }

  state.correctTowardScore = 0;
  updateUI();

  if(state.utScore >= UT_TARGET){
    endGameWin();
  }
}

// --- Question flow ---
function drawQuestion(){
  if(state.gameOver) return;
  if(deck.length === 0) deck = shuffle(QUESTIONS);

  let q = deck.pop();
  let tries = 0;
  while(state.usedIds.has(q.id) && tries < 8){
    if(deck.length === 0) deck = shuffle(QUESTIONS);
    q = deck.pop();
    tries++;
  }
  state.usedIds.add(q.id);

  state.questionIndex += 1;
  el.qTopic.textContent = q.topic;
  el.qNumber.textContent = `Play ${state.questionIndex}`;
  el.questionText.textContent = q.q;

  el.answers.innerHTML = "";
  q.choices.forEach((choice, idx) => {
    const btn = document.createElement("button");
    btn.className = "answer";
    btn.type = "button";
    btn.textContent = choice;
    btn.addEventListener("click", () => handleAnswer(q, idx, btn));
    el.answers.appendChild(btn);
  });

  el.sprites.classList.remove("play-td");
  resetSpritePositions();
  updateUI();
  logMsg("Run a play — pick an answer.", "info");
}

function yardsForCorrect(topic){
  // “Arcade” feel: 6–18 yards with occasional big plays
  const base = 8 + Math.floor(Math.random()*7); // 8–14
  const bonus = (topic.includes("Z") || topic.includes("Correlation") || topic.includes("Two-Way")) ? 2 : 0;
  const boom = (Math.random() < 0.12) ? 10 : 0; // 12% explosive play
  return base + bonus + boom; // up to ~26
}
function yardsForWrong(){
  return 3 + Math.floor(Math.random()*6); // 3–8 yard loss/sack
}

function handleAnswer(q, idx, btn){
  if(state.locked || state.gameOver) return;
  lockAnswers(true);

  const buttons = [...el.answers.querySelectorAll("button")];
  const correctBtn = buttons[q.answer];

  const isCorrect = idx === q.answer;

  if(isCorrect){
    btn.classList.add("correct");
    state.correctTowardScore += 1;
    state.totalCorrect += 1;

    const gain = yardsForCorrect(q.topic);
    gainYards(gain);
    tickClock("play");

    el.driveText.textContent = `✅ ${gain} yards! ${q.explain}`;
    logMsg(`Gain ${gain}. ${ordinalDown(state.down)} & ${state.toGo} on ${formatBallOn(state.ballOn)}.`, "good");
  } else {
    btn.classList.add("wrong");
    correctBtn.classList.add("correct");

    const loss = yardsForWrong();
    loseYards(loss);
    tickClock("play");

    // consume a down on wrong
    nextDown();

    el.driveText.textContent = `❌ Sack/penalty: −${loss} yards. ${q.explain}`;
    logMsg(`Loss ${loss}. Now ${ordinalDown(state.down)} & ${state.toGo}.`, "bad");
  }

  updateUI();

  setTimeout(() => {
    // If hit 5 correct, score event triggers no matter what yardline (but it *feels* like a drive)
    if(state.correctTowardScore >= CORRECTS_PER_SCORE){
      scoreEvent();
      setTimeout(() => {
        lockAnswers(false);
        drawQuestion();
      }, 900);
      return;
    }

    // Optional “strategy” auto prompts on 4th down
    if(!state.gameOver && state.down === 4){
      // If in FG range AND this would be the FINAL FG (only after 49), we encourage it via correct answers anyway.
      // But we can still let user choose to punt/reset for realism.
      el.driveText.textContent += " 4th down… (Tip: skip = no play; or reset if you want a fresh drive).";
    }

    lockAnswers(false);
    drawQuestion();
  }, 850);
}

// Buttons
el.skipBtn.addEventListener("click", () => {
  if(state.gameOver) return;
  tickClock("play");
  logMsg("Skipped play (no yards, no down).", "info");
  drawQuestion();
});

el.resetBtn.addEventListener("click", () => resetGame());

function resetGame(){
  state.utScore = 0;
  state.correctTowardScore = 0;
  state.totalCorrect = 0;
  state.questionIndex = 0;
  state.usedIds = new Set();
  state.locked = false;
  state.gameOver = false;

  state.ballOn = DRIVE_START;
  state.down = 1;
  state.toGo = FIRST_DOWN_YARDS;
  state.quarter = 1;
  state.clockSec = 15*60;

  deck = shuffle(QUESTIONS);

  el.goalposts.classList.remove("posts-down");
  el.storm.classList.remove("storming");
  el.sprites.classList.remove("play-td");
  resetSpritePositions();

  el.sceneTitle.textContent = "—";
  el.sceneCaption.textContent = "";
  el.driveText.textContent = "Ball on UT 25. Start the drive.";
  logMsg("Reset. New drive.", "info");

  updateUI();
  drawQuestion();
}

// init
updateUI();
drawQuestion();
