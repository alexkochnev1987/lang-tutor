/**
 * Расширение тематического ядра — третий заход, прицельный.
 *
 * После второго захода (`vocab-themes-2.mjs`) слова покрывали 92 дня из
 * 155. Остаток добирался не вслепую: по каждой теме посчитана разница
 * между тем, сколько слов просят её дни, и тем, сколько слов в теме есть.
 * Больше всего не хватало досугу, повседневной жизни, обществу, дому,
 * образованию и работе — им здесь и отдан объём.
 *
 * ПОТОЛОК. Объём ограничен не фантазией, а бюджетом программы: 182 дня
 * по 15 минут дают 15,7 часа на лексику, а каждое слово стоит от 38 до
 * 100 секунд в зависимости от прозрачности (VOCABULARY.md §3). После
 * этого захода занято около 15 часов — запас почти исчерпан. Дальше
 * добирать слова нельзя: оставшиеся дни должны уходить в повторение и
 * грамматику, иначе программа обещает то, чего не успеет.
 *
 * Формат и правила разметки — как в `vocab-themes-2.mjs`.
 */
export const THEMATIC_3 = {
  // 7.1 Человек — родня и характер
  '7.1': [
    ['wnuk',        'noun', 'внук',               'transparent'],
    ['wujek',       'noun', 'дядя',               'opaque'],
    ['ciocia',      'noun', 'тётя',               'opaque'],
    ['kuzyn',       'noun', 'двоюродный брат',    'transparent'],
    ['małżeństwo',  'noun', 'брак, супружество',  'opaque'],
    ['rozwód',      'noun', 'развод',             'transparent'],
    ['przyjaciółka','noun', 'подруга',            'partial'],
    ['pracowity',   'adj',  'трудолюбивый',       'partial'],
    ['wzrost',      'noun', 'рост (человека)',    'partial'],
    ['broda',       'noun', 'борода; подбородок', 'partial'],
  ],

  // 7.2 Дом и жильё — обстановка и аренда
  '7.2': [
    ['adres',       'noun', 'адрес',              'transparent'],
    ['piwnica',     'noun', 'подвал',             'opaque'],
    ['strych',      'noun', 'чердак',             'opaque'],
    ['garaż',       'noun', 'гараж',              'transparent'],
    ['kaucja',      'noun', 'залог при аренде',   'partial'],
    ['właściciel',  'noun', 'владелец',           'opaque'],
    ['lokator',     'noun', 'жилец',              'partial'],
    ['przeprowadzka','noun','переезд',            'opaque'],
    ['kanapa',      'noun', 'диван',              'opaque'],
    ['fotel',       'noun', 'кресло',             'opaque'],
    ['lampa',       'noun', 'лампа',              'transparent'],
    ['żarówka',     'noun', 'лампочка',           'opaque'],
    ['kran',        'noun', 'кран',               'transparent'],
    ['piekarnik',   'noun', 'духовка',            'opaque'],
    ['talerz',      'noun', 'тарелка',            'transparent'],
    ['kubek',       'noun', 'кружка',             'opaque'],
    ['szklanka',    'noun', 'стакан',             'partial'],
    ['widelec',     'noun', 'вилка',              'opaque'],
    ['łyżka',       'noun', 'ложка',              'transparent'],
    ['naczynia',    'noun', 'посуда',             'opaque'],
  ],

  // 7.3 Повседневная жизнь — месяцы и распорядок
  '7.3': [
    ['styczeń',     'noun', 'январь',             'opaque'],
    ['luty',        'noun', 'февраль',            'opaque'],
    ['marzec',      'noun', 'март',               'partial'],
    ['kwiecień',    'noun', 'апрель',             'opaque'],
    ['maj',         'noun', 'май',                'transparent'],
    ['czerwiec',    'noun', 'июнь',               'opaque'],
    ['lipiec',      'noun', 'июль',               'opaque'],
    ['sierpień',    'noun', 'август',             'opaque'],
    ['wrzesień',    'noun', 'сентябрь',           'opaque'],
    ['październik', 'noun', 'октябрь',            'opaque'],
    ['listopad',    'noun', 'ноябрь',             'opaque'],
    ['grudzień',    'noun', 'декабрь',            'opaque'],
    ['popołudnie',  'noun', 'вторая половина дня','opaque'],
    ['północ',      'noun', 'полночь; север',     'partial'],
    ['kwadrans',    'noun', 'четверть часа',      'opaque'],
    ['minuta',      'noun', 'минута',             'transparent'],
    ['zegarek',     'noun', 'часы (наручные)',    'partial'],
    ['kalendarz',   'noun', 'календарь',          'transparent'],
    ['data',        'noun', 'дата',               'transparent'],
    ['myć się',     'verb', 'мыться',             'transparent'],
    ['zmęczony',    'adj',  'усталый',            'opaque'],
    ['śmieci',      'noun', 'мусор',              'opaque'],
  ],

  // 7.4 Досуг — спорт, искусство, игры
  '7.4': [
    ['piłka nożna', 'noun', 'футбол',             'opaque'],
    ['mecz',        'noun', 'матч',               'transparent'],
    ['kibic',       'noun', 'болельщик',          'opaque'],
    ['drużyna',     'noun', 'команда',            'partial'],
    ['trener',      'noun', 'тренер',             'transparent'],
    ['bieganie',    'noun', 'бег',                'partial'],
    ['wędkarstwo',  'noun', 'рыбалка',            'opaque'],
    ['ogrodnictwo', 'noun', 'садоводство',        'partial'],
    ['powieść',     'noun', 'роман (книга)',      'partial'],
    ['komedia',     'noun', 'комедия',            'transparent'],
    ['serial',      'noun', 'сериал',             'transparent'],
    ['odcinek',     'noun', 'серия; отрезок',     'partial'],
    ['scena',       'noun', 'сцена',              'transparent'],
    ['widz',        'noun', 'зритель',            'opaque'],
    ['publiczność', 'noun', 'публика',            'transparent'],
    ['gitara',      'noun', 'гитара',             'transparent'],
    ['chór',        'noun', 'хор',                'transparent'],
    ['rysować',     'verb', 'рисовать',           'transparent'],
    ['malować',     'verb', 'рисовать красками',  'partial'],
    ['szachy',      'noun', 'шахматы',            'transparent'],
    ['rozrywka',    'noun', 'развлечение',        'opaque'],
    ['festiwal',    'noun', 'фестиваль',          'transparent'],
  ],

  // 7.5 Путешествия — транспорт и формальности
  '7.5': [
    ['lot',         'noun', 'рейс, полёт',        'partial'],
    ['przesiadka',  'noun', 'пересадка',          'opaque'],
    ['odprawa',     'noun', 'регистрация на рейс','opaque'],
    ['wiza',        'noun', 'виза',               'transparent'],
    ['pensjonat',   'noun', 'пансионат',          'transparent'],
    ['recepcja',    'noun', 'стойка регистрации', 'partial'],
    ['doba',        'noun', 'сутки',              'transparent'],
    ['pamiątka',    'noun', 'сувенир',            'partial'],
    ['zagranica',   'noun', 'заграница',          'partial'],
    ['kraj',        'noun', 'страна',             'partial'],
    ['stolica',     'noun', 'столица',            'transparent'],
    ['taksówka',    'noun', 'такси',              'transparent'],
    ['metro',       'noun', 'метро',              'transparent'],
    ['tramwaj',     'noun', 'трамвай',            'transparent'],
    ['autostrada',  'noun', 'автомагистраль',     'transparent'],
    ['prom',        'noun', 'паром',              'partial'],
  ],

  // 7.6 Общество — государство и общественная жизнь
  '7.6': [
    ['wojna',       'noun', 'война',              'transparent'],
    ['bezpieczeństwo','noun','безопасность',      'opaque'],
    ['przestępstwo','noun', 'преступление',       'partial'],
    ['kara',        'noun', 'наказание',          'partial'],
    ['więzienie',   'noun', 'тюрьма',             'opaque'],
    ['budżet',      'noun', 'бюджет',             'transparent'],
    ['gospodarka',  'noun', 'экономика, хозяйство','opaque'],
    ['inflacja',    'noun', 'инфляция',           'transparent'],
    ['demokracja',  'noun', 'демократия',         'transparent'],
    ['partia',      'noun', 'партия',             'transparent'],
    ['głosować',    'verb', 'голосовать',         'transparent'],
    ['kandydat',    'noun', 'кандидат',           'transparent'],
    ['protest',     'noun', 'протест',            'transparent'],
    ['strajk',      'noun', 'забастовка',         'partial'],
    ['organizacja', 'noun', 'организация',        'transparent'],
    ['wolontariat', 'noun', 'волонтёрство',       'partial'],
    ['mniejszość',  'noun', 'меньшинство',        'opaque'],
    ['uchodźca',    'noun', 'беженец',            'opaque'],
    ['religia',     'noun', 'религия',            'transparent'],
    ['tolerancja',  'noun', 'терпимость',         'transparent'],
  ],

  // 7.7 Здоровье — симптомы и помощь
  '7.7': [
    ['pogotowie',   'noun', 'скорая помощь',      'opaque'],
    ['karetka',     'noun', 'машина скорой',      'opaque'],
    ['objaw',       'noun', 'симптом',            'opaque'],
    ['ciśnienie',   'noun', 'давление',           'partial'],
    ['alergia',     'noun', 'аллергия',           'transparent'],
    ['zastrzyk',    'noun', 'укол',               'opaque'],
    ['szczepienie', 'noun', 'прививка',           'opaque'],
    ['rana',        'noun', 'рана',               'transparent'],
    ['złamanie',    'noun', 'перелом',            'opaque'],
    ['dieta',       'noun', 'диета',              'transparent'],
    ['sen',         'noun', 'сон',                'transparent'],
    ['ćwiczyć',     'verb', 'тренироваться',      'opaque'],
    ['oddychać',    'verb', 'дышать',             'partial'],
    ['wyzdrowieć',  'verb', 'выздороветь',        'partial'],
  ],

  // 7.8 Образование — школа и учёба
  '7.8': [
    ['przedszkole', 'noun', 'детский сад',        'opaque'],
    ['podstawówka', 'noun', 'начальная школа',    'opaque'],
    ['liceum',      'noun', 'лицей',              'transparent'],
    ['klasa',       'noun', 'класс',              'transparent'],
    ['dyrektor',    'noun', 'директор',           'transparent'],
    ['przerwa',     'noun', 'перемена, перерыв',  'partial'],
    ['dzwonek',     'noun', 'звонок',             'partial'],
    ['tablica',     'noun', 'доска',              'partial'],
    ['długopis',    'noun', 'ручка',              'opaque'],
    ['ołówek',      'noun', 'карандаш',           'opaque'],
    ['plecak',      'noun', 'рюкзак',             'opaque'],
    ['matura',      'noun', 'выпускной экзамен',  'opaque'],
    ['świadectwo',  'noun', 'аттестат',           'partial'],
    ['semestr',     'noun', 'семестр',            'transparent'],
    ['praca domowa','noun', 'домашнее задание',   'partial'],
    ['powtarzać',   'verb', 'повторять',          'transparent'],
    ['błąd',        'noun', 'ошибка',             'opaque'],
    ['słownik',     'noun', 'словарь',            'transparent'],
    ['gramatyka',   'noun', 'грамматика',         'transparent'],
    ['zaliczyć',    'verb', 'сдать, зачесть',     'opaque'],
  ],

  // 7.9 Работа — наём и офис
  '7.9': [
    ['kariera',     'noun', 'карьера',            'transparent'],
    ['ogłoszenie',  'noun', 'объявление',         'opaque'],
    ['rekrutacja',  'noun', 'набор, отбор',       'transparent'],
    ['pracodawca',  'noun', 'работодатель',       'opaque'],
    ['zespół',      'noun', 'команда, коллектив', 'opaque'],
    ['zebranie',    'noun', 'собрание',           'partial'],
    ['prezentacja', 'noun', 'презентация',        'transparent'],
    ['raport',      'noun', 'отчёт',              'transparent'],
    ['delegacja',   'noun', 'командировка',       'partial'],
    ['szkolenie',   'noun', 'обучение, тренинг',  'opaque'],
    ['odpowiedzialność','noun','ответственность', 'opaque'],
    ['stres',       'noun', 'стресс',             'transparent'],
    ['zarabiać',    'verb', 'зарабатывать',       'opaque'],
    ['zatrudnić',   'verb', 'нанять',             'opaque'],
    ['podpisać',    'verb', 'подписать',          'transparent'],
    ['ubezpieczenie','noun','страховка',          'opaque'],
    ['premia',      'noun', 'премия',             'transparent'],
    ['biurko',      'noun', 'письменный стол',    'opaque'],
    ['komputer',    'noun', 'компьютер',          'transparent'],
    ['spóźnienie',  'noun', 'опоздание',          'opaque'],
  ],

  // 7.10 Покупки — одежда и магазины
  '7.10': [
    ['centrum handlowe','noun','торговый центр',  'partial'],
    ['supermarket', 'noun', 'супермаркет',        'transparent'],
    ['piekarnia',   'noun', 'булочная',           'opaque'],
    ['kiosk',       'noun', 'киоск',              'transparent'],
    ['targ',        'noun', 'рынок, базар',       'partial'],
    ['przymierzalnia','noun','примерочная',       'opaque'],
    ['rozmiar',     'noun', 'размер',             'transparent'],
    ['kolor',       'noun', 'цвет',               'transparent'],
    ['wzór',        'noun', 'узор; образец',      'opaque'],
    ['bawełna',     'noun', 'хлопок',             'opaque'],
    ['ubranie',     'noun', 'одежда',             'opaque'],
    ['koszula',     'noun', 'рубашка',            'partial'],
    ['spodnie',     'noun', 'брюки',              'opaque'],
    ['sukienka',    'noun', 'платье',             'opaque'],
    ['buty',        'noun', 'обувь, ботинки',     'opaque'],
    ['kurtka',      'noun', 'куртка',             'transparent'],
    ['czapka',      'noun', 'шапка',              'transparent'],
    ['przecena',    'noun', 'уценка',             'opaque'],
  ],

  // 7.12 Услуги — мастера и коммуналка
  '7.12': [
    ['mechanik',    'noun', 'механик',            'transparent'],
    ['hydraulik',   'noun', 'сантехник',          'opaque'],
    ['elektryk',    'noun', 'электрик',           'transparent'],
    ['krawiec',     'noun', 'портной',            'opaque'],
    ['sprzątaczka', 'noun', 'уборщица',           'opaque'],
    ['opiekunka',   'noun', 'няня, сиделка',      'opaque'],
    ['abonament',   'noun', 'абонемент',          'transparent'],
    ['prąd',        'noun', 'электричество',      'opaque'],
    ['awaria',      'noun', 'авария, поломка',    'partial'],
    ['zgłosić',     'verb', 'заявить, сообщить',  'opaque'],
  ],

  // 7.15 Традиции и праздники
  '7.15': [
    ['karnawał',    'noun', 'карнавал',           'transparent'],
    ['Wszystkich Świętych','noun','День всех святых','partial'],
    ['Dzień Kobiet','noun', 'Женский день',       'partial'],
    ['opłatek',     'noun', 'рождественская облатка','opaque'],
    ['pisanki',     'noun', 'расписные яйца',     'partial'],
    ['tort',        'noun', 'торт',               'transparent'],
    ['toast',       'noun', 'тост',               'transparent'],
    ['zabawa',      'noun', 'гулянье, вечеринка', 'partial'],
  ],
}
