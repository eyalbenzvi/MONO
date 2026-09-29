# Make: תוכנית הרעיונות

Sep 29, 2026

## מה נמחק

**לבקשתך:** פרשת בר/בת מצווה, המרוצים, המשפחה כקולג', כריכת ספר.

**במהלך הניתוח:**

| רעיון | למה |
| --- | --- |
| חמסה עם שמות | הרעיון נשען על שמות בעברית, וההדפס קובע רק אותיות לטיניות (`WORDS` ב-`lib/custom/specKit.ts`). בלי זה נשארת חמסה דקורטיבית עם שמות באנגלית: קישוט, לא גרפיקה |
| פרח חודש הלידה | יש 12 תוצאות אפשריות: כל מי שנולד במאי מקבל אותו פרח, והחלק האישי היחיד הוא השם. זה לא מוצר |
| מפת נתחים | כולם מקבלים אותה פרה, וסימון שלושה נתחים הוא לא פרסונליזציה. הבדיחה נגמרת אחרי פעם אחת |
| "מאז" (כמוצר נפרד) | אוחד עם שלט ההכוונה, כמצב "שנינו": שני שלטים, שתי ערים והמרחק ביניהן |

נשארו **21 מוצרים**.

## מה המגבלות של הקוד קובעות (לכל המוצרים)

1. **גופן אחד.** כל טקסט מודפס הוא DejaVu Sans Mono (`lib/custom/kit.ts`, `canvasSvg.ts`). עיתון, כרטיס ביקור, תווית מוזיאון וכותרות סיום לא ייראו אמינים במונו בלבד. **צריך להוסיף שלושה גופני הדפס** ברישיון OFL: סריף טקסט (למשל Libre Caslon Text או EB Garamond), סנס דחוס (Oswald) ובלאקלטר לראש העיתון (UnifrakturMaguntia). כל גופן כ-subset של WOFF2, רשום ב-`canvasSvg` וזמין גם ל-resvg בבדיקת האיכות.
2. **אותיות לטיניות בלבד.** הלקסיקון והמפרט מתירים רק לטינית. עברית (כולל RTL) היא פרויקט תשתית נפרד. כל המוצרים כאן יוצאים באנגלית, והאתר כולו באנגלית.
3. **תת-קבוצה של SVG.** אין `clipPath`, `pattern`, `mask`, `textPath`, `ellipse`, `polygon` ו-`opacity`. מילוי בקווקוו נבנה מקווים. טקסט על עיגול נבנה אות אחרי אות, כמו `arcText` ב-`templates/family.ts`, שצריך להוציא ל-`kit.ts`.
4. **שער האיכות.** אסור גוש דיו מלא, והאיכות צריכה להיות 53 לפחות. תבנית טיפוגרפית דלה (שלוש שורות) עלולה להיכשל על "faint", ולכן לכל תבנית טקסט צריך מסגרת או מבנה שנותן לה גוף.
5. **המפרט עובר בכתובת** (`?make=`), ולכן גבולות קשיחים למספר השורות והתווים.
6. **מידות ילדים קיימות** (`KID_SIZES`), כך שמוצר לילדים ישים.

## קטגוריות

היום יש חמש קבוצות: From a date, From a name, From a place, From your people, From you. מוצעות שתיים חדשות:

| קבוצה | מוצרים |
| --- | --- |
| **From your travels** (חדשה) | Landmarks, Passport, World Tour, Countries, Signpost, Flights |
| **In a form you know** (חדשה) | Sign, Museum Label, Business Card, Front Page, Telegram |
| From your people (קיימת) | Limited Editions, Things They Say, First Message, Credits, Receipt, Line-up, Mission Patch, Birth Announcement |
| From a name (קיימת) | Sampler, Dinosaur |

**For two** (`/make/two/`) מקבל שלושה כרטיסים חדשים: First Message, Receipt, ו-Signpost במצב "שנינו".

---

## המוצרים

### 1. Your Sign: שלט רחוב, שלט הנצחה, שלט אזהרה

