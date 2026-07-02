// ui.js — render the engine to the DOM with premium animations; drive both modes.

import { SUIT_SYMBOL, SUIT_COLOR, isRightBower, isLeftBower, isTrump, cardStrength, effectiveSuit } from './cards.js';
import {
  newGame, deal, orderUp, discard, callTrump, pass, playCard,
  getLegalCards, currentLedSuit, TEAM_OF,
} from './engine.js';
import { aiBid, aiDiscard, aiPlay } from './ai.js';
import { evaluateMove } from './coach-client.js';
import { cardName, GRADE_LABEL } from './coach.js';
import * as Stats from './stats.js';
import { emit } from './events.js';
import { initJuice } from './juice.js';
import { CHARACTERS, line as charLine } from './personalities.js';
import { loadProfile, saveProfile, sanitizeName } from './profile.js';
import { PACKS, loadCosmetics, saveCosmetics, isOwned, setActivePack, applyPack, unlockHint, ownPack, packById } from './cosmetics.js';
import { ROSTER, characterLine, teamNameForPair } from './personalities.js';
import { portraitSVG, PORTRAITS } from './portraits.js';
import { RIVALS, isRival, rivalLine, loadRivals, saveRivals, recordVsRival, h2h, rivalById } from './rivals.js';
import { loadCareer, saveCareer, awardTitle, setActiveTitle, recordCup } from './career.js';
import { DEFAULT_ALLY, loadAlly, saveAlly, availableAllies, isAllyUnlocked, allyProfile } from './allies.js';
import {
  TOURNAMENTS, tournamentById, loadTournaments, saveTournaments,
  progressFor, currentRound, isTournamentUnlocked, recordRoundWin,
  allTournamentsComplete, prestigeFor, canStartPrestigeSeason, beginPrestigeSeason,
  completePrestigeSeason, prestigeLabel,
} from './tournaments.js';
import {
  localDateKey, dailyConfig, dailyDealRng, dailyActionRng, scoreDaily,
  loadDaily, saveDaily, officialEntry, completeDaily,
  dailyBest, dailyStreak, recentDailyEntries,
} from './daily.js';

const NAMES = {
  ai:    ['you', 'west', 'partner', 'east'],
  train: ['you', 'west', 'partner', 'east'],
  tutorial: ['you', 'west', 'partner', 'east'],
  tour:  ['you', 'west', 'partner', 'east'],
  daily: ['you', 'west', 'partner', 'east'],
};

let S;                 // game state
let mode = 'ai';       // 'ai' | 'train' | 'tutorial' | 'tour' | 'daily'
let difficulty = 'normal'; // 'easy' | 'normal' | 'hard'
let perspective = 0;   // seat shown at the bottom (face-up)
let humanResolve = null;
let pendingResolve = null;
let aloneFlag = false;
let activeRun = 0;
let lastFocused = null;
let feedback = loadFeedback();
let stats = Stats.loadStats();
let profile = loadProfile();
let cosmetics = loadCosmetics();
let packsReturnScreen = 'clubhouse';
let tournaments = loadTournaments();
let rivals = loadRivals();           // head-to-head records
let career = loadCareer();           // titles + cups won
let allyId = loadAlly();             // your chosen partner (seat 2 everywhere)
let tourCtx = null;                  // { id, round } while playing a cup match
let dailyCtx = null;                 // seeded lineup, deal index, official/replay metrics
let dailyStore = loadDaily();
let activeCharacters = CHARACTERS;   // overridden per-round in tournament mode
let coachResolve = null;       // resolves the coach review sheet
let trainHand = [];            // coach grades for the current hand
let trainGame = [];            // coach grades for the whole game
let hintBusy = false;
let pendingDiscardId = null;

const SAVES_KEY = 'euchre.saves.v1';   // map keyed by mode → each mode resumes independently
const FEEDBACK_KEY = 'euchre.feedback.v2';
const HAND_RESULT_SETTLE_MS = 180;
const APP_INFO = {
  versionName: '2.30',
  versionCode: '41',
  applicationId: 'com.offlineeuchre.cardgame',
  supportEmail: 'abhotoia@gmail.com',
};

const $ = (id) => document.getElementById(id);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));
const isHuman = (seat) => seat === 0;
const isTrain = () => mode === 'train';
const isTutorial = () => mode === 'tutorial';
const screenPos = (seat) => (seat - perspective + 4) % 4; // 0 bottom,1 left,2 top,3 right
const POS_SEL = ['#seat-0', '#seat-1', '#seat-2', '#seat-3'];

const LANGS = {
  en: 'English',
  zh: '中文（普通话）',
};

const I18N = {
  en: {
    appTitle: 'Euchre',
    tagline: 'First to 10. Bowers high. No mercy.',
    playingAs: 'Playing as',
    solo: 'Solo',
    soloSub: 'You + AI partner vs 2 AI',
    train: 'Train',
    coach: 'Coach',
    trainSub: 'Every move graded — learn to master it',
    dailyDeal: 'Daily Deal',
    dailySub: 'Same table for everyone — first attempt counts',
    tournaments: 'Tournaments 🏆',
    tournamentsSub: 'Climb the cups — unlock card packs',
    clubhouse: 'Clubhouse',
    clubhouseSub: 'Team, stats, trophies & card packs',
    clubhouseIntro: 'Your team, career, and collection.',
    yourTeam: 'Your Team',
    yourTeamSub: 'Choose your ally and team name',
    yourStats: 'Your Stats',
    yourStatsSub: 'Career record, rank, and badges',
    trophyRoom: 'Trophy Room',
    trophyRoomSub: 'Titles, cups, and rival records',
    cardPacks: 'Card Packs',
    cardPacksSub: 'Browse and equip your collection',
    settings: 'Settings',
    profile: 'Profile',
    editIdentity: 'Edit identity',
    editIdentitySub: 'Player and team names',
    language: 'Language',
    languageSub: 'Choose the game language',
    currentLanguage: 'Current',
    changeLanguage: 'Change language',
    chooseLanguage: 'Choose language',
    languagePickerSub: 'Pick the language used across the game.',
    mandarinChinese: 'Mandarin Chinese',
    gameFeedback: 'Game feedback',
    haptics: 'Haptics',
    hapticsSub: 'Vibrate for cards, tricks, and scores',
    sound: 'Sound',
    soundSub: 'Play subtle table sounds',
    gameSpeed: 'Game speed',
    speedSub: 'Slower pacing is easier for learning',
    speedSlow: 'Slow',
    speedFast: 'Fast',
    appearance: 'Appearance',
    cardPack: 'Card pack',
    equipped: 'equipped',
    help: 'Help',
    howToPlay: 'How to play',
    howToPlaySub: 'Rules, bowers, bidding, and scoring',
    about: 'About',
    aboutPrivacySupport: 'About, privacy & support',
    aboutPrivacySupportSub: 'Version, local data, and support details',
    privacy: 'Privacy',
    privacyCopy: 'This build stores profile, saves, stats, settings, Daily Deal history, tournament progress, allies, rivals, titles, and card packs on this device. It does not use accounts, cloud sync, ads, analytics, crash reporting, telemetry, or online multiplayer.',
    resetLocalDataCopy: 'Reset everything removes Euchre local data from this device.',
    support: 'Support',
    supportCopy: 'Email {email} for support. Include the app version when reporting a bug.',
    build: 'Build',
    appVersion: 'Version {version} ({code})',
    applicationId: 'Application ID',
    dataStorage: 'Data storage',
    localDeviceOnly: 'Local device only',
    data: 'Data',
    resetStats: 'Reset stats',
    resetEverything: 'Reset everything',
    resumeGame: 'Resume game',
    discard: 'Discard',
    resume: 'Resume',
    newGame: 'New game',
    difficulty: 'Difficulty',
    easy: 'Easy',
    normal: 'Normal',
    hard: 'Hard',
    autoAdvanceOptimal: 'Auto-advance optimal',
    on: 'On',
    off: 'Off',
    currentStreak: 'Current streak',
    personalBest: 'Personal best',
    recentDeals: 'Recent deals',
    teamName: 'Team name',
    yourAlly: 'Your ally',
    badges: 'Badges',
    titles: 'Titles',
    cups: 'Cups',
    prestigeSeasons: 'Prestige Seasons',
    rivals: 'Rivals',
    partner: 'Partner',
    west: 'West',
    east: 'East',
    you: 'You',
    them: 'Them',
    readReasoning: 'Read the reasoning',
    gotIt: 'Got it',
    continue: 'Continue',
    backToMenu: 'Back to menu',
    nextHand: 'Next hand',
    lastTrick: 'Last trick',
    previousTrick: 'Previous trick',
    close: 'Close',
    sweet: 'Sweet',
    cancel: 'Cancel',
    confirm: 'Confirm',
    areYouSure: 'Are you sure?',
    yourIdentity: 'Your identity',
    yourName: 'Your name',
    save: 'Save',
    welcome: 'Welcome',
    welcomeTitle: 'Welcome to Euchre',
    welcomeText: 'Play a gentle one-hand tutorial with tips for bidding, following suit, and taking tricks. You can skip it any time.',
    startTutorial: 'Play tutorial hand',
    skipForNow: 'Skip for now',
    guidedHand: 'Guided hand',
    tutorialIntro: 'We will play one hand slowly. Watch the turned-up card, choose whether to bid, then follow suit when you can.',
    tutorialBidRound1: 'The card in the middle can become trump. If you order it up, the dealer gets that card and must discard one.',
    tutorialBidRound2: 'Everyone passed. Now you can name any trump suit except the turned-down suit, or pass and redeal.',
    tutorialDiscard: 'You are the dealer. Pick one card to discard so your hand goes back to five cards.',
    tutorialPlay: 'Your turn. Follow the led suit if you have it. When you cannot follow suit, trump can win the trick.',
    tutorialWatch: '{name} is deciding. Watch which suit is led and who has to follow it.',
    tutorialCompleteTitle: 'Tutorial hand complete',
    tutorialCompleteText: 'Nice. That was one full hand: bidding, trump, following suit, and scoring. Solo is ready when you are; Train adds coach feedback on every move.',
    startSolo: 'Start Solo',
    keepExploring: 'Keep exploring',
    skipTutorial: 'Skip tutorial',
    currentGame: 'Current game',
    leaveTable: 'Leave the table?',
    saveAndLeave: 'Save & leave',
    keepPlaying: 'Keep playing',
    leaveWithoutSaving: 'Leave without saving',
    saveResumeDesc: 'Save to resume later from this mode’s menu, or leave without saving.',
    saveDailyDesc: 'Save to continue your official attempt later. Leaving without saving forfeits today’s score.',
    forfeitOfficial: 'Forfeit official attempt',
    startOfficial: 'Start official attempt',
    replayPractice: 'Replay for practice',
    officialReady: 'Your official table is ready',
    officialProgress: 'Official attempt in progress',
    replayProgress: 'Non-official replay in progress',
    officialForfeited: 'Official attempt forfeited',
    officialWin: 'Official win',
    officialComplete: 'Official complete',
    dailyInitialNote: 'You get one official attempt. Save & leave keeps it safe; abandoning it counts as a forfeit.',
    dailyLockedNote: 'Your official result is locked. Replays use the same deal for practice only and never affect score, streaks, bests, or stats.',
    dailyReplayNote: 'Practice replay — this will never affect score, streaks, bests, or stats.',
    completeFirstDaily: 'Complete your first Daily Deal to begin a streak.',
    days: '{n} day{suffix}',
    inProgress: 'In progress · {us}–{them}',
    allPassed: 'All passed — redealing…',
    yourBid: 'Your bid',
    consideringBid: '{name} is considering the bid…',
    picksItUp: '{name} picks it up',
    discardPrompt: 'Discard one card — tap twice to confirm. This is not playing a trick.',
    cardDiscarded: 'Card discarded',
    discardsCard: '{name} discards a card',
    yourTurn: 'Your turn',
    isPlaying: '{name} is playing…',
    tapAgainDiscard: 'Tap {card} again to discard — not play',
    mustFollow: 'Must follow {symbol} — play a {suit} card',
    orderItUp: 'Order it up?',
    pickItUp: 'Pick it up?',
    nameTrump: 'Name trump',
    cantChoose: "Can't choose {symbol}",
    pass: 'Pass',
    orderUp: 'Order Up',
    pickUp: 'Pick Up',
    goAlone: 'Go alone',
    turnedUp: 'Turned up',
    yourTeamSide: 'your team',
    opponentTeamSide: 'opponent team',
    pickupRecipient: 'If picked up: {dealer} gets it · {side}',
    coachAnalyzing: 'Coach is analyzing…',
    coachOptimal: 'Coach: optimal ✓',
    coachThinking: 'Coach is thinking…',
    coachSuggests: 'Coach suggests {card}',
    gameOver: 'Game Over',
    youWin: 'You Win 🏆',
    youLose: 'You Lose',
    finalScore: 'Final — {usName} {us} · {themName} {them}',
    euchre: 'Euchre',
    march: 'March',
    aloneMarch: 'Alone march',
    hand: 'Hand',
    youWonHand: 'You won the hand',
    youLostHand: 'You lost the hand',
    youEuchredThem: 'You euchred them',
    youGotEuchred: 'You got euchred',
    loneHandSwept: 'Lone hand swept',
    theySweptAlone: 'They swept alone',
    youMarched: 'You marched',
    theyMarched: 'They marched',
    youMadeBid: 'You made the bid',
    theyMadeBid: 'They made the bid',
    tableSecured: 'Table secured.',
    tableLost: 'Table lost.',
    final: 'Final',
    mode: 'Mode',
    caller: 'Caller',
    tricks: 'Tricks',
    makers: 'Makers',
    defenders: 'Defenders',
    swing: 'Swing',
    score: 'Score',
    tookAllFiveAlone: '{maker} took all five tricks alone.',
    tookAllFive: '{maker} took all five tricks.',
    madeBidDetail: '{maker} took {n} trick{suffix} and made the bid.',
    euchreDetail: '{defenders} held {maker} to {n} trick{suffix}.',
    contractNeed: 'more trick{suffix} needed to make the bid',
    bidMade: 'Bid made ✓',
    rulesHTML: `
        <p><b>Deck</b> — 24 cards: 9, 10, J, Q, K, A in four suits.</p>
        <p><b>Teams</b> — You + Partner (Us) vs West + East (Them).</p>
        <p><b>Trump</b> — Each hand one suit is trump. The <b>right bower</b> (Jack of trump) is highest; the <b>left bower</b> (other Jack of the same color) is second and counts as trump.</p>
        <p><b>Bidding</b> — A card is turned up. In turn, order it up or pass. If all pass, name any other suit or pass again.</p>
        <p><b>Going alone</b> — The maker may play without their partner for bonus points.</p>
        <p><b>Play</b> — Follow the led suit if you can. Highest trump wins, else highest card of the led suit.</p>
        <p><b>Scoring</b> — Makers: 3–4 tricks = 1, all 5 = 2 (4 alone). Euchred = 2 to defenders. First to 10 wins.</p>
        <p><b>Trump order</b> (highest → lowest), with ♥ as trump:</p>
        <div class="cheat-row"><span class="cheat-card red">J♥<small>right</small></span><span class="cheat-card red">J♦<small>left</small></span><span class="cheat-card red">A♥</span><span class="cheat-card red">K♥</span><span class="cheat-card red">Q♥</span><span class="cheat-card red">10♥</span><span class="cheat-card red">9♥</span></div>
        <p class="cheat-note">Both Jacks of the trump colour are the two strongest cards. Everything else ranks A–9 in its own suit.</p>`,
  },
  zh: {
    appTitle: '尤克牌',
    tagline: '先到 10 分。王牌最大。别手软。',
    playingAs: '当前玩家',
    solo: '单人',
    soloSub: '你和 AI 搭档 对阵 2 个 AI',
    train: '训练',
    coach: '教练',
    trainSub: '每一步都会评分——学到精通',
    dailyDeal: '每日牌局',
    dailySub: '所有人同一桌——第一次成绩有效',
    tournaments: '锦标赛 🏆',
    tournamentsSub: '挑战杯赛——解锁牌背',
    clubhouse: '俱乐部',
    clubhouseSub: '队伍、统计、奖杯和牌包',
    clubhouseIntro: '你的队伍、战绩和收藏。',
    yourTeam: '你的队伍',
    yourTeamSub: '选择搭档和队名',
    yourStats: '你的统计',
    yourStatsSub: '生涯战绩、等级和徽章',
    trophyRoom: '奖杯室',
    trophyRoomSub: '称号、奖杯和对手记录',
    cardPacks: '牌包',
    cardPacksSub: '浏览并装备你的收藏',
    settings: '设置',
    profile: '档案',
    editIdentity: '编辑身份',
    editIdentitySub: '玩家名和队名',
    language: '语言',
    languageSub: '选择游戏语言',
    currentLanguage: '当前',
    changeLanguage: '更改语言',
    chooseLanguage: '选择语言',
    languagePickerSub: '选择游戏中使用的语言。',
    mandarinChinese: '中文普通话',
    gameFeedback: '游戏反馈',
    haptics: '震动',
    hapticsSub: '出牌、赢墩和得分时震动',
    sound: '声音',
    soundSub: '播放轻微桌面音效',
    gameSpeed: '游戏速度',
    speedSub: '较慢节奏更适合学习',
    speedSlow: '慢',
    speedFast: '快',
    appearance: '外观',
    cardPack: '牌包',
    equipped: '已装备',
    help: '帮助',
    howToPlay: '玩法说明',
    howToPlaySub: '规则、左右 J、叫牌和计分',
    about: '关于',
    aboutPrivacySupport: '关于、隐私和支持',
    aboutPrivacySupportSub: '版本、本地数据和支持信息',
    privacy: '隐私',
    privacyCopy: '此版本会把档案、存档、统计、设置、每日牌局历史、锦标赛进度、搭档、对手、称号和牌包保存在本设备上。它不使用账号、云同步、广告、分析、崩溃报告、遥测或在线多人游戏。',
    resetLocalDataCopy: '“全部重置”会从本设备删除 Euchre 本地数据。',
    support: '支持',
    supportCopy: '请发送邮件至 {email} 获取支持。报告问题时请附上应用版本。',
    build: '构建',
    appVersion: '版本 {version} ({code})',
    applicationId: '应用 ID',
    dataStorage: '数据存储',
    localDeviceOnly: '仅本设备',
    data: '数据',
    resetStats: '重置统计',
    resetEverything: '全部重置',
    resumeGame: '继续游戏',
    discard: '丢弃',
    resume: '继续',
    newGame: '新游戏',
    difficulty: '难度',
    easy: '简单',
    normal: '普通',
    hard: '困难',
    autoAdvanceOptimal: '最佳选择时自动继续',
    on: '开',
    off: '关',
    currentStreak: '当前连续',
    personalBest: '个人最佳',
    recentDeals: '最近牌局',
    teamName: '队名',
    yourAlly: '你的搭档',
    badges: '徽章',
    titles: '称号',
    cups: '奖杯',
    prestigeSeasons: '威望赛季',
    rivals: '对手',
    partner: '搭档',
    west: '西家',
    east: '东家',
    you: '你',
    them: '对手',
    readReasoning: '查看原因',
    gotIt: '知道了',
    continue: '继续',
    backToMenu: '返回菜单',
    nextHand: '下一手',
    lastTrick: '上一墩',
    previousTrick: '上一墩',
    close: '关闭',
    sweet: '太好了',
    cancel: '取消',
    confirm: '确认',
    areYouSure: '确定吗？',
    yourIdentity: '你的身份',
    yourName: '你的名字',
    save: '保存',
    welcome: '欢迎',
    learnFast: '快速学会尤克牌',
    welcomeTitle: '欢迎来到 Euchre',
    welcomeText: '先打一手温和的新手教学牌局，了解叫牌、跟牌和赢墩。你可以随时跳过。',
    startTutorial: '打一手教学牌',
    skipForNow: '暂时跳过',
    guidedHand: '教学牌局',
    tutorialIntro: '我们会慢慢打一手牌。先看翻开的牌，决定是否叫牌，然后在能跟牌时跟同花色。',
    tutorialBidRound1: '中间的牌可能成为 trump。叫它起来后，庄家会拿到这张牌并弃一张。',
    tutorialBidRound2: '大家都过了。现在你可以指定一个 trump 花色，但不能选刚才翻下去的花色，也可以继续过牌。',
    tutorialDiscard: '你是庄家。请选择一张牌弃掉，让手牌回到五张。',
    tutorialPlay: '轮到你了。有同花色时必须跟牌；没有时，trump 往往可以赢下这一墩。',
    tutorialWatch: '{name} 正在决定。留意首牌花色，以及谁必须跟牌。',
    tutorialCompleteTitle: '教学牌局完成',
    tutorialCompleteText: '很好。你已经完成了一手牌：叫牌、trump、跟牌和计分。可以开始 Solo，也可以用 Train 让教练点评每一步。',
    startSolo: '开始 Solo',
    keepExploring: '继续看看',
    skipTutorial: '跳过教学',
    currentGame: '当前游戏',
    leaveTable: '离开牌桌？',
    saveAndLeave: '保存并离开',
    keepPlaying: '继续玩',
    leaveWithoutSaving: '不保存离开',
    saveResumeDesc: '保存后可从该模式菜单继续，或不保存离开。',
    saveDailyDesc: '保存后可继续今天的正式尝试。不保存离开会视为今天弃权。',
    forfeitOfficial: '放弃正式尝试',
    startOfficial: '开始正式尝试',
    replayPractice: '练习重玩',
    officialReady: '你的正式牌桌已准备好',
    officialProgress: '正式尝试进行中',
    replayProgress: '非正式练习进行中',
    officialForfeited: '正式尝试已弃权',
    officialWin: '正式获胜',
    officialComplete: '正式完成',
    dailyInitialNote: '你只有一次正式尝试。保存并离开会保留；放弃会算作弃权。',
    dailyLockedNote: '正式成绩已锁定。重玩只用于练习，不影响分数、连胜、最佳或统计。',
    dailyReplayNote: '练习重玩——不会影响分数、连胜、最佳或统计。',
    completeFirstDaily: '完成第一次每日牌局来开始连续记录。',
    days: '{n} 天',
    inProgress: '进行中 · {us}–{them}',
    allPassed: '全部 pass——重新发牌…',
    yourBid: '轮到你叫牌',
    consideringBid: '{name} 正在考虑叫牌…',
    picksItUp: '{name} 拿起这张牌',
    discardPrompt: '丢弃一张牌——点两次确认。这不是出牌。',
    cardDiscarded: '已丢弃',
    discardsCard: '{name} 丢弃一张牌',
    yourTurn: '轮到你出牌',
    isPlaying: '{name} 正在出牌…',
    tapAgainDiscard: '再点一次 {card} 来丢弃——不是出牌',
    mustFollow: '必须跟 {symbol}——出一张 {suit} 牌',
    orderItUp: '叫庄拿牌？',
    pickItUp: '拿起这张？',
    nameTrump: '选择王牌花色',
    cantChoose: '不能选 {symbol}',
    pass: 'Pass',
    orderUp: '叫上',
    pickUp: '拿起',
    goAlone: '单独打',
    turnedUp: '翻出',
    yourTeamSide: '你的队伍',
    opponentTeamSide: '对手队伍',
    pickupRecipient: '如果拿起：{dealer} 得到这张牌 · {side}',
    coachAnalyzing: '教练正在分析…',
    coachOptimal: '教练：最佳 ✓',
    coachThinking: '教练正在思考…',
    coachSuggests: '教练建议 {card}',
    gameOver: '游戏结束',
    youWin: '你赢了 🏆',
    youLose: '你输了',
    finalScore: '最终 — {usName} {us} · {themName} {them}',
    euchre: '反吃',
    march: '全拿',
    aloneMarch: '单人全拿',
    hand: '本手',
    youWonHand: '你赢下本手',
    youLostHand: '你输掉本手',
    youEuchredThem: '你反吃了对手',
    youGotEuchred: '你被反吃了',
    loneHandSwept: '单人全拿',
    theySweptAlone: '对手单人全拿',
    youMarched: '你全拿了',
    theyMarched: '对手全拿了',
    youMadeBid: '你完成了叫牌',
    theyMadeBid: '对手完成了叫牌',
    tableSecured: '牌桌拿下。',
    tableLost: '牌桌失守。',
    final: '最终',
    mode: '模式',
    caller: '叫牌方',
    tricks: '墩数',
    makers: '叫牌方',
    defenders: '防守方',
    swing: '得分',
    score: '比分',
    tookAllFiveAlone: '{maker} 单人拿下五墩。',
    tookAllFive: '{maker} 拿下五墩。',
    madeBidDetail: '{maker} 拿下 {n} 墩并完成叫牌。',
    euchreDetail: '{defenders} 把 {maker} 压到只拿 {n} 墩。',
    contractNeed: '墩完成叫牌',
    bidMade: '叫牌已完成 ✓',
    rulesHTML: `
        <p><b>牌组</b> — 24 张牌：四种花色的 9、10、J、Q、K、A。</p>
        <p><b>队伍</b> — 你 + 搭档（我方）对西家 + 东家（对手）。</p>
        <p><b>王牌</b> — 每手有一个王牌花色。<b>右 J</b>（王牌 J）最大；<b>左 J</b>（同色另一张 J）第二大，并算作王牌。</p>
        <p><b>叫牌</b> — 翻出一张牌。轮流选择叫上或 pass。若全员 pass，则第二轮可叫其他花色或再 pass。</p>
        <p><b>单独打</b> — 叫牌方可以不带搭档，争取更高奖励分。</p>
        <p><b>出牌</b> — 能跟首引花色就必须跟。最高王牌赢；否则首引花色中最大牌赢。</p>
        <p><b>计分</b> — 叫牌方拿 3–4 墩得 1 分，全拿得 2 分（单独打全拿得 4 分）。叫牌失败则防守方得 2 分。先到 10 分获胜。</p>
        <p><b>王牌顺序</b>（高 → 低），以 ♥ 为王牌：</p>
        <div class="cheat-row"><span class="cheat-card red">J♥<small>右</small></span><span class="cheat-card red">J♦<small>左</small></span><span class="cheat-card red">A♥</span><span class="cheat-card red">K♥</span><span class="cheat-card red">Q♥</span><span class="cheat-card red">10♥</span><span class="cheat-card red">9♥</span></div>
        <p class="cheat-note">王牌颜色的两张 J 是最强的两张牌。其他牌按各自花色 A 到 9 排序。</p>`,
  },
};

