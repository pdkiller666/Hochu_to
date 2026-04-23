import { db, listingsTable, categoriesTable, regionsTable, usersTable } from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";

type ItemTpl = { title: string; desc: string; price: number; deposit: number };

// 15 объявлений на каждую из 10 категорий = 150 шт.
// Фото — стабильные URL с picsum.photos (seed гарантирует одну и ту же картинку).
const ITEMS: Record<string, ItemTpl[]> = {
  construction: [
    { title: "Перфоратор Bosch GBH 2-28 F",          desc: "880 Вт, 3,2 Дж, SDS-plus, чемодан и буры в комплекте.",        price: 500,  deposit: 4000 },
    { title: "Шуруповёрт Makita DDF484 18V",         desc: "Бесщёточный, 2 АКБ 5 Ач, кейс, биты.",                          price: 350,  deposit: 3500 },
    { title: "Лазерный уровень Bosch GLL 3-80",      desc: "3-плоскостной, 80 м, штатив, очки.",                            price: 700,  deposit: 6000 },
    { title: "Болгарка DeWalt DWE4257 125 мм",       desc: "1500 Вт, плавный пуск, диски в подарок.",                       price: 400,  deposit: 3000 },
    { title: "Бетономешалка 160 л",                  desc: "Чугунный венец, 230 В. Самовывоз или доставка по городу.",      price: 800,  deposit: 5000 },
    { title: "Леса строительные ЛРСП-30",            desc: "Высота до 6 м, грузоподъёмность 200 кг/м².",                    price: 1500, deposit: 12000 },
    { title: "Тепловая пушка дизельная 30 кВт",      desc: "Прямой нагрев, 50 л бак, для просушки помещений.",              price: 900,  deposit: 8000 },
    { title: "Аккумуляторная пила Makita DUC353",    desc: "18+18 В, шина 35 см, 2 АКБ 5 Ач.",                              price: 600,  deposit: 6000 },
    { title: "Виброплита Wacker Neuson 90 кг",       desc: "Honda GX160, центробежная сила 18 кН.",                         price: 1200, deposit: 10000 },
    { title: "Промышленный пылесос Karcher NT 30/1", desc: "30 л, влажная и сухая уборка, розетка для электроинструмента.", price: 500,  deposit: 4000 },
    { title: "Сварочный полуавтомат Aurora ULTIMATE 200", desc: "MIG/MAG/MMA, 200 А, проволока в подарок.",                price: 700,  deposit: 7000 },
    { title: "Пила торцовочная Metabo KGS 254",      desc: "Распил под углом до 47°, длина пропила 305 мм.",                price: 600,  deposit: 5000 },
    { title: "Шлифмашина ленточная Makita 9404",     desc: "Лента 100×610 мм, мешок-пылесборник.",                          price: 350,  deposit: 3000 },
    { title: "Краскопульт Wagner Control Pro 250M",  desc: "HEA-технология, бак 1 л, шланг 9 м.",                           price: 800,  deposit: 6000 },
    { title: "Алмазное бурение D=82 мм",             desc: "Установка СО + 5 коронок, обучение оператора 30 мин.",          price: 1200, deposit: 9000 },
  ],
  tourism: [
    { title: "Горные лыжи Rossignol Experience 88",  desc: "170 см, крепления Look SPX 12, отличное состояние.",            price: 700,  deposit: 8000 },
    { title: "Сноуборд Burton Custom 156",           desc: "Жёсткость средняя, крепления Burton Mission, ботинки 43.",       price: 800,  deposit: 9000 },
    { title: "Палатка MSR Habitude 4 (4 чел.)",      desc: "3,5 кг, тамбур, водостойкость 3000 мм.",                        price: 600,  deposit: 5000 },
    { title: "Спальник зимний -20°C",                desc: "Пуховый, размер L, компрессионный мешок.",                       price: 250,  deposit: 3000 },
    { title: "Туристический рюкзак Osprey Atmos 65", desc: "Антигравитационная подвеска, дождевик в комплекте.",            price: 200,  deposit: 4000 },
    { title: "SUP-доска надувная 11'",               desc: "Весло, насос, рюкзак, плавники. До 130 кг.",                    price: 900,  deposit: 6000 },
    { title: "Велосипед горный Trek Marlin 7",       desc: "Рама 19\", 27,5\", гидравлика, 1×11.",                          price: 500,  deposit: 12000 },
    { title: "Каяк надувной Sea Eagle 370",          desc: "На 2 человек, 2 весла, насос, чехол.",                          price: 1100, deposit: 8000 },
    { title: "Газовая горелка MSR PocketRocket 2",   desc: "73 г, котелок 1 л, баллон в подарок.",                          price: 150,  deposit: 1500 },
    { title: "Налобный фонарь Petzl Actik Core 600 lm", desc: "Аккумулятор + батарейки в комплекте.",                       price: 100,  deposit: 1500 },
    { title: "Беговые лыжи Fischer XC Touring",      desc: "195 см, NNN, ботинки 42-43.",                                    price: 350,  deposit: 4000 },
    { title: "Эхолот Garmin Striker 4",              desc: "GPS, морозостойкий, аккумулятор + крепление на лодку.",         price: 400,  deposit: 5000 },
    { title: "Скалодромное снаряжение",              desc: "Веревка 70 м, обвязка, 12 оттяжек, страховка GriGri.",          price: 700,  deposit: 8000 },
    { title: "Раскладные кресла туристические (2 шт)", desc: "Алюминий, в чехле. До 120 кг каждое.",                         price: 200,  deposit: 1500 },
    { title: "Газовый обогреватель уличный",         desc: "Для веранды/беседки, 4 кВт, баллон 5 л.",                        price: 600,  deposit: 4000 },
  ],
  garden: [
    { title: "Мотоблок Patriot Garden Калуга",       desc: "Бензин, 7 л.с., фрезы 80 см, обучение в комплекте.",            price: 1200, deposit: 8000 },
    { title: "Газонокосилка Husqvarna LC 140",       desc: "Бензин, ширина 40 см, мешок 50 л.",                              price: 700,  deposit: 5000 },
    { title: "Триммер бензиновый STIHL FS 55",       desc: "Леска + диск, ремень-наплечник.",                                price: 500,  deposit: 4000 },
    { title: "Цепная пила Husqvarna 240",            desc: "Шина 40 см, 2-тактный, цепь + масло.",                          price: 600,  deposit: 5000 },
    { title: "Измельчитель веток Bosch AXT 25 TC",   desc: "Турбинная режущая система, диаметр до 45 мм.",                  price: 800,  deposit: 7000 },
    { title: "Воздуходувка STIHL BG 86",             desc: "Бензин, для уборки листвы.",                                     price: 400,  deposit: 4000 },
    { title: "Аэратор электрический AL-KO Combi",    desc: "1300 Вт, 32 см, барабан с пружинами + ножи.",                  price: 600,  deposit: 5000 },
    { title: "Высокорез STIHL HT 56 C",              desc: "Бензин, штанга 4 м, для обрезки веток.",                        price: 800,  deposit: 6000 },
    { title: "Опрыскиватель ранцевый аккумуляторный 16 л", desc: "Регулировка давления, 2 форсунки.",                       price: 250,  deposit: 2500 },
    { title: "Снегоуборщик Patriot PRO 658 E",       desc: "Бензин 6,5 л.с., ширина захвата 60 см, электростартер.",        price: 1500, deposit: 12000 },
    { title: "Тачка строительно-садовая 100 л",      desc: "Усиленная рама, пневмоколесо.",                                  price: 150,  deposit: 1500 },
    { title: "Дровокол гидравлический 6 т",          desc: "Электрический, для поленьев до 52 см.",                          price: 1000, deposit: 8000 },
    { title: "Парник плёночный 3×6 м",               desc: "Каркас + плёнка + дуги. Самовывоз.",                            price: 400,  deposit: 2500 },
    { title: "Скарификатор-аэратор Bosch AVR 1100",  desc: "1100 Вт, 32 см, 2 валика в комплекте.",                          price: 500,  deposit: 4500 },
    { title: "Бочка для воды 200 л на колёсах",      desc: "Полипропилен, кран + ручка.",                                    price: 200,  deposit: 1500 },
  ],
  holidays: [
    { title: "Фотобудка с печатью",                  desc: "Автомат, печать за 10 сек, 200 фото в подарок.",                price: 5000, deposit: 30000 },
    { title: "Шатёр свадебный 6×12 м",               desc: "Каркас + ткань, монтаж и доставка отдельно.",                   price: 8000, deposit: 50000 },
    { title: "Звуковая система JBL EON 715 (пара)",  desc: "Микрофон, стойка, кабели. Для мероприятий до 200 чел.",         price: 3500, deposit: 35000 },
    { title: "Светомузыка LED-проектор Laser",       desc: "Лазер + LED-эффекты, ДУ. Для дискотек.",                        price: 1200, deposit: 8000 },
    { title: "Дым-машина Antari Z-1500 II",          desc: "1500 Вт, ДУ, 2 л жидкости в подарок.",                          price: 1500, deposit: 10000 },
    { title: "Караоке-система с микрофонами",        desc: "Беспроводные микрофоны (2 шт), 30 000+ песен.",                 price: 1500, deposit: 10000 },
    { title: "Свадебная арка деревянная",            desc: "Декорированная, разборная, инструкция по сборке.",              price: 2000, deposit: 8000 },
    { title: "Холодные фонтаны 4 шт (искры)",        desc: "Без дыма, 30 секунд горения, для сцены и фотосессии.",          price: 800,  deposit: 2000 },
    { title: "Костюм Деда Мороза премиум",           desc: "Парча, посох, борода, шапка, мешок. Размер 50-54.",             price: 1500, deposit: 6000 },
    { title: "Машина мыльных пузырей",               desc: "Беспроводная, 2 л раствора в подарок.",                          price: 700,  deposit: 4000 },
    { title: "Прокат проектора Epson + экран 100\"", desc: "3500 люмен, для домашних кинопросмотров.",                       price: 1200, deposit: 12000 },
    { title: "Аренда кофемашины Jura E8",            desc: "Зерно, чистка, обучение бариста на 30 мин.",                    price: 1500, deposit: 30000 },
    { title: "Танцпол LED 2×2 м",                    desc: "16 модулей 50×50, контроллер, 16 цветов.",                       price: 4000, deposit: 25000 },
    { title: "Игровой стол аэрохоккей",              desc: "180 см, шайбы, биты. Доставка отдельно.",                        price: 2000, deposit: 15000 },
    { title: "Стулья Кьявари (комплект 50 шт)",      desc: "Белые, банкетные, с подушками.",                                price: 2500, deposit: 20000 },
  ],
  children: [
    { title: "Детская коляска Bugaboo Fox 3",        desc: "2 в 1: люлька + прогулка. От 0 до 22 кг.",                      price: 350,  deposit: 30000 },
    { title: "Автокресло Britax Römer Advansafix",   desc: "Группа 1/2/3 (9-36 кг), Isofix, наклон.",                       price: 250,  deposit: 12000 },
    { title: "Детский велосипед 16\" с колёсами",    desc: "Возраст 4-7 лет, регулировка сиденья и руля.",                  price: 200,  deposit: 2500 },
    { title: "Беговел Strider 12 Pro",               desc: "Алюминий, 3 кг, для детей 18 мес – 5 лет.",                     price: 200,  deposit: 3500 },
    { title: "Манеж-кровать Chicco Lullaby",         desc: "С пеленальным столиком и музыкальным мобилем.",                 price: 300,  deposit: 5000 },
    { title: "Детский электромобиль Mercedes G63",   desc: "12 В, ДУ родителя, мягкие колёса, кожа.",                       price: 800,  deposit: 15000 },
    { title: "Развивающий коврик Tiny Love",         desc: "С дугами, погремушками и зеркалом.",                            price: 200,  deposit: 2000 },
    { title: "Сумка-кенгуру Manduca",                desc: "Слинг + рюкзак, для малыша от 3,5 до 20 кг.",                   price: 150,  deposit: 3000 },
    { title: "Качели для дома Graco DuetSoothe",     desc: "Электронные, 2 в 1, музыка, таймер.",                            price: 350,  deposit: 5000 },
    { title: "Детский батут с сеткой 140 см",        desc: "Защитная сетка, ручка. Для дома или дачи.",                     price: 400,  deposit: 4000 },
    { title: "Прыгунки в дверной проём",             desc: "Регулировка по росту, 6-12 мес.",                                price: 100,  deposit: 1500 },
    { title: "Радионяня Philips Avent SCD 833",      desc: "Двусторонняя связь, ночник, колыбельные.",                      price: 200,  deposit: 4000 },
    { title: "Стерилизатор бутылочек Philips Avent", desc: "Электрический паровой, 6 бутылочек.",                            price: 150,  deposit: 2500 },
    { title: "Детский велобагажник на машину",       desc: "Thule RideAlong, для детей 9 мес – 6 лет.",                      price: 200,  deposit: 4000 },
    { title: "Детский снегокат Барс",                desc: "Алюминий, мягкое сиденье, до 50 кг.",                           price: 150,  deposit: 2000 },
  ],
  electronics: [
    { title: "MacBook Pro 16\" M3 Pro",              desc: "36 ГБ RAM, 1 ТБ SSD. Для разработки, дизайна, монтажа.",        price: 3000, deposit: 120000 },
    { title: "iPad Pro 12.9\" M2 + Apple Pencil",    desc: "256 ГБ, Wi-Fi+Cellular, чехол-клавиатура.",                     price: 1200, deposit: 80000 },
    { title: "DJI Mini 3 Pro Fly More Combo",        desc: "4K/60fps, 3 АКБ, кейс. Не требует регистрации.",                price: 2500, deposit: 50000 },
    { title: "Проектор Epson EH-TW7100 + экран 120\"", desc: "4K-ready, 3000 люмен, HDMI 2.0.",                              price: 1500, deposit: 30000 },
    { title: "PlayStation 5 + 2 геймпада + 5 игр",   desc: "1 ТБ, 4K HDR, FIFA 24, GTA V, Mortal Kombat и др.",            price: 1000, deposit: 40000 },
    { title: "Xbox Series X + Game Pass на месяц",   desc: "1 ТБ, доступ к 100+ играм.",                                    price: 900,  deposit: 35000 },
    { title: "Наушники Bose QC Ultra",               desc: "Шумоподавление, 24 ч работы, кейс.",                             price: 400,  deposit: 30000 },
    { title: "Колонка JBL Boombox 3",                desc: "Bluetooth, IP67, 24 ч автономии. Для вечеринок.",               price: 700,  deposit: 25000 },
    { title: "Зарядная станция EcoFlow Delta 2",     desc: "1024 Вт·ч, 1800 Вт. Для дачи и кемпинга.",                      price: 1500, deposit: 60000 },
    { title: "VR-шлем Meta Quest 3 128 ГБ",          desc: "Mixed Reality, 5 игр на аккаунте.",                              price: 1500, deposit: 40000 },
    { title: "Smart-телевизор LG OLED 65\" C3",      desc: "4K, HDR, webOS. Для аренды дач и презентаций.",                price: 2000, deposit: 80000 },
    { title: "Робот-пылесос Roborock S8 Pro Ultra",  desc: "Сухая+влажная уборка, база самоочистки.",                       price: 600,  deposit: 30000 },
    { title: "Электросамокат Xiaomi Pro 2",          desc: "До 25 км/ч, 45 км запас хода. Шлем в подарок.",                 price: 700,  deposit: 25000 },
    { title: "Apple Watch Ultra 2 49 мм",            desc: "GPS+Cellular, титан, ремешок Trail.",                            price: 800,  deposit: 60000 },
    { title: "GoPro Hero 12 + крепления",            desc: "5K, 2 АКБ, держатели для шлема и руля.",                         price: 800,  deposit: 30000 },
  ],
  auto: [
    { title: "Автобокс Thule Motion XT 600",         desc: "420 л, крепится на рейлинги, замки.",                            price: 800,  deposit: 12000 },
    { title: "Велобагажник Thule на фаркоп (3 вело)", desc: "Складной, поворотный, с подсветкой.",                            price: 700,  deposit: 15000 },
    { title: "Прицеп легковой МЗСА 817711",          desc: "Грузоподъёмность 750 кг, ВУ категории B.",                       price: 1500, deposit: 20000 },
    { title: "Цепи противоскольжения R16-R18",       desc: "Комплект на 2 колеса, перчатки + сумка.",                       price: 300,  deposit: 3000 },
    { title: "Компрессор автомобильный Berkut R20",  desc: "60 л/мин, до 12 атм, питание от прикуривателя.",                price: 200,  deposit: 3000 },
    { title: "Пуско-зарядное устройство NOCO GB70",  desc: "2000 А, для двигателей до 8 л.",                                price: 400,  deposit: 8000 },
    { title: "Эвакуационный трос 5 т",               desc: "Кевлар, шаклы 4,75 т, перчатки.",                                price: 200,  deposit: 2000 },
    { title: "Автомобильный пылесос Karcher VC 5",   desc: "Беспроводной, 30 мин работы, насадки.",                         price: 200,  deposit: 4000 },
    { title: "Видеорегистратор + камера заднего вида", desc: "70mai 4K, GPS, ночной режим.",                                  price: 200,  deposit: 8000 },
    { title: "Палатка на крышу авто Roof Tent 3 чел.", desc: "Раскладывается за 60 сек, лестница.",                          price: 1500, deposit: 25000 },
    { title: "Мотоэкипировка комплект (шлем+куртка)", desc: "Размер L, защита спины и локтей.",                              price: 500,  deposit: 8000 },
    { title: "Автохолодильник Dometic CFX3 35",      desc: "32 л, компрессорный, 12/24/220 В.",                              price: 600,  deposit: 12000 },
    { title: "Багажник на крышу Thule WingBar",      desc: "Аэродинамический, для большинства машин.",                       price: 400,  deposit: 8000 },
    { title: "Сканер диагностики OBD2 Launch X431",  desc: "Полный сканер, обновлённое ПО, мультимарка.",                   price: 800,  deposit: 15000 },
    { title: "Защитный чехол для авто внешний",      desc: "Универсальный размер L, водостойкий.",                          price: 100,  deposit: 1500 },
  ],
  clothing: [
    { title: "Свадебное платье Pronovias 42-44",     desc: "Атлас, шлейф, фата в подарок. Химчистка проведена.",            price: 5000, deposit: 30000 },
    { title: "Смокинг мужской Hugo Boss 50",         desc: "Чёрный, бабочка и пояс в комплекте.",                            price: 2000, deposit: 15000 },
    { title: "Вечернее платье в пол 44-46",          desc: "Тёмно-синее, с открытой спиной, размер S/M.",                    price: 1500, deposit: 8000 },
    { title: "Костюм Санта-Клауса класс люкс",       desc: "Парча, борода, мешок. Универсальный размер.",                   price: 1500, deposit: 6000 },
    { title: "Костюм Снегурочки",                    desc: "Размер 44, кокошник, шуба, сапоги.",                            price: 1500, deposit: 5000 },
    { title: "Карнавальный костюм пирата (взрослый)", desc: "Шляпа, повязка, сабля-бутафория.",                              price: 700,  deposit: 2500 },
    { title: "Военная форма ВОВ парадная",           desc: "Для реконструкции и Дня Победы. Размеры 48-54.",                price: 1500, deposit: 5000 },
    { title: "Маскарадные маски (набор 10 шт)",      desc: "Венецианский стиль, для тематической вечеринки.",                price: 500,  deposit: 1500 },
    { title: "Зимний пуховик женский Canada Goose",  desc: "Размер S, чёрный, мех койота.",                                  price: 1500, deposit: 30000 },
    { title: "Платье для выпускного 44",             desc: "Розовое, корсет, пышная юбка.",                                  price: 1200, deposit: 6000 },
    { title: "Костюм аниматора единорог (2 размера)", desc: "Полноразмерный, с головой, рост 160-185.",                      price: 1500, deposit: 5000 },
    { title: "Греческий костюм для фотосессии",      desc: "Длинная туника + венок + сандалии.",                            price: 800,  deposit: 2500 },
    { title: "Кимоно для айкидо/дзюдо взрослое",     desc: "Хлопок 100%, размеры 4-5.",                                      price: 200,  deposit: 1500 },
    { title: "Костюм для бальных танцев",            desc: "Мужской классический, размер 48.",                              price: 1500, deposit: 6000 },
    { title: "Корсаж + юбка для танца живота",       desc: "С монистами, размеры S/M/L.",                                    price: 600,  deposit: 2500 },
  ],
  photo: [
    { title: "Sony A7 IV + 24-70 f/2.8 GM",          desc: "33 МП, 2 АКБ, сумка, карта 128 ГБ.",                            price: 3500, deposit: 100000 },
    { title: "Canon EOS R6 Mark II + 24-105 f/4",    desc: "24 МП, 2 АКБ, бленда, карта 64 ГБ.",                             price: 3000, deposit: 90000 },
    { title: "Nikon Z6 II + 24-70 f/4 S",            desc: "24 МП, 2 АКБ, сумка Lowepro.",                                   price: 2500, deposit: 80000 },
    { title: "Объектив Sigma 35mm f/1.4 Art (Sony E)", desc: "Светосильный портретник, в коробке.",                          price: 800,  deposit: 30000 },
    { title: "Стабилизатор DJI RS 3 Pro",            desc: "До 4,5 кг, Bluetooth-кнопка спуска.",                            price: 1000, deposit: 25000 },
    { title: "Студийный свет 3×Godox SK400II",       desc: "Стойки, зонты, октабоксы 80 см, синхронизатор X2.",             price: 2000, deposit: 25000 },
    { title: "Фон бумажный белый 2,7×11 м + стойки", desc: "Профессиональный, для портретной съёмки.",                      price: 1000, deposit: 8000 },
    { title: "Микрофон Rode Wireless Pro",           desc: "2 петлички, 32-битная запись, кейс.",                            price: 800,  deposit: 30000 },
    { title: "Дрон DJI Mavic 3 Pro Cine",            desc: "Hasselblad, ProRes, 3 АКБ. Требуется лицензия.",                price: 5000, deposit: 200000 },
    { title: "Камера Insta360 X4 8K",                desc: "360°, кейс, селфи-палка, карта 256 ГБ.",                         price: 700,  deposit: 25000 },
    { title: "ND-фильтры комплект (Sony 67-82 мм)",  desc: "Magnetic, ND8/64/1000.",                                         price: 300,  deposit: 5000 },
    { title: "Софтбокс октабокс 150 см",             desc: "Bowens-байонет, диффузор, сетка.",                              price: 500,  deposit: 5000 },
    { title: "Ручной трекер DJI Focus Pro",          desc: "Для плавного автофокуса с DSLR/беззеркалок.",                  price: 800,  deposit: 20000 },
    { title: "Слайдер моторизованный 80 см",         desc: "WiFi-управление, для time-lapse.",                              price: 700,  deposit: 12000 },
    { title: "Внешний монитор Atomos Ninja V",       desc: "5\", запись ProRes, кейс.",                                      price: 1500, deposit: 35000 },
  ],
  books: [
    { title: "Учебники ОГЭ 2026 по 5 предметам",     desc: "Русский, математика, обществознание, физика, информатика.",     price: 100,  deposit: 500 },
    { title: "Учебники ЕГЭ 2026 (полный комплект)",  desc: "Русский, математика, физика, информатика, англ.",                price: 150,  deposit: 800 },
    { title: "Атлас и контурные карты 8-11 кл.",     desc: "Дрофа, актуальная редакция.",                                    price: 50,   deposit: 300 },
    { title: "Глобус физический 320 мм с подсветкой", desc: "Для уроков географии.",                                          price: 100,  deposit: 1500 },
    { title: "Микроскоп школьный Levenhuk LabZZ M3", desc: "До 400×, набор образцов.",                                       price: 200,  deposit: 4000 },
    { title: "Графический планшет XP-Pen Deco 01 V2", desc: "Для онлайн-уроков рисования.",                                   price: 200,  deposit: 4000 },
    { title: "Электронная книга PocketBook 740",     desc: "7,8\", 8 ГБ, подсветка SMARTlight.",                              price: 200,  deposit: 8000 },
    { title: "Курс подготовки к IELTS (книги+CD)",   desc: "Cambridge, 4 учебника + аудио.",                                 price: 150,  deposit: 1500 },
    { title: "Кубик Рубика обучающий + книга",       desc: "Speedcube + 4-х книжный курс по сборке.",                       price: 50,   deposit: 500 },
    { title: "Шахматные часы Garde DGT (электронные)", desc: "Для турниров, разные режимы.",                                  price: 150,  deposit: 2500 },
    { title: "Робот-конструктор LEGO Mindstorms EV3", desc: "Полный набор + методичка.",                                     price: 500,  deposit: 25000 },
    { title: "Скелет человека анатомический 85 см",  desc: "Для медиков и студентов биологии.",                              price: 300,  deposit: 5000 },
    { title: "Полный сборник BBC Planet Earth (DVD)", desc: "11 серий + бонусы. Для домашних просмотров.",                  price: 100,  deposit: 1000 },
    { title: "Книги Гарри Поттер (комплект 7 шт)",   desc: "На русском, новые издания.",                                     price: 200,  deposit: 2500 },
    { title: "Курс Solidworks 2024 (флешка + методичка)", desc: "30 уроков, для CAD-инженеров.",                              price: 300,  deposit: 1500 },
  ],
};