- **איך ייראה:** שלושה סגנונות. **שלט רחוב:** מלבן בעל פינות מעוגלות עם מסגרת כפולה, שם הרחוב באותיות דחוסות גדולות ושורה קטנה מתחת ("Est. 1990"). **שלט הנצחה:** עיגול, טקסט לאורך הקשת העליונה, שלוש שורות במרכז וקו מפריד. **שלט אזהרה:** משולש או מלבן ISO, פיקטוגרמה ו-"CAUTION" עם שורה.
- **מה להכין:** 12 פיקטוגרמות לשלט האזהרה, מצוירות בקוד (ספל, מיטה, טלפון, מגהץ, ברביקיו, כדור, ספר, גלגל, אוזניות, תינוק, כלב, מקלדת). את שני השלטים האחרים אפשר לבנות בקוד בלבד.
- **מה אישי:** השם, השורה, השנים והפיקטוגרמה.
- **מה נדרש:** גופן דחוס, `arcText` ב-kit, ותבנית עם שלושה מצבים.
- **מה יהפוך ללהיט:** הוא מזוהה מייד ברחוב. שלט ההנצחה היבש ("On this site in 1990 nothing happened") הוא בדיוק הקול של MONO. יש לו גם פוטנציאל מתנה גדול, לימי הולדת עגולים ולבית חדש.
- **קבוצה:** In a form you know.

### 2. Your Sampler: סמפלר רקמה

- **איך ייראה:** סמפלר ויקטוריאני: שורות אלפבית בתפר צלב, השם והשנה במרכז, מסגרת של דוגמה חוזרת ומוטיב קטן בפינות. כל פיקסל הוא איקס מתפר אלכסוני, בדיו אחת.
- **מה להכין:** שישה מסגרות ושמונה מוטיבים (עץ, בית, לב גאומטרי, כוכב, ציפור, פרח, כתר, ספינה) כגריד פיקסלים בקוד. אין צורך באיורים.
- **מה אישי:** השם, השנה, שורה ("Home is where…" דרך הלקסיקון), המוטיבים והמסגרת.
- **מה נדרש:** הגופן `pixelFont` כבר קיים (Your ASCII), ומוסיפים לו מרנדר תפר צלב. צריך גם לבדוק שהצפיפות לא נופלת ב-"dense".
- **מה יהפוך ללהיט:** נראה עבודת יד, ובפועל זה שם אחד. טרנד ה-grandmacore. מתנה ללידה ולחתונה ("Noa & David · 2026").
- **קבוצה:** From a name.

### 3. Limited Editions: הנכדים כמהדורות מוגבלות

- **איך ייראה:** תווית אספנות: "LIMITED EDITIONS" למעלה, ומתחת עד שמונה שורות "No. 1 · Maya · 2015". מסגרת גיליוש (Your Monogram ו-rosettes כבר יודעים לצייר גיליוש) וחותמת עגולה "Grandpa · est. 1952".
- **מה להכין:** כלום. טיפוגרפיה ומסגרת בקוד.
- **מה אישי:** השמות, השנים והתפקיד (Grandpa, Savta, Mom).
- **מה נדרש:** גופן סריף, ורשימת שם ושנה עם הוספה והסרה.
- **מה יהפוך ללהיט:** זו המתנה הקלה ביותר בעולם לסבא וסבתא, וקונים אותה פעם אחת ואז שוב עם כל נכד חדש. כדאי להציע אותה ביום סבים ובחגים.
- **קבוצה:** From your people.

### 4. Your Signpost: עמוד שלטים (כולל "מאז")

- **איך ייראה:** עמוד עץ בשרטוט קו, ועליו שלטים בצורת חץ. כל שלט הוא עיר ומרחק ("TOKYO 9,172 km"). **החצים פונים לכיוון האמיתי** מהבית (אזימוט), עם N קטן בבסיס. במצב "שנינו" יש שני שלטים לשתי הערים, והמרחק ביניהן ו-"since 2016".
- **מה להכין:** כלום. הצורות נבנות בקוד, והערים והקואורדינטות קיימות (`data/cities`).
- **מה אישי:** הבית, הערים, השנה, וכיוון החצים שנגזר מהגאוגרפיה של המשתמש עצמו.
- **מה נדרש:** עורך "מקומות" משותף (ראו תשתית), חישובי haversine ואזימוט, וסידור השלטים שלא יתנגשו.
- **מה יהפוך ללהיט:** כל אחד מכיר את השלט הזה מתחנת סקי או מגן לאומי, וכאן הוא נכון גאוגרפית. חזק למשפחות שמפוזרות בעולם ולזוגות.
- **קבוצה:** From your travels. גם ב-For two.

### 5. Your First Message: ההודעה הראשונה

- **איך ייראה:** עמודת בועות צ'אט כלליות, מלבנים מעוגלים משני צדדים. תאריך באמצע ("12 Aug 2016"), שעה קטנה ליד כל בועה ו-"Read 23:14" בסוף. בלי ממשק או צבעים של אפליקציה מסוימת.
- **מה להכין:** כלום.
- **מה אישי:** עד שש הודעות שהמשתמש מקליד, השעות, התאריך והשמות.
- **מה נדרש:** שבירת שורות בתוך בועה, פריסה אנכית שמתאימה את עצמה לאורך, והלקסיקון על כל הודעה.
- **מה יהפוך ללהיט:** הסיפור הכי אינטימי בזוגיות, בפורמט שכולם מבינים. מתנת יום נישואים, ומתאים ל-For two.
- **קבוצה:** From your people. גם ב-For two.