function lang() { return feedback.language === 'zh' ? 'zh' : 'en'; }
function t(key, vars = {}) {
  const dict = I18N[lang()] || I18N.en;
  let value = dict[key] ?? I18N.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) value = value.replaceAll(`{${k}}`, String(v));
  return value;
}
function setText(id, key, vars) { const el = $(id); if (el) el.textContent = t(key, vars); }
function setHTML(id, key, vars) { const el = $(id); if (el) el.innerHTML = t(key, vars); }

// Display name for a seat: your profile name for seat 0, character names in
// tournaments, otherwise the role label (West/Partner/East or Player N).
function nameFor(seat) {
  if (seat === 0) return profile.playerName;
  const ch = activeCharacters[seat];
  if (seat === 2 && ch?.name) return ch.name;   // your ally, by name, everywhere
  if ((mode === 'tour' || mode === 'daily') && ch) return ch.name;
  const role = NAMES[mode]?.[seat];
  return role ? t(role) : ch?.name || `P${seat}`;
}

// Portrait expression from the live game state, so avatars emote with the match.
function expressionFor(seat) {
  if (!S) return 'neutral';
  const team = seat % 2;
  const mine = S.scores[team], theirs = S.scores[1 - team];
  const r = S.lastResult;
  if (r) {
    if (r.kind === 'euchre' && r.makerTeam === team) return 'angry';  // their call failed
    if (r.team === team && r.points >= 2) return 'gloating';          // big hand for them
    if (r.team !== team && r.points >= 2) return 'rattled';
  }
  if (mine - theirs >= 3) return 'smug';
  if (theirs - mine >= 3) return 'rattled';
  return 'neutral';
}

// Push the editable team name onto the scoreboard label ("Us").
function applyIdentity() {
  const usLabel = document.querySelector('.team-us .score-label');
  if (usLabel) {
    usLabel.textContent = profile.teamName;
    usLabel.title = profile.teamName;
  }
  const themLabel = document.querySelector('.team-them .score-label');
  if (themLabel) {
    const name = opponentTeamName();
    themLabel.textContent = name;
    themLabel.title = name;
  }
}

function opponentTeamName() {
  const west = activeCharacters[1]?.id || CHARACTERS[1]?.id || 'vera';
  const east = activeCharacters[3]?.id || CHARACTERS[3]?.id || 'pip';
  return teamNameForPair(west, east);
}

function teamSideForSeat(seat) {
  return TEAM_OF(seat) === 0 ? t('yourTeamSide') : t('opponentTeamSide');
}

function refreshProfileName() {
  const el = $('profileName');
  if (el) el.textContent = career.activeTitle ? `${profile.playerName} · ${career.activeTitle}` : profile.playerName;
}

function openProfile() {
  $('profilePlayer').value = profile.playerName === 'You' ? '' : profile.playerName;
  $('profileTeam').value = profile.teamName === 'Us' ? '' : profile.teamName;
  openModal('profileScrim', 'profilePlayer');
}

function saveProfileEdits() {
  profile = saveProfile({
    playerName: sanitizeName($('profilePlayer').value, 'You'),
    teamName: sanitizeName($('profileTeam').value, 'Us'),
  });
  refreshProfileName();
  applyIdentity();
  closeModal('profileScrim');
}

function applyLanguage() {
  document.documentElement.lang = lang() === 'zh' ? 'zh-Hans' : 'en';
  document.title = t('appTitle');
  const brandTitle = document.querySelector('.brand h1');
  if (brandTitle) brandTitle.textContent = t('appTitle');
  const tagline = document.querySelector('.tagline');
  if (tagline) tagline.textContent = t('tagline');
  const playing = document.querySelector('.playing-as');
  if (playing) playing.innerHTML = `${escapeHTML(t('playingAs'))} <b id="profileName"></b>`;
  refreshProfileName();

  const set = (sel, key) => { const el = document.querySelector(sel); if (el) el.textContent = t(key); };
  const setSmall = (sel, key) => { const el = document.querySelector(sel); if (el) el.textContent = t(key); };
  set('[data-mode="ai"] .btn-title', 'solo');
  set('[data-mode="ai"] .btn-sub', 'soloSub');
  const trainTitle = document.querySelector('[data-mode="train"] .btn-title');
  if (trainTitle) trainTitle.innerHTML = `${escapeHTML(t('train'))} <span class="btn-badge">${escapeHTML(t('coach'))}</span>`;
  set('[data-mode="train"] .btn-sub', 'trainSub');
  const dailyTitle = document.querySelector('#dailyBtn .btn-title');
  if (dailyTitle) dailyTitle.innerHTML = `${escapeHTML(t('dailyDeal'))} <span class="daily-dot">●</span>`;
  set('#dailyBtn .btn-sub', 'dailySub');
  set('#tournamentsBtn .btn-title', 'tournaments');
  set('#tournamentsBtn .btn-sub', 'tournamentsSub');
  set('#clubhouseBtn b', 'clubhouse');
  set('#clubhouseBtn small', 'clubhouseSub');
  set('#clubhouse .stats-rank', 'clubhouse');
  set('.hub-intro', 'clubhouseIntro');
  set('#teamBtn b', 'yourTeam'); setSmall('#teamBtn small', 'yourTeamSub');
  set('#statsBtn b', 'yourStats'); setSmall('#statsBtn small', 'yourStatsSub');
  set('#trophiesBtn b', 'trophyRoom'); setSmall('#trophiesBtn small', 'trophyRoomSub');
  set('#packsBtn b', 'cardPacks'); setSmall('#packsBtn small', 'cardPacksSub');

  set('#settings .stats-rank', 'settings');
  const settingsHeaders = [...document.querySelectorAll('#settings .settings-h')];
  ['profile', 'language', 'gameFeedback', 'appearance', 'help', 'data'].forEach((key, i) => {
    if (settingsHeaders[i]) settingsHeaders[i].textContent = t(key);
  });
  set('#editProfileBtn b', 'editIdentity'); setSmall('#editProfileBtn small', 'editIdentitySub');
  setText('languageTitle', 'language');
  const feedbackRows = document.querySelectorAll('#settings .settings-card[aria-label="Game feedback settings"] .setting-row');
  if (feedbackRows[0]) { feedbackRows[0].querySelector('b').textContent = t('haptics'); feedbackRows[0].querySelector('small').textContent = t('hapticsSub'); }
  if (feedbackRows[1]) { feedbackRows[1].querySelector('b').textContent = t('sound'); feedbackRows[1].querySelector('small').textContent = t('soundSub'); }
  if (feedbackRows[2]) { feedbackRows[2].querySelector('b').textContent = t('gameSpeed'); feedbackRows[2].querySelector('small').textContent = t('speedSub'); }
  set('#appearancePacksBtn b', 'cardPack');
  set('#rulesBtn b', 'howToPlay'); setSmall('#rulesBtn small', 'howToPlaySub');
  set('#aboutBtn b', 'aboutPrivacySupport'); setSmall('#aboutBtn small', 'aboutPrivacySupportSub');
  setText('statsReset', 'resetStats'); setText('resetAllBtn', 'resetEverything');
  renderAbout();

  set('#modeMenuBack + .stats-rank', mode === 'train' ? 'train' : 'solo');
  set('.resume-label', 'resumeGame');
  setText('resumeDiscard', 'discard'); setText('resumeBtn', 'resume'); setText('newGameBtn', 'newGame');
  set('.diff-label', 'difficulty');
  document.querySelector('[data-diff="easy"]') && (document.querySelector('[data-diff="easy"]').textContent = t('easy'));
  document.querySelector('[data-diff="normal"]') && (document.querySelector('[data-diff="normal"]').textContent = t('normal'));
  document.querySelector('[data-diff="hard"]') && (document.querySelector('[data-diff="hard"]').textContent = t('hard'));
  const modeAuto = document.querySelector('#modeAutoAdvance span:first-child');
  if (modeAuto) modeAuto.textContent = t('autoAdvanceOptimal');

  set('#daily .stats-rank', 'dailyDeal');
  setText('dailyPlayBtn', 'startOfficial');
  const dailyRecords = document.querySelectorAll('.daily-records span');
  if (dailyRecords[0]) dailyRecords[0].textContent = t('currentStreak');
  if (dailyRecords[1]) dailyRecords[1].textContent = t('personalBest');
  set('#daily .stats-h', 'recentDeals');
  set('#team .stats-rank', 'yourTeam');
  const teamLabel = document.querySelector('#team .field span');
  if (teamLabel) teamLabel.textContent = t('teamName');
  set('#team .stats-h', 'yourAlly');
  set('#stats .stats-h', 'badges');
  set('#tournaments .stats-rank', 'tournaments');
  setText('tourPlayBtn', 'startOfficial');
  set('#trophies .stats-rank', 'trophyRoom');
  const trophyHeads = document.querySelectorAll('#trophies .stats-h');
  if (trophyHeads[0]) trophyHeads[0].textContent = t('titles');
  if (trophyHeads[1]) trophyHeads[1].textContent = t('cups');
  if (trophyHeads[2]) trophyHeads[2].textContent = t('prestigeSeasons');
  if (trophyHeads[3]) trophyHeads[3].textContent = t('rivals');
  set('#packs .stats-rank', 'cardPacks');
  setText('aboutTitle', 'about');
  const scoreThem = document.querySelector('.team-them .score-label');
  if (scoreThem && scoreThem.textContent === 'Them') scoreThem.textContent = t('them');
  const partnerSeat = document.querySelector('.seat-top .seat-name');
  if (partnerSeat && partnerSeat.textContent === 'Partner') partnerSeat.textContent = t('partner');
  const westSeat = document.querySelector('.seat-left .seat-name');
  if (westSeat && westSeat.textContent === 'West') westSeat.textContent = t('west');
  const eastSeat = document.querySelector('.seat-right .seat-name');
  if (eastSeat && eastSeat.textContent === 'East') eastSeat.textContent = t('east');
  const youSeat = document.querySelector('.seat-name-you');
  if (youSeat && youSeat.textContent === 'You') youSeat.textContent = t('you');
  const discardLabel = document.querySelector('#discardTarget span');
  if (discardLabel) discardLabel.textContent = t('discard');

  const coachSummary = document.querySelector('#coachDetails summary');
  if (coachSummary) coachSummary.textContent = t('readReasoning');
  setText('coachNext', 'gotIt');
  const coachAuto = document.querySelector('#coachAuto span:last-child');
  if (coachAuto) coachAuto.innerHTML = `${escapeHTML(t('autoAdvanceOptimal'))} <b id="coachAutoState">${escapeHTML(feedback.autoAdvance ? t('on') : t('off'))}</b>`;
  setText('modalBtn', 'continue');
  setText('faceoffSecondary', 'backToMenu'); setText('faceoffPrimary', 'resume');
  setText('lastTrickClose', 'close');
  set('#lastTrickScrim .modal-kicker', 'previousTrick'); setText('lastTrickTitle', 'lastTrick');
  setText('rewardBtn', 'sweet');
  setText('confirmCancel', 'cancel'); setText('confirmOk', 'confirm');
  setText('confirmTitle', 'areYouSure');
  setText('languageModalKicker', 'settings'); setText('languageModalTitle', 'chooseLanguage');
  setText('languageModalDesc', 'languagePickerSub'); setText('languageCancel', 'cancel');
  set('#profileScrim .modal-kicker', 'profile'); setText('profileTitle', 'yourIdentity');
  const profileFields = document.querySelectorAll('#profileScrim .field span');
  if (profileFields[0]) profileFields[0].textContent = t('yourName');
  if (profileFields[1]) profileFields[1].textContent = t('teamName');
  setText('profileCancel', 'cancel'); setText('profileSave', 'save');
  set('#welcomeScrim .modal-kicker', 'welcome'); setText('welcomeTitle', 'welcomeTitle');
  set('#welcomeScrim .modal-score', 'welcomeText'); setText('welcomeTutorial', 'startTutorial'); setText('welcomeSkip', 'skipForNow');
  setText('rulesTitle', 'howToPlay'); setHTML('rulesBody', 'rulesHTML'); setText('rulesClose', 'gotIt');
  set('#exitScrim .modal-kicker', 'currentGame'); setText('exitTitle', 'leaveTable');
  setText('leaveBtn', 'saveAndLeave'); setText('stayBtn', 'keepPlaying'); setText('discardLeaveBtn', 'leaveWithoutSaving');

  document.querySelectorAll('[aria-label="Back to menu"]').forEach((el) => el.setAttribute('aria-label', t('backToMenu')));
  $('hintBtn')?.setAttribute('aria-label', t('coach'));
  renderCoachAutoState();
  renderSpeedToggle();
}

