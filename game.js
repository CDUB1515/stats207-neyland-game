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

{ id:"q1", topic:"Mean", q:"Data: 4, 6, 8, 10, 12. What is the mean?", choices:["6","8","9","10"], answer:1, explain:"(4+6+8+10+12)/5 = 8." },

{ id:"q2", topic:"Median", q:"Data: 2, 3, 3, 7, 20. What is the median?", choices:["3","7","5","6"], answer:0, explain:"Middle value is 3." },

{ id:"q3", topic:"Outliers", q:"Adding a very large outlier mostly affects which measure?", choices:["Median","IQR","Mean","Mode"], answer:2, explain:"Mean is sensitive to outliers." },

{ id:"q4", topic:"Skewness", q:"If mean > median, distribution is likely:", choices:["Symmetric","Left-skewed","Right-skewed","Uniform"], answer:2, explain:"Right skew pulls mean upward." },

{ id:"q5", topic:"Symmetry", q:"In a symmetric distribution:", choices:["Mean > Median","Median > Mean","Mean = Median","Mean = 0"], answer:2, explain:"They are equal in symmetry." },

{ id:"q6", topic:"Mean", q:"Data: 5, 6, 7, 8. What is the mean?", choices:["6.5","6","7","5.5"], answer:0, explain:"(5+6+7+8)/4 = 6.5." },

{ id:"q7", topic:"Median", q:"Why is the median resistant?", choices:["Uses all values","Not affected much by outliers","Equals mean","Largest value"], answer:1, explain:"Median is not pulled by extremes." },

{ id:"q8", topic:"Mean", q:"If all values increase by 5, the mean:", choices:["Stays same","Decreases","Increases by 5","Doubles"], answer:2, explain:"Mean shifts by same constant." },

{ id:"q9", topic:"Outliers", q:"If one extreme value increases greatly, the median:", choices:["Changes drastically","Stays mostly same","Doubles","Becomes undefined"], answer:1, explain:"Median resistant to extremes." },

{ id:"q10", topic:"Mode", q:"Mode is:", choices:["Middle value","Average","Most frequent value","Largest value"], answer:2, explain:"Mode = most common value." },

{ id:"q11", topic:"IQR", q:"IQR measures:", choices:["Total range","Spread of middle 50%","Mean difference","Skewness"], answer:1, explain:"IQR = Q3 - Q1." },

{ id:"q12", topic:"IQR", q:"Q1 = 12, Q3 = 25. IQR = ?", choices:["13","37","25","12"], answer:0, explain:"25 − 12 = 13." },

{ id:"q13", topic:"Outliers", q:"Outliers are typically defined using:", choices:["1 SD","2 SD","1.5 × IQR rule","Mean ± IQR"], answer:2, explain:"1.5×IQR rule defines fences." },

{ id:"q14", topic:"Range", q:"Range is:", choices:["Q3 − Q1","Max − Min","Mean difference","Median spread"], answer:1, explain:"Range = max − min." },

{ id:"q15", topic:"Outliers", q:"Data: 2,4,6,8,20. Likely outlier?", choices:["8","6","20","4"], answer:2, explain:"20 is extreme." },

{ id:"q16", topic:"Standard Deviation", q:"Standard deviation measures:", choices:["Skewness","Spread around mean","Middle 50%","Range only"], answer:1, explain:"SD measures spread from mean." },

{ id:"q17", topic:"Skewness", q:"If data are skewed right, best spread measure:", choices:["SD","Variance","IQR","Range"], answer:2, explain:"Use IQR for skewed data." },

{ id:"q18", topic:"Standard Deviation", q:"Large SD means:", choices:["Tight clustering","High variability","Symmetry","Small range"], answer:1, explain:"Large SD = wide spread." },

{ id:"q19", topic:"IQR", q:"Q1 = 10, Q3 = 18. Upper fence = ?", choices:["28","30","30.5","26"], answer:1, explain:"IQR=8; 18 + 1.5(8)=30." },

{ id:"q20", topic:"IQR", q:"IQR is resistant to:", choices:["Outliers","Mean","Sample size","Median"], answer:0, explain:"IQR ignores extremes." },

{ id:"q21", topic:"Skewness", q:"Right skewed distribution has:", choices:["Tail left","Tail right","Symmetry","Uniform shape"], answer:1, explain:"Right skew = long right tail." },

{ id:"q22", topic:"Skewness", q:"Left skewed data typically has:", choices:["Mean < Median","Mean > Median","Equal values","No tail"], answer:0, explain:"Left skew pulls mean down." },

{ id:"q23", topic:"Skewness", q:"Income distributions are usually:", choices:["Symmetric","Left-skewed","Right-skewed","Uniform"], answer:2, explain:"High earners stretch right tail." },

{ id:"q24", topic:"Center", q:"Best center for skewed data:", choices:["Mean","Median","Mode","Range"], answer:1, explain:"Median is resistant." },

{ id:"q25", topic:"Skewness", q:"Skewness affects which most?", choices:["Median","Mean","IQR","Q1"], answer:1, explain:"Mean moves toward tail." },

