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
const QUESTIONS = [
  // 1–10 Mean/Median basics
  { id:"q01", topic:"Mean", q:"Data: 4, 6, 8, 10, 12. What is the mean?", choices:["6","8","9","10"], answer:1, explain:"(4+6+8+10+12)/5 = 8." },
  { id:"q02", topic:"Median", q:"Data: 2, 3, 3, 7, 20. What is the median?", choices:["3","7","5","6"], answer:0, explain:"Sorted data middle value is 3." },
  { id:"q03", topic:"Mean", q:"Data: 5, 6, 7, 8. What is the mean?", choices:["6.5","6","7","5.5"], answer:0, explain:"(5+6+7+8)/4 = 6.5." },
  { id:"q04", topic:"Median", q:"Data: 9, 1, 4, 6, 6. What is the median?", choices:["4","5","6","9"], answer:2, explain:"Sorted: 1,4,6,6,9 → median is 6." },
  { id:"q05", topic:"Outliers", q:"Adding one extremely large outlier mostly affects:", choices:["Median","IQR","Mean","Q1"], answer:2, explain:"Mean is sensitive to extreme values." },
  { id:"q06", topic:"Center", q:"For skewed data, the best measure of center is usually:", choices:["Mean","Median","Range","Standard deviation"], answer:1, explain:"Median is resistant to skew/outliers." },
  { id:"q07", topic:"Mean", q:"If every value in a data set increases by 5, the mean:", choices:["Stays the same","Increases by 5","Decreases by 5","Doubles"], answer:1, explain:"Adding a constant shifts the mean by that constant." },
  { id:"q08", topic:"Median", q:"If every value in a data set increases by 5, the median:", choices:["Stays the same","Increases by 5","Decreases by 5","Becomes 0"], answer:1, explain:"All values shift, so the middle shifts by 5." },
  { id:"q09", topic:"Mode", q:"The mode is the:", choices:["Middle value","Average of all values","Most frequent value","Largest value"], answer:2, explain:"Mode = most common value." },
  { id:"q10", topic:"Center", q:"In a symmetric distribution, which is most likely true?", choices:["Mean > median","Mean < median","Mean = median","Mean = 0"], answer:2, explain:"Symmetry implies mean and median are about equal." },

  // 11–20 IQR / Range / Outliers
  { id:"q11", topic:"IQR", q:"The IQR measures:", choices:["Total spread (max-min)","Spread of the middle 50%","Spread around the mean","Skewness"], answer:1, explain:"IQR = Q3 − Q1 (middle 50%)." },
  { id:"q12", topic:"IQR", q:"If Q1 = 12 and Q3 = 25, the IQR is:", choices:["13","37","25","12"], answer:0, explain:"25 − 12 = 13." },
  { id:"q13", topic:"Range", q:"Range is defined as:", choices:["Q3 − Q1","Max − Min","Mean − Median","Median − Min"], answer:1, explain:"Range = max − min." },
  { id:"q14", topic:"Outliers", q:"Which rule is commonly used to flag outliers?", choices:["±1 SD rule","±2 SD rule","1.5 × IQR rule","Mean ± IQR"], answer:2, explain:"Outliers often defined using fences based on 1.5×IQR." },
  { id:"q15", topic:"Outliers", q:"Data: 2, 4, 6, 8, 20. Which value is most likely an outlier?", choices:["2","6","8","20"], answer:3, explain:"20 is far from the rest." },
  { id:"q16", topic:"IQR", q:"IQR is resistant to:", choices:["Outliers","Sample size","Median","Units"], answer:0, explain:"IQR ignores extreme tails mostly." },
  { id:"q17", topic:"Standard Deviation", q:"Standard deviation primarily measures:", choices:["Center","Spread around the mean","Category counts","Skewness"], answer:1, explain:"SD measures typical distance from mean." },
  { id:"q18", topic:"Spread", q:"For skewed distributions, which spread measure is preferred?", choices:["Standard deviation","Variance","IQR","Mean"], answer:2, explain:"Use IQR for skewed/outlier-prone data." },
  { id:"q19", topic:"IQR", q:"If Q1=10 and Q3=18, what is the upper fence?", choices:["26","28","30","34"], answer:2, explain:"IQR=8; upper fence = 18 + 1.5×8 = 30." },
  { id:"q20", topic:"Range", q:"If min = 3 and max = 60, the range is:", choices:["57","63","30","20"], answer:0, explain:"60 − 3 = 57." },

  // 21–28 Skewness
  { id:"q21", topic:"Skewness", q:"A right-skewed distribution has a long tail to the:", choices:["Left","Right","Both","Neither"], answer:1, explain:"Right skew → tail extends right." },
  { id:"q22", topic:"Skewness", q:"If mean > median, the distribution is likely:", choices:["Left-skewed","Right-skewed","Symmetric","Bimodal"], answer:1, explain:"Right tail pulls mean upward." },
  { id:"q23", topic:"Skewness", q:"If mean < median, the distribution is likely:", choices:["Left-skewed","Right-skewed","Uniform","No spread"], answer:0, explain:"Left tail pulls mean downward." },
  { id:"q24", topic:"Skewness", q:"Income data are typically:", choices:["Symmetric","Left-skewed","Right-skewed","Uniform"], answer:2, explain:"A few very large incomes create right tail." },
  { id:"q25", topic:"Center", q:"For right-skewed data, the best measure of center is:", choices:["Mean","Median","Range","SD"], answer:1, explain:"Median resists the right tail." },
  { id:"q26", topic:"Skewness", q:"In a right-skewed distribution, which is usually true?", choices:["Mean < median","Mean ≈ median","Mean > median","Mean = 0"], answer:2, explain:"Mean pulled toward long right tail." },
  { id:"q27", topic:"Skewness", q:"In a left-skewed distribution, which is usually true?", choices:["Mean > median","Mean < median","Mean = median","Mean = max"], answer:1, explain:"Mean pulled toward long left tail." },
  { id:"q28", topic:"Shape", q:"Which description matches a symmetric unimodal distribution?", choices:["One peak, equal tails","Two peaks, equal tails","Flat with no peaks","Tail only to right"], answer:0, explain:"Symmetric unimodal: one peak + balanced tails." },

  // 29–36 Types of data
  { id:"q29", topic:"Types of Data", q:"Type of gas (regular/premium/diesel) is:", choices:["Quantitative","Categorical","Identifier","Continuous"], answer:1, explain:"Gas type is categorical." },
  { id:"q30", topic:"Types of Data", q:"Number of gallons purchased is:", choices:["Categorical","Quantitative","Identifier","Nominal"], answer:1, explain:"Gallons is a numeric measurement." },
  { id:"q31", topic:"Types of Data", q:"Transaction number is best classified as:", choices:["Quantitative","Categorical","Identifier","Continuous"], answer:2, explain:"ID labels an observation." },
  { id:"q32", topic:"Types of Data", q:"Day of week is:", choices:["Quantitative","Categorical","Identifier","Ratio"], answer:1, explain:"Days are categories." },
  { id:"q33", topic:"Types of Data", q:"Height (in inches) is:", choices:["Categorical","Quantitative","Identifier","Nominal"], answer:1, explain:"Numeric measurement." },
  { id:"q34", topic:"Types of Data", q:"A student’s major (Engineering, Business, etc.) is:", choices:["Quantitative","Categorical","Identifier","Continuous"], answer:1, explain:"Major is a category." },
  { id:"q35", topic:"Types of Data", q:"Age (in years) is:", choices:["Categorical","Quantitative","Identifier","Nominal"], answer:1, explain:"Age is numeric." },
  { id:"q36", topic:"Types of Data", q:"Jersey number is typically:", choices:["Quantitative","Categorical","Identifier","Continuous"], answer:2, explain:"Jersey # labels a player; arithmetic isn’t meaningful." },

  // 37–44 Correlation / scatterplots
  { id:"q37", topic:"Correlation", q:"Correlation (r) is used for:", choices:["Two categorical variables","Two quantitative variables","One categorical & one quantitative","Any variables"], answer:1, explain:"r measures linear association between two quantitative variables." },
  { id:"q38", topic:"Correlation", q:"If r is close to +1, that indicates:", choices:["Strong positive linear association","Strong negative linear association","No linear association","Causation"], answer:0, explain:"r near +1 → strong positive linear relationship." },
  { id:"q39", topic:"Correlation", q:"If r is close to 0, that means:", choices:["No relationship at all","No linear relationship","Perfect curve","Causation"], answer:1, explain:"r near 0 → weak/no linear association (could still be nonlinear)." },
  { id:"q40", topic:"Correlation", q:"Which is always true?", choices:["Correlation implies causation","Causation implies correlation","Correlation does not imply causation","r can only be positive"], answer:2, explain:"Association ≠ causation." },
  { id:"q41", topic:"Correlation", q:"Before computing r, you should check:", choices:["Two quantitative variables","Straight enough (roughly linear)","No strong outliers","All of the above"], answer:3, explain:"All 3 conditions." },
  { id:"q42", topic:"Outliers", q:"Adding a large outlier to a scatterplot can:", choices:["Only increase r","Only decrease r","Only flip sign of r","Change r in many ways"], answer:3, explain:"Outliers can increase/decrease/flip depending on location." },
  { id:"q43", topic:"Scatterplots", q:"A point far from the overall pattern is called:", choices:["Median","Outlier","Quartile","Mode"], answer:1, explain:"Outlier = unusual observation." },
  { id:"q44", topic:"Scatterplots", q:"If a point is far in x-direction (high leverage), it can:", choices:["Never change r","Strongly affect r","Only affect mean","Only affect median"], answer:1, explain:"High-leverage points can strongly affect correlation." },

  // 45–50 Two-way tables / conditional percent
  { id:"q45", topic:"Two-Way Tables", q:"A conditional percent is computed using:", choices:["Overall total","Row or column total","Mean","Standard deviation"], answer:1, explain:"Conditional % uses the total of the conditioned group." },
  { id:"q46", topic:"Two-Way Tables", q:"If 30 out of 100 students prefer A, what percent prefer A?", choices:["3%","30%","70%","0.3%"], answer:1, explain:"30/100 = 30%." },
  { id:"q47", topic:"Two-Way Tables", q:"Promoted 60 of 200 employees. Percent promoted is:", choices:["60%","30%","20%","15%"], answer:1, explain:"60/200 = 0.30 = 30%." },
  { id:"q48", topic:"Two-Way Tables", q:"If two categorical variables show different conditional distributions, they likely:", choices:["Are independent","Have a relationship","Are symmetric","Have equal means"], answer:1, explain:"Different conditional splits suggests association." },
  { id:"q49", topic:"Displays", q:"A mosaic plot is mainly used to visualize:", choices:["Two quantitative variables","One quantitative variable","Two categorical variables","A normal curve"], answer:2, explain:"Mosaic plots compare categorical distributions." },
  { id:"q50", topic:"Two-Way Tables", q:"Percent of promoted employees who are 40+ is an example of:", choices:["Marginal percent","Conditional percent","Mean","Correlation"], answer:1, explain:"It conditions on being promoted." }
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