function refreshLocalizedScreen() {
  renderSettings();
  if ($('table')?.classList.contains('active') && S) renderAll();
  if ($('daily')?.classList.contains('active')) openDaily();
  if ($('stats')?.classList.contains('active')) renderStats();
  if ($('packs')?.classList.contains('active')) renderPacks();
  if ($('trophies')?.classList.contains('active')) openTrophies();
  if ($('modeMenu')?.classList.contains('active')) openModeMenu(mode);
  if ($('about')?.classList.contains('active')) renderAbout();
}

// ─── card packs ───
function openPacks(returnScreen = 'clubhouse') {
  packsReturnScreen = returnScreen;
  renderPacks();
  show('packs');
}

function openSettings() {
  renderSettings();
  show('settings');
}

function renderSettings() {
  const pack = packById(cosmetics.active);
  const summary = $('settingsPackSummary');
  if (summary) summary.textContent = `${pack.name} ${t('equipped')}`;
  const preview = $('settingsPackPreview');
  if (preview) preview.className = `settings-pack-preview theme-${pack.id}`;
  renderLanguagePicker();
  renderSpeedToggle();
}

function openAbout() {
  renderAbout();
  show('about');
}

function renderAbout() {
  setText('aboutTitle', 'about');
  const version = $('aboutVersion');
  if (version) version.textContent = t('appVersion', {
    version: APP_INFO.versionName,
    code: APP_INFO.versionCode,
  });
  setText('aboutPrivacyHeader', 'privacy');
  setText('aboutPrivacyCopy', 'privacyCopy');
  setText('aboutResetCopy', 'resetLocalDataCopy');
  setText('aboutSupportHeader', 'support');
  setText('aboutSupportCopy', 'supportCopy', { email: APP_INFO.supportEmail });
  setText('aboutBuildHeader', 'build');
  setText('aboutAppIdLabel', 'applicationId');
  setText('aboutDataLabel', 'dataStorage');
  setText('aboutDataValue', 'localDeviceOnly');
  const appId = $('aboutAppId');
  if (appId) appId.textContent = APP_INFO.applicationId;
}

function renderPacks() {
  const grid = $('packsGrid');
  grid.innerHTML = '';
  for (const pack of PACKS) {
    const owned = isOwned(cosmetics, pack.id);
    const active = cosmetics.active === pack.id;
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'pack-tile' + (active ? ' active' : '') + (owned ? '' : ' locked');
    tile.dataset.packId = pack.id;
    const state = active ? 'Active' : owned ? 'Tap to use' : unlockHint(pack);
    tile.innerHTML =
      `<div class="pack-preview theme-${pack.id}"><span class="pp-back"></span><span class="pp-card">A♥</span></div>` +
      `<div class="pack-name">${pack.name}</div>` +
      `<div class="pack-state">${state}</div>`;
    tile.onclick = () => selectPack(pack.id);
    grid.appendChild(tile);
  }
}

function selectPack(id) {
  if (!isOwned(cosmetics, id)) { feedbackEvent('card'); return; } // locked — no-op
  setActivePack(cosmetics, id);
  saveCosmetics(cosmetics);
  applyPack(cosmetics.active);
  feedbackEvent('bid');
  renderPacks();
  renderSettings();
}

// ─── your team (ally + name) ───
function openTeam() {
  $('teamNameInput').value = profile.teamName === 'Us' ? '' : profile.teamName;
  renderAllyGrid();
  show('team');
}

function renderAllyGrid() {
  const grid = $('allyGrid');
  grid.innerHTML = '';
  // candidates: the default ally + every rival (locked until beaten)
  const pool = [DEFAULT_ALLY, ...Object.keys(RIVALS)];
  const seen = new Set();
  for (const id of pool) {
    if (seen.has(id)) continue; seen.add(id);
    const r = ROSTER[id]; if (!r) continue;
    const unlocked = isAllyUnlocked(id, rivals);
    const active = allyId === id;
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'ally-tile' + (active ? ' active' : '') + (unlocked ? '' : ' locked');
    const profile = allyProfile(id);
    const sub = active ? 'Selected ally' : unlocked ? 'Tap to choose' : 'Beat them to recruit';
    tile.innerHTML =
      `<div class="ally-av">${portraitSVG(id, active ? 'gloating' : 'neutral') || r.emoji}</div>` +
      `<div class="ally-name">${r.name}</div>` +
      `<div class="ally-sub">${sub}</div>` +
      (unlocked
        ? `<div class="ally-style"><span>${profile.label}</span>${profile.description}</div>`
        : '');
    if (unlocked) tile.onclick = () => { allyId = saveAlly(id); renderAllyGrid(); feedbackEvent('bid'); };
    else tile.onclick = () => feedbackEvent('card');
    grid.appendChild(tile);
  }
}

// ─── trophy room ───
function openTrophies() { renderTrophies(); show('trophies'); }

function renderTrophies() {
  // titles
  const tw = $('titlesWrap');
  tw.innerHTML = '';
  if (!career.titles.length) {
    tw.innerHTML = '<span class="title-chip empty">No titles yet — win a cup</span>';
  } else {
    for (const title of career.titles) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'title-chip' + (career.activeTitle === title ? ' active' : '');
      chip.textContent = title;
      chip.onclick = () => {
        setActiveTitle(career, career.activeTitle === title ? null : title);
        saveCareer(career);
        renderTrophies();
        refreshProfileName();
      };
      tw.appendChild(chip);
    }
  }
  // cups
  const cw = $('cupsWrap');
  cw.innerHTML = '';
  for (const tour of TOURNAMENTS) {
    const won = career.cupsWon.includes(tour.id);
    const row = document.createElement('div');
    row.className = 'cup-row' + (won ? ' won' : '');
    row.innerHTML = `<span>${tour.name}</span><span class="cup-state">${won ? 'Champion 🏆' : '—'}</span>`;
    cw.appendChild(row);
  }
  // prestige seasons
  const pw = $('prestigeWrap');
  const prestige = prestigeFor(tournaments);
  if (pw) {
    const next = prestige.completed + 1;
    pw.innerHTML =
      `<div class="prestige-card"><b>${escapeHTML(prestigeLabel(prestige.active ? prestige.level : next))}</b>` +
      `<small>${prestige.active
        ? 'Season active — clear all five cups again to complete it.'
        : prestige.completed
          ? `${prestige.completed} season${prestige.completed === 1 ? '' : 's'} completed. Next season is ready after the cup ladder is complete.`
          : allTournamentsComplete(tournaments)
            ? 'The crown is yours. Start Prestige from the Tournaments screen to defend it.'
            : 'Beat The Masters to unlock Prestige Seasons.'}</small></div>`;
  }
  // rivals
  const rw = $('rivalsWrap');
  rw.innerHTML = '';
  for (const id of Object.keys(RIVALS)) {
    const r = RIVALS[id];
    const rec = h2h(rivals, id);
    const row = document.createElement('div');
    row.className = 'rival-row' + (rec.beaten ? ' beaten' : '');
    row.innerHTML =
      `<div class="rival-av">${portraitSVG(id, rec.beaten ? 'rattled' : 'smug')}</div>` +
      `<div class="rival-meta"><div class="rival-name">${r.name} · ${r.title}</div>` +
      `<div class="rival-rec">${rec.wins || rec.losses ? `You ${rec.wins}–${rec.losses}` : 'Not yet faced'}</div></div>` +
      `<div class="rival-badge">${rec.beaten ? '✅' : '🔒'}</div>`;
    rw.appendChild(row);
  }
}

// ─── tournaments ───
function openTournaments() { syncPostTournamentAchievements(); renderTournaments(); show('tournaments'); }

function syncPostTournamentAchievements() {
  let changed = false;
  if (allTournamentsComplete(tournaments)) changed = Stats.unlockBadge(stats, 'allCups') || changed;
  if (Object.keys(RIVALS).every((id) => h2h(rivals, id).beaten)) changed = Stats.unlockBadge(stats, 'rivalSweep') || changed;
  if (changed) Stats.saveStats(stats);
}

// ─── daily deal ───
function formatDailyDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(y, m - 1, d));
}

function dailySavedGame(dateKey) {
  const saved = readSavedGame('daily');
  if (!saved) return null;
  if (saved.dailyCtx?.dateKey !== dateKey) {
    clearSavedGame('daily');
    return null;
  }
  return saved;
}

function openDaily() {
  dailyStore = loadDaily();
  const dateKey = localDateKey();
  const config = dailyConfig(dateKey);
  const entry = officialEntry(dailyStore, dateKey);
  const saved = dailySavedGame(dateKey);
  const ally = ROSTER[config.ally];
  const west = ROSTER[config.opponents[0]];
  const east = ROSTER[config.opponents[1]];

  $('dailyDate').textContent = formatDailyDate(dateKey);
  $('dailyLineup').innerHTML = [
    { id: config.opponents[0], role: t('west'), data: west },
    { id: config.ally, role: t('partner'), data: ally, ally: true },
    { id: config.opponents[1], role: t('east'), data: east },
  ].map((p) =>
    `<div class="daily-player${p.ally ? ' ally' : ''}">` +
    `<div class="daily-avatar">${portraitSVG(p.id, 'neutral') || p.data?.emoji || ''}</div>` +
    `<b>${p.data?.name || 'Player'}</b><span>${p.role}</span></div>`
  ).join('');
  $('dailyMeta').innerHTML =
    `<span>${config.difficulty.toUpperCase()} AI</span><span>Fixed seeded deals</span><span>First to 10</span>`;

  const scoreEl = $('dailyScore');
  const play = $('dailyPlayBtn');
  if (saved) {
    const practice = !!saved.dailyCtx?.practice;
    $('dailyStatus').textContent = practice ? t('replayProgress') : t('officialProgress');
    scoreEl.hidden = !(practice && entry);
    if (practice && entry) scoreEl.textContent = entry.score;
    play.className = `btn ${practice ? 'btn-glass' : 'btn-primary'}`;
    play.textContent = t('inProgress', { us: saved.state.scores[0], them: saved.state.scores[1] });
    play.onclick = () => resumeGame('daily');
    $('dailyNote').textContent = practice
      ? t('dailyReplayNote')
      : t('saveDailyDesc');
  } else if (entry) {
    $('dailyStatus').textContent = entry.forfeit ? t('officialForfeited') : entry.won ? t('officialWin') : t('officialComplete');
    scoreEl.hidden = false;
    scoreEl.textContent = entry.score;
    play.className = 'btn btn-glass';
    play.textContent = t('replayPractice');
    play.onclick = () => startDaily();
    $('dailyNote').textContent = t('dailyLockedNote');
  } else {
    $('dailyStatus').textContent = t('officialReady');
    scoreEl.hidden = true;
    play.className = 'btn btn-primary';
    play.textContent = t('startOfficial');
    play.onclick = () => startDaily();
    $('dailyNote').textContent = t('dailyInitialNote');
  }

  const streak = dailyStreak(dailyStore, dateKey);
  $('dailyStreak').textContent = t('days', { n: streak, suffix: streak === 1 ? '' : 's' });
  $('dailyBest').textContent = dailyBest(dailyStore);
  const recent = recentDailyEntries(dailyStore);
  $('dailyHistory').innerHTML = recent.length
    ? recent.map((e) =>
      `<div class="daily-history-row"><span>${e.dateKey}${e.forfeit ? ' · Forfeit' : e.won ? ' · Win' : ' · Loss'}</span><b>${e.score}</b></div>`
    ).join('')
    : `<div class="daily-history-empty">${escapeHTML(t('completeFirstDaily'))}</div>`;
  show('daily');
}

function startDaily() {
  const config = dailyConfig();
  const hasOfficialEntry = !!officialEntry(loadDaily(), config.dateKey);
  startGame('daily', config.difficulty, {
    ...config,
    practice: hasOfficialEntry,
    dealIndex: 0,
    actionIndex: 0,
    metrics: { hands: 0, euchres: 0, aloneWins: 0 },
  });
}

function recordDailyForfeit() {
  if (!dailyCtx || dailyCtx.practice) return;
  dailyStore = loadDaily();
  completeDaily(dailyStore, dailyCtx.dateKey, {
    score: 0, won: false, forfeit: true, scores: S?.scores?.slice?.() || [0, 0],
    hands: dailyCtx.metrics?.hands || 0, euchres: dailyCtx.metrics?.euchres || 0,
    aloneWins: dailyCtx.metrics?.aloneWins || 0,
  });
  saveDaily(dailyStore);
}

function finishDaily() {
  if (!dailyCtx || !S) return;
  const result = {
    score: scoreDaily({
      won: S.winner === 0,
      scores: S.scores,
      hands: dailyCtx.metrics.hands,
      euchres: dailyCtx.metrics.euchres,
      aloneWins: dailyCtx.metrics.aloneWins,
    }),
    won: S.winner === 0,
    forfeit: false,
    scores: S.scores.slice(),
    hands: dailyCtx.metrics.hands,
    euchres: dailyCtx.metrics.euchres,
    aloneWins: dailyCtx.metrics.aloneWins,
  };
  if (!dailyCtx.practice) {
    dailyStore = loadDaily();
    completeDaily(dailyStore, dailyCtx.dateKey, result);
    saveDaily(dailyStore);
  }
}

function renderTournaments() {
  const grid = $('tourGrid');
  grid.innerHTML = '';
  const prestige = prestigeFor(tournaments);
  if (prestige.active || canStartPrestigeSeason(tournaments)) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tour-tile prestige';
    if (prestige.active) {
      tile.innerHTML =
        `<div class="tour-name">${escapeHTML(prestigeLabel(prestige.level))}</div>` +
        `<div class="tour-blurb">Defend the crown by clearing every cup again.</div>` +
        `<div class="tour-foot"><span class="tour-status">Season active</span>` +
        `<span class="tour-reward">🏆 Prestige title</span></div>`;
      tile.onclick = () => openTournamentDetail((TOURNAMENTS.find((t) => !progressFor(tournaments, t.id).done) || TOURNAMENTS[0]).id);
    } else {
      tile.innerHTML =
        `<div class="tour-name">${escapeHTML(prestigeLabel(prestige.completed + 1))}</div>` +
        `<div class="tour-blurb">You conquered The Masters. Start a new season and run the full ladder again.</div>` +
        `<div class="tour-foot"><span class="tour-status">Ready</span>` +
        `<span class="tour-reward">✨ New achievements</span></div>`;
      tile.onclick = () => startPrestigeSeason();
    }
    grid.appendChild(tile);
  }
  for (const tour of TOURNAMENTS) {
    const unlocked = isTournamentUnlocked(tour, tournaments);
    const prog = progressFor(tournaments, tour.id);
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tour-tile' + (prog.done ? ' done' : '') + (unlocked ? '' : ' locked');
    const status = prog.done ? 'Champion 🏆'
      : !unlocked ? `Win ${tournamentById(tour.requires)?.name}`
      : `Round ${prog.cleared + 1} of ${tour.rounds.length}`;
    const reward = packById(tour.reward.pack);
    tile.innerHTML =
      `<div class="tour-name">${tour.name}</div>` +
      `<div class="tour-blurb">${tour.blurb}</div>` +
      `<div class="tour-foot"><span class="tour-status">${status}</span>` +
      `<span class="tour-reward">🎁 ${reward.name}</span></div>`;
    if (unlocked) tile.onclick = () => openTournamentDetail(tour.id);
    else tile.onclick = () => feedbackEvent('card');
    grid.appendChild(tile);
  }
}

async function startPrestigeSeason() {
  const next = prestigeFor(tournaments).completed + 1;
  const ok = await confirmDialog({
    title: `${prestigeLabel(next)}?`,
    desc: 'This starts the cup ladder over for a prestige run. Your earned cups, titles, packs, stats, and rival records stay kept.',
    ok: 'Start season',
    cancel: 'Not yet',
  });
  if (!ok) return;
  const res = beginPrestigeSeason(tournaments);
  if (!res.started) return;
  saveTournaments(tournaments);
  feedbackEvent('reward');
  renderTournaments();
  openTournamentDetail(TOURNAMENTS[0].id);
}

function openTournamentDetail(id) {
  const tour = tournamentById(id);
  if (!tour) return;
  const prog = progressFor(tournaments, id);
  const next = currentRound(tournaments, id);
  $('tourDetailName').textContent = tour.name;

  const ladder = $('tourLadder');
  ladder.innerHTML = '';
  tour.rounds.forEach((round, i) => {
    const cleared = i < prog.cleared;
    const isNext = i === next;
    const row = document.createElement('div');
    row.className = 'ladder-row' + (cleared ? ' cleared' : '') + (isNext ? ' next' : '');
    const opps = round.opponents.map((cid) => {
      const r = ROSTER[cid]; if (!r) return '';
      return `<span class="opp-chip opp" style="border-color:${r.color}"><span class="opp-emoji">${r.emoji}</span>${r.name}</span>`;
    }).join('');
    row.innerHTML =
      `<div class="ladder-head"><span class="ladder-n">Round ${i + 1}</span>` +
      `<span class="ladder-diff diff-${round.difficulty}">${round.difficulty}</span>` +
      `${cleared ? '<span class="ladder-check">✓</span>' : ''}</div>` +
      `<div class="ladder-opps">${opps}</div>`;
    ladder.appendChild(row);
  });

  const btn = $('tourPlayBtn');
  const tourSave = readSavedGame('tour');
  const hasResume = tourSave && tourSave.tourCtx && tourSave.tourCtx.id === id;
  if (prog.done) {
    btn.textContent = 'Cup complete 🏆';
    btn.disabled = true;
    $('tourIntro').textContent = `You hold the ${tour.name}. Reward unlocked: ${packById(tour.reward.pack).name} pack.`;
    btn.onclick = null;
  } else if (hasResume) {
    btn.disabled = false;
    btn.textContent = `Resume match (round ${tourSave.tourCtx.round + 1})`;
    $('tourIntro').textContent = `Match in progress — ${tourSave.state.scores[0]}–${tourSave.state.scores[1]}.`;
    btn.onclick = () => resumeGame('tour');
  } else {
    btn.disabled = false;
    btn.textContent = next === 0 ? 'Start cup' : `Play round ${next + 1}`;
    const [rid] = pickCaptain(resolveOpponents(tour.rounds[next].opponents), tour);
    const r = rivalById(rid) || ROSTER[rid];
    $('tourIntro').textContent = `${r.name}: “${isRival(rid) ? rivalLine(rid, 'faceoff') : characterLine(rid, 'intro')}”`;
    btn.onclick = () => startTournamentRound(id, next);
  }
  show('tournamentDetail');
}

// The opponent who is the "face" of a round: the cup boss if present, else a
// defined rival, else the East seat.
// Swap out any opponent that is your current ally so they never appear on both
// sides of the table.
const SUB_POOL = ['duke', 'pip', 'coral', 'vera', 'nyx', 'rex', 'sage', 'kit'];
function resolveOpponents(opps) {
  const out = [];
  for (const id of opps) {
    if (id !== allyId) { out.push(id); continue; }
    const sub = SUB_POOL.find((c) => c !== allyId && !opps.includes(c) && !out.includes(c)) || 'duke';
    out.push(sub);
  }
  return out;
}

