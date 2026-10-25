/**
 * Расширение тематического ядра — второй заход.
 *
 * Первый заход (`vocab-themes.mjs`) дал 174 тематических слова, и их
 * хватило на 58 дней программы из 155: новые слова заканчивались на дне
 * 107, дальше человек получал пустые занятия. Здесь — добор по тем же
 * 16 областям Katalogu B.
 *
 * Формат тот же: [лемма, часть речи, перевод, прозрачность].
 *
 * ПРОЗРАЧНОСТЬ ставится относительно РУССКОГО (VOCABULARY.md §2):
 *   transparent — узнаётся сразу, значение совпадает   (brat, szkoła)
 *   partial     — узнаётся, но значение сдвинуто        (miasto, godzina)
 *   opaque      — русский не помогает                   (pociąg, dziękuję)
 * Ложные друзья сюда НЕ попадают: у них отдельный источник с разбором
 * ошибки (`vocab-false-friends.mjs`) и критический приоритет.
 *
 * Слова отбирались по двум критериям разом: частотность в живой речи и
 * нужность для экзаменационных заданий. Для описания фотографии нужна
 * внешность, для rozmowy sterowanej — услуги и покупки, для письма —
 * связки и оценочная лексика.
 */
export const THEMATIC_2 = {
  // 7.1 Человек
  '7.1': [
    ['człowiek',    'noun', 'человек',            'transparent'],
    ['osoba',       'noun', 'человек, лицо',      'partial'],
    ['mężczyzna',   'noun', 'мужчина',            'transparent'],
    ['kobieta',     'noun', 'женщина',            'opaque'],
    ['dziewczyna',  'noun', 'девушка',            'transparent'],
    ['chłopak',     'noun', 'парень',             'partial'],
    ['młody',       'adj',  'молодой',            'transparent'],
    ['starszy',     'adj',  'пожилой; старший',   'partial'],
    ['charakter',   'noun', 'характер',           'transparent'],
    ['leniwy',      'adj',  'ленивый',            'transparent'],
    ['mądry',       'adj',  'умный',              'partial'],
    ['odważny',     'adj',  'смелый',             'transparent'],
    ['spokojny',    'adj',  'спокойный',          'transparent'],
    ['włosy',       'noun', 'волосы',             'transparent'],
    ['twarz',       'noun', 'лицо',               'opaque'],
    ['okulary',     'noun', 'очки',               'opaque'],
    ['sąsiad',      'noun', 'сосед',              'transparent'],
    ['babcia',      'noun', 'бабушка',            'transparent'],
    ['dziadek',     'noun', 'дедушка',            'transparent'],
    ['córka',       'noun', 'дочь',               'opaque'],
    ['syn',         'noun', 'сын',                'transparent'],
    ['znajomy',     'noun', 'знакомый',           'transparent'],
  ],

  // 7.2 Дом и жильё
  '7.2': [
    ['blok',        'noun', 'многоквартирный дом', 'partial'],
    ['parter',      'noun', 'первый этаж',        'partial'],
    ['schody',      'noun', 'лестница',           'partial'],
    ['drzwi',       'noun', 'дверь',              'transparent'],
    ['okno',        'noun', 'окно',               'transparent'],
    ['ściana',      'noun', 'стена',              'transparent'],
    ['podłoga',     'noun', 'пол',                'opaque'],
    ['sufit',       'noun', 'потолок',            'opaque'],
    ['balkon',      'noun', 'балкон',             'transparent'],
    ['lodówka',     'noun', 'холодильник',        'opaque'],
    ['pralka',      'noun', 'стиральная машина',  'opaque'],
    ['prysznic',    'noun', 'душ',                'opaque'],
    ['ręcznik',     'noun', 'полотенце',          'partial'],
    ['poduszka',    'noun', 'подушка',            'transparent'],
    ['koc',         'noun', 'одеяло, плед',       'opaque'],
    ['remont',      'noun', 'ремонт',             'transparent'],
    ['sprzątać',    'verb', 'убирать',            'opaque'],
    ['porządek',    'noun', 'порядок',            'transparent'],
  ],

  // 7.3 Повседневная жизнь
  '7.3': [
    ['dzień',       'noun', 'день',               'transparent'],
    ['noc',         'noun', 'ночь',               'transparent'],
    ['wtorek',      'noun', 'вторник',            'transparent'],
    ['czwartek',    'noun', 'четверг',            'transparent'],
    ['weekend',     'noun', 'выходные',           'opaque'],
    ['budzik',      'noun', 'будильник',          'partial'],
    ['spóźniać się','verb', 'опаздывать',         'opaque'],
    ['zdążyć',      'verb', 'успеть',             'opaque'],
    ['załatwić',    'verb', 'уладить, оформить',  'opaque'],
    ['codziennie',  'adv',  'ежедневно',          'partial'],
    ['zwykle',      'adv',  'обычно',             'partial'],
    ['rzadko',      'adv',  'редко',              'transparent'],
    ['chwila',      'noun', 'момент, минутка',    'partial'],
    ['termin',      'noun', 'срок',               'partial'],
    ['spotkanie',   'noun', 'встреча',            'opaque'],
    ['plan',        'noun', 'план',               'transparent'],
    ['obowiązek',   'noun', 'обязанность',        'partial'],
  ],

  // 7.4 Досуг
  '7.4': [
    ['hobby',       'noun', 'хобби',              'transparent'],
    ['sport',       'noun', 'спорт',              'transparent'],
    ['siłownia',    'noun', 'тренажёрный зал',    'opaque'],
    ['rower',       'noun', 'велосипед',          'opaque'],
    ['narty',       'noun', 'лыжи',               'opaque'],
    ['basen',       'noun', 'бассейн',            'transparent'],
    ['teatr',       'noun', 'театр',              'transparent'],
    ['kino',        'noun', 'кино',               'transparent'],
    ['aktor',       'noun', 'актёр',              'transparent'],
    ['przedstawienie','noun','спектакль',         'partial'],
    ['gra',         'noun', 'игра',               'transparent'],
    ['grać',        'verb', 'играть',             'transparent'],
    ['śpiewać',     'verb', 'петь',               'partial'],
    ['tańczyć',     'verb', 'танцевать',          'transparent'],
    ['spacer',      'noun', 'прогулка',           'opaque'],
    ['zbierać',     'verb', 'собирать',           'transparent'],
    ['fotografia',  'noun', 'фотография',         'transparent'],
  ],

  // 7.5 Путешествия
  '7.5': [
    ['podróżować',  'verb', 'путешествовать',     'partial'],
    ['pasażer',     'noun', 'пассажир',           'transparent'],
    ['peron',       'noun', 'платформа',          'partial'],
    ['rozkład jazdy','noun','расписание',         'opaque'],
    ['kierowca',    'noun', 'водитель',           'opaque'],
    ['benzyna',     'noun', 'бензин',             'transparent'],
    ['droga',       'noun', 'дорога',             'transparent'],
    ['mapa',        'noun', 'карта',              'partial'],
    ['hotel',       'noun', 'гостиница',          'transparent'],
    ['rezerwacja',  'noun', 'бронирование',       'partial'],
    ['paszport',    'noun', 'паспорт',            'transparent'],
    ['granica',     'noun', 'граница',            'transparent'],
    ['zwiedzać',    'verb', 'осматривать, ходить по достопримечательностям', 'opaque'],
    ['przewodnik',  'noun', 'гид; путеводитель',  'partial'],
    ['plaża',       'noun', 'пляж',               'transparent'],
    ['wyjazd',      'noun', 'отъезд, поездка',    'partial'],
    ['przyjazd',    'noun', 'приезд',             'transparent'],
  ],

  // 7.6 Общество
  '7.6': [
    ['rząd',        'noun', 'правительство',      'opaque'],
    ['prezydent',   'noun', 'президент',          'transparent'],
    ['minister',    'noun', 'министр',            'transparent'],
    ['prawo',       'noun', 'право; закон',       'transparent'],
    ['ustawa',      'noun', 'закон',              'opaque'],
    ['sąd',         'noun', 'суд',                'transparent'],
    ['obywatelstwo','noun', 'гражданство',        'opaque'],
    ['cudzoziemiec','noun', 'иностранец',         'partial'],
    ['dowód osobisty','noun','удостоверение личности','opaque'],
    ['formularz',   'noun', 'бланк',              'partial'],
    ['wniosek',     'noun', 'заявление; вывод',   'opaque'],
    ['urzędnik',    'noun', 'чиновник',           'partial'],
    ['kolejka',     'noun', 'очередь',            'opaque'],
    ['społeczeństwo','noun','общество',           'opaque'],
  ],

  // 7.7 Здоровье
  '7.7': [
    ['choroba',     'noun', 'болезнь',            'partial'],
    ['chory',       'adj',  'больной',            'partial'],
    ['zdrowy',      'adj',  'здоровый',           'transparent'],
    ['kaszel',      'noun', 'кашель',             'transparent'],
    ['katar',       'noun', 'насморк',            'opaque'],
    ['grypa',       'noun', 'грипп',              'transparent'],
    ['gardło',      'noun', 'горло',              'transparent'],
    ['brzuch',      'noun', 'живот',              'opaque'],
    ['serce',       'noun', 'сердце',             'transparent'],
    ['plecy',       'noun', 'спина',              'partial'],
    ['ząb',         'noun', 'зуб',                'transparent'],
    ['dentysta',    'noun', 'стоматолог',         'transparent'],
    ['pielęgniarka','noun', 'медсестра',          'opaque'],
    ['badanie',     'noun', 'обследование',       'partial'],
    ['tabletka',    'noun', 'таблетка',           'transparent'],
    ['leczyć',      'verb', 'лечить',             'transparent'],
    ['boleć',       'verb', 'болеть (о части тела)', 'transparent'],
    ['czuć się',    'verb', 'чувствовать себя',   'transparent'],
  ],

  // 7.8 Образование
  '7.8': [
    ['wykład',      'noun', 'лекция',             'opaque'],
    ['zajęcia',     'noun', 'занятия',            'partial'],
    ['ćwiczenia',   'noun', 'практические занятия','partial'],
    ['wydział',     'noun', 'факультет',          'partial'],
    ['student',     'noun', 'студент',            'transparent'],
    ['dyplom',      'noun', 'диплом',             'transparent'],
    ['stypendium',  'noun', 'стипендия',          'transparent'],
    ['podręcznik',  'noun', 'учебник',            'opaque'],
    ['notatka',     'noun', 'запись, конспект',   'partial'],
    ['zadanie',     'noun', 'задание',            'transparent'],
    ['sprawdzian',  'noun', 'контрольная',        'opaque'],
    ['nauka',       'noun', 'учёба; наука',       'partial'],
    ['kurs',        'noun', 'курс',               'transparent'],
    ['wiedza',      'noun', 'знания',             'partial'],
    ['umiejętność', 'noun', 'умение, навык',      'partial'],
  ],

  // 7.9 Работа
  '7.9': [
    ['stanowisko',  'noun', 'должность',          'opaque'],
    ['etat',        'noun', 'ставка, полная занятость', 'partial'],
    ['nadgodziny',  'noun', 'сверхурочные',       'opaque'],
    ['awans',       'noun', 'повышение',          'partial'],
    ['firma',       'noun', 'фирма',              'transparent'],
    ['klient',      'noun', 'клиент',             'transparent'],
    ['projekt',     'noun', 'проект',             'transparent'],
    ['życiorys',    'noun', 'резюме',             'opaque'],
    ['zatrudnienie','noun', 'трудоустройство',    'opaque'],
    ['bezrobocie',  'noun', 'безработица',        'partial'],
    ['emerytura',   'noun', 'пенсия',             'opaque'],
    ['zwolnienie',  'noun', 'увольнение; больничный', 'partial'],
    ['obowiązki',   'noun', 'обязанности',        'partial'],
    ['wynagrodzenie','noun','оплата труда',       'opaque'],
  ],

  // 7.10 Покупки
  '7.10': [
    ['sprzedawca',  'noun', 'продавец',           'transparent'],
    ['klientka',    'noun', 'покупательница',     'transparent'],
    ['wózek',       'noun', 'тележка',            'partial'],
    ['półka',       'noun', 'полка',              'transparent'],
    ['torba',       'noun', 'сумка',              'partial'],
    ['opakowanie',  'noun', 'упаковка',           'partial'],
    ['rabat',       'noun', 'скидка',             'partial'],
    ['wyprzedaż',   'noun', 'распродажа',         'partial'],
    ['zwrot',       'noun', 'возврат',            'partial'],
    ['gwarancja',   'noun', 'гарантия',           'transparent'],
    ['gotówka',     'noun', 'наличные',           'opaque'],
    ['reszta',      'noun', 'сдача; остальное',   'partial'],
    ['kosztować',   'verb', 'стоить',             'partial'],
    ['wydawać',     'verb', 'тратить; выдавать',  'partial'],
  ],

  // 7.11 Еда и напитки
  '7.11': [
    ['woda',        'noun', 'вода',               'transparent'],
    ['sok',         'noun', 'сок',                'transparent'],
    ['piwo',        'noun', 'пиво',               'transparent'],
    ['wino',        'noun', 'вино',               'transparent'],
    ['cukier',      'noun', 'сахар',              'partial'],
    ['sól',         'noun', 'соль',               'transparent'],
    ['masło',       'noun', 'сливочное масло',    'transparent'],
    ['jajko',       'noun', 'яйцо',               'partial'],
    ['ryba',        'noun', 'рыба',               'transparent'],
    ['kurczak',     'noun', 'курица',             'partial'],
    ['ziemniak',    'noun', 'картофель',          'opaque'],
    ['pomidor',     'noun', 'помидор',            'transparent'],
    ['ogórek',      'noun', 'огурец',             'transparent'],
    ['jabłko',      'noun', 'яблоко',             'transparent'],
    ['ciasto',      'noun', 'пирог, тесто',       'partial'],
    ['lody',        'noun', 'мороженое',          'opaque'],
    ['smaczny',     'adj',  'вкусный',            'opaque'],
    ['słodki',      'adj',  'сладкий',            'transparent'],
    ['słony',       'adj',  'солёный',            'transparent'],
    ['kwaśny',      'adj',  'кислый',             'partial'],
  ],

  // 7.12 Услуги
  '7.12': [
    ['usługa',      'noun', 'услуга',             'transparent'],
    ['kelner',      'noun', 'официант',           'opaque'],
    ['warsztat',    'noun', 'мастерская',         'partial'],
    ['naprawić',    'verb', 'починить',           'partial'],
    ['reklamacja',  'noun', 'претензия, рекламация', 'partial'],
    ['dostawa',     'noun', 'доставка',           'transparent'],
    ['kurier',      'noun', 'курьер',             'transparent'],
    ['przesyłka',   'noun', 'посылка',            'partial'],
    ['znaczek',     'noun', 'марка',              'opaque'],
    ['koperta',     'noun', 'конверт',            'opaque'],
    ['kantor',      'noun', 'обменный пункт',     'opaque'],
    ['wymiana',     'noun', 'обмен',              'partial'],
    ['kredyt',      'noun', 'кредит',             'transparent'],
    ['oszczędności','noun', 'сбережения',         'opaque'],
  ],

  // 7.13 Места
  '7.13': [
    ['dzielnica',   'noun', 'район города',       'partial'],
    ['osiedle',     'noun', 'жилой массив',       'opaque'],
    ['skrzyżowanie','noun', 'перекрёсток',        'opaque'],
    ['przystanek',  'noun', 'остановка',          'opaque'],
    ['chodnik',     'noun', 'тротуар',            'opaque'],
    ['parking',     'noun', 'парковка',           'transparent'],
    ['park',        'noun', 'парк',               'transparent'],
    ['wieś',        'noun', 'деревня',            'partial'],
    ['okolica',     'noun', 'окрестности',        'partial'],
    ['kierunek',    'noun', 'направление',        'opaque'],
    ['prosto',      'adv',  'прямо',              'partial'],
    ['blisko',      'adv',  'близко',             'transparent'],
    ['daleko',      'adv',  'далеко',             'transparent'],
    ['naprzeciwko', 'adv',  'напротив',           'partial'],
  ],

  // 7.14 Природа
  '7.14': [
    ['niebo',       'noun', 'небо',               'transparent'],
    ['chmura',      'noun', 'туча, облако',       'partial'],
    ['mróz',        'noun', 'мороз',              'transparent'],
    ['upał',        'noun', 'жара',               'opaque'],
    ['temperatura', 'noun', 'температура',        'transparent'],
    ['burza',       'noun', 'гроза',              'partial'],
    ['mgła',        'noun', 'туман',              'partial'],
    ['liść',        'noun', 'лист',               'transparent'],
    ['kwiat',       'noun', 'цветок',             'partial'],
    ['trawa',       'noun', 'трава',              'transparent'],
    ['zwierzę',     'noun', 'животное',           'partial'],
    ['pies',        'noun', 'собака',             'opaque'],
    ['kot',         'noun', 'кот',                'transparent'],
    ['ptak',        'noun', 'птица',              'partial'],
    ['jezioro',     'noun', 'озеро',              'transparent'],
    ['lato',        'noun', 'лето',               'transparent'],
    ['zima',        'noun', 'зима',               'transparent'],
  ],

  // 7.15 Традиции и праздники
  '7.15': [
    ['tradycja',    'noun', 'традиция',           'transparent'],
    ['Sylwester',   'noun', 'новогодняя ночь',    'opaque'],
    ['Nowy Rok',    'noun', 'Новый год',          'transparent'],
    ['choinka',     'noun', 'ёлка',               'opaque'],
    ['kolęda',      'noun', 'рождественская песня','opaque'],
    ['imieniny',    'noun', 'именины',            'transparent'],
    ['rocznica',    'noun', 'годовщина',          'partial'],
    ['gość',        'noun', 'гость',              'transparent'],
    ['zaprosić',    'verb', 'пригласить',         'partial'],
    ['życzyć',      'verb', 'желать',             'partial'],
    ['obchodzić',   'verb', 'отмечать (праздник)','partial'],
    ['przyjęcie',   'noun', 'приём, вечеринка',   'partial'],
  ],

  // 7.16 Общие темы
  '7.16': [
    ['temat',       'noun', 'тема',               'transparent'],
    ['pytanie',     'noun', 'вопрос',             'opaque'],
    ['odpowiedź',   'noun', 'ответ',              'partial'],
    ['przykład',    'noun', 'пример',             'opaque'],
    ['różnica',     'noun', 'разница',            'transparent'],
    ['znaczenie',   'noun', 'значение',           'transparent'],
    ['cel',         'noun', 'цель',               'transparent'],
    ['wynik',       'noun', 'результат',          'opaque'],
    ['skutek',      'noun', 'последствие',        'opaque'],
    ['warunek',     'noun', 'условие',            'opaque'],
    ['uwaga',       'noun', 'внимание; замечание','partial'],
    ['opinia',      'noun', 'мнение',             'transparent'],
    ['prawda',      'noun', 'правда',             'transparent'],
    ['zgoda',       'noun', 'согласие',           'partial'],
  ],
}
