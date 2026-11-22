export interface LessonPhrase {
  situation: string
  cue: string
  answer: string
  translation: string
  alternatives?: readonly string[]
}

const phrases: Partial<Record<number, LessonPhrase>> = {
  1: {
    situation: 'На ресепшене быстро назвали время записи. Вежливо попроси повторить.',
    cue: 'Wizyta jest o siedemnastej trzydzieści.',
    answer: 'Przepraszam, można jeszcze raz?',
    translation: 'Извините, можно ещё раз?',
    alternatives: ['Przepraszam, czy można jeszcze raz?', 'Przepraszam, można powtórzyć?'],
  },
  2: {
    situation: 'Друг ждёт у кафе и спрашивает, где ты. Скажи, что уже в пути.',
    cue: 'Gdzie jesteś?',
    answer: 'Jestem już w drodze.',
    translation: 'Я уже в пути.',
    alternatives: ['Już jestem w drodze.'],
  },
  3: {
    situation: 'На встрече заканчивают обсуждение. Скажи, что у тебя ещё один вопрос.',
    cue: 'To chyba wszystko.',
    answer: 'Mam jeszcze jedno pytanie.',
    translation: 'У меня ещё один вопрос.',
    alternatives: ['Mam jeszcze pytanie.'],
  },
  4: {
    situation: 'Записываешь данные по телефону. Уточни, как пишется фамилия.',
    cue: 'Nazwisko to Dąbrowski.',
    answer: 'Jak się pisze to nazwisko?',
    translation: 'Как пишется эта фамилия?',
    alternatives: ['Jak to nazwisko się pisze?'],
  },
  5: {
    situation: 'Знакомого интересует, какое впечатление произвёл новый сосед. Скажи, что он очень приятный человек.',
    cue: 'I jak nowy sąsiad?',
    answer: 'To bardzo miła osoba.',
    translation: 'Это очень приятный человек.',
  },
  6: {
    situation: 'Показываешь другу фотографию. Скажи, что это твоя сестра.',
    cue: 'A kto to jest na zdjęciu?',
    answer: 'To moja siostra.',
    translation: 'Это моя сестра.',
  },
  7: {
    situation: 'Друг представил тебя новой знакомой. Скажи, что приятно познакомиться.',
    cue: 'Cześć, jestem Ola.',
    answer: 'Miło mi cię poznać.',
    translation: 'Приятно познакомиться.',
    alternatives: ['Miło cię poznać.', 'Miło mi.'],
  },
  8: {
    situation: 'У новых соседей слышен лай. Спроси, есть ли у них собака.',
    cue: 'Przepraszamy za hałas.',
    answer: 'Macie psa?',
    translation: 'У вас есть собака?',
    alternatives: ['Czy macie psa?'],
  },
  9: {
    situation: 'Друг предлагает подняться на лифте. Скажи, что он не работает.',
    cue: 'Może pojedziemy windą?',
    answer: 'Winda nie działa.',
    translation: 'Лифт не работает.',
  },
  10: {
    situation: 'Друг отправил объявление о квартире. Спроси, знает ли он размер арендной платы.',
    cue: 'Zobacz to mieszkanie.',
    answer: 'Wiesz, ile wynosi czynsz?',
    translation: 'Знаешь, сколько составляет арендная плата?',
    alternatives: ['Czy wiesz, ile wynosi czynsz?'],
  },
  11: {
    situation: 'Ты у подъезда. Друг просит просто войти, но дверь закрыта. Сообщи об этом.',
    cue: 'Po prostu wejdź, czekam na górze.',
    answer: 'Drzwi są zamknięte.',
    translation: 'Дверь закрыта.',
  },
  12: {
    situation: 'Смотришь съёмную квартиру. Уточни, есть ли здесь стиральная машина.',
    cue: 'Czy ma pan jakieś pytania?',
    answer: 'Jest tu pralka?',
    translation: 'Здесь есть стиральная машина?',
    alternatives: ['Czy jest tu pralka?', 'Czy tutaj jest pralka?'],
  },
  13: {
    situation: 'В гостиничном номере прохладно. Вежливо попроси ещё одно одеяло.',
    cue: 'W czym mogę pomóc?',
    answer: 'Poproszę jeszcze jeden koc.',
    translation: 'Можно ещё одно одеяло?',
    alternatives: ['Czy mogę prosić o jeszcze jeden koc?'],
  },
  14: {
    situation: 'После просмотра жилья спрашивают твоё мнение. Скажи, что эта квартира тебе подходит.',
    cue: 'I jak wrażenia po obejrzeniu?',
    answer: 'To mieszkanie mi pasuje.',
    translation: 'Эта квартира мне подходит.',
    alternatives: ['Pasuje mi to mieszkanie.'],
  },
  15: {
    situation: 'Друг удивляется, что тебе удобно встретиться так рано. Скажи, что ты жаворонок.',
    cue: 'Serio? O siódmej rano?',
    answer: 'Jestem rannym ptaszkiem.',
    translation: 'Я жаворонок.',
  },
  16: {
    situation: 'Друг спрашивает, когда встретиться. Предложи эту пятницу.',
    cue: 'Kiedy masz czas?',
    answer: 'W ten piątek mam czas.',
    translation: 'В эту пятницу у меня есть время.',
    alternatives: ['Mam czas w ten piątek.'],
  },
  17: {
    situation: 'Выезжаешь из съёмной квартиры. Уточни у хозяина, что делать с ключом.',
    cue: 'Proszę zamknąć mieszkanie przy wyjściu.',
    answer: 'Co z tym kluczem?',
    translation: 'Что делать с этим ключом?',
    alternatives: ['A co z tym kluczem?', 'Co zrobić z tym kluczem?'],
  },
  18: {
    situation: 'Коллега собирается уходить. Спроси, есть ли у него две минуты.',
    cue: 'Już wychodzę.',
    answer: 'Masz dwie minuty?',
    translation: 'У тебя есть две минуты?',
    alternatives: ['Czy masz dwie minuty?'],
  },
  19: {
    situation: 'Друг спрашивает про твой распорядок. Скажи, что обычно встаёшь в семь.',
    cue: 'O której zwykle wstajesz?',
    answer: 'Zwykle wstaję o siódmej.',
    translation: 'Обычно я встаю в семь.',
    alternatives: ['Wstaję zwykle o siódmej.', 'Zwykle wstaję o siódmej godzinie.'],
  },
  20: {
    situation: 'Предлагаешь другу встретиться в пятницу в шесть. Уточни, подходит ли ему это время.',
    cue: 'Mogę sprawdzić kalendarz.',
    answer: 'Pasuje ci ten termin?',
    translation: 'Тебе подходит это время?',
    alternatives: ['Czy pasuje ci ten termin?', 'Ten termin ci pasuje?', 'Pasuje ci ta godzina?'],
  },
  21: {
    situation: 'Друг переживает, что вы опоздаете. По-дружески успокой его и скажи, что вы успеете.',
    cue: 'Chyba się spóźnimy.',
    answer: 'Spoko, zdążymy.',
    translation: 'Спокойно, успеем.',
    alternatives: ['Spokojnie, zdążymy.', 'Bez obaw, zdążymy.'],
  },
  22: {
    situation: 'Новый знакомый говорит, что вечерами у него есть время. Спроси, чем он занимается в свободное время.',
    cue: 'Wieczory zwykle mam wolne.',
    answer: 'Co robisz w wolnym czasie?',
    translation: 'Чем ты занимаешься в свободное время?',
    alternatives: ['Co robisz w czasie wolnym?'],
  },
  23: {
    situation: 'Друг написал, что вечером будет концерт. Спроси, идёт ли он сегодня.',
    cue: 'Dzisiaj jest koncert w klubie.',
    answer: 'Idziesz dziś na koncert?',
    translation: 'Ты сегодня идёшь на концерт?',
    alternatives: ['Idziesz dzisiaj na koncert?', 'Czy idziesz dziś na koncert?'],
  },
  24: {
    situation: 'Друг зовёт в бассейн. Скажи, что хочешь пойти, но сегодня не получится.',
    cue: 'Idziemy dziś na basen?',
    answer: 'Chcę iść na basen, ale dziś nie dam rady.',
    translation: 'Хочу пойти в бассейн, но сегодня не смогу.',
    alternatives: ['Chcę iść na basen, ale dzisiaj nie dam rady.', 'Chętnie, ale dziś nie dam rady.'],
  },
  25: {
    situation: 'Друг предлагает фильм ужасов. Ответь разговорно, что это не твоё.',
    cue: 'Może obejrzymy horror?',
    answer: 'To nie moja bajka.',
    translation: 'Это не моё.',
  },
  26: {
    situation: 'Друг спрашивает про вчерашний вечер. Скажи, что был или была на матче.',
    cue: 'Co robiłeś wczoraj wieczorem?',
    answer: 'Byłem na meczu.',
    translation: 'Я был / была на матче.',
    alternatives: ['Byłam na meczu.'],
  },
  27: {
    situation: 'Знакомый собирается смотреть матч. Спроси, за кого он болеет.',
    cue: 'Zaraz zaczyna się mecz.',
    answer: 'Komu kibicujesz?',
    translation: 'За кого болеешь?',
    alternatives: ['A komu kibicujesz?'],
  },
  28: {
    situation: 'У друга освободился вечер. Предложи сходить в кино.',
    cue: 'Mam dziś wolny wieczór.',
    answer: 'To co, idziemy do kina?',
    translation: 'Ну что, идём в кино?',
    alternatives: ['Może pójdziemy do kina?', 'Idziemy do kina?'],
  },
  29: {
    situation: 'Вы уже час в дороге. Спроси, когда вы приедете.',
    cue: 'Jedziemy już godzinę.',
    answer: 'Kiedy dojedziemy?',
    translation: 'Когда мы приедем?',
  },
  30: {
    situation: 'На вокзале нужен билет. Спроси, где его можно купить.',
    cue: 'Dzień dobry, w czym mogę pomóc?',
    answer: 'Gdzie mogę kupić bilet?',
    translation: 'Где можно купить билет?',
    alternatives: ['Gdzie można kupić bilet?'],
  },
}

export function lessonPhraseFor(day: number, targetLanguage: string): LessonPhrase | undefined {
  return targetLanguage === 'pl' ? phrases[day] : undefined
}