// Pick the captain (the face/speaker) from a resolved opponent pair, plus the sidekick.
function pickCaptain(opponents, tour) {
  const cap = (tour.boss && opponents.includes(tour.boss))
    ? tour.boss
    : (opponents.find(isRival) || opponents[opponents.length - 1]);
  const side = opponents.find((id) => id !== cap) ?? opponents[0];
  return [cap, side];
}

function recordLabel(rid) {
  const rec = h2h(rivals, rid);
  if (!rec.wins && !rec.losses) return 'First meeting';
  return `Head-to-head — You ${rec.wins}–${rec.losses}`;
}

function venueLabel(tour) {
  return ({
    cellar: 'Back room',
    parlour: 'Brass table',
    penthouse: 'Highrise table',
    vault: 'Private vault',
    gala: 'Masters gala',
  }[tour?.venue]) || 'Tournament table';
}

function opponentPairName(opponents) {
  const [a, b] = opponents || [];
  return a && b ? teamNameForPair(a, b) : 'Opponent team';
}

function faceoffMetaHTML(items = []) {
  return items.map((it) =>
    `<div class="faceoff-meta-card${it.wide ? ' wide' : ''}"><span>${escapeHTML(it.k)}</span><b>${escapeHTML(it.v)}</b></div>`
  ).join('');
}

// Reusable duo overlay for the pre-match face-off and post-match reaction.
// captain (speaks + holds H2H) is shown large; sidekick smaller.
function showFaceoff({ captain, sidekick, kicker, expr, line, primary, secondary, sub, meta = [] }) {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    const cap = rivalById(captain) || ROSTER[captain] || { name: 'Rival' };
    $('faceoffKicker').textContent = kicker || '';
    $('faceoffPortrait').innerHTML = portraitSVG(captain, expr) || (ROSTER[captain]?.emoji || '');
    $('faceoffName').textContent = cap.name || 'Rival';
    $('faceoffTitle').textContent = rivalById(captain)?.title || '';
    // sidekick
    const sideWrap = $('faceoffPortrait2').parentElement;
    if (sidekick && ROSTER[sidekick]) {
      sideWrap.style.display = '';
      document.querySelector('.ff-amp').style.display = '';
      $('faceoffPortrait2').innerHTML = portraitSVG(sidekick, 'neutral') || ROSTER[sidekick].emoji;
      $('faceoffSidename').textContent = ROSTER[sidekick].name;
    } else {
      sideWrap.style.display = 'none';
      document.querySelector('.ff-amp').style.display = 'none';
    }
    $('faceoffSub').textContent = sub || '';
    $('faceoffMeta').innerHTML = faceoffMetaHTML(meta);
    $('faceoffLine').textContent = line ? `“${line}”` : '';
    const pBtn = $('faceoffPrimary'), sBtn = $('faceoffSecondary');
    pBtn.textContent = primary;
    if (secondary) { sBtn.textContent = secondary; sBtn.hidden = false; } else { sBtn.hidden = true; }
    const ov = $('faceoff');
    ov.classList.add('show'); ov.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => pBtn.focus());
    const done = (val) => {
      pendingResolve = null;
      ov.classList.remove('show'); ov.setAttribute('aria-hidden', 'true');
      resolve(val);
    };
    pBtn.onclick = () => done('primary');
    sBtn.onclick = () => done('secondary');
  });
}

async function startTournamentRound(id, roundIndex) {
  const tour = tournamentById(id);
  const round = tour.rounds[roundIndex];
  const opponents = resolveOpponents(round.opponents); // never your ally
  const [cap, side] = pickCaptain(opponents, tour);
  const reward = packById(tour.reward.pack);
  applyTableStyle(tour.venue || 'casino'); // venue ambiance behind the face-off
  const choice = await showFaceoff({
    captain: cap, sidekick: side, kicker: `${tour.name} — Round ${roundIndex + 1}`, expr: 'smug',
    sub: recordLabel(cap),
    meta: [
      { k: 'Venue', v: venueLabel(tour) },
      { k: 'Difficulty', v: round.difficulty.toUpperCase() },
      { k: 'Opponents', v: opponentPairName(opponents), wide: true },
      { k: 'Cup reward', v: `${reward.name} pack`, wide: true },
    ],
    line: isRival(cap) ? rivalLine(cap, 'faceoff') : characterLine(cap, 'intro'),
    primary: 'Deal', secondary: 'Back',
  });
  if (choice !== 'primary') { applyTableStyle('casino'); return; }
  startGame('tour', round.difficulty, { id, round: roundIndex, opponents, venue: tour.venue, captain: cap, sidekick: side });
}

function refreshRivalAchievements() {
  if (Object.keys(RIVALS).every((id) => h2h(rivals, id).beaten)) {
    if (Stats.unlockBadge(stats, 'rivalSweep')) Stats.saveStats(stats);
  }
}

async function handleTournamentEnd(won) {
  const tour = tournamentById(tourCtx.id);
  const cap = tourCtx.captain || pickCaptain(tourCtx.opponents || [], tour)[0];
  const side = tourCtx.sidekick || pickCaptain(tourCtx.opponents || [], tour)[1];
  recordVsRival(rivals, cap, won); saveRivals(rivals);
  refreshRivalAchievements();

  let completed = false;
  let seasonCompleted = false;
  let completedSeasonLevel = 0;
  const prestigeWasActive = prestigeFor(tournaments).active;
  if (won) {
    const res = recordRoundWin(tournaments, tour.id, tour.rounds.length);
    completed = res.justCompleted;
    if (completed && prestigeWasActive) {
      const season = completePrestigeSeason(tournaments);
      seasonCompleted = season.justCompleted;
      completedSeasonLevel = season.completed;
    }
    saveTournaments(tournaments);
  }

  // post-match: the captain reacts to the result
  await showFaceoff({
    captain: cap, sidekick: side, kicker: won ? 'Beaten' : 'You lost',
    expr: won ? 'rattled' : 'gloating',
    sub: recordLabel(cap),
    meta: [
      { k: 'Result', v: won ? `${tour.name} round cleared` : `${tour.name} round remains`, wide: true },
      { k: 'Score', v: `${profile.teamName} ${S.scores[0]} · ${opponentTeamName()} ${S.scores[1]}`, wide: true },
    ],
    line: isRival(cap) ? rivalLine(cap, won ? 'lose' : 'win') : '',
    primary: won ? 'Continue' : 'Try again',
  });

  if (completed) {
    if (ownPack(cosmetics, tour.reward.pack)) saveCosmetics(cosmetics);
    if (tour.reward.title) awardTitle(career, tour.reward.title);
    if (seasonCompleted) awardTitle(career, `${prestigeLabel(completedSeasonLevel)} Champion`);
    recordCup(career, tour.id);
    saveCareer(career);
    if (Stats.unlockBadge(stats, tour.reward.badge)) Stats.saveStats(stats);
    Stats.recordTournamentCup(stats, { prestige: prestigeWasActive, seasonComplete: seasonCompleted });
    Stats.saveStats(stats);
    emit('reward');
    await showReward(tour, { prestige: prestigeWasActive, seasonLevel: completedSeasonLevel });
  }

  const id = tourCtx.id;
  tourCtx = null;
  activeCharacters = CHARACTERS;
  applyTableStyle('casino');
  openTournamentDetail(id);
}

function showReward(tour, { prestige = false, seasonLevel = 0 } = {}) {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    const pack = packById(tour.reward.pack);
    $('rewardKicker').textContent = prestige ? `${tour.name} — Defended` : `${tour.name} — Champion`;
    $('rewardPackPreview').className = `reward-pack theme-${pack.id}`;
    $('rewardTitle').textContent = prestige
      ? `${tour.name} defended`
      : `${pack.name} unlocked`;
    $('rewardDesc').textContent = prestige
      ? `Prestige pressure, same old table. You cleared ${tour.name} again.`
      : `${pack.blurb} You cleared every table in ${tour.name}.`;
    $('rewardUnlocks').innerHTML =
      (prestige
        ? `<div class="reward-unlock"><span>Prestige cup</span><span>${escapeHTML(tour.name)}</span></div>`
        : `<div class="reward-unlock"><span>Card pack</span><span>${escapeHTML(pack.name)}</span></div>`) +
      (!prestige && tour.reward.title ? `<div class="reward-unlock"><span>Title</span><span>${escapeHTML(tour.reward.title)}</span></div>` : '') +
      (seasonLevel ? `<div class="reward-unlock"><span>Season</span><span>${escapeHTML(prestigeLabel(seasonLevel))} complete</span></div>` : '') +
      `<div class="reward-unlock"><span>Badge</span><span>${escapeHTML(tour.name)} Champion</span></div>`;
    const chip = $('rewardTitleChip');
    if (seasonLevel) { chip.hidden = false; chip.textContent = `Title earned — ${prestigeLabel(seasonLevel)} Champion`; }
    else if (!prestige && tour.reward.title) { chip.hidden = false; chip.textContent = `Title earned — ${tour.reward.title}`; }
    else chip.hidden = true;
    openModal('rewardScrim', 'rewardBtn');
    $('rewardBtn').onclick = () => {
      pendingResolve = null;
      closeModal('rewardScrim');
      resolve(true);
    };
  });
}

// ─── public entry ───
export function startGame(m, diff = 'normal', ctx = null) {
  cancelActiveRun();
  mode = m;
  difficulty = diff;
  perspective = 0;
  trainGame = [];
  trainHand = [];
  tourCtx = m === 'tour' ? ctx : null;
  dailyCtx = m === 'daily' ? ctx : null;
  activeCharacters = buildCharacters(tourCtx || dailyCtx);
  applyTableStyle(tourCtx?.venue || 'casino');
  S = newGame();
  const run = ++activeRun;
  show('table');
  saveGame();
  gameLoop(run, false);
}

function updateTutorialGuide(key = 'tutorialIntro', vars = {}) {
  const guide = $('tutorialGuide');
  if (!guide) return;
  const active = isTutorial();
  guide.hidden = !active;
  if (!active) return;
  $('tutorialGuideTitle').textContent = t('guidedHand');
  $('tutorialGuideText').textContent = t(key, vars);
  $('tutorialSkip').textContent = t('skipTutorial');
}

function hideTutorialGuide() {
  const guide = $('tutorialGuide');
  if (guide) guide.hidden = true;
}

function skipTutorial() {
  if (!isTutorial()) return;
  cancelActiveRun();
  S = null;
  hideTutorialGuide();
  clearSavedGame('tutorial');
  applyTableStyle('casino');
  show('menu');
}

function showTutorialComplete() {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    $('modalKicker').textContent = t('guidedHand');
    $('modalTitle').textContent = t('tutorialCompleteTitle');
    $('modalScore').textContent = t('tutorialCompleteText');
    $('modalSummary').innerHTML = '';
    $('modalRecap').style.display = 'none';
    $('modalBtn').textContent = t('startSolo');
    const scrim = $('modalScrim');
    scrim.classList.add('show');
    scrim.setAttribute('aria-hidden', 'false');
    syncBackgroundInert();
    requestAnimationFrame(() => $('modalBtn').focus());
    $('modalBtn').onclick = () => {
      pendingResolve = null;
      scrim.classList.remove('show');
      scrim.setAttribute('aria-hidden', 'true');
      syncBackgroundInert();
      resolve('solo');
    };
  });
}

// ─── mode submenu (Solo / Train) ───
const MODE_LABEL = { ai: 'solo', train: 'train' };

export function openModeMenu(m) {
  $('modeMenuTitle').textContent = t(MODE_LABEL[m] || 'solo');
  // resume card
  const summary = savedGameSummary(m);
  const card = $('resumeCard');
  card.hidden = !summary;
  if (summary) $('resumeSub').textContent = summary;
  $('resumeBtn').onclick = () => resumeGame(m);
  $('resumeDiscard').onclick = () => { clearSavedGame(m); openModeMenu(m); };
  // settings: difficulty (ai/train), auto-advance (train)
  const diffRow = $('modeDiffRow');
  diffRow.hidden = false;
  if (!diffRow.hidden) {
    const cur = feedback.modeDiff[m] || 'normal';
    diffRow.querySelectorAll('.seg-opt').forEach((o) => {
      const on = o.dataset.diff === cur;
      o.classList.toggle('active', on);
      o.setAttribute('aria-pressed', String(on));
      o.onclick = () => {
        feedback.modeDiff[m] = o.dataset.diff;
        persistFeedback();
        openModeMenu(m);
      };
    });
  }
  const auto = $('modeAutoAdvance');
  auto.hidden = (m !== 'train');
  if (!auto.hidden) {
    auto.classList.toggle('active', feedback.autoAdvance);
    auto.setAttribute('aria-pressed', String(feedback.autoAdvance));
    auto.querySelector('.preference-state').textContent = feedback.autoAdvance ? t('on') : t('off');
    auto.onclick = () => { feedback.autoAdvance = !feedback.autoAdvance; persistFeedback(); openModeMenu('train'); };
  }
  $('newGameBtn').onclick = () => startGame(m, feedback.modeDiff[m] || 'normal');
  show('modeMenu');
}

// Your chosen ally as a seat character (portrait/name/voice from ROSTER).
function allyChar() {
  const r = ROSTER[allyId] || ROSTER[DEFAULT_ALLY];
  return { ...r, id: ROSTER[allyId] ? allyId : DEFAULT_ALLY };
}

// AI style per seat: your partner (seat 2) uses the selected ally profile;
// tournament opponents use their character style; casual opponents use the
// selected match difficulty (null).
function styleFor(seat) {
  if (seat === 2) return allyProfile(mode === 'daily' ? dailyCtx?.ally : allyId).style;
  return (mode === 'tour' || mode === 'daily') ? (activeCharacters[seat]?.style || null) : null;
}

// Seat characters for a game. Seat 2 is always your chosen ally (casual + tour).
// Tournament opponents come from the round (seats 1 & 3).
function buildCharacters(ctx) {
  const fixedAllyId = mode === 'daily' ? ctx?.ally : allyId;
  const allyBase = ROSTER[fixedAllyId] || ROSTER[DEFAULT_ALLY];
  const ally = { ...allyBase, id: ROSTER[fixedAllyId] ? fixedAllyId : DEFAULT_ALLY };
  if (!ctx) return [null, CHARACTERS[1], ally, CHARACTERS[3]];
  const opps = ctx.opponents;
  const west = opps[0], east = opps.length >= 3 ? opps[2] : opps[1]; // tolerate [w,e] or [w,p,e]
  const toChar = (id) => { const r = ROSTER[id]; return r ? { ...r, id } : null; };
  return [null, toChar(west), ally, toChar(east)];
}

export function resumeGame(m) {
  const saved = readSavedGame(m);
  if (!saved) return false;
  cancelActiveRun();
  ({ state: S, mode, difficulty, perspective } = saved);
  tourCtx = saved.tourCtx || null;
  dailyCtx = saved.dailyCtx || null;
  activeCharacters = buildCharacters(tourCtx || dailyCtx);
  applyTableStyle(tourCtx?.venue || 'casino');
  const run = ++activeRun;
  show('table');
  gameLoop(run, true);
  return true;
}

export function savedGameSummary(m) {
  const saved = readSavedGame(m);
  if (!saved) return null;
  return `In progress · ${saved.state.scores[0]}–${saved.state.scores[1]}`;
}

function quietBadge(id, line) {
  if (Stats.unlockBadge(stats, id)) Stats.saveStats(stats);
  if ($('stats')?.classList.contains('active')) renderStats();
  const tagline = document.querySelector('.tagline');
  if (tagline && line) {
    tagline.textContent = line;
    setTimeout(() => { if (tagline.textContent === line) tagline.textContent = t('tagline'); }, 2600);
  }
  emit('reward');
}

function openSecretDrawer() {
  quietBadge('drawer');
  openModal('secretScrim', 'secretClose');
}

function flashTagline(line, ms = 2600) {
  const tagline = document.querySelector('.tagline');
  if (!tagline) return;
  tagline.textContent = line;
  setTimeout(() => { if (tagline.textContent === line) tagline.textContent = t('tagline'); }, ms);
}

let suppressSettingsOpen = false;

function bindQuietBits() {
  const pips = [...document.querySelectorAll('.brand-mark .pip')];
  const target = ['♠', '♥', '♦', '♣'];
  let seen = [];
  pips.forEach((pip) => {
    pip.style.cursor = 'pointer';
    pip.onclick = () => {
      seen.push(pip.textContent.trim());
      seen = seen.slice(-target.length);
      if (seen.join('') === target.join('')) quietBadge('wink', 'Bowers high. Secrets higher.');
    };
  });
  let taps = 0;
  let lastTap = 0;
  $('statsRank').onclick = () => {
    const now = Date.now();
    taps = now - lastTap < 850 ? taps + 1 : 1;
    lastTap = now;
    if (taps >= 7) {
      taps = 0;
      document.body.classList.add('moonlit');
      setTimeout(() => document.body.classList.remove('moonlit'), 4200);
      quietBadge('moon');
    }
  };
  let gearHold = null;
  $('settingsBtn').addEventListener('pointerdown', () => {
    clearTimeout(gearHold);
    gearHold = setTimeout(() => {
      if ($('menu').classList.contains('active')) {
        suppressSettingsOpen = true;
        openSecretDrawer();
      }
    }, 900);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
    $('settingsBtn').addEventListener(eventName, () => clearTimeout(gearHold));
  });
  $('secretClose').onclick = () => closeModal('secretScrim');
  $('secretScrim').onclick = (e) => { if (e.target === $('secretScrim')) closeModal('secretScrim'); };
  $('secretFelt').onclick = () => {
    document.body.classList.add('felt-polished');
    setTimeout(() => document.body.classList.remove('felt-polished'), 3600);
    quietBadge('polish', 'The felt looks suspiciously expensive.');
  };
  $('secretDealer').onclick = () => {
    const lines = [
      'The dealer says: never trust a quiet left bower.',
      'The dealer says: count trump, then count exits.',
      'The dealer says: if they hesitate, remember it.',
    ];
    quietBadge('oracle');
    flashTagline(lines[Math.floor(Math.random() * lines.length)], 3200);
  };
  $('secretCut').onclick = () => {
    const cuts = ['9♣', 'A♥', 'J♠', 'Q♦', '10♠', 'K♣'];
    quietBadge('cut', `You cut to ${cuts[Math.floor(Math.random() * cuts.length)]}. Feels lucky.`);
  };
}