### 6. Your World Tour: סיבוב הופעות

- **איך ייראה:** חולצת טור של להקה: השם כשם הסיבוב ("NOA · WORLD TOUR · 1990–2026") באותיות דחוסות גדולות, ומתחתיו רשימת ערים ושנים בשני טורים, כמו גב של חולצת קונצרט. ההדפס קדמי.
- **מה להכין:** כלום.
- **מה אישי:** השם, הערים, השנים והכותרת (World Tour, Family Tour, Farewell Tour).
- **מה נדרש:** גופן דחוס, עורך המקומות המשותף, ופריסה שמתאימה את עצמה ל-4 עד 24 שורות.
- **מה יהפוך ללהיט:** קריצה שכל אחד מבין, בפורמט שכבר נמכר המון. חולצה לטיול שנתי ולמסיבת רווקים.
- **קבוצה:** From your travels.

### 7. Your Museum Label: תווית מוזיאון

- **איך ייראה:** תווית קיר של מוזיאון: שם בבולד, "(b. 1990, Tel Aviv)", שורת "חומרים" ("Coffee, stubbornness and love on canvas"), "On loan from her mother" ומספר קטלוגי. בסריף ובשוליים רחבים, עם מסגרת דקה כדי לעבור את שער האיכות.
- **מה להכין:** כלום.
- **מה אישי:** השם, השנה, העיר והשורות. אפשר להציע שורות מוכנות לבחירה.
- **מה נדרש:** גופן סריף, ומאגר של כ-40 שורות מוצעות שאנחנו כותבים.
- **מה יהפוך ללהיט:** זה בדיוק הקול של המותג ("תווית מוזיאון עם חוש הומור"). יבש, חכם, ומקבלים עליו מחמאה.
- **קבוצה:** In a form you know.

### 8. Your Passport: חותמות דרכון

- **איך ייראה:** עמוד דרכון עם רשת עדינה של קווי ביטחון (גיליוש, לא גוש), ועליו חותמות כניסה מפוזרות: עיגול, מלבן, אוקטגון ומשושה, עם קוד המדינה, שם המדינה, התאריך ומטוס קטן. כל חותמה מסובבת מעט. הפיזור דטרמיניסטי ונזרע מהרשימה.
- **מה להכין:** 10 צורות חותמת פרוצדורליות, ואייקון מטוס ואייקון רכבת בקוד. זה עבודת קוד, לא איור.
- **מה אישי:** המדינות, השנים, הסדר, והשם בראש העמוד.
- **מה נדרש:** רשימת מדינות עם קודי ISO (Natural Earth, public domain), אלגוריתם פיזור בלי חפיפה, ועורך מדינה ושנה.
- **מה יהפוך ללהיט:** זה גאווה של מטיילים שכולם רוצים להראות. ככל שהרשימה ארוכה יותר, העמוד עשיר יותר, ולכן זה מוצר שמוזמן שוב.
- **קבוצה:** From your travels.

### 9. Things They Say: מה שסבתא תמיד אומרת

- **איך ייראה:** כותרת "THINGS SAVTA SAYS" ורשימה של שלוש עד שבע אמרות במירכאות גדולות, עם חתימה בסוף ("— Savta Rina, since 1948"). מצב שני: "First words", כלומר מילה אחת גדולה בבועה עם השם והתאריך.
- **מה להכין:** כלום.
- **מה אישי:** האמרות עצמן, בדיוק כפי שהמשפחה מכירה אותן.
- **מה נדרש:** גופן סריף, והלקסיקון על כל אמרה. אמרות של אדם פרטי בלבד.
- **מה יהפוך ללהיט:** זה הדבר הכי אישי ברשימה, כי אף אחד אחר לא יכול לכתוב אותו. מתנה משפחתית שעוברת מיד ליד בכל ארוחת שישי.
- **קבוצה:** From your people.

### 10. Your Birth Announcement: הודעת לידה וינטג'

