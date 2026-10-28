/**
 * Word lists for the onboarding profanity check. Data only: the matching rules live in detect.ts.
 *
 * Every entry is lowercase ASCII with diacritics already stripped (the input is normalized the same
 * way before matching), and every list is written in its romanized form. Two kinds of entry exist
 * because substring matching is what makes the Scunthorpe problem:
 *
 * - `contains`: long and unambiguous. Matched anywhere inside a word, so "fuckboy", "xXshitXx" and
 *   "bullshit" are caught. A term belongs here only if no ordinary word or surname contains it.
 * - `word`: short or ambiguous. Matched only as a whole word (letters on neither side), so "ass" is
 *   caught but "Assad", "Classic" and "Essex" are not. Compounds ("dumbass") get their own entry.
 *
 * An entry containing a space is a phrase: the space must be present, and the phrase is matched on
 * word boundaries. Chinese pinyin is deliberately listed in its joined form only ("shabi"), because
 * two short syllables written apart are very often a real given name plus surname.
 *
 * Adding a term: prefer `word` when in doubt, then add a test for the innocent word that made you hesitate.
 */

export interface TermList {
  contains?: readonly string[];
  word?: readonly string[];
  /** Matched as written (no normalization beyond NFC and lowercase) for terms that have no romanization here. */
  native?: readonly string[];
}