export function bindUI() {
  $('exitBtn').onclick = requestExit;
  $('helpBtn').onclick = () => openModal('rulesScrim', 'rulesClose');
  $('rulesBtn').onclick = () => openModal('rulesScrim', 'rulesClose');
  $('rulesClose').onclick = () => closeModal('rulesScrim');
  $('rulesScrim').onclick = (e) => { if (e.target === $('rulesScrim')) closeModal('rulesScrim'); };
  $('stayBtn').onclick = () => closeModal('exitScrim');
  $('leaveBtn').onclick = () => leaveGame(true);
  $('discardLeaveBtn').onclick = () => leaveGame(false);
  bindPreference('hapticsToggle', 'haptics');
  bindPreference('soundToggle', 'sound');
  bindLanguagePicker();
  bindSpeedToggle();
  bindSpeedStorageSync();
  bindCoachControls();
  initJuice(() => feedback);
  $('hintBtn').onclick = requestHint;
  $('settingsBtn').onclick = () => {
    if (suppressSettingsOpen) { suppressSettingsOpen = false; return; }
    openSettings();
  };
  $('settingsBack').onclick = () => show('menu');
  $('aboutBtn').onclick = openAbout;
  $('aboutBack').onclick = () => show('settings');
  $('clubhouseBtn').onclick = () => show('clubhouse');
  $('clubhouseBack').onclick = () => show('menu');
  $('statsBtn').onclick = openStats;
  $('statsBack').onclick = () => show('clubhouse');
  $('lastTrickBtn').onclick = showLastTrick;
  $('lastTrickClose').onclick = () => closeModal('lastTrickScrim');
  $('lastTrickScrim').onclick = (e) => { if (e.target === $('lastTrickScrim')) closeModal('lastTrickScrim'); };
  $('welcomeTutorial').onclick = () => { dismissWelcome(); startGame('tutorial', 'easy'); };
  $('welcomeSkip').onclick = dismissWelcome;
  $('tutorialSkip').onclick = skipTutorial;
  $('statsReset').onclick = async () => {
    if (await confirmDialog({ desc: 'Reset all your stats and badges? This can’t be undone.' })) {
      stats = Stats.defaultStats();
      Stats.saveStats(stats);
      renderStats();
    }
  };
  $('resetAllBtn').onclick = async () => {
    if (await confirmDialog({ title: 'Reset everything?', desc: 'Wipes stats, packs, allies, tournament progress, profile and saved games. This can’t be undone.' })) {
      resetEverything();
    }
  };
  $('editProfileBtn').onclick = openProfile;
  $('profileCancel').onclick = () => closeModal('profileScrim');
  $('profileSave').onclick = saveProfileEdits;
  refreshProfileName();
  $('appearancePacksBtn').onclick = () => openPacks('settings');
  $('packsBtn').onclick = () => openPacks('clubhouse');
  $('packsBack').onclick = () => { renderSettings(); show(packsReturnScreen); };
  $('modeMenuBack').onclick = () => show('menu');
  $('teamBtn').onclick = openTeam;
  $('teamBack').onclick = () => show('clubhouse');
  $('teamNameInput').oninput = (e) => {
    profile = saveProfile({ playerName: profile.playerName, teamName: sanitizeName(e.target.value, 'Us') });
    applyIdentity();
  };
  $('tournamentsBtn').onclick = openTournaments;
  $('dailyBtn').onclick = openDaily;
  $('dailyBack').onclick = () => show('menu');
  $('tourBack').onclick = () => show('menu');
  $('tourDetailBack').onclick = openTournaments;
  $('trophiesBtn').onclick = openTrophies;
  $('trophiesBack').onclick = () => show('clubhouse');
  bindQuietBits();
  applyPack(cosmetics.active);
  applyTableStyle('casino');
  applyLanguage();
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  window.addEventListener('pagehide', saveGame);
  window.handleNativeBack = () => {
    if (closeTopOverlay()) return true;
    if ($('table').classList.contains('active')) { requestExit(); return true; }
    if ($('tournamentDetail').classList.contains('active')) { openTournaments(); return true; }
    if ($('about').classList.contains('active')) { show('settings'); return true; }
    if (['team', 'stats', 'trophies', 'packs'].some((id) => $(id).classList.contains('active'))) {
      show('clubhouse');
      return true;
    }
    if (!$('menu').classList.contains('active')) { show('menu'); return true; }
    return false;
  };
  maybeWelcome();
}

function maybeWelcome() {
  try {
    const anySave = Object.keys(loadSaves()).length > 0;
    if (localStorage.getItem('euchre.seenWelcome') || anySave) return;
  } catch {}
  openModal('welcomeScrim', 'welcomeTutorial');
}

function dismissWelcome() {
  try { localStorage.setItem('euchre.seenWelcome', '1'); } catch {}
  closeModal('welcomeScrim');
}

// In-app confirm — window.confirm() is a no-op in the Android WebView.
function confirmDialog({ title = 'Are you sure?', desc = '', ok = t('confirm'), cancel = t('cancel') } = {}) {
  return new Promise((resolve) => {
    $('confirmTitle').textContent = title;
    $('confirmDesc').textContent = desc;
    $('confirmOk').textContent = ok;
    $('confirmCancel').textContent = cancel;
    openModal('confirmScrim', 'confirmCancel');
    const done = (val) => { closeModal('confirmScrim'); resolve(val); };
    $('confirmOk').onclick = () => done(true);
    $('confirmCancel').onclick = () => done(false);
  });
}

// Wipe every persisted euchre key and restart fresh.
function resetEverything() {
  try {
    for (const k of Object.keys(localStorage)) { if (k.startsWith('euchre.')) localStorage.removeItem(k); }
  } catch {}
  location.reload();
}

function show(screen) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $(screen).classList.add('active');
  document.body.dataset.screen = screen;
  if (screen === 'table') applyIdentity();
  else hideTutorialGuide();
}

function isActive(run) { return run === activeRun && !!S; }

function cancelActiveRun() {
  activeRun += 1;
  if (humanResolve) { const resolve = humanResolve; humanResolve = null; resolve(null); }
  if (pendingResolve) { const resolve = pendingResolve; pendingResolve = null; resolve(null); }
  if (coachResolve) { const resolve = coachResolve; coachResolve = null; resolve(null); }
  closeCoachSheet();
  closeBidSheet();
  closeModal('modalScrim', false);
  closeModal('exitScrim', false);
  closeModal('rewardScrim', false);
  closeModal('languageScrim', false);
  closeModal('secretScrim', false);
  hideTutorialGuide();
  $('faceoff').classList.remove('show');
  $('faceoff').setAttribute('aria-hidden', 'true');
  syncBackgroundInert();
}

function requestExit() {
  if (isTutorial()) { skipTutorial(); return; }
  if (mode === 'daily' && dailyCtx && !dailyCtx.practice) {
    $('exitDescription').textContent = 'Save to continue your official attempt later. Leaving without saving forfeits today’s score.';
    $('discardLeaveBtn').textContent = 'Forfeit official attempt';
  } else {
    $('exitDescription').textContent = 'Save to resume later from this mode’s menu, or leave without saving.';
    $('discardLeaveBtn').textContent = 'Leave without saving';
  }
  openModal('exitScrim', 'stayBtn');
}

// save=true keeps this mode's autosave; save=false discards it.
function leaveGame(save) {
  if (save) {
    saveGame();
  } else {
    if (mode === 'daily' && dailyCtx && !dailyCtx.practice) recordDailyForfeit();
    clearSavedGame();
  }
  cancelActiveRun();
  S = null;
  tourCtx = null;
  dailyCtx = null;
  applyTableStyle('casino');
  if (mode === 'daily') openDaily(); else show('menu');
}

function clearTable() {
  document.querySelectorAll('.hand, .play-slot').forEach((el) => { el.innerHTML = ''; });
  $('upCardSlot').innerHTML = '';
  setStatus('');
}

function loadSaves() {
  try { return JSON.parse(localStorage.getItem(SAVES_KEY) || '{}') || {}; } catch { return {}; }
}
function writeSaves(map) {
  try { localStorage.setItem(SAVES_KEY, JSON.stringify(map)); } catch {}
}

function saveGame() {
  if (isTutorial()) return;
  if (!S || S.phase === 'idle') return;
  const map = loadSaves();
  map[mode] = { version: 1, state: S, mode, difficulty, perspective, tourCtx, dailyCtx };
  writeSaves(map);
}

function readSavedGame(m) {
  const data = loadSaves()[m];
  if (!data || !data.state || data.mode !== m || !['ai', 'train', 'tour', 'daily'].includes(m)) return null;
  return data;
}

function clearSavedGame(m = mode) {
  const map = loadSaves();
  if (map[m]) { delete map[m]; writeSaves(map); }
}

function loadFeedback() {
  const base = { haptics: true, sound: true, language: 'en', gameSpeed: 'slow', autoAdvance: false, modeDiff: { ai: 'normal', train: 'normal' } };
  try {
    const saved = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '{}');
    const next = { ...base, ...saved, modeDiff: { ...base.modeDiff, ...(saved.modeDiff || {}) } };
    next.gameSpeed = next.gameSpeed === 'fast' ? 'fast' : 'slow';
    next.language = next.language === 'zh' ? 'zh' : 'en';
    next.haptics = next.haptics !== false;
    next.sound = next.sound !== false;
    next.autoAdvance = !!next.autoAdvance;
    return next;
  } catch {
    return base;
  }
}
function persistFeedback() { try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback)); } catch {} }

// Apply the room ambiance. Tournament venues pass the cup's venue; casual = casino.
function applyTableStyle(style) {
  document.documentElement.dataset.table = style || 'casino';
}

function bindPreference(id, key) {
  const button = $(id);
  const render = () => {
    button.classList.toggle('active', feedback[key]);
    button.setAttribute('aria-pressed', String(feedback[key]));
    button.querySelector('.preference-state').textContent = feedback[key] ? t('on') : t('off');
  };
  render();
  button.onclick = () => {
    feedback[key] = !feedback[key];
    try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback)); } catch {}
    render();
    if (key === 'haptics' && feedback[key]) feedbackEvent('card');
    if (key === 'sound' && feedback[key]) feedbackEvent('bid');
  };
}

function bindLanguagePicker() {
  const button = $('languagePickerBtn');
  if (!button) return;
  button.onclick = () => {
    renderLanguagePicker();
    openModal('languageScrim', lang() === 'zh' ? 'languageChoiceZh' : 'languageChoiceEn');
  };
  $('languageCancel').onclick = () => closeModal('languageScrim');
  $('languageScrim').onclick = (e) => { if (e.target === $('languageScrim')) closeModal('languageScrim'); };
  document.querySelectorAll('.language-option').forEach((option) => {
    option.onclick = () => setLanguage(option.dataset.language);
  });
  renderLanguagePicker();
}

function setLanguage(code) {
  if (!['en', 'zh'].includes(code)) return;
  if (feedback.language !== code) {
    feedback.language = code;
    persistFeedback();
    applyLanguage();
    refreshLocalizedScreen();
    feedbackEvent('bid');
  }
  closeModal('languageScrim');
}

function renderLanguagePicker() {
  const button = $('languagePickerBtn');
  const action = $('languageAction');
  const desc = $('languageDesc');
  const current = lang();
  if (button) button.setAttribute('aria-label', `${t('changeLanguage')}: ${LANGS[current]}`);
  if (action) action.textContent = t('changeLanguage');
  if (desc) desc.textContent = `${t('currentLanguage')}: ${LANGS[current]}`;
  document.querySelectorAll('.language-option').forEach((option) => {
    const active = option.dataset.language === current;
    option.classList.toggle('active', active);
    option.setAttribute('aria-selected', String(active));
    const small = option.querySelector('small');
    if (small) small.textContent = option.dataset.language === 'zh' ? t('mandarinChinese') : LANGS.en;
  });
}

function bindSpeedToggle() {
  const button = $('speedToggle');
  if (!button) return;
  button.onclick = () => {
    setGameSpeed(feedback.gameSpeed === 'fast' ? 'slow' : 'fast');
    feedbackEvent('bid');
  };
  renderSpeedToggle();
}

function setGameSpeed(speed) {
  feedback.gameSpeed = speed === 'fast' ? 'fast' : 'slow';
  persistFeedback();
  renderSpeedToggle();
}

function savedGameSpeed() {
  try {
    const saved = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '{}');
    return saved.gameSpeed === 'fast' ? 'fast' : 'slow';
  } catch {
    return 'slow';
  }
}

function refreshGameSpeedFromStorage() {
  const stored = savedGameSpeed();
  if (feedback.gameSpeed !== stored) feedback.gameSpeed = stored;
  renderSpeedToggle();
}

function bindSpeedStorageSync() {
  window.addEventListener('storage', (event) => {
    if (event.key === FEEDBACK_KEY) refreshGameSpeedFromStorage();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshGameSpeedFromStorage();
  });
}

function renderSpeedToggle() {
  const button = $('speedToggle');
  const state = $('speedState');
  if (!button || !state) return;
  const fast = feedback.gameSpeed === 'fast';
  button.classList.toggle('active', fast);
  button.setAttribute('aria-pressed', String(fast));
  state.textContent = fast ? t('speedFast') : t('speedSlow');
}

function speedScale() {
  return feedback.gameSpeed === 'fast' ? 1 : 1.45;
}

function paceMs(ms) {
  return Math.round(ms * speedScale());
}

function paceDelay(ms) {
  return delay(paceMs(ms));
}

function feedbackEvent(kind) {
  if (feedback.haptics) {
    if (window.NativeFeedback?.vibrate) window.NativeFeedback.vibrate(kind);
    else if (navigator.vibrate) {
      const pattern = {
        card: 10,
        bid: 18,
        trickWin: [16, 24, 26],
        trickLose: [24, 44, 18],
        trick: [22, 35, 34],
        score: [30, 45, 55],
      }[kind] || 10;
      navigator.vibrate(pattern);
    }
  }
  if (feedback.sound) playSfx(kind);
}

function sfxCtx() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const c = playSfx.ctx || (playSfx.ctx = new AC());
    if (c.state === 'suspended') c.resume();
    return c;
  } catch { return null; }
}

// A gentle tone with a soft attack/decay so it never "clicks" on. Quiet by design.
function sfxTone(freq, start, dur, vol, type = 'triangle') {
  const c = sfxCtx(); if (!c) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator(); const g = c.createGain();
  osc.type = type; osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}
function softTone(freq, dur, vol, type = 'triangle') { sfxTone(freq, 0, dur, vol, type); }