- **איך ייראה:** כרטיס שנות ה-50: "IT'S A GIRL" (או "HELLO WORLD"), השם הגדול, ומתחת טבלה: תאריך, שעה, משקל, אורך, עיר. מסגרת קישוט עדינה, ואופציה לירח של אותו לילה (moonShape כבר קיים).
- **מה להכין:** כלום.
- **מה אישי:** כל השדות.
- **מה נדרש:** גופן סריף, וולידציה של משקל ואורך ביחידות מטריות או אימפריאליות.
- **מה יהפוך ללהיט:** זוג חולצות להורים, מידת ילדים לאח הגדול, ומתנה לביקור בבית החולים. ה-Moon הקיים מוסיף רגע נכון.
- **קבוצה:** From your people.

### 11. Your Line-up: הרכב הקבוצה

- **איך ייראה:** מגרש כדורגל בשרטוט קו מלמעלה (או כדורסל, או 5 נגד 5), עיגולים במיקומים לפי המערך ושם מתחת לכל עיגול. שם הקבוצה ועונה בראש.
- **מה להכין:** כלום. מגרשים ומערכים הם גאומטריה.
- **מה אישי:** השמות, מספרי החולצה, שם הקבוצה והעונה.
- **מה נדרש:** טבלת מערכים (4-4-2, 4-3-3, 3-5-2, 5 נגד 5, כדורסל), ועורך "שם לכל עמדה".
- **מה יהפוך ללהיט:** הזמנה קבוצתית: 11 חולצות בבת אחת. ליגות חובבים, עבודה, ובוגרים. מומלץ כפתור "Order for the team" שמוסיף כמות.
- **קבוצה:** From your people.

### 12. Your Telegram: טלגרם

- **איך ייראה:** טופס מברק וינטג': כותרת "TELEGRAM", שדות TO ו-FROM ותאריך, רצועות נייר מודבקות עם הטקסט באותיות גדולות ו-STOP בין המשפטים. המונו הקיים מתאים כאן בדיוק.
- **מה להכין:** כלום.
- **מה אישי:** ההודעה, הנמען, השולח והתאריך.
- **מה נדרש:** המרת נקודות ל-"STOP", אותיות גדולות, ופיצול לרצועות.
- **מה יהפוך ללהיט:** הכי זול לפתח (גופן קיים), ומתאים לכל אירוע: "ARRIVED SAFELY STOP", "SHE SAID YES STOP".
- **קבוצה:** In a form you know.

### 13. Your Countries: מפת המדינות

- **איך ייראה:** מפת עולם (הטלת Equal Earth), קווי חוף דקים, והמדינות שבחרת מלאות בקווקוו אלכסוני. מדינות זעירות מסומנות בנקודה. בתחתית "37 / 195 · NOA · since 1990".
- **מה להכין:** נתוני Natural Earth ברזולוציה 1:110m (public domain), מפושטים בזמן build ומפורסמים כמו `cities.json`.
- **מה אישי:** המדינות, המספר והשם.
- **מה נדרש:** סקריפט build למדינות, מילוי קווקוו בקווים (כי אסור `pattern`), ובדיקה שהכיסוי לא עובר את "dense" כשמסמנים הרבה.
- **מה יהפוך ללהיט:** זה ה-scratch map, מוצר שכבר נמכר בכמויות, והפעם על חולצה. ממשיכים לרכוש כשהמספר עולה.
- **קבוצה:** From your travels.

### 14. Your Landmarks: אתרים שביקרתי בהם (הרעיון שלך)

- **איך ייראה:** רשת של 3 עד 9 אתרים, כל אחד בשרטוט קו בסגנון תחריט, בתוך מסגרת קטנה עם השם והשנה, כמו דף ביומן מסע. מתחת: "NOA · 2009–2026".
- **מה להכין:** **ספריית איורים של 24 אתרים בגל הראשון** (Eiffel, Colosseum, Big Ben, Taj Mahal, Pyramids, Machu Picchu, Great Wall, Sydney Opera, Golden Gate, Statue of Liberty, Kotel, Petra, Acropolis, Sagrada Família, Tower Bridge, Leaning Tower, Christ the Redeemer, Fuji, Angkor Wat, Brandenburg Gate, Burj Khalifa, Empire State, Neuschwanstein, Santorini). אפשר להגיע ל-60 בהמשך. חלק מהם אפשר לקחת מתחריטים בארכיון (Architecture, Engravings), את השאר מאיירים וקטורית באותו סגנון. **הערה משפטית:** את תאורת הלילה של מגדל אייפל ואת Sydney Opera מציירים ביום, כמבנה.
- **מה אישי:** הבחירה, השנים והסדר.
- **מה נדרש:** צינור הכנה (איור, SVG בקו, מינימיזציה, בדיקת איכות), ועורך בחירה עם תמונות קטנות.
- **מה יהפוך ללהיט:** זה המוצר הכי "מרשים" ברשימה, והכי ברור למי שרואה אותו. הוא נשען על איכות האיור: עדיף 24 מושלמים מ-60 בינוניים.
- **קבוצה:** From your travels.