{ id:"q26", topic:"Types of Data", q:"Type of gas is:", choices:["Quantitative","Categorical","Continuous","Identifier"], answer:1, explain:"Gas type is categorical." },

{ id:"q27", topic:"Types of Data", q:"Number of gallons purchased:", choices:["Categorical","Identifier","Quantitative","Nominal"], answer:2, explain:"Measured numeric value." },

{ id:"q28", topic:"Types of Data", q:"Transaction number is:", choices:["Quantitative","Continuous","Identifier","Ordinal"], answer:2, explain:"Label only." },

{ id:"q29", topic:"Types of Data", q:"Day of week is:", choices:["Quantitative","Categorical","Continuous","Numeric"], answer:1, explain:"Categorical variable." },

{ id:"q30", topic:"Types of Data", q:"Height in inches is:", choices:["Categorical","Quantitative","Identifier","Nominal"], answer:1, explain:"Numeric measurement." },

{ id:"q31", topic:"Types of Data", q:"GPA is:", choices:["Quantitative","Categorical","Identifier","Nominal"], answer:0, explain:"Numeric scale." },

{ id:"q32", topic:"Types of Data", q:"Gender is:", choices:["Quantitative","Categorical","Continuous","Ratio"], answer:1, explain:"Categorical variable." },

{ id:"q33", topic:"Correlation", q:"Correlation requires:", choices:["Two categorical","Two quantitative","One categorical","Any two"], answer:1, explain:"r requires two quantitative variables." },

{ id:"q34", topic:"Correlation", q:"r close to +1 indicates:", choices:["Strong positive linear","No relationship","Strong negative","Nonlinear"], answer:0, explain:"Positive strong linear relationship." },

{ id:"q35", topic:"Correlation", q:"r close to 0 means:", choices:["No linear relationship","No relationship at all","Strong curve","Perfect fit"], answer:0, explain:"No linear association." },

{ id:"q36", topic:"Correlation", q:"Correlation implies causation?", choices:["Yes","No","Always","Sometimes"], answer:1, explain:"Correlation ≠ causation." },

{ id:"q37", topic:"Outliers", q:"Outliers can:", choices:["Increase r","Decrease r","Flip sign","All of the above"], answer:3, explain:"Depends on position." },

{ id:"q38", topic:"Correlation", q:"Before computing r, check:", choices:["Two quantitative","Straight enough","No strong outliers","All of the above"], answer:3, explain:"All three conditions required." },

{ id:"q39", topic:"Z-Score", q:"z = (x − μ)/σ measures:", choices:["Distance in units","Distance in SD units","Probability","Mean"], answer:1, explain:"Measured in SD units." },

{ id:"q40", topic:"Z-Score", q:"z = 2 means:", choices:["2 units above mean","2 SD above mean","2% above","2 below"], answer:1, explain:"2 standard deviations above mean." },

{ id:"q41", topic:"Normal Rule", q:"About 68% fall within:", choices:["±2 SD","±1 SD","±3 SD","IQR"], answer:1, explain:"68% rule." },

{ id:"q42", topic:"Normal Rule", q:"About 95% fall within:", choices:["±1 SD","±2 SD","±3 SD","±4 SD"], answer:1, explain:"95% rule." },

{ id:"q43", topic:"Z-Score", q:"z = −1.5 means:", choices:["1.5 SD below mean","1.5 above","15% below","Negative mean"], answer:0, explain:"Negative means below mean." },

{ id:"q44", topic:"Z-Score", q:"If z = 0:", choices:["Maximum","Minimum","At mean","Outlier"], answer:2, explain:"Exactly at mean." },

{ id:"q45", topic:"Normal Rule", q:"Value 2 SD above mean is roughly percentile:", choices:["50%","68%","97.5%","84%"], answer:2, explain:"Upper 2.5% tail." },

{ id:"q46", topic:"Two-Way Tables", q:"Conditional percent uses:", choices:["Total sample","Row/column total","Mean","SD"], answer:1, explain:"Condition on row or column." },

{ id:"q47", topic:"Percentages", q:"30 of 100 males prefer A. Percent?", choices:["30%","70%","0.3%","3%"], answer:0, explain:"30/100 = 30%." },

{ id:"q48", topic:"Percentages", q:"60 of 200 promoted. Percent?", choices:["60%","30%","20%","15%"], answer:1, explain:"60/200 = 30%." },

{ id:"q49", topic:"Mosaic Plot", q:"If conditional distributions differ, variables likely:", choices:["Independent","Related","Symmetric","Equal"], answer:1, explain:"Different distributions imply relationship." },

{ id:"q50", topic:"Mosaic Plot", q:"Mosaic plots compare:", choices:["Means","Spread","Two categorical variables","Two quantitative"], answer:2, explain:"Used for two categorical variables." }


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
  if(hy) hy.style.transform = "";
  if(sa) sa.style.transform = "";
  const arm = hy?.querySelector(".arm");
  if(arm) arm.style.transform = "";
}

function playScoreCutscene(points)
{el.sceneCaption.textContent = "He breaks free and sprints INTO THE CHECKERBOARD!";
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