// A very soft felt tap. Card plays happen constantly, so this stays warmer and
// quieter than the outcome sounds.
function cardTick() {
  const c = sfxCtx(); if (!c) return;
  const now = c.currentTime;
  const tap = c.createOscillator(); const tapGain = c.createGain();
  tap.type = 'triangle'; tap.frequency.value = 185;
  tapGain.gain.setValueAtTime(0.0001, now);
  tapGain.gain.exponentialRampToValueAtTime(0.018, now + 0.012);
  tapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
  tap.connect(tapGain).connect(c.destination);
  tap.start(now); tap.stop(now + 0.08);

  const dur = 0.035, n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.35 * (1 - i / n) ** 3;
  const src = c.createBufferSource(); src.buffer = buf;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
  const g = c.createGain();
  g.gain.setValueAtTime(0.012, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(lp).connect(g).connect(c.destination);
  src.start(now); src.stop(now + dur);
}

// Pleasant, understated cues. Card plays are frequent, so they get a soft tick.
function playSfx(kind) {
  switch (kind) {
    case 'card':  cardTick(); break;
    case 'bid':
      sfxTone(392, 0, 0.11, 0.035);
      sfxTone(493.88, 0.07, 0.12, 0.032);
      break;
    case 'trickWin':
      sfxTone(523.25, 0, 0.12, 0.04);
      sfxTone(659.25, 0.08, 0.14, 0.036);
      break;
    case 'trickLose':
      sfxTone(246.94, 0, 0.16, 0.035, 'sine');
      break;
    case 'trick': softTone(523.25, 0.12, 0.045); break;  // legacy fallback
    case 'score': softTone(659.25, 0.18, 0.05, 'sine'); break; // warm E5
    default:      cardTick();
  }
}

function openModal(id, focusId) {
  lastFocused = document.activeElement;
  const scrim = $(id);
  scrim.classList.add('show');
  scrim.setAttribute('aria-hidden', 'false');
  syncBackgroundInert();
  requestAnimationFrame(() => $(focusId)?.focus());
}

function closeModal(id, restoreFocus = true) {
  const scrim = $(id);
  if (!scrim) return;
  scrim.classList.remove('show');
  scrim.setAttribute('aria-hidden', 'true');
  syncBackgroundInert();
  if (restoreFocus && lastFocused?.focus) requestAnimationFrame(() => lastFocused.focus());
}

function syncBackgroundInert() {
  const topBlocked = !!document.querySelector('.modal-scrim.show, .faceoff.show');
  const sheetBlocked = !!document.querySelector('.sheet.show');
  $('app').inert = topBlocked;
  $('app').setAttribute('aria-hidden', String(topBlocked));
  $('felt').inert = topBlocked || sheetBlocked;
  $('felt').setAttribute('aria-hidden', String(topBlocked || sheetBlocked));
  $('statusLine').setAttribute('aria-hidden', String(topBlocked || sheetBlocked));
  $('bidSheet').inert = !$('bidSheet').classList.contains('show') || topBlocked;
  $('coachSheet').inert = !$('coachSheet').classList.contains('show') || topBlocked;
}

function closeTopOverlay() {
  if ($('confirmScrim').classList.contains('show')) { closeModal('confirmScrim'); return true; }
  if ($('languageScrim').classList.contains('show')) { closeModal('languageScrim'); return true; }
  if ($('secretScrim').classList.contains('show')) { closeModal('secretScrim'); return true; }
  if ($('profileScrim').classList.contains('show')) { closeModal('profileScrim'); return true; }
  if ($('lastTrickScrim').classList.contains('show')) { closeModal('lastTrickScrim'); return true; }
  if ($('welcomeScrim').classList.contains('show')) { dismissWelcome(); return true; }
  if ($('exitScrim').classList.contains('show')) { closeModal('exitScrim'); return true; }
  if ($('rulesScrim').classList.contains('show')) { closeModal('rulesScrim'); return true; }
  return false;
}

function handleKeydown(event) {
  if (event.key === 'Escape') closeTopOverlay();
  if (event.key !== 'Tab') return;
  const open = document.querySelector('.modal-scrim.show, .faceoff.show, .sheet.show');
  if (!open) return;
  const focusable = [...open.querySelectorAll('button:not(:disabled), [tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

// ─── main async driver ───
async function gameLoop(run, resume) {
  if (!resume) {
    dealNextHand();
    await prepareHand(run);
  } else {
    renderAll();
  }

  while (isActive(run) && S.phase !== 'gameEnd') {
    switch (S.phase) {
      case 'bid1':
      case 'bid2':
        await handleBid(run);
        break;
      case 'discard':
        await handleDiscard(run);
        break;
      case 'play':
        await handlePlay(run);
        break;
      case 'redeal':
        setStatus(t('allPassed'));
        await paceDelay(900);
        if (!isActive(run)) return;
        dealNextHand();
        await prepareHand(run);
        break;
      case 'handEnd':
        await showResult(false);
        if (!isActive(run)) return;
        if (isTutorial()) {
          const next = await showTutorialComplete();
          if (!isActive(run)) return;
          hideTutorialGuide();
          clearSavedGame('tutorial');
          S = null;
          if (next === 'solo') startGame('ai', feedback.modeDiff.ai || 'normal');
          else show('menu');
          return;
        }
        dealNextHand();
        await prepareHand(run);
        break;
    }
  }
  if (!isActive(run)) return;
  await showResult(true);
  if (!isActive(run)) return;
  clearSavedGame();
  if (mode === 'tour' && tourCtx) {
    await handleTournamentEnd(S.winner === 0);
  } else if (mode === 'daily' && dailyCtx) {
    finishDaily();
    dailyCtx = null;
    openDaily();
  } else {
    show('menu');
  }
  hideTutorialGuide();
  S = null;
}

function dealNextHand() {
  if (mode === 'daily' && dailyCtx) {
    deal(S, dailyDealRng(dailyCtx.dateKey, dailyCtx.dealIndex));
    dailyCtx.dealIndex += 1;
  } else {
    deal(S);
  }
}

async function prepareHand(run) {
  trainHand = [];
  perspective = 0;
  updateTutorialGuide('tutorialIntro');
  saveGame();
  await dealAnimation();
}

// ─── bidding ───
async function handleBid(run) {
  const seat = S.turn;
  renderAll();
  let dec;
  if (isHuman(seat)) {
    if (!isActive(run)) return;
    updateTutorialGuide(S.phase === 'bid1' ? 'tutorialBidRound1' : 'tutorialBidRound2');
    setStatus(t('yourBid'));
    dec = await openBidSheet(seat);
    closeBidSheet();
  } else {
    updateTutorialGuide('tutorialWatch', { name: nameFor(seat) });
    setStatus(t('consideringBid', { name: nameFor(seat) }));
    await paceDelay(520);
    if (!isActive(run)) return;
    dec = aiBid(S, seat, difficulty, styleFor(seat));
  }
  if (!dec || !isActive(run)) return;
  const snapshot = (isTrain() && isHuman(seat)) ? snapshotState() : null;
  await applyBid(seat, dec, run);
  if (!isActive(run)) return;
  if (snapshot) await coachReview(run, 'bid', snapshot, seat, dec);
}

async function applyBid(seat, d, run) {
  if (d.action === 'orderUp') {
    const upCardData = S.upCard;          // capture before it moves into the dealer's hand
    const pickupAnimation = preparePickupAnimation(upCardData);
    seatFlash(seat, d.alone ? 'Alone!' : 'Order up!');
    setStatus(t('picksItUp', { name: nameFor(S.dealer) }));
    orderUp(S, seat, d.alone);
    saveGame();
    renderAll();
    await pickupAnimation();
    if (!isActive(run)) return;
    if (!isHuman(seat)) reactBubble(seat, 'order');
    feedbackEvent('bid');
    renderAll();
    await paceDelay(220);
  } else if (d.action === 'callTrump') {
    seatFlash(seat, `${SUIT_SYMBOL[d.suit]}${d.alone ? ' alone!' : ' trump!'}`);
    if (!isHuman(seat)) reactBubble(seat, 'call');
    callTrump(S, seat, d.suit, d.alone);
    saveGame();
    feedbackEvent('bid');
    await paceDelay(320);
  } else {
    seatFlash(seat, 'Pass');
    pass(S);
    saveGame();
    await paceDelay(280);
  }
}

// ─── dealer discard after order-up ───
async function handleDiscard(run) {
  const seat = S.dealer;
  pendingDiscardId = null;
  renderAll();
  if (isHuman(seat)) {
    updateTutorialGuide('tutorialDiscard');
    setStatus(t('discardPrompt'));
    const card = await waitForCardTap(S.hands[seat]); // any card legal
    if (!card || !isActive(run)) return;
    pendingDiscardId = null;
    setStatus(t('cardDiscarded'));
    await animateDiscard(seat, card);
    if (!isActive(run)) return;
    discard(S, card);
  } else {
    await paceDelay(380);
    if (!isActive(run)) return;
    const card = aiDiscard(S);
    setStatus(t('discardsCard', { name: nameFor(seat) }));
    await animateDiscard(seat, card);
    if (!isActive(run)) return;
    discard(S, card);
  }
  saveGame();
  await paceDelay(180);
}

// ─── trick play ───
async function handlePlay(run) {
  const seat = S.turn;
  renderAll();
  if (isHuman(seat)) {
    if (!isActive(run)) return;
    const legal = getLegalCards(S, seat);
    updateTutorialGuide('tutorialPlay');
    setStatus(t('yourTurn'));
    showHint(true);
    const card = await waitForCardTap(legal);
    showHint(false);
    if (!card || !isActive(run)) return;
    const snapshot = isTrain() ? snapshotState() : null;
    await commitPlay(seat, card, run);
    if (!isActive(run)) return;
    if (snapshot) await coachReview(run, 'play', snapshot, seat, card);
  } else {
    updateTutorialGuide('tutorialWatch', { name: nameFor(seat) });
    setStatus(t('isPlaying', { name: nameFor(seat) }));
    await paceDelay(340);
    if (!isActive(run)) return;
    let rng = Math.random;
    if (mode === 'daily' && dailyCtx) {
      const actionIndex = Number.isInteger(dailyCtx.actionIndex) ? dailyCtx.actionIndex : 0;
      dailyCtx.actionIndex = actionIndex + 1;
      rng = dailyActionRng(dailyCtx.dateKey, actionIndex);
    }
    const card = aiPlay(S, seat, difficulty, styleFor(seat), rng);
    await commitPlay(seat, card, run);
  }
}

async function commitPlay(seat, card, run) {
  const before = S.completedTricks.length;
  playCard(S, seat, card);
  saveGame();
  feedbackEvent('card');
  const completed = S.completedTricks.length > before;
  if (completed) {
    const last = S.completedTricks[S.completedTricks.length - 1];
    // 1) lay down the full 4-card trick (cards glide into the centre)
    renderScores(); renderTrump(); renderSeats(); renderUpCard();
    renderCompletedTrick(last.plays);
    await paceDelay(460);
    if (!isActive(run)) return;
    // 2) make the winner unmistakable: glow the winning card, pulse the seat, badge it
    highlightWinner(last.winner);
    const trickByYou = TEAM_OF(last.winner) === 0;
    feedbackEvent(trickByYou ? 'trickWin' : 'trickLose');
    emit('trick', { winner: last.winner, youWon: trickByYou, mode });
    reactToTrick(last);
    await paceDelay(690);
    if (!isActive(run)) return;
    // 3) the trick sweeps to the winner's pile
    await sweepTrick(last.winner);
    if (!isActive(run)) return;
    renderAll();
    if (S.completedTricks.length === 5) {
      reactToHandResult();
      await paceDelay(HAND_RESULT_SETTLE_MS); // quips are flavor; never hold up the result screen
    } else {
      await paceDelay(180);
    }
  } else {
    renderAll();
    await paceDelay(400);
  }
}

// character reactions the instant a hand is scored (before the result modal)
// When YOU take a trick an opponent was contesting, let that rival grumble.
function reactToTrick(last) {
  if (mode !== 'tour' || last.winner !== 0) return;
  const trump = S.trump;
  const led = effectiveSuit(last.plays[0].card, trump);
  let best = null, bestStr = -1;
  for (const p of last.plays) {
    if (p.seat % 2 === 0) continue; // opponents are the odd seats
    const s = cardStrength(p.card, trump, led);
    if (s > bestStr) { bestStr = s; best = p; }
  }
  if (best && bestStr > 0) reactBubble(best.seat, 'stolen', { prob: 0.5, cooldown: 8000 });
}

// character reactions the instant a hand is scored (before the result modal)
function reactToHandResult() {
  const r = S.lastResult;
  if (!r) return;
  const aiOn = (team) => [1, 2, 3].filter((s) => TEAM_OF(s) === team && !isHuman(s));
  if (r.kind === 'euchre') {
    const makerSeat = aiOn(r.makerTeam)[0];
    const defSeat = aiOn(1 - r.makerTeam)[0];
    if (defSeat != null) reactBubble(defSeat, 'euchredThem', { cooldown: 0 });
    if (makerSeat != null) reactBubble(makerSeat, 'gotEuchred', { cooldown: 0 });
  } else if (r.kind === 'march' || r.kind === 'alone-march') {
    const seat = aiOn(r.team)[0];
    if (seat != null) reactBubble(seat, 'march', { cooldown: 0 });
  }
}

// glow the winning card, pulse the winner's seat, and float a badge
function highlightWinner(winnerSeat) {
  document.querySelectorAll('.play-slot .card.leading').forEach((c) => c.classList.remove('leading'));
  const pos = screenPos(winnerSeat);
  const slot = document.querySelector('.slot-' + pos);
  const card = slot && slot.querySelector('.card');
  if (card) card.classList.add('trick-win');
  const node = document.querySelector(POS_SEL[pos]);
  if (node) {
    node.classList.add('trick-won');
    setTimeout(() => node.classList.remove('trick-won'), 800);
  }
  const who = nameFor(winnerSeat);
  const label = who === 'You' ? 'You win it' : `${who} wins it`;
  seatFlash(winnerSeat, label, true);
  if (!isHuman(winnerSeat)) reactBubble(winnerSeat, 'trick', { prob: 0.22, cooldown: 9000 });
}

// Place `plays` into the centre slots idempotently: a slot already showing the
// right card is left alone (so its glide-in animation does NOT replay); only
// newly added cards animate, and stale cards are cleared.
function renderPlays(plays) {
  const bySlot = {};
  const orderIdx = {};
  plays.forEach((play, i) => { bySlot[screenPos(play.seat)] = play; orderIdx[play.card.id] = i; });
  for (let p = 0; p < 4; p++) {
    const slot = document.querySelector('.slot-' + p);
    if (!slot || slot.querySelector('.sweeping')) continue;
    const play = bySlot[p];
    const existing = slot.firstElementChild;
    if (!play) { if (existing) slot.innerHTML = ''; continue; }
    if (existing && existing.dataset.id === play.card.id) continue; // unchanged → keep
    slot.innerHTML = '';
    const el = cardEl(play.card); // new card → animates in
    const z = String(orderIdx[play.card.id] + 1); // later plays stack on top
    el.style.zIndex = z; el.dataset.z = z;
    slot.appendChild(el);
  }
}

function renderCompletedTrick(plays) { renderPlays(plays); }

// ─── rendering ───
function renderAll() {
  renderScores();
  renderTrump();
  renderSeats();
  renderUpCard();
  renderTrick();
  renderContract();
  renderDiscardCue();
}

function renderDiscardCue() {
  const table = $('table');
  const target = $('discardTarget');
  const active = !!(S && S.phase === 'discard' && isHuman(S.turn));
  table?.classList.toggle('discard-mode', active);
  if (!target) return;
  target.classList.toggle('choose', active);
  target.classList.toggle('show', active || target.classList.contains('received'));
  target.setAttribute('aria-hidden', String(!active));
  const label = target.querySelector('span');
  if (label) label.textContent = active ? t('discardPrompt') : t('discard');
}

// clarity bar: who is making, alone, and how many tricks they still need
function renderContract() {
  const bar = $('contractBar');
  const ltBtn = $('lastTrickBtn');
  if (ltBtn) ltBtn.hidden = !(S && S.phase === 'play' && S.completedTricks.length > 0);
  if (!bar) return;
  if (!S || S.phase !== 'play' || S.maker == null) { bar.hidden = true; return; }
  bar.hidden = false;
  const team = S.maker;
  const teamCls = team === 0 ? 'us' : 'them';
  const won = S.tricksWon[team];
  const need = Math.max(0, 3 - won);
  const matchPoint = Math.max(S.scores[0], S.scores[1]) >= 9;
  const needTxt = need > 0
    ? `<span class="c-need">${need}</span> ${escapeHTML(t('contractNeed', { suffix: need === 1 ? '' : 's' }))}`
    : `<span class="c-need">${escapeHTML(t('bidMade'))}</span>`;
  const makerName = team === 0 ? profile.teamName : opponentTeamName();
  const safeMakerName = escapeHTML(makerName);
  bar.innerHTML =
    `<span class="c-pill ${teamCls}${matchPoint ? ' match' : ''}" title="${safeMakerName}">${safeMakerName} · ${SUIT_SYMBOL[S.trump]}${S.alone ? ' · alone' : ''}</span>` +
    `<span>${needTxt}</span>`;
}

function showLastTrick() {
  if (!S || !S.completedTricks.length) return;
  const tk = S.completedTricks[S.completedTricks.length - 1];
  const wrap = $('lastTrickCards');
  wrap.innerHTML = '';
  for (const p of tk.plays) {
    const col = document.createElement('div');
    col.className = 'ltc' + (p.seat === tk.winner ? ' won' : '');
    col.appendChild(cardEl(p.card));
    const s = document.createElement('div');
    s.className = 'ltc-seat';
    s.textContent = nameFor(p.seat) + (p.seat === tk.winner ? ' ✓' : '');
    col.appendChild(s);
    wrap.appendChild(col);
  }
  openModal('lastTrickScrim', 'lastTrickClose');
}

// gentle feedback when the player taps a card they can't legally play
function nudgeIllegal(card) {
  const led = currentLedSuit(S);
  if (!S || S.phase !== 'play' || !led) return;
  const tapped = document.querySelector(`.hand-you .card[data-id="${card.id}"]`);
  if (tapped) { tapped.classList.remove('nudge'); void tapped.offsetWidth; tapped.classList.add('nudge'); setTimeout(() => tapped.classList.remove('nudge'), 400); }
  document.querySelectorAll('.hand-you .card.playable').forEach((el) => {
    el.classList.add('must-follow');
    setTimeout(() => el.classList.remove('must-follow'), 1200);
  });
  setStatus(t('mustFollow', { symbol: SUIT_SYMBOL[led], suit: led }));
  feedbackEvent('card');
}

function renderScores() {
  setScore($('scoreUs'), S.scores[0]);
  setScore($('scoreThem'), S.scores[1]);
}
function setScore(el, val) {
  if (el.textContent !== String(val)) {
    el.textContent = val;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
}

function renderTrump() {
  const badge = $('trumpBadge');
  if (S.trump) {
    $('trumpSym').textContent = SUIT_SYMBOL[S.trump];
    badge.className = 'trump-badge set ' + SUIT_COLOR[S.trump];
  } else {
    $('trumpSym').textContent = '–';
    badge.className = 'trump-badge';
  }
}

function tricksBySeat() {
  const t = [0, 0, 0, 0];
  for (const ct of S.completedTricks) t[ct.winner]++;
  return t;
}

function renderSeats() {
  const tb = tricksBySeat();
  const phasePlay = S.phase === 'play';
  for (let seat = 0; seat < 4; seat++) {
    const pos = screenPos(seat);
    const node = document.querySelector(POS_SEL[pos]);
    if (!node) continue;
    node.id = `seat-${pos}`; // keep position id stable
    node.classList.toggle('active-turn', S.turn === seat && (phasePlay || S.phase.startsWith('bid') || S.phase === 'discard'));
    node.classList.toggle('dealer-seat', S.dealer === seat);
    node.classList.toggle('maker', S.makerSeat === seat);
    const sitting = S.alone && S.sittingSeat === seat;
    node.classList.toggle('sitting', sitting);

    // name (keep role labels for clarity) + character avatar (Solo/Train/Tour)
    const ch = activeCharacters[seat];
    const nameEl = node.querySelector('.seat-name, .seat-name-you');
    if (nameEl) nameEl.textContent = nameFor(seat);
    const avatarEl = node.querySelector('.avatar');
    if (avatarEl) {
      const svg = ch && ch.id && PORTRAITS[ch.id] ? portraitSVG(ch.id, expressionFor(seat)) : '';
      if (svg) {
        avatarEl.innerHTML = svg;
        avatarEl.classList.add('has-portrait');
      } else {
        avatarEl.textContent = ch ? ch.emoji : '';
        avatarEl.classList.remove('has-portrait');
      }
      avatarEl.style.borderColor = ch ? ch.color : '';
    }

    // trick pips
    const pipWrap = node.querySelector('.seat-tricks, .seat-tricks-you');
    if (pipWrap) renderTrickPips(pipWrap, seat, tb[seat]);

    // hand
    const hand = node.querySelector('.hand');
    if (!hand) continue;
    if (pos === 0) {
      renderBottomHand(hand, seat, phasePlay || S.phase === 'discard');
    } else {
      const n = sitting ? 0 : S.hands[seat].length;
      hand.innerHTML = '<div class="cardback"></div>'.repeat(n);
    }
  }
}

const RANKVAL = { '9': 1, '10': 2, 'J': 3, 'Q': 4, 'K': 5, 'A': 6 };
const NONTRUMP_SUIT_ORDER = { spades: 0, diamonds: 1, clubs: 2, hearts: 3 }; // alternate colours

// display order: non-trump on the left (grouped by suit, low→high), trump on the
// right (weakest→strongest so the bowers sit far right)
function sortHand(cards, trump) {
  return cards.slice().sort((a, b) => {
    const at = trump ? isTrump(a, trump) : false;
    const bt = trump ? isTrump(b, trump) : false;
    if (at !== bt) return at ? 1 : -1;
    if (at && bt) return cardStrength(a, trump, trump) - cardStrength(b, trump, trump);
    if (a.suit !== b.suit) return NONTRUMP_SUIT_ORDER[a.suit] - NONTRUMP_SUIT_ORDER[b.suit];
    return RANKVAL[a.rank] - RANKVAL[b.rank];
  });
}

function renderBottomHand(hand, seat, interactive) {
  hand.innerHTML = '';
  const discarding = S.phase === 'discard' && isHuman(seat) && S.turn === seat;
  hand.classList.toggle('discard-hand', discarding);
  const cards = sortHand(S.hands[seat], S.trump);
  hand.dataset.count = String(cards.length);
  hand.style.setProperty('--hand-count', String(Math.max(cards.length, 1)));
  let legalIds = null;
  if (interactive && isHuman(seat) && S.turn === seat) {
    if (S.phase === 'play') legalIds = new Set(getLegalCards(S, seat).map((c) => c.id));
    else if (S.phase === 'discard') legalIds = new Set(cards.map((c) => c.id)); // any
  }
  for (const c of cards) {
    const playable = legalIds ? legalIds.has(c.id) : false;
    const illegal = legalIds && !playable;
    const el = cardEl(c, { playable, dim: illegal, discardable: discarding });
    if (discarding && pendingDiscardId === c.id) el.classList.add('discard-selected');
    if (playable) el.onclick = () => {
      if (discarding && pendingDiscardId !== c.id) {
        pendingDiscardId = c.id;
        setStatus(t('tapAgainDiscard', { card: cardName(c, S.trump) }));
        feedbackEvent('card');
        renderAll();
        return;
      }
      if (humanResolve) { const r = humanResolve; humanResolve = null; r(c); }
    };
    else if (illegal && S.phase === 'play') el.onclick = () => nudgeIllegal(c);
    hand.appendChild(el);
  }
}

function renderTrickPips(wrap, seat, count) {
  const sameSeat = wrap.dataset.seat === String(seat);
  if (!sameSeat) {
    wrap.replaceChildren();
    wrap.dataset.seat = String(seat);
    for (let i = 0; i < count; i++) {
      const pip = document.createElement('span');
      pip.className = 't';
      wrap.appendChild(pip);
    }
    return;
  }
  while (wrap.children.length > count) wrap.lastElementChild.remove();
  while (wrap.children.length < count) {
    const pip = document.createElement('span');
    pip.className = 't new';
    pip.addEventListener('animationend', () => pip.classList.remove('new'), { once: true });
    wrap.appendChild(pip);
  }
}

function cardEl(card, { playable = false, dim = false, discardable = false } = {}) {
  const el = document.createElement(playable ? 'button' : 'div');
  const color = SUIT_COLOR[card.suit];
  const trump = S.trump && isTrump(card, S.trump);
  const bower = S.trump && (isRightBower(card, S.trump) || isLeftBower(card, S.trump));
  el.className = 'card ' + color + (playable ? ' playable' : '') + (discardable ? ' discardable' : '') + (dim ? ' dim' : '') +
    (trump ? ' trump' : '') + (bower ? ' bower' : '');
  el.dataset.id = card.id;
  if (playable) {
    el.type = 'button';
    const verb = discardable ? 'Discard' : 'Play';
    el.setAttribute('aria-label', `${verb} ${card.rank} of ${card.suit}${bower ? ', bower' : trump ? ', trump' : ''}`);
  } else {
    el.setAttribute('aria-hidden', 'true');
  }
  el.innerHTML =
    `<div class="corner"><span class="r">${card.rank}</span><span class="s">${SUIT_SYMBOL[card.suit]}</span></div>` +
    `<div class="center-pip">${SUIT_SYMBOL[card.suit]}</div>`;
  return el;
}

function renderUpCard() {
  const slot = $('upCardSlot');
  slot.innerHTML = '';
  if ((S.phase === 'bid1') && S.upCard) {
    const card = cardEl(S.upCard);
    card.classList.add('order-up-card');
    card.removeAttribute('aria-hidden');
    card.setAttribute('aria-label', `Turned up ${S.upCard.rank} of ${S.upCard.suit}`);
    slot.appendChild(card);
  }
  // dealer chip
  const chip = $('dealerChip');
  const pos = screenPos(S.dealer);
  chip.style.opacity = '1';
  const offsets = [
    { left: '50%', top: '74%' },   // bottom
    { left: '22%', top: '50%' },   // left
    { left: '50%', top: '26%' },   // top
    { left: '78%', top: '50%' },   // right
  ][pos];
  chip.style.left = offsets.left; chip.style.top = offsets.top;
  chip.style.transform = 'translate(-50%,-50%)';
}

function renderTrick() { renderPlays(S.trickPile); markLeadingCard(); }

// mark the card currently winning the in-progress trick so the player can see
// what's leading; raise it to the top of the stack
function markLeadingCard() {
  document.querySelectorAll('.play-slot .card.leading').forEach((c) => {
    c.classList.remove('leading'); c.style.zIndex = c.dataset.z || '';
  });
  if (S.trickPile.length < 1 || S.phase !== 'play') return;
  const trump = S.trump;
  const led = effectiveSuit(S.trickPile[0].card, trump);
  let best = S.trickPile[0], bestS = cardStrength(best.card, trump, led);
  for (const p of S.trickPile) {
    const s = cardStrength(p.card, trump, led);
    if (s > bestS) { bestS = s; best = p; }
  }
  const slot = document.querySelector('.slot-' + screenPos(best.seat));
  const card = slot && slot.querySelector('.card');
  if (card) { card.classList.add('leading'); card.style.zIndex = '50'; }
}

// ─── animations ───
async function dealAnimation() {
  renderAll();
  const youHand = document.querySelector('.slot-0') ? null : null;
  // animate bottom hand cards in with stagger
  const cards = document.querySelectorAll('.hand-you .card, .hand .cardback');
  cards.forEach((c, i) => {
    c.classList.add('dealing');
    c.style.animationDelay = paceMs((i % 5) * 44 + Math.floor(i / 5) * 28) + 'ms';
  });
  await paceDelay(440);
  cards.forEach((c) => { c.classList.remove('dealing'); c.style.animationDelay = ''; });
}

async function sweepTrick(winnerSeat) {
  const pos = screenPos(winnerSeat);
  const targets = [
    { x: 0, y: 200 }, { x: -210, y: 0 }, { x: 0, y: -200 }, { x: 210, y: 0 },
  ][pos];
  for (let p = 0; p < 4; p++) {
    const slot = document.querySelector('.slot-' + p);
    const card = slot && slot.querySelector('.card');
    if (card) {
      card.style.setProperty('--sx', targets.x + 'px');
      card.style.setProperty('--sy', targets.y + 'px');
      card.classList.add('sweeping');
    }
  }
  await paceDelay(430);
  for (let p = 0; p < 4; p++) {
    const slot = document.querySelector('.slot-' + p);
    if (slot) slot.innerHTML = '';
  }
}

// floating badge above a seat ('win' = gold result badge, else neutral call badge)
function seatFlash(seat, text, win = false) {
  const pos = screenPos(seat);
  const felt = $('felt');
  if (!felt) return;
  felt.querySelector(`.seat-flash.pos-${pos}`)?.remove();
  const b = document.createElement('div');
  b.className = `seat-flash pos-${pos}${win ? ' win' : ''}`;
  b.textContent = text;
  felt.appendChild(b);
  setTimeout(() => b.remove(), win ? 1700 : 1350);
}

function setStatus(t) { $('statusLine').textContent = t; }

// ─── character reaction bubbles (Solo & Train) ───
const bubbleAt = {};
function reactBubble(seat, event, { prob = 1, cooldown = 3800 } = {}) {
  if (seat === 0) return;
  const ch = activeCharacters[seat];
  if (!ch) return;
  if (Math.random() > prob) return;
  const now = Date.now();
  if (now - (bubbleAt[seat] || 0) < cooldown) return;
  // rivals have bespoke voice; roster falls back to per-character/tone lines
  const text = (ch.id && isRival(ch.id) && rivalLine(ch.id, event))
    || (ch.id ? characterLine(ch.id, event) : '')
    || charLine(ch.tone, event);
  if (!text) return;
  bubbleAt[seat] = now;
  seatBubble(seat, text);
}

function seatBubble(seat, text) {
  const pos = screenPos(seat);
  const felt = $('felt');
  if (!felt) return;
  felt.querySelector(`.seat-bubble.pos-${pos}`)?.remove();
  const b = document.createElement('div');
  b.className = `seat-flash seat-bubble pos-${pos}`;
  b.textContent = text;
  felt.appendChild(b);
  requestAnimationFrame(() => keepBubbleInsideFelt(b, felt));
  setTimeout(() => b.remove(), 2600);
}

function keepBubbleInsideFelt(bubble, felt) {
  if (!bubble?.isConnected || !felt) return;
  const pad = 8;
  const fr = felt.getBoundingClientRect();
  const br = bubble.getBoundingClientRect();
  let dx = 0;
  let dy = 0;
  if (br.left < fr.left + pad) dx = fr.left + pad - br.left;
  else if (br.right > fr.right - pad) dx = fr.right - pad - br.right;
  if (br.top < fr.top + pad) dy = fr.top + pad - br.top;
  else if (br.bottom > fr.bottom - pad) dy = fr.bottom - pad - br.bottom;
  bubble.style.setProperty('--bubble-nudge-x', `${Math.round(dx)}px`);
  bubble.style.setProperty('--bubble-nudge-y', `${Math.round(dy)}px`);
}

// fly a ghost card element from one element's position to another's, then remove it
function flyCard(fromEl, toEl, ghost, { ms = 850, endScale = .72, endOpacity = .28 } = {}) {
  if (!fromEl) return Promise.resolve();
  return flyCardFromRect(fromEl.getBoundingClientRect(), toEl, ghost, { ms, endScale, endOpacity });
}

function flyCardFromRect(fromRect, toEl, ghost, { ms = 850, endScale = .72, endOpacity = .28 } = {}) {
  return new Promise((resolve) => {
    if (!fromRect || !toEl) { resolve(); return; }
    const f = fromRect;
    const t = toEl.getBoundingClientRect();
    ghost.style.position = 'fixed';
    ghost.style.left = f.left + 'px';
    ghost.style.top = f.top + 'px';
    ghost.style.width = f.width + 'px';
    ghost.style.height = f.height + 'px';
    ghost.style.margin = '0';
    ghost.style.zIndex = '90';
    ghost.style.pointerEvents = 'none';
    ghost.style.transition = `transform ${ms}ms cubic-bezier(.22,.72,.18,1), opacity ${ms}ms ease`;
    document.body.appendChild(ghost);
    const dx = (t.left + t.width / 2) - (f.left + f.width / 2);
    const dy = (t.top + t.height / 2) - (f.top + f.height / 2);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      ghost.style.transform = `translate(${dx}px, ${dy}px) scale(${endScale})`;
      ghost.style.opacity = String(endOpacity);
    }));
    setTimeout(() => {
      ghost.style.opacity = '0';
      setTimeout(() => { ghost.remove(); resolve(); }, 130);
    }, ms);
  });
}

function preparePickupAnimation(upCardData) {
  const slot = $('upCardSlot');
  const source = slot?.querySelector('.card');
  if (!source) return async () => {};
  source.classList.add('pickup-ready');
  const fromRect = source.getBoundingClientRect();
  const ghost = source.cloneNode(true);
  source.style.visibility = 'hidden';
  const dealerSeat = S.dealer;
  return async () => {
    const dealerNode = document.querySelector(POS_SEL[screenPos(dealerSeat)]);
    if (!dealerNode) return;
    seatFlash(dealerSeat, 'Picking it up');
    await paceDelay(120);
    await flyCardFromRect(fromRect, dealerNode, ghost, { ms: paceMs(820), endScale: .5, endOpacity: .6 });
    dealerNode.classList.add('active-turn');
    await paceDelay(140);
  };
}

// a card flies away from the dealer's seat (discard)
async function animateDiscard(dealerSeat, card) {
  const dealerNode = document.querySelector(POS_SEL[screenPos(dealerSeat)]);
  const target = $('discardTarget');
  const visibleCard = dealerNode?.querySelector(`[data-id="${card.id}"]`);
  const hiddenCard = dealerNode?.querySelector('.cardback:last-child');
  const source = visibleCard || hiddenCard || dealerNode;
  if (!source || !target) return;
  const ghost = visibleCard
    ? visibleCard.cloneNode(true)
    : (() => { const d = document.createElement('div'); d.className = 'cardback'; return d; })();
  target.classList.add('show');
  seatFlash(dealerSeat, 'Discarding');
  await paceDelay(100);
  if (visibleCard) visibleCard.style.visibility = 'hidden';
  await flyCard(source, target, ghost, { ms: paceMs(640), endScale: .86, endOpacity: .92 });
  target.classList.add('received');
  const preview = ghost.cloneNode(true);
  preview.removeAttribute('style');
  preview.classList.add('discard-preview');
  target.appendChild(preview);
  feedbackEvent('card');
  await paceDelay(140);
  preview.remove();
  target.classList.remove('show', 'received', 'choose');
  target.setAttribute('aria-hidden', 'true');
}

// ─── human input plumbing ───
function waitForCardTap() {
  return new Promise((resolve) => { humanResolve = resolve; });
}

// ─── bidding sheet ───
function openBidSheet(seat) {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    aloneFlag = false;
    const body = $('sheetBody');
    body.innerHTML = '';
    const sub = $('sheetSub');

    if (S.phase === 'bid1') {
      $('sheetTitle').textContent = seat === S.dealer ? t('pickItUp') : t('orderItUp');
      sub.innerHTML = '';
      sub.appendChild(bidUpCardPreview(S.upCard, S.dealer));
      const aloneRow = aloneToggle();
      const row = document.createElement('div'); row.className = 'sheet-row';
      const passB = mkBtn(t('pass'), 'btn-glass', () => finish({ action: 'pass' }));
      const orderB = mkBtn(seat === S.dealer ? t('pickUp') : t('orderUp'), 'btn-primary', () => finish({ action: 'orderUp', alone: aloneFlag }));
      row.append(passB, orderB);
      body.append(aloneRow, row);
    } else {
      $('sheetTitle').textContent = t('nameTrump');
      sub.textContent = t('cantChoose', { symbol: SUIT_SYMBOL[S.upCard.suit] });
      const grid = document.createElement('div'); grid.className = 'suit-grid';
      for (const suit of ['spades', 'hearts', 'diamonds', 'clubs']) {
        const b = document.createElement('button');
        b.className = 'suit-btn ' + SUIT_COLOR[suit];
        b.innerHTML = SUIT_SYMBOL[suit];
        b.setAttribute('aria-label', `${t('nameTrump')} ${suit}${suit === S.upCard.suit ? ', unavailable' : ''}`);
        b.disabled = suit === S.upCard.suit;
        b.onclick = () => finish({ action: 'callTrump', suit, alone: aloneFlag });
        grid.appendChild(b);
      }
      const aloneRow = aloneToggle();
      const passB = mkBtn(t('pass'), 'btn-glass', () => finish({ action: 'pass' }));
      body.append(grid, aloneRow, passB);
    }

    // Always-visible read-only copy of your hand, right in the sheet, so naming
    // trump never hides your cards. Trump emphasis appears once trump is known.
    const mini = document.createElement('div');
    mini.className = 'bid-mini-hand';
    for (const c of sortHand(S.hands[seat], S.trump)) mini.appendChild(cardEl(c));
    body.prepend(mini);
    if (isTutorial()) {
      const note = document.createElement('div');
      note.className = 'tutorial-sheet-note';
      note.textContent = S.phase === 'bid1' ? t('tutorialBidRound1') : t('tutorialBidRound2');
      body.prepend(note);
    }

    $('sheetScrim').classList.add('show');
    $('sheetScrim').setAttribute('aria-hidden', 'false');
    $('bidSheet').classList.add('show');
    $('bidSheet').setAttribute('aria-hidden', 'false');
    syncBackgroundInert();
    requestAnimationFrame(() => body.querySelector('button:not(:disabled)')?.focus());

    function finish(choice) {
      pendingResolve = null;
      resolve(choice);
    }
  });
}