export const TERM_LISTS: Record<string, TermList> = {
  english: {
    contains: [
      'fuck', 'phuck', 'motherfuck', 'shit', 'bullshit', 'bitch', 'biatch', 'asshole', 'arsehole', 'dumbass',
      'jackass', 'smartass', 'fatass', 'asswipe', 'asshat', 'assface', 'asslick', 'dickhead', 'dickwad',
      'cocksuck', 'cockhead', 'pussy', 'bastard', 'bollock', 'wanker', 'whore', 'slutty', 'douchebag',
      'jerkoff', 'jackoff', 'cumshot', 'cumslut', 'blowjob', 'handjob', 'dildo', 'orgasm', 'jizz',
      'faggot', 'nigger', 'nigga', 'niglet', 'wetback', 'towelhead', 'raghead', 'sandnigger',
      'retarded', 'vagina', 'pedophile', 'paedophile', 'hitler',
    ],
    word: [
      'ass', 'arse', 'dick', 'dicks', 'cock', 'cocks', 'cunt', 'cunts', 'cunty', 'twat', 'twats',
      'slut', 'sluts', 'tit', 'tits', 'titty', 'titties', 'boob', 'boobs', 'wank', 'prick', 'pricks',
      'piss', 'pissed', 'pisser', 'tosser', 'bugger', 'porn', 'porno', 'cum', 'anal', 'anus', 'penis',
      'sex', 'rapist', 'rapists', 'rape', 'raped', 'rapes', 'fag', 'fags', 'dyke', 'dykes', 'tranny', 'trannies', 'retard',
      'retards', 'spastic', 'spaz', 'coon', 'coons', 'chink', 'chinks', 'gook', 'gooks', 'spic', 'spics',
      'kike', 'kikes', 'paki', 'honky', 'beaner', 'negro', 'nazi', 'nazis', 'pedo', 'pedos', 'kys', 'thot',
      'mofo', 'fck', 'fuk', 'fuq', 'fuc', 'shyt', 'sheit', 'shiz', 'bich', 'btch',
      'ass hole', 'jack ass', 'dumb ass', 'smart ass', 'fat ass', 'dick head', 'cock sucker', 'mother fucker',
      'kill yourself',
    ],
  },
  spanish: {
    contains: [
      'mierda', 'pendejo', 'cabron', 'hijueputa', 'hijodeputa', 'hijoputa', 'maricon', 'gilipollas',
      'chingatumadre', 'chingada', 'chingar', 'verguita', 'concha tu madre', 'conchatumadre', 'culero',
      'cojudo', 'huevon', 'mamahuevo', 'malparido', 'hijueputas', 'puta madre', 'putamadre', 'vete a la mierda',
    ],
    word: [
      'puta', 'putas', 'puto', 'putos', 'putita', 'puton', 'verga', 'culo', 'joder', 'jodete', 'coño', 'cono',
      'marica', 'maricas', 'zorra', 'polla', 'pinche', 'mamon', 'chingon', 'cabrona', 'idiota', 'estupido',
      'hdp', 'ctm', 'sudaca', 'gonorrea', 'carajo', 'boludo', 'pelotudo', 'cagon',
    ],
  },
  french: {
    contains: [
      'merde', 'putain', 'salope', 'connard', 'connasse', 'enculer', 'encule', 'niquetamere', 'nique ta mere',
      'petasse', 'branleur', 'bougnoule', 'fils de pute', 'filsdepute', 'ta gueule', 'tagueule',
    ],
    word: [
      'pute', 'putes', 'nique', 'niquer', 'foutre', 'batard', 'bordel', 'salaud', 'couille', 'couilles',
      'bite', 'chiasse', 'tapette', 'negre', 'negresse', 'ntm', 'fdp', 'ptdr',
    ],
  },
  german: {
    contains: [
      'scheisse', 'scheiss', 'arschloch', 'hurensohn', 'wichser', 'schlampe', 'mistkerl',
      'schwuchtel', 'missgeburt', 'drecksau', 'fotze', 'verdammt', 'kackbratze', 'huhrensohn', 'spasti',
    ],
    word: ['arsch', 'fick', 'ficken', 'kacke', 'neger', 'hure', 'huren', 'nutte', 'wixer', 'vollidiot', 'schlampen'],
  },
  portuguese: {
    contains: [
      'caralho', 'buceta', 'arrombado', 'vagabunda', 'babaca', 'punheta', 'xoxota', 'desgracado', 'fodase',
      'vaitomarnocu', 'filho da puta', 'filhodaputa', 'viadao', 'cuzao',
    ],
    word: ['porra', 'foda', 'foder', 'fodido', 'viado', 'bosta', 'otario', 'cuzao', 'piroca', 'corno', 'merdinha'],
  },
  italian: {
    contains: [
      'cazzo', 'vaffanculo', 'stronzo', 'puttana', 'minchia', 'coglione', 'fanculo', 'sborra', 'pompino',
      'zoccola', 'figlio di puttana', 'porcodio', 'porcamadonna',
    ],
    word: ['troia', 'troie', 'figa', 'finocchio', 'frocio', 'culo', 'negro', 'merda', 'stronza', 'cretino'],
  },
  dutch: {
    contains: ['klootzak', 'godverdomme', 'neuken', 'kutwijf', 'hoerenzoon', 'tyfuslijer', 'kankerlijer', 'rotzak'],
    word: ['kut', 'kanker', 'hoer', 'lul', 'flikker', 'mongool', 'kutkind', 'klootzakken', 'lulhannes', 'tering'],
  },
  russian: {
    contains: [
      'blyat', 'blyad', 'pizda', 'pizdec', 'pizdet', 'nahui', 'nahuy', 'pohui', 'pohuy', 'nakhuy', 'pokhuy', 'mudila',
      'zalupa', 'govno', 'shlyukha', 'shlyuha', 'ublyudok', 'khuila', 'yebat', 'yobany', 'yobanyi',
      'ebanat', 'ebanut', 'eblan', 'pidoras', 'pidaras', 'pidorasy',
    ],
    word: ['khuy', 'xuy', 'khui', 'blyat', 'suka', 'sukin', 'ebat', 'mudak', 'gandon', 'dermo', 'durak', 'debil', 'mraz', 'pidor', 'pidar', 'cyka', 'cyka blyat', 'suka blyat', 'idi nahui'],
  },
  chinese: {
    contains: [
      'caonima', 'cao ni ma', 'tamade', 'ta ma de', 'nimabi', 'biaozi', 'hundan', 'wangbadan', 'wang ba dan',
      'gourende', 'gou ri de', 'rinima', 'ri ni ma', 'jibai', 'shagua',
    ],
    word: ['shabi', 'nmsl', 'mlgb', 'cnmb', 'wdnmd', 'wocao', 'gundan', 'bendan'],
    native: ['他妈的', '操你妈', '草泥马', '傻逼', '傻b', '婊子', '王八蛋', '滚蛋', '妈的', '肏'],
  },
  japanese: {
    contains: ['kusoyaro', 'bakayaro', 'kisama', 'kutabare', 'chikusho', 'chikushou', 'kuso yaro', 'baka yaro'],
    word: ['kuso', 'baka', 'manko', 'unko', 'chinko', 'temee', 'kusottare', 'aho baka'],
    native: ['くそ', 'クソ', 'ばか', 'バカ', '死ね', 'しね', 'ちんこ', 'まんこ', '馬鹿'],
  },
  korean: {
    contains: [
      'sibal', 'shibal', 'ssibal', 'ssibbal', 'sibbal', 'gaesaekki', 'gaesaeki', 'gae saekki', 'gaesekki', 'gesaeki',
      'byungshin', 'byeongsin', 'byeongshin', 'michinnom', 'kkeojyeo', 'ggeojyeo', 'jotgateun', 'sibalnom', 'ssibalnom',
    ],
    word: ['jiral', 'nyeon', 'tlqkf', 'saekki', 'saeki', 'ssangnom', 'ssaenggi', 'babo'],
    native: ['시발', '씨발', '개새끼', '병신', '지랄', '좆', '씹', '미친놈', '꺼져'],
  },
  arabic: {
    contains: [
      'sharmuta', 'sharmouta', 'sharmoota', 'charmouta', 'ibn sharmuta', 'kosomak', 'kos omak', 'kos ummak', 'kess omak',
      'kosommak', 'ya kalb', 'ibn kalb', 'ibn el kalb', 'ibnelkalb', 'ibnelsharmouta', 'manyak', 'zebbi', 'kusomak',
    ],
    word: ['ahbal', 'sharmoota', 'mkhanath', 'ibn haram'],
    native: ['كس امك', 'ابن الكلب', 'ابن شرموطة', 'شرموطة', 'خنزير', 'يا كلب', 'عاهرة'],
  },
  hindi: {
    contains: [
      'madarchod', 'maderchod', 'madrchod', 'behenchod', 'bhenchod', 'benchod', 'bhosdi', 'bhosda', 'chutiya',
      'haramzada', 'haramzade', 'haramkhor', 'gaandu', 'gandu', 'randwa', 'bhosdike', 'bhosadike',
    ],
    word: ['lauda', 'lawda', 'lavda', 'chutia', 'kutta', 'kutte', 'kamina', 'kamine', 'kamini', 'bsdk', 'chodu', 'chod', 'gaand', 'harami', 'saala kutta'],
    native: ['मादरचोद', 'बहनचोद', 'भोसड़ी', 'चूतिया', 'हरामी', 'गांडू', 'कुत्ता', 'रंडी'],
  },
};

/**
 * Ordinary words, places and surnames that contain a `contains` term but are not offensive. They are
 * blanked out of the text before matching. Whole-word terms never need an entry: they only match
 * between non-letters. Add an entry whenever a false positive is reported.
 */
export const INNOCENT_WORDS: readonly string[] = [
  'shiitake', 'shitake', 'shittim', 'mishit', 'mishits',
  'niggard', 'niggardly', 'snigger', 'sniggers', 'sniggered', 'sniggering',
  'pussycat', 'pussyfoot', 'pussywillow', 'pussyfooting',
  'therapist', 'therapists', 'scunthorpe', 'penistone', 'cockburn', 'hancock', 'dickson', 'dickinson', 'essex', 'sussex', 'middlesex',
  'assad', 'classic', 'assassin', 'bassett', 'massey', 'cassidy',
  'analyst', 'canal', 'cumberland', 'document', 'sextant', 'rapeseed', 'grape', 'drape',
];