### 15. Your Receipt: הזוגיות כקבלה, חוזה או ביקורת

- **איך ייראה:** שלושה מצבים. **קבלה:** נייר צר עם שוליים משוננים, שורות "1x FIRST DATE ....... 0.00", סכום "TOTAL: PRICELESS" וברקוד (Code 128 מתאריך ההיכרות). **תנאי שימוש:** סעיפים ממוספרים בסגנון משפטי. **ביקורת:** חמישה כוכבים, "Would marry again", "Verified partner since 2016".
- **מה להכין:** כלום. את הברקוד מקודדים בקוד.
- **מה אישי:** הפריטים, התאריכים והשמות. יש שורות מוצעות לכל מצב.
- **מה נדרש:** המונו מתאים לקבלה, וסריף לחוזה. מאגר של כ-60 שורות מוצעות.
- **מה יהפוך ללהיט:** מצחיק, מדויק ומתאים לזוג חולצות. מתנת ולנטיין ויום נישואים.
- **קבוצה:** From your people. גם ב-For two.

### 16. Your Credits: כותרות סיום

- **איך ייראה:** מסך שחור של סוף סרט: "A COHEN FAMILY PRODUCTION", ובטור אחד "Directed by Mom · Produced by Dad · Starring Noa, Maya · Special effects: the dog", עם © ושנה בסוף.
- **מה להכין:** כלום.
- **מה אישי:** התפקידים והשמות.
- **מה נדרש:** גופן דחוס, ורשימת זוגות של תפקיד ושם, עד 12.
- **מה יהפוך ללהיט:** חולצות משפחתיות תואמות לטיול או לכנס משפחה. מצחיק בלי להתאמץ.
- **קבוצה:** From your people.

### 17. Your Dinosaur: הדינוזאור של הילד

- **איך ייראה:** לוח פלאונטולוגי: שלד בתחריט, שם מדעי מהשם של הילד ("NOASAURUS REX"), ובאותיות קטנות "Discovered 2019 · Height 112 cm · Diet: pasta". סרגל קנה מידה.
- **מה להכין:** **שמונה לוחות שלד** מ-O. C. Marsh, *The Dinosaurs of North America* (USGS, 1896, public domain): T. rex, Triceratops, Stegosaurus, Brontosaurus, Allosaurus, Diplodocus, Iguanodon, Pteranodon. צריך לחתוך, לנקות ולהפוך ל-one-ink, כמו בצינור הארכיון הקיים.
- **מה אישי:** השם שהופך לשם מדעי (כללי סיומת: ‑saurus, ‑raptor, ‑don), השנה, הגובה והשורה.
- **מה נדרש:** צינור הכנה לשמונה לוחות וכללי יצירת שמות. המוצר נמכר במידות ילדים.
- **מה יהפוך ללהיט:** כל ילד בגיל 4 עד 8 מוכר את זה להורים שלו. יש כאן גם נתונים אמיתיים מהארכיון, שזה בדיוק ה-DNA של MONO.
- **קבוצה:** From a name.

### 18. Your Business Card: כרטיס ביקור (הרעיון שלך)

- **איך ייראה:** כרטיס ביקור גדול במרכז החולצה, ביחס 85:55, עם מסגרת דקה. שם, תפקיד, חברה, ושורה של טלפון ואתר, או בלי פרטים. שלושה סגנונות: קלאסי (סריף, יישור למרכז), מודרני (סנס, יישור לשמאל) ו"American Psycho" (bone, מונו). אסור לוגו.
- **מה להכין:** כלום.
- **מה אישי:** כל השדות. אפשר גם שורת תפקיד מצחיקה ("Chief Snack Officer").
- **מה נדרש:** שני הגופנים החדשים. חשוב: **לא לאסוף טלפון אמיתי כברירת מחדל**, אלא לתת את זה כשדה אופציונלי עם אזהרה קצרה.
- **מה יהפוך ללהיט:** מתנת "תפקיד חדש" ו"פרישה", וסוואג צוות לסטארטאפים. זה מוצר שהזמנה אחת שלו מביאה עשר.
- **קבוצה:** In a form you know.

### 19. Your Flights: כרטיס טיסה או לוח המראות