// 5 уникальных photo-URL на каждое объявление через picsum.photos с детерминированным seed.
function makePhotos(slug: string, idx: number): string[] {
  return Array.from({ length: 3 }, (_, j) =>
    `https://picsum.photos/seed/${slug}-${idx}-${j}/800/600`
  );
}

const TEST_TAG = "[seed-test]";

/** Идемпотентно: если в категории уже есть N объявлений с тегом TEST_TAG в описании,
 *  ничего не делает. Иначе доливает до 15. */
export async function seedTestListings(opts: { perCategory?: number } = {}): Promise<{ inserted: number; skipped: string[]; perCategory: Record<string, number> }> {
  const target = opts.perCategory ?? 15;

  const cats = await db.select().from(categoriesTable);
  const regs = await db.select().from(regionsTable);
  if (regs.length === 0) throw new Error("Сначала запустите /api/admin/seed (нет регионов)");

  // Берём существующих owner-ов (если их 0 — берём первого пользователя)
  let owners = await db.select().from(usersTable).where(eq(usersTable.role, "owner"));
  if (owners.length === 0) {
    owners = await db.select().from(usersTable).limit(3);
  }
  if (owners.length === 0) throw new Error("Нет ни одного пользователя в БД");

  const inserted: number = await db.transaction(async (tx) => {
    let total = 0;
    for (const cat of cats) {
      const tpl = ITEMS[cat.slug];
      if (!tpl) continue;

      const [{ cnt }] = await tx.execute(sql`
        SELECT count(*)::int as cnt FROM listings
        WHERE category_id = ${cat.id} AND description LIKE ${"%" + TEST_TAG + "%"}
      `).then(r => r.rows as { cnt: number }[]);

      const need = Math.max(0, target - cnt);
      if (need === 0) continue;

      const slice = tpl.slice(0, need);
      const rows = slice.map((it, i) => {
        const owner = owners[(cat.id + i) % owners.length];
        const region = regs[(cat.id * 7 + i * 11) % regs.length];
        return {
          title: it.title,
          description: `${it.desc} ${TEST_TAG}`,
          pricePerDay: String(it.price),
          deposit: String(it.deposit),
          categoryId: cat.id,
          regionId: region.id,
          city: region.name.replace(/^Республика |^Край |^Область /, ""),
          ownerId: owner.id,
          isAvailable: true,
          ownerProtectionEnabled: true,
          photos: makePhotos(cat.slug, i),
        };
      });
      await tx.insert(listingsTable).values(rows as any);
      total += rows.length;
    }
    return total;
  });

  // Итоговая сводка по категориям
  const summary = await db
    .select({ slug: categoriesTable.slug, cnt: sql<number>`count(${listingsTable.id})::int` })
    .from(categoriesTable)
    .leftJoin(listingsTable, eq(listingsTable.categoryId, categoriesTable.id))
    .groupBy(categoriesTable.slug);
  const perCategory: Record<string, number> = {};
  summary.forEach(r => { perCategory[r.slug] = Number(r.cnt) || 0; });

  return { inserted, skipped: [], perCategory };
}