function aloneToggle() {
  const row = document.createElement('div');
  row.className = 'alone-toggle';
  const label = document.createElement('span');
  label.textContent = t('goAlone');
  const sw = document.createElement('button');
  sw.type = 'button';
  sw.className = 'switch';
  sw.setAttribute('role', 'switch');
  sw.setAttribute('aria-label', t('goAlone'));
  sw.setAttribute('aria-checked', 'false');
  sw.onclick = () => {
    aloneFlag = !aloneFlag;
    sw.classList.toggle('on', aloneFlag);
    sw.setAttribute('aria-checked', String(aloneFlag));
    feedbackEvent('card');
  };
  row.appendChild(label);
  row.appendChild(sw);
  return row;
}

function mkBtn(label, cls, onclick) {
  const b = document.createElement('button');
  b.className = 'btn ' + cls;
  b.textContent = label;
  b.onclick = onclick;
  return b;
}

function closeBidSheet() {
  $('sheetScrim').classList.remove('show');
  $('sheetScrim').setAttribute('aria-hidden', 'true');
  $('bidSheet').classList.remove('show');
  $('bidSheet').setAttribute('aria-hidden', 'true');
  syncBackgroundInert();
}

function bidUpCardPreview(card, dealerSeat) {
  const wrap = document.createElement('div');
  wrap.className = 'bid-up-card';
  const preview = cardEl(card);
  preview.classList.add('order-up-card');
  preview.removeAttribute('aria-hidden');
  preview.setAttribute('aria-label', `Turned up ${card.rank} of ${card.suit}`);
  const label = document.createElement('div');
  label.className = 'bid-up-card-label';
  label.innerHTML = `${escapeHTML(t('turnedUp'))} <b>${card.rank}${SUIT_SYMBOL[card.suit]}</b>`;
  const dealer = nameFor(dealerSeat);
  const side = teamSideForSeat(dealerSeat);
  const recipient = document.createElement('div');
  recipient.className = `bid-up-recipient team-${TEAM_OF(dealerSeat) === 0 ? 'us' : 'them'}`;
  recipient.textContent = t('pickupRecipient', { dealer, side });
  wrap.append(preview, label, recipient);
  return wrap;
}

// ─── stats screen ───
const BADGE_ICONS = {
  firstWin: '🏆', firstMarch: '🧹', firstAlone: '🐺', euchreHard: '🗡️', streak3: '🔥', sharpEye: '🎯',
  games10: '🪑', games50: '🟩', games250: '🏠',
  wins10: '🔟', wins25: '❄️', wins100: '💯', wins250: '👑',
  hands50: '🃏', hands250: '🌦️', hands1000: '♾️',
  points100: '✍️', points500: '⛈️', points2000: '📜',
  euchres10: '🪤', euchres50: '🚪', euchres200: '☠️',
  marches10: '🧽', marches50: '🌪️', alone5: '🎙️', alone25: '🍽️',
  streak5: '🌶️', streak10: '🛡️', streak25: '🦄',
  coach100: '📚', coach500: '🧠',
  cellarCup: '🍺', highlandCup: '🎩', apexCup: '🏙️', vaultCup: '🔐', mastersCup: '🥇',
  allCups: '👑', rivalSweep: '✅', prestigeCup: '✨', prestigeCup25: '🏺',
  prestige1: 'Ⅰ', prestige3: 'Ⅲ', prestige5: 'Ⅴ', prestige10: 'Ⅹ',
  wink: '🃟', moon: '🌙', drawer: '🗝️', polish: '✨', oracle: '👁️', cut: '✂️',
};

function openStats() {
  stats = Stats.loadStats();
  renderStats();
  show('stats');
}

function renderStats() {
  $('statsRank').textContent = Stats.rankFor(stats).name;
  const pct = (x) => Math.round(x * 100) + '%';
  const cards = [
    { label: 'Games won', val: stats.gamesWon, sub: `of ${stats.gamesPlayed} · ${pct(Stats.winRate(stats))}`, accent: true },
    { label: 'Win streak', val: stats.currentStreak, sub: `best ${stats.longestStreak}` },
    { label: 'Hands won', val: stats.handsWon, sub: `of ${stats.handsPlayed}` },
    { label: 'Points for', val: stats.pointsFor, sub: `vs ${stats.pointsAgainst} against` },
    { label: 'Euchres dealt', val: stats.euchresDealt, sub: `${stats.euchresReceived} received` },
    { label: 'Marches', val: stats.marches, sub: `${stats.aloneWins} alone wins` },
    { label: 'Coach accuracy', val: pct(Stats.coachAccuracy(stats)), sub: `${stats.coachOptimal}/${stats.coachGraded} optimal`, accent: true },
  ];
  $('statsGrid').innerHTML = cards.map((c) =>
    `<div class="stat-card${c.accent ? ' accent' : ''}"><span class="stat-val">${c.val}</span>` +
    `<span class="stat-label">${c.label}</span><span class="stat-sub">${c.sub}</span></div>`).join('');

  $('badgeGrid').innerHTML = Object.entries(Stats.BADGES).filter(([id, b]) => !b.hidden || stats.badges[id]).map(([id, b]) => {
    const on = !!stats.badges[id];
    return `<div class="badge${on ? ' on' : ''}"><span class="badge-icon">${BADGE_ICONS[id] || '🎖️'}</span>` +
      `<span class="badge-name">${b.name}</span><span class="badge-desc">${b.desc}</span></div>`;
  }).join('');
}

// ─── training / coach ───
function snapshotState() {
  return typeof structuredClone === 'function' ? structuredClone(S) : JSON.parse(JSON.stringify(S));
}

function bindCoachControls() {
  const auto = $('coachAuto');
  renderCoachAutoState();
  auto.onclick = () => {
    feedback.autoAdvance = !feedback.autoAdvance;
    try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback)); } catch {}
    renderCoachAutoState();
  };
}

function renderCoachAutoState() {
  const auto = $('coachAuto');
  if (!auto) return;
  auto.classList.toggle('on', !!feedback.autoAdvance);
  auto.setAttribute('aria-pressed', String(!!feedback.autoAdvance));
  const label = $('coachAutoState');
  if (label) label.textContent = feedback.autoAdvance ? 'On' : 'Off';
}

function showHint(on) { $('hintBtn').hidden = !on; }