- **איך ייראה:** שני מצבים. **כרטיס עלייה:** שם, FROM ו-TO בקודי IATA גדולים, תאריך, מושב ושער, עם ברקוד. **לוח המראות:** שורות של לוח מתהפך, כל אות בתא ("TOKYO NRT 2019 BOARDED").
- **מה להכין:** רשימת שדות תעופה מ-OurAirports (public domain), מסוננת לשדות גדולים, כ-1,000.
- **מה אישי:** הטיסות, השנים והשם.
- **מה נדרש:** סקריפט build לשדות תעופה, וחיפוש בעיר או בקוד.
- **מה יהפוך ללהיט:** כרטיס עלייה של הטיסה לירח דבש, או לוח המראות של כל הטיולים. מתנת יום נישואים וטיול.
- **קבוצה:** From your travels.

### 20. Your Front Page: עמוד ראשון בעיתון

- **איך ייראה:** ראש עיתון בדיוני בבלאקלטר ("The Daily Noa"), תאריך ומחיר, כותרת ענקית ("LOCAL WOMAN TURNS 40"), כותרת משנה ושלושה טורים של טקסט מילוי בקריצה. אפשר להוסיף מקום לתמונה מ-From yours בגל שני.
- **מה להכין:** כלום בגל הראשון. טקסט הטורים נוצר מתבנית.
- **מה אישי:** שם העיתון, הכותרת, כותרת המשנה והתאריך.
- **מה נדרש:** גופן בלאקלטר וגופן סריף, ומאגר של כ-30 פסקאות מילוי שאנחנו כותבים (לא lorem ipsum).
- **מה יהפוך ללהיט:** ימי הולדת עגולים, פרישה וסיום לימודים. כל אחד רוצה להיות כותרת.
- **קבוצה:** In a form you know.

### 21. Your Mission Patch: פאץ' משימה

- **איך ייראה:** טלאי עגול בסגנון משימות חלל: טבעת חיצונית עם שם המשימה ושמות הצוות לאורך הקשת, סמל במרכז (טיל, מסלול, הר, גל, אוהל, מטוס, בית, כוכב), ותאריך למטה. התפר של שולי הטלאי מצויר כקווקוו.
- **מה להכין:** 10 סמלים בקוד.
- **מה אישי:** שם המשימה ("COHEN · ICELAND · 2026"), השמות והסמל.
- **מה נדרש:** `arcText` ב-kit, וחלוקה של שמות סביב הקשת.
- **מה יהפוך ללהיט:** חולצות תואמות לטיול משפחתי או לצוות, ומזכרת ששייכת רק למי שהיה שם.
- **קבוצה:** From your people.

---

## תשתית שכל המוצרים צריכים (לפני כולם)

| # | מה | למה | הערכה |
| --- | --- | --- | --- |
| T1 | שלושה גופני הדפס OFL (סריף, דחוס, בלאקלטר), כ-subset של WOFF2, רשומים ב-`canvasSvg` וב-resvg של הבדיקות, ופרמטר גופן ב-`kit.text` | 12 מוצרים | 3 ימים |
| T2 | עורך "מקומות ושנים" משותף, שנשען על `CityField` | 6 מוצרים | 2 ימים |
| T3 | `arcText` מ-`family.ts` אל `kit.ts` | Sign, Patch | 0.5 יום |
| T4 | נתוני מדינות (Natural Earth) ושדות תעופה (OurAirports) בזמן build | Countries, Passport, Flights | 2 ימים |
| T5 | שתי קבוצות חדשות ב-`MAKE_GROUPS`, והרחבת For two | ניווט | 1 יום |
| T6 | עזר שבירת שורות והתאמה לרוחב, מבוסס מדידת הגופן | כל מוצרי הטקסט | 1 יום |

## סדר ביצוע וזמנים

| גל | מוצרים | ימים |
| --- | --- | --- |
| 0 | תשתית T1 עד T6 | 9.5 |
| 1: טקסט בלבד | Telegram, Limited Editions, Things They Say, Museum Label, Credits, Business Card, Receipt, First Message, Birth Announcement | 25 |
| 2: גאומטריה | Sign, Signpost, World Tour, Line-up, Mission Patch, Sampler | 24 |
| 3: נתונים | Countries, Flights, Passport, Front Page | 18 |
| 4: איורים | Dinosaur, Landmarks | 14, לא כולל איור |

סך הכול כ-90 ימי פיתוח.

## הפרומפט לפיתוח

הפרומפט כתוב באנגלית, כמו הקוד וה-README. מעתיקים את כל הבלוק לסשן חדש של Claude Code על הריפו. הוא בנוי לגל 0 ולגל 1, ובסופו כתוב איך להמשיך לגלים הבאים.

````text
You are working in the MONO repository (Next.js, static export). Read README.md
("Make: from ours, from yours") and docs/brand-book.md first, then study how an
existing "later" Make product is built end to end. Use Your Snowflake as the
reference and read every file it touches:

  lib/custom/specs/snowflake.ts        (params, strict check, detail, PRODUCT meta)
  lib/custom/specs/index.ts            (EXTRA registry)
  lib/custom/templates/snowflake.ts    (render(spec, colour) -> SVG string)
  lib/custom/renderers.ts              (lazy template registry)
  lib/custom/products.ts               (SHIPPED list, MAKE_GROUPS, order)
  components/custom/editors/SnowflakeEditor.tsx and editors/Field.tsx, types.ts
  components/custom/MakeView.tsx       (lazy editor registry)
  tests/make/snowflake.test.ts and tests/make/fuzz.ts (the gate)
  lib/custom/kit.ts, svg.ts, canvasSvg.ts, printCheck.ts, lexicon.ts, specKit.ts
  lib/custom/templates/family.ts       (arcText: letters along a circle)
  lib/custom/forTwo.ts and components/custom/ForTwo.tsx
  e2e/make-ours.spec.ts

Hard rules (all already enforced by the codebase; do not weaken any of them):
- One ink. A print is a two-tone SVG in the allowed subset: no clipPath, pattern,
  mask, textPath, defs, use, opacity, gradient, ellipse, polygon, polyline, no
  transform attribute, no NaN. Hatching is drawn as lines. Text on a circle is
  placed glyph by glyph.
- Every print must pass the catalogue's gate in BOTH colourways (solidBlock
  refused, quality >= 53; see tests/make/fuzz.ts `gate`). A failing print says
  why in one line and cannot be bought. Fix the template, never the fuzz.
- Every printed text field goes through the lexicon (useLexicon /
  wordsProblem) and the words rule (specKit WORDS: Latin script only). Do not
  add Hebrew or RTL.
- A spec is { t, v: 1, p }, small and strict, validated field by field, dropping
  unknown keys. It travels in ?make= and the bag line. Every product's test
  asserts its longest ?make= is under 300 characters (or a stated bound).
- Everything runs on the device. No network calls, no new CSP entries, no
  backend. Data files are built at build time and published under content
  hashes like data/cities (scripts/tools/buildCities.ts, publishCustom.ts).
- Deterministic: the same spec renders byte-identical SVG.
- British English, the brand voice (short, factual, deadpan, no exclamation
  marks, no "premium"/"special"). No brands, logos or real famous people.
- Match the surrounding code's naming, comment density and idiom. Each product
  is its own template chunk, its own spec module, its own editor, its own test.

WAVE 0: infrastructure (do this first, commit separately)