// evaluate the human's just-made move and surface the coach's verdict
async function coachReview(run, type, snapshot, seat, chosen) {
  setStatus(t('coachAnalyzing'));
  let res;
  try {
    res = await evaluateMove({
      type, state: snapshot, heroSeat: seat, chosen,
      opts: { samples: type === 'bid' ? 140 : 200, seed: (Math.random() * 2 ** 31) | 0 },
    });
  } catch { return; }
  if (!res || !isActive(run)) return;
  const optimal = res.grade === 'optimal';
  const topic = res.lesson?.topic || (type === 'bid' ? 'Bidding judgment' : 'Card play');
  trainHand.push({ grade: res.grade, optimal, type, topic });
  trainGame.push({ grade: res.grade, optimal, type, topic });
  Stats.recordCoachMove(stats, optimal);
  if (stats.coachGraded >= 20 && Stats.coachAccuracy(stats) >= 0.9) Stats.unlockBadge(stats, 'sharpEye');
  Stats.saveStats(stats);
  feedbackEvent(optimal ? 'bid' : 'card');
  if (optimal) setTimeout(() => reactBubble(2, 'praise', { prob: 0.4, cooldown: 12000 }), 0); // partner approves without pacing the game
  if (optimal && feedback.autoAdvance) { setStatus(t('coachOptimal')); await delay(180); return; }
  await showCoachSheet(res, type);
}

function showCoachSheet(res, type) {
  return new Promise((resolve) => {
    coachResolve = resolve;
    const chip = $('coachGrade');
    chip.textContent = GRADE_LABEL[res.grade] || res.grade;
    chip.className = 'coach-grade-chip grade-' + res.grade;
    $('coachQuick').innerHTML = coachQuickVerdict(res, type);
    $('coachExplain').innerHTML = res.explanation || '';
    const details = $('coachDetails');
    if (details) details.open = false;
    renderCoachLesson(res.lesson);
    const wrap = $('coachCards');
    wrap.innerHTML = '';
    if (type === 'play' && res.best && res.chosen && res.best.id !== res.chosen.id) {
      wrap.appendChild(coachCardCol('You played', res.chosen, false));
      wrap.appendChild(coachCardCol('Best', res.best, true));
      wrap.style.display = '';
    } else {
      wrap.style.display = 'none';
    }
    $('coachScrim').classList.add('show');
    $('coachScrim').setAttribute('aria-hidden', 'false');
    $('coachSheet').classList.add('show');
    $('coachSheet').setAttribute('aria-hidden', 'false');
    renderCoachAutoState();
    syncBackgroundInert();
    requestAnimationFrame(() => $('coachNext').focus());
    $('coachNext').onclick = () => { coachResolve = null; closeCoachSheet(); resolve(true); };
  });
}

function coachQuickVerdict(res, type) {
  const grade = (GRADE_LABEL[res.grade] || res.grade || 'Coach').toLowerCase();
  const optimal = res.grade === 'optimal' || sameCoachMove(res.chosen, res.best);
  if (optimal) {
    return type === 'bid'
      ? `<b>Keep it:</b> ${escapeHTML(coachBidVerdict(res.chosen))}.`
      : `<b>Keep it:</b> ${escapeHTML(cardName(res.chosen, S.trump))}.`;
  }
  if (type === 'bid') {
    return `<b>${escapeHTML(coachBidVerdict(res.best))}</b>, not ${escapeHTML(coachBidVerdict(res.chosen)).toLowerCase()}. <span>${escapeHTML(capitalize(grade))}</span>`;
  }
  if (res.best) {
    const chosen = res.chosen ? cardName(res.chosen, S.trump) : 'that card';
    return `<b>Play ${escapeHTML(cardName(res.best, S.trump))}</b>, not ${escapeHTML(chosen)}. <span>${escapeHTML(capitalize(grade))}</span>`;
  }
  return `<b>Look for the lower-risk line</b>, not the flashy one. <span>${escapeHTML(capitalize(grade))}</span>`;
}

function sameCoachMove(a, b) {
  if (!a || !b) return false;
  if (a.id || b.id) return a.id === b.id;
  return a.action === b.action && (a.suit || '') === (b.suit || '') && !!a.alone === !!b.alone;
}

function coachBidVerdict(best) {
  if (!best) return 'Choose the safer bid';
  if (best.action === 'pass') return 'Pass';
  if (best.action === 'orderUp') return best.alone ? 'Order it up alone' : 'Order it up';
  if (best.action === 'callTrump') {
    const suit = SUIT_SYMBOL[best.suit] || best.suit;
    return best.alone ? `Go alone in ${suit}` : `Call ${suit}`;
  }
  return 'Choose the better call';
}

function capitalize(value) {
  const s = String(value || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function coachCardCol(label, card, best) {
  const col = document.createElement('div');
  col.className = 'coach-card-col' + (best ? ' best' : '');
  col.appendChild(cardEl(card));
  const cap = document.createElement('div');
  cap.className = 'coach-card-label';
  cap.textContent = label;
  col.appendChild(cap);
  return col;
}

function renderCoachLesson(lesson) {
  const box = $('coachLesson');
  if (!box) return;
  if (!lesson) { box.innerHTML = ''; box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML =
    `<div class="coach-lesson-top"><span>${escapeHTML(lesson.topic)}</span><em>${escapeHTML(lesson.cost)}</em></div>` +
    `<div class="coach-principle">${escapeHTML(lesson.principle)}</div>` +
    `<div class="coach-drill"><b>Master drill:</b> ${escapeHTML(lesson.drill)}</div>`;
}

function closeCoachSheet() {
  $('coachScrim').classList.remove('show');
  $('coachScrim').setAttribute('aria-hidden', 'true');
  $('coachSheet').classList.remove('show');
  $('coachSheet').setAttribute('aria-hidden', 'true');
  syncBackgroundInert();
}

// on-demand hint in Solo/Train: flash the coach's recommended card in your hand
async function requestHint() {
  if (hintBusy || !S || S.phase !== 'play') return;
  if (!isHuman(S.turn) || humanResolve == null) return; // only while awaiting your play
  hintBusy = true;
  const prev = $('statusLine').textContent;
  setStatus(t('coachThinking'));
  try {
    const legal = getLegalCards(S, S.turn);
    const res = await evaluateMove({
      type: 'play', state: snapshotState(), heroSeat: S.turn, chosen: legal[0],
      opts: { samples: 160, seed: (Math.random() * 2 ** 31) | 0 },
    });
    if (res && res.best) {
      const el = document.querySelector(`.hand-you .card[data-id="${res.best.id}"]`);
      if (el) { el.classList.add('hint'); setTimeout(() => el.classList.remove('hint'), 1700); }
      setStatus(t('coachSuggests', { card: cardName(res.best, S.trump) }));
    } else { setStatus(prev); }
  } catch { setStatus(prev); }
  hintBusy = false;
}

function trainAccuracy(list) {
  const n = list.length;
  const opt = list.filter((m) => m.optimal).length;
  return { n, opt, pct: n ? Math.round((opt / n) * 100) : 0 };
}

function weakestNote(list) {
  const bad = list.filter((m) => !m.optimal);
  if (!bad.length) return '';
  const counts = {};
  for (const m of bad) counts[m.grade] = (counts[m.grade] || 0) + 1;
  const order = ['blunder', 'mistake', 'inaccuracy', 'good'];
  const worst = order.find((g) => counts[g]);
  const label = { blunder: 'blunders', mistake: 'mistakes', inaccuracy: 'inaccuracies', good: 'minor misses' }[worst];
  return `${counts[worst]} ${label} to clean up`;
}

function focusTopic(list) {
  const bad = list.filter((m) => !m.optimal && m.topic);
  if (!bad.length) return '';
  const counts = {};
  for (const m of bad) counts[m.topic] = (counts[m.topic] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function masteryDrill(topic) {
  if (!topic) return 'Keep playing Train mode and call out your reason before every bid and play.';
  const drills = [
    [/bid|trump|call/i, 'Before bidding, count sure tricks, possible trump help, and whether your partner is dealer.'],
    [/lead|opening/i, 'Before leading, name what you are trying to reveal: trump strength, partner support, or a safe exit.'],
    [/follow|void|suit/i, 'Track voids aloud for each opponent after every trick, then use that map before spending trump.'],
    [/partner|overtrump/i, 'When partner is winning, ask “can I save power?” before overtrumping or burning a boss card.'],
    [/boss|highest|control/i, 'Identify the current boss card in each suit and avoid spending it unless it wins tempo or points.'],
  ];
  return drills.find(([re]) => re.test(topic))?.[1] || `Replay one hand and focus only on: ${topic}.`;
}

function masteryProgress(statsNow, gameList) {
  const rank = Stats.rankFor(statsNow);
  const accuracy = Stats.coachAccuracy(statsNow);
  const winsNeed = Math.max(0, 50 - statsNow.gamesWon);
  const gradedNeed = Math.max(0, 50 - statsNow.coachGraded);
  const accuracyNeed = statsNow.coachGraded >= 50 && accuracy < 0.7 ? `${Math.round((0.7 - accuracy) * 100)} accuracy points` : '';
  const blockers = [];
  if (winsNeed) blockers.push(`${winsNeed} more win${winsNeed === 1 ? '' : 's'}`);
  if (gradedNeed) blockers.push(`${gradedNeed} more graded move${gradedNeed === 1 ? '' : 's'}`);
  if (accuracyNeed) blockers.push(accuracyNeed);
  const topic = focusTopic(gameList);
  const gameAccuracy = trainAccuracy(gameList);
  return {
    rank: rank.name,
    globalAccuracy: Math.round(accuracy * 100),
    gameAccuracy: gameAccuracy.pct,
    topic,
    drill: masteryDrill(topic),
    next: blockers.length ? blockers.join(' · ') : 'Master requirements met — defend the crown.',
  };
}

function handResultTitle(r) {
  if (!r) return '';
  const youScored = r.team === 0;
  if (r.kind === 'euchre') return youScored ? t('youEuchredThem') : t('youGotEuchred');
  if (r.kind === 'alone-march') return youScored ? t('loneHandSwept') : t('theySweptAlone');
  if (r.kind === 'march') return youScored ? t('youMarched') : t('theyMarched');
  return youScored ? t('youMadeBid') : t('theyMadeBid');
}

function handResultDetail(r) {
  if (!r) return '';
  const maker = r.makerTeam === 0 ? profile.teamName : opponentTeamName();
  const defenders = r.makerTeam === 0 ? opponentTeamName() : profile.teamName;
  if (r.kind === 'euchre') return escapeHTML(t('euchreDetail', { defenders, maker, n: r.makerTricks, suffix: r.makerTricks === 1 ? '' : 's' }));
  if (r.kind === 'alone-march') return escapeHTML(t('tookAllFiveAlone', { maker }));
  if (r.kind === 'march') return escapeHTML(t('tookAllFive', { maker }));
  return escapeHTML(t('madeBidDetail', { maker, n: r.makerTricks, suffix: r.makerTricks === 1 ? '' : 's' }));
}

function renderResultSummary(gameOver, r) {
  const box = $('modalSummary');
  if (!box) return;
  box.innerHTML = '';
  box.className = 'result-summary';
  if (gameOver) {
    const youWon = S.winner === 0;
    box.classList.add(youWon ? 'win' : 'loss');
    box.innerHTML =
      `<div class="result-hero">${escapeHTML(youWon ? t('tableSecured') : t('tableLost'))}</div>` +
      `<div class="result-grid">` +
      `<div class="result-stat"><span>${escapeHTML(t('final'))}</span><b>${escapeHTML(profile.teamName)} ${S.scores[0]} · ${escapeHTML(opponentTeamName())} ${S.scores[1]}</b></div>` +
      `<div class="result-stat"><span>${escapeHTML(t('mode'))}</span><b>${modeLabel()}</b></div>` +
      `</div>`;
    return;
  }
  if (!r) return;
  const youScored = r.team === 0;
  const maker = r.makerTeam === 0 ? profile.teamName : opponentTeamName();
  const scoringTeam = r.team === 0 ? profile.teamName : opponentTeamName();
  const defenderTricks = Math.max(0, 5 - (r.makerTricks || 0));
  box.classList.add(youScored ? 'win' : 'loss');
  box.innerHTML =
    `<div class="result-hero">${handResultDetail(r)}</div>` +
    `<div class="result-grid">` +
    `<div class="result-stat"><span>${escapeHTML(t('caller'))}</span><b>${escapeHTML(maker)}</b></div>` +
    `<div class="result-stat"><span>${escapeHTML(t('tricks'))}</span><b>${escapeHTML(t('makers'))} ${r.makerTricks} · ${escapeHTML(t('defenders'))} ${defenderTricks}</b></div>` +
    `<div class="result-stat"><span>${escapeHTML(t('swing'))}</span><b>+${r.points} ${escapeHTML(scoringTeam)}</b></div>` +
    `<div class="result-stat"><span>${escapeHTML(t('score'))}</span><b>${escapeHTML(profile.teamName)} ${S.scores[0]} · ${escapeHTML(opponentTeamName())} ${S.scores[1]}</b></div>` +
    `</div>`;
}

function modeLabel() {
  return ({ ai: t('solo'), train: t('train'), tour: t('tournaments'), daily: t('dailyDeal') }[mode]) || t('appTitle');
}

// build the coach recap shown in the result modal during training
function renderRecap(gameOver) {
  const box = $('modalRecap');
  if (!box) return;
  box.innerHTML = '';
  if (!isTrain()) { box.style.display = 'none'; return; }
  box.style.display = '';
  const list = gameOver ? trainGame : trainHand;
  const a = trainAccuracy(list);
  if (!a.n) { box.style.display = 'none'; return; }
  const head = gameOver ? 'Coach accuracy this game' : 'Coach accuracy this hand';
  const note = weakestNote(list);
  const topic = focusTopic(list);
  box.innerHTML =
    `<div class="recap-row"><span class="recap-k">${head}</span><span class="recap-v">${a.opt}/${a.n} optimal · ${a.pct}%</span></div>` +
    `<div class="recap-bar"><span style="width:${a.pct}%"></span></div>` +
    (note ? `<div class="recap-row"><span class="recap-k">Focus</span><span class="recap-v">${note}</span></div>` : '') +
    (topic ? `<div class="recap-row"><span class="recap-k">Lesson</span><span class="recap-v">${escapeHTML(topic)}</span></div>` : '') +
    (gameOver ? renderMasteryPath(list) : '');
}

function renderMasteryPath(list) {
  const m = masteryProgress(stats, list);
  return `<div class="mastery-card">` +
    `<div class="mastery-head"><span>Mastery path</span><b>${escapeHTML(m.rank)}</b></div>` +
    `<div class="mastery-grid">` +
    `<div><span>This game</span><b>${m.gameAccuracy}%</b></div>` +
    `<div><span>Career coach</span><b>${m.globalAccuracy}%</b></div>` +
    `</div>` +
    `<div class="mastery-next"><span>Next gate</span><b>${escapeHTML(m.next)}</b></div>` +
    `<div class="mastery-drill"><span>Drill</span><b>${escapeHTML(m.drill)}</b></div>` +
    `</div>`;
}

// Record every mode into the shared career stats. A game-ending hand bypasses
// the normal hand-end modal, so it must be recorded here before the game itself.
function recordOutcomeStats(gameOver) {
  if (!['ai', 'train', 'tour', 'daily'].includes(mode)) return;
  if (S.resultStatsRecorded) return;
  if (mode === 'daily' && dailyCtx?.practice) {
    S.resultStatsRecorded = true;
    saveGame();
    return;
  }
  if (mode === 'daily' && dailyCtx && S.lastResult) {
    dailyCtx.metrics.hands += 1;
    if (S.lastResult.kind === 'euchre' && S.lastResult.team === 0) dailyCtx.metrics.euchres += 1;
    if (S.alone && S.lastResult.team === 0 && S.lastResult.makerTeam === 0) dailyCtx.metrics.aloneWins += 1;
  }
  Stats.recordOutcome(stats, {
    result: S.lastResult,
    alone: S.alone,
    gameOver,
    won: S.winner === 0,
    difficulty,
  });
  Stats.saveStats(stats);
  S.resultStatsRecorded = true;
  saveGame();
}

// a floating "+N" chip that flies from the table to the scoring team's pill
function scoreFly(team, points) {
  if (!points) return;
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch {}
  const felt = $('felt');
  const target = $(team === 0 ? 'scoreUs' : 'scoreThem');
  if (!felt || !target) return;
  const f = felt.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  const chip = document.createElement('div');
  chip.className = 'score-fly';
  chip.textContent = '+' + points;
  chip.style.left = (f.left + f.width / 2) + 'px';
  chip.style.top = (f.top + f.height / 2) + 'px';
  chip.style.color = team === 0 ? 'var(--us)' : 'var(--them)';
  document.body.appendChild(chip);
  const dx = (t.left + t.width / 2) - (f.left + f.width / 2);
  const dy = (t.top + t.height / 2) - (f.top + f.height / 2);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    chip.style.transform = `translate(${dx}px, ${dy}px) scale(.55)`;
    chip.style.opacity = '0';
  }));
  setTimeout(() => chip.remove(), 900);
}

// notify feature modules (juice, personality) about hand/game outcomes
function emitResultEvents(gameOver, r) {
  if (gameOver) {
    emit('game', { winner: S.winner, youWon: S.winner === 0, mode, scores: S.scores.slice() });
    return;
  }
  if (!r) return;
  const youScored = r.team === 0;
  emit('hand', { result: r, youScored, alone: S.alone, mode });
  if (r.kind === 'euchre') emit('euchre', { byYou: r.makerTeam === 1, makerSeat: S.makerSeat });
  if (r.kind === 'march' || r.kind === 'alone-march') emit('march', { youScored, alone: r.kind === 'alone-march' });
}

// ─── result modal ───
function showResult(gameOver) {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    const r = S.lastResult;
    recordOutcomeStats(gameOver);
    if (r) scoreFly(r.team, r.points);
    const scrim = $('modalScrim');
    let kicker = '', title = '', score = '';
    if (gameOver) {
      const usWon = S.winner === 0;
      kicker = t('gameOver');
      title = usWon ? t('youWin') : t('youLose');
      score = t('finalScore', { usName: profile.teamName, us: S.scores[0], themName: opponentTeamName(), them: S.scores[1] });
    } else if (r) {
      const usScored = r.team === 0;                 // team 0 = You + Partner
      const kindLabel = { euchre: t('euchre'), march: t('march'), 'alone-march': t('aloneMarch'), point: t('hand') }[r.kind] || t('hand');
      title = handResultTitle(r) || (usScored ? t('youWonHand') : t('youLostHand'));
      kicker = `${kindLabel} • +${r.points}`;
      score = `${profile.teamName} ${S.scores[0]} · ${opponentTeamName()} ${S.scores[1]}`;
    }
    $('modalKicker').textContent = kicker;
    $('modalTitle').textContent = title;
    $('modalScore').textContent = score;
    renderResultSummary(gameOver, r);
    renderRecap(gameOver);
    $('modalBtn').textContent = gameOver ? t('backToMenu') : t('nextHand');
    scrim.classList.add('show');
    scrim.setAttribute('aria-hidden', 'false');
    syncBackgroundInert();
    emitResultEvents(gameOver, r);
    requestAnimationFrame(() => $('modalBtn').focus());
    $('modalBtn').onclick = () => {
      pendingResolve = null;
      scrim.classList.remove('show');
      scrim.setAttribute('aria-hidden', 'true');
      syncBackgroundInert();
      resolve(true);
    };
  });
}