T1 Print fonts. Add three OFL print fonts beside DejaVu Sans Mono:
   a text serif (Libre Caslon Text, regular and bold), a condensed sans (Oswald,
   regular and bold) and a blackletter for mastheads (UnifrakturMaguntia).
   Subset each to Latin + digits + the WORDS punctuation, as WOFF2, into
   public/fonts with their licence files. Register them in lib/custom/canvasSvg.ts
   (the live preview) and wherever the tests and scripts/gen/quality.ts load fonts
   for resvg, so the gate measures the same glyphs. Extend kit.text with an
   optional family: "mono" | "serif" | "condensed" | "blackletter" (default
   mono, so every existing print stays byte-identical; add a test proving the
   existing examples' SVG is unchanged). Add a width measure per family (from
   the font's advance widths, generated at build time into a small JSON) so
   templates can fit text without a DOM.
T2 A shared "places and years" editor (components/custom/editors/PlacesField.tsx)
   built on the existing CityField: an ordered list of up to N rows of
   { city id, year? }, add/remove/reorder, the lexicon untouched (city names come
   from the list). A matching spec helper in specKit (packed like journey's
   stops) with its check.
T3 Move arcText out of templates/family.ts into kit.ts (family keeps using it;
   its output must stay byte-identical).
T4 Build-time data: countries from Natural Earth admin-0 1:110m (public
   domain; ISO A2/A3, name, simplified outline in Equal Earth projection
   coordinates, rounded) and major airports from OurAirports (public domain;
   large_airport + medium with scheduled service, IATA, name, city, country,
   lat, lon). Scripts in scripts/tools, outputs published under content hashes,
   loaded only on the pages that need them. Record the sources and licences in
   the README.
T5 Two new Make groups in MAKE_GROUPS, in this order after "place":
   { id: "travels", label: "From your travels" } and
   { id: "form", label: "In a form you know" }. The filter, counts, ?g= and
   the index cards must handle them (tests).
T6 A text-fitting helper in kit: wrap words to a width in a family and size,
   shrinking a step at a time to a floor; returns lines or null when it cannot
   fit (the editor then says "Too long for the print. Try shorter.").

WAVE 1: nine text products, one commit each, in this order. For each: spec
module, template, editor, registry entries, PRODUCT meta with a real example
that passes the gate in both colours, a test file modelled on
tests/make/snowflake.test.ts (spec accepts/refuses, longest link, determinism,
forbidden SVG, example gate in both colours, a fuzz over the full input range),
and the product added to SHIPPED. Give every template enough structure (a frame,
rules, a border) that a short input does not fail as "faint".

1. telegram, "Your Telegram" (group "form"). A vintage telegram form in the mono
   face: TELEGRAM header, TO / FROM / date fields, the message in capitals on
   pasted strips, full stops printed as STOP. Params: to, from (labels), d date,
   m message (up to 160 characters, lexicon). Example: "ARRIVED SAFELY STOP
   LOVE STOP".
2. editions, "Limited Editions" (group "people"). A collector's label:
   LIMITED EDITIONS, up to eight rows "No. 1 · Maya · 2015", a guilloche border
   (reuse the monogram/rosette guilloche drawing), a round seal with a role and
   year ("Grandpa · est. 1952"). Serif.
3. sayings, "Things They Say" (group "people"). A title ("THINGS SAVTA SAYS"),
   three to seven sayings in large quotation marks, a signature line. Second
   mode "First words": one word in a speech balloon, the child's name and date.
   Serif. Private people only; the attribution is a name the visitor types.
4. label, "Your Museum Label" (group "form"). A museum wall label: bold name,
   "(b. 1990, Tel Aviv)", a medium line, a credit line, an accession number
   derived from the date. Serif, generous margins, a hairline frame. Offer about
   40 suggested medium/credit lines we write (a constant list, deadpan, no
   brands), selectable or overridden by the visitor's own.
5. credits, "Your Credits" (group "people"). End credits: "A COHEN FAMILY
   PRODUCTION", then up to 12 role/name pairs centred in the condensed face,
   a copyright line and year.
6. card, "Your Business Card" (group "form"). An 85:55 card centred on the
   print with a hairline frame; name, title, company, and optional contact line;
   three styles: classic (serif, centred), modern (condensed, left), bone
   (mono, the 1980s card). The contact line is optional and the editor says
   in one line that it will be printed on a shirt. No logo upload.
7. receipt, "Your Receipt" (group "people", and in For two). Three modes:
   receipt (mono, a narrow slip with zigzag edges, "1x FIRST DATE ..... 0.00"
   lines, TOTAL, a Code 128 barcode encoding the date, drawn from our own
   encoder), terms (serif, numbered clauses), review (five stars, a quote,
   "Verified partner since 2016"). About 60 suggested lines across modes.
8. message, "Your First Message" (group "people", and in For two). Generic chat
   bubbles (rounded rectangles as paths), two sides, up to six messages with
   times, a date divider, a read line. No app's colours, shapes or names.
9. birth, "Your Birth Announcement" (group "people"). A 1950s card: IT'S A GIRL /
   IT'S A BOY / HELLO WORLD, the name large, a table of date, time, weight,
   length (metric or imperial, validated ranges) and city (CityField), a fine
   border, and optionally that night's moon (reuse moonShape and astro's
   moonPhase for the date and time).

For two: add cards for receipt and message to lib/custom/forTwo.ts (only when
the inputs allow them, every spec validated), with tests in tests/forTwo.test.ts.

After each product: run the project's checks (typecheck, lint, vitest for
tests/make and tests/forTwo, and the e2e Make spec for the new product: open the
page, fill the editor, see the canvas and ?make=, add to bag in M at $75, reopen
the link in a fresh context). Add each product's row to the README table in
"Make: from ours" and bump the product count in the README and the brand book's
facts table. Do not change prices or policy.

Stop after wave 1 and report: which products shipped, each one's longest
?make= length, anything the gate refused and how the template was changed, and
screenshots of every example in both colourways (use the run skill or
Playwright with the pre-installed Chromium).

Later waves (do not start without being asked): wave 2 sign, signpost (arrows
at true bearings; a two-city "since" mode also in For two), tour, lineup,
patch, sampler; wave 3 countries, flights, passport, frontpage; wave 4
dinosaur and landmarks, which need prepared artwork (eight O. C. Marsh 1896
skeleton plates, public domain; 24 landmark line drawings) that the owner
supplies or approves first.
````
