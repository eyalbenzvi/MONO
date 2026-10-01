אתה הסשן המתאם של ריצה של 50 עיצובים טובים לחולצות של MONO, בכשעתיים, בלי שום שירות או API חיצוני. העבודה מתפצלת ל-10 סשני עזר בענן. לכל עוזר מכונה משלו, 5 משבצות, ולכל משבצת עיצוב ראשי ועיצוב גיבוי משלה. אתה מכין את הקרקע, מפעיל את העוזרים, ממתין, ממזג ומדווח.

הריפו: eyalbenzvi/MONO. ענף הבסיס: ccr-3caacdc3-1shlt2. אם הסשן נפתח על ענף אחר: git fetch origin ccr-3caacdc3-1shlt2 ו-git checkout ccr-3caacdc3-1shlt2.
רושמים את שעת ההתחלה (date) מיד. בכל 15 דקות שורת סטטוס אחת. בלי הסברים ארוכים.

== לקחים מריצת הניסיון (חובה לפעול לפיהם) ==
1. **מה המודל (SSD-1B עם LCM, 8 צעדים) מצייר טוב:**
   - נושא אחד, סימטרי ומוכר, במבט חזיתי או מלמעלה: צב, תנשמת, מדוזה.
   - נופים בגוונים, שבהם אנטומיה לא משנה.
2. **במה הוא נכשל:**
   - ספירה: מספר רגליים, "שלושה X".
   - ציפורים עומדות על הקרקע.
   - גוף ארוך במבט צד (לווייתן, סוסון ים).
   - שרטוטים טכניים (גשר, מפרשית).
   - הוראות קומפוזיציה ("side elevation", "isolated"): הוא מתעלם מהן, והופך את הנושא לנוף.
   לכן כל 50 העיצובים למטה נבחרו מהסוג הראשון.
3. **פרומפט באורך 60–100 מילים, לא יותר.**
   - הנושא, הכמות והמבט בשבע המילים הראשונות. למשל: "One barn owl, front view, perched".
   - תיקונים ספציפיים מיד אחרי זה, בקצרה ("both feet, no ear tufts").
   - בסוף שורה אחת של איסורים.
4. **4 seeds לכל עיצוב בבת אחת,** ובוחרים את הטוב. לא ניסיון אחרי ניסיון.
5. **לכל משבצת גיבוי משלה.** אם כל 4 התמונות של העיצוב הראשי נפסלות, עוברים לגיבוי של אותה משבצת, עם 4 seeds חדשים.
6. **גרסת החולצה השחורה במצב tone עם --fade** יצאה כאליפסה בהירה רציפה. התיקון ממתין בענף studio/oneink-mass-fix (שלב 0).

== שלב 0: התיקון ל-oneink (כ-10 דקות, לפני שמפעילים עוזרים) ==
1. git fetch origin studio/oneink-mass-fix, ומסתכלים על ה-diff. מה שהוא מוסיף:
   - בגרסת החולצה השחורה של סצנה דוהה: רק אזורים בהירים שיש בהם ציור הופכים לדיו.
2. מריצים את oneink.py מהענף על שתי תמונות מהניסיון:
   data/studio/08-lighthouse/sources/lighthouse-generated.png
   data/studio/05-patagonia/sources/patagonia-generated.png
   עם --mode tone --fade, לתיקייה זמנית.
3. מסתכלים בעין על התצוגה המקדימה של החולצה השחורה. בודקים שאין אליפסה בהירה רציפה, ושהמגדלור והצוקים עדיין נקראים.
4. אם טוב: ממזגים את הענף ל-ccr-3caacdc3-1shlt2 ודוחפים. אם לא: מתקנים בקצרה, או ממזגים בלי השינוי ל-detail_light. **לא מבזבזים על זה יותר מ-15 דקות.**

== שלב 1: הקרקע לעוזרים (כ-5 דקות) ==
מוודאים עם ToolSearch שהכלים create_session, get_session, list_events, send_message ו-archive_session קיימים. הם של שרת claude-code-remote.
- אם הם לא קיימים: אומרים זאת בשורה אחת, ועושים בעצמך כמה שאפשר בשעתיים, משבצת אחר משבצת, לפי "עבודת סשן עזר".

כותבים את scripts/studio/briefs/run50.py: רשימת 100 העיצובים שלמטה, 50 ראשיים ו-50 גיבויים. הקובץ מקבל מספר עוזר, משבצת ו-main או backup, ומדפיס jobs.json עם 4 seeds.
- את הפרומפטים לא כותב המתאם. כל עוזר כותב בעצמו את הפרומפטים לחמשת העיצובים שלו, וזה חוסך זמן.
- המתאם כותב רק את המבנה ואת הנגטיב המשותף:
  text, letters, numbers, signature, watermark, logo, frame, border, ornament, decorative corners, panel, colour, grey wash, gradient, blurry, photo, 3d render, cropped, cut off, extra limbs, missing limbs, fused, deformed, two heads, duplicate, landscape background
  (ה-landscape background לא נכנס לנגטיב של עיצובי הנוף, עוזרים 7–9.)
- commit ו-push.

== הטעם של היזם ==
- **הסגנון:** איור מדעי ותיעודי אמיתי ומדויק, קו נקי, הרבה שטח ריק.
- **הסיסמה:** "Real places. Real things. A deeper look."
- **הכותרת מעל האיור:** כותרת קטנה ומרווחת באותיות גדולות, ושורת משנה בצורה "<World> · <detail>".

== 100 העיצובים: 10 עוזרים × 5 משבצות ==
(ראשי | גיבוי | מצב | גודל | שורת משנה)
גדלים: 832x1216 לאורך, 960x1088 לנושא רחב.

עוזר 1, Marine life:
  1 MANTA RAY, מלמעלה, כנפיים פרושות | STINGRAY מלמעלה | line | 960x1088 | Marine life · Seen from above
  2 NAUTILUS SHELL, מבט צד על הספירלה | CONCH SHELL | line | 832x1216 | Marine life · Natural history plate
  3 SCALLOP SHELL, מבט חזיתי | SAND DOLLAR מלמעלה | line | 960x1088 | Marine life · Natural history plate
  4 PUFFERFISH, מבט חזיתי, מנופח | SEA URCHIN | line | 960x1088 | Marine life · Natural history plate
  5 BRANCHING CORAL, ענף אחד | SEA FAN | line | 832x1216 | Marine life · The reef

עוזר 2, Birds (רק חזיתי, יושב על ענף או ראש בלבד, אף פעם לא עומד על הקרקע):
  1 SNOWY OWL, יושב על ענף, חזיתי | EAGLE OWL יושב, חזיתי | tone | 832x1216 | Nature · Arctic hunter
  2 GOLDEN EAGLE, חזיתי, כנפיים פרושות לרוחב | RAVEN חזיתי, כנפיים פרושות | line | 960x1088 | Nature · Wings open
  3 PEACOCK FEATHER, נוצה אחת | PHEASANT FEATHER נוצה אחת | line | 832x1216 | Nature · One feather
  4 PUFFIN, ראש וכתפיים, פורטרט צד | KINGFISHER ראש וכתפיים | line | 832x1216 | Nature · Portrait
  5 BIRD'S NEST עם ביצים, מלמעלה | OWL FEATHER נוצה אחת | line | 960x1088 | Nature · Seen from above

עוזר 3, Wings (מבט מלמעלה, סימטרי):
  1 SWALLOWTAIL BUTTERFLY | MONARCH BUTTERFLY | line | 960x1088 | Nature · Wings open
  2 LUNA MOTH | ATLAS MOTH | line | 960x1088 | Nature · Night flyer
  3 DRAGONFLY | DAMSELFLY | pen | 960x1088 | Nature · Four wings
  4 HONEYBEE | BUMBLEBEE | line | 960x1088 | Nature · Natural history plate
  5 BAT, חזיתי, כנפיים פרושות | FLYING FOX חזיתי, כנפיים פרושות | line | 960x1088 | Nature · Wings open

עוזר 4, Heads (ראש חזיתי, סימטרי, עד הכתפיים):
  1 WOLF | FOX | line | 832x1216 | Nature · Portrait
  2 LION, עם רעמה | TIGER | line | 832x1216 | Nature · Portrait
  3 RED DEER STAG, עם קרניים | MOOSE | line | 832x1216 | Nature · Portrait
  4 BROWN BEAR | POLAR BEAR | line | 832x1216 | Nature · Portrait
  5 HIGHLAND BULL, עם קרניים | RAM עם קרניים מסולסלות | line | 960x1088 | Nature · Portrait

עוזר 5, Botanical (פריט אחד, לוח בוטני):
  1 OAK LEAF AND ACORNS | MAPLE LEAF | line | 832x1216 | Botanical · Natural history plate
  2 FERN FROND, אחד, מתפתל | GINKGO LEAF | line | 832x1216 | Botanical · Natural history plate
  3 PINE CONE, אחד | FIR CONE על ענף | line | 832x1216 | Botanical · Natural history plate
  4 ARTICHOKE, אחד | THISTLE | line | 832x1216 | Botanical · Natural history plate
  5 SUNFLOWER HEAD, חזיתי | DANDELION CLOCK | line | 960x1088 | Botanical · Seen head on

עוזר 6, Garden & fruit:
  1 POMEGRANATE, חתוך לחצי | FIG חתוך לחצי | line | 960x1088 | Botanical · Cut open
  2 FLY AGARIC, שתי פטריות | MOREL אחת | line | 832x1216 | Nature · Forest floor
  3 LOTUS FLOWER, חזיתי | WATER LILY | line | 960x1088 | Botanical · Natural history plate
  4 ROSE, פריחה אחת, חזיתית | PEONY פריחה אחת | line | 960x1088 | Botanical · Natural history plate
  5 OLIVE BRANCH, ענף אחד עם זיתים | LEMON BRANCH ענף אחד עם לימונים | line | 832x1216 | Botanical · Natural history plate

עוזר 7, Mountains (tone --fade, נוף, "the scene fades into white paper at every edge"):
  1 MATTERHORN, פירמידה בודדת | DOLOMITES צריחים | tone --fade | 832x1216 | Places · The Alps
  2 ALPINE LAKE עם פסגות | FJORD | tone --fade | 832x1216 | Places · Still water
  3 DESERT DUNES | MESAS במדבר | tone --fade | 832x1216 | Places · The desert
  4 WATERFALL גבוה | SLOT CANYON | tone --fade | 832x1216 | Places · Falling water
  5 PINE FOREST IN MIST | BIRCH WOOD | tone --fade | 832x1216 | Places · The forest

עוזר 8, Coast (tone --fade):
  1 SEA STACKS | SEA ARCH | tone --fade | 832x1216 | Places · The coast
  2 BREAKING WAVE, גל אחד גדול | STORM SEA | tone --fade | 960x1088 | Maritime · Open water
  3 ROCKY ISLET עם עץ אחד | LONE PALM ON A BEACH | tone --fade | 832x1216 | Places · The island
  4 CHALK CLIFFS | BASALT COLUMNS | tone --fade | 832x1216 | Places · The coast
  5 FISHING HUT ON STILTS מעל מים | BOATHOUSE על אגם | tone --fade | 960x1088 | Maritime · Still water

עוזר 9, Sky & earth:
  1 FULL MOON, דיסק אחד, בלי fade | CRESCENT MOON | tone | 960x1088 | Maps & Sky · The near side
  2 SATURN, עם הטבעות | JUPITER | tone | 960x1088 | Maps & Sky · The planets
  3 GEYSER מתפרץ | ICEBERG | tone --fade | 832x1216 | Science · Earth at work
  4 QUARTZ CRYSTAL CLUSTER | AMETHYST GEODE חצוי | line | 960x1088 | Science · Mineral plate
  5 GLACIER | ICE CAVE | tone --fade | 832x1216 | Places · Ice

עוזר 10, Objects (חזיתי, חפץ אחד, בלי טקסט ובלי ספרות):
  1 ANCHOR | SHIP'S BELL | line | 832x1216 | Maritime · Ground tackle
  2 DIVING HELMET, חזיתי | OIL LANTERN | line | 832x1216 | Maritime · Deep water
  3 HOURGLASS | OIL LAMP | line | 832x1216 | Objects · Time
  4 ANTIQUE KEY | PADLOCK | line | 960x1088 | Objects · Ironwork
  5 CHESS KNIGHT | CHESS ROOK | line | 832x1216 | Objects · Carved wood

כלל האמת: שם מדעי, מקום או סוג בכותרת רק אם התמונה באמת מראה אותו. Matterhorn נקרא "MATTERHORN" רק אם ההר בתמונה נראה כמו המטרהורן. אחרת כותבים שם כללי, למשל ALPINE PEAK.

== שלב 2: הפעלת 10 העוזרים (כ-5 דקות) ==
לכל עוזר K מ-1 עד 10, create_session עם:
- source_url: https://github.com/eyalbenzvi/MONO
- source_revision: ccr-3caacdc3-1shlt2, אחרי המיזוג של שלב 0
- title: "MONO run50 helper K"
- prompt: החלק "עבודת סשן עזר" שלמטה, עם K ועם עשרת העיצובים של העוזר
- permission_mode: כמו שלך. לא plan.

אם יש מגבלה על מספר הסשנים במקביל: מפעילים כמה שאפשר. אחרי שעוזר מסיים, מפעילים את הבא שחיכה. אם עד דקה 30 עוזרים עדיין לא נפתחו, מדווחים כמה, ומוותרים על המשבצות שלהם (עדיף 40 עיצובים טובים מ-50 בחיפזון).

== שלב 3: המתנה ==
- Monitor עם until-loop: git fetch כל 60 שניות, ובדיקה אם בענפים studio/run50-K קיים data/studio/run50/DONE-K.json.
- מדווח על כל עוזר שסיים, ויוצא כשכולם סיימו, או בדקה 115.
- עוזר שאין לו ענף אחרי 30 דקות, או ש-get_session מראה failed: list_events, ואחר כך send_message או החלפה.
- **לא** sleep בלולאות קצרות.

== שלב 4: מיזוג ודוח (כ-10 דקות) ==
1. ממזגים כל studio/run50-K לתוך ccr-3caacdc3-1shlt2 (merge, לא rebase), ודוחפים.
2. גיליון אחד data/studio/run50-sheet.png: כל התצוגות המקדימות שעברו, בטבלה של 10 טורים, עם הכותרת מתחת לכל אחת. בלי הדמיות על חולצות.
3. archive_session לכל עוזר שסיים.
4. בצ'אט:
   - כמה עברו מתוך 50, וכמה מתוכם גיבויים
   - טבלה קצרה לפי עוזר
   - זמן כל שלב
   - שלוש מסקנות לריצה הבאה
5. לא נוגעים בקטלוג (data/shirts.json, public/prints) ולא מוחקים עיצובים קיימים.

==================== עבודת סשן עזר (נשלח לכל עוזר) ====================
אתה עוזר K בריצה של MONO. מייצרים 5 עיצובים טובים לחולצות במודל שרץ על המכונה שלך, בלי שירות חיצוני.
- **זמן מקסימלי:** 105 דקות.
- **אחרי דקה 85:** לא מתחילים ייצור חדש.

העיצובים שלך: [5 משבצות, ראשי וגיבוי, כפי שהם ברשימה].

1. ענף:
   git checkout -b studio/run50-K
   רושמים את השעה.
2. התקנה ברקע, מיד:
   pip install pillow numpy opencv-python-headless scipy diffusers transformers accelerate safetensors peft
   pip install torch --index-url https://download.pytorch.org/whl/cpu
3. פרומפטים לחמשת העיצובים הראשיים, ל-scripts/studio/briefs/run50-K.py. **60–100 מילים לכל אחד, באנגלית:**
   - שבע המילים הראשונות: כמות, נושא ומבט. למשל: "One red deer stag, head and shoulders, front view".
   - מיד אחר כך: מה חייב להיות ומה לא ("two antlers, symmetrical, both eyes").
   - אחר כך, במשפט אחד כל אחד: הקו, האור והקומפוזיציה:
     - עיצוב שאינו נוף: "centred, the whole subject with wide white margins, plain white paper"
     - עיצוב נוף: "the scene fades softly into white paper at every edge"
   - בסוף שורה אחת: "No text, no frame, no border, no ornaments, no colour, no grey wash."
   - הנגטיב המשותף נמצא ב-run50.py.
4. ייצור, ברקע, בפקודה אחת: 20 תמונות, 4 seeds לכל אחד מחמשת העיצובים הראשיים:
   python3 scripts/studio/generate.py --jobs <jobs.json> --lcm --steps 8
   כ-3.5 דקות לתמונה, כלומר כ-70 דקות. לא להריץ בלי --lcm. מעבדים כל עיצוב ברגע שארבע התמונות שלו מוכנות, ולא מחכים לסוף.
5. בחירה בעין, כל תמונה מלאה ובחיתוך מוגדל. תמונה נפסלת אם יש בה אחד מאלה:
   - איברים מיותרים, חסרים או מתמזגים, שני ראשים, או מבנה בלי היגיון
   - טקסט מזויף, מסגרת, קישוטים או פאנל
   - הנושא חתוך בקצה
   - מסה אפורה בלי פרטים
   - הנושא הפך לנוף, בעיצוב שאינו נוף
   - לא היית לובש את זה
   **אם כל ארבע נפסלו:** כותבים פרומפט לגיבוי של אותה משבצת, ושולחים 4 seeds בפקודה נוספת. אם כבר עברה דקה 85, המשבצת נשארת ריקה.
6. דיו אחת:
   python3 scripts/studio/oneink.py <image> data/studio/run50/K<slot>-<slug> <slug> --mode <mode> [--fade] --title "<TITLE>" --sub "<Sub>"
   - ב-check.json חייב להיות "fails": [] בכל גרסה.
   - מסתכלים בעין על התצוגה המקדימה ועל שני הקבצים במצב tone. מחפשים "חול", כתמים, קווים שבורים, מסה, או אליפסה בהירה.
   - אם משהו נכשל: --size 0.9, line↔pen, או line↔tone. אם עדיין נכשל: התמונה הבאה מבין הארבע.
7. מסירה, לפי סעיפים 08 ו-09 בהנחיות. בכל data/studio/run50/K<slot>-<slug>/:
   - קובץ ההדפס
   - <slug>-preview.png
   - <slug>.txt עם השדות:
     - Title: Title Case, עד 40 תווים
     - Category: אחת מעשר הקטגוריות. Engravings לכל היותר לעיצוב אחד מתוך החמישה.
     - Subject
     - Style
     - Medium: Drawn (illustration)
     - Description: משפט עובדתי אחד וקריצה יבשה אחת, באנגלית בריטית, בלי סימני קריאה, בלי "premium" ו-"special"
     - Tee colours
     - Print size: מ-check.json
     - Keywords: 5–10
     - Credit and source: "Original image made with a generative tool: Segmind SSD-1B (Apache 2.0) with the LCM LoRA for SSD-1B (CreativeML Open RAIL++-M); both allow commercial use. Run on MONO's own machine from MONO's brief; no source image. Heading set in Space Grotesk (SIL Open Font License 1.1)."
   - sources/ עם התמונה שנבחרה ו-brief.txt (הפרומפט, ה-seed, הגודל, המודל, ואיזו מבין הארבע נבחרה ולמה)
   - check.json לא נכנס ל-commit.
8. commit ו-push של כל עיצוב מיד כשהוא מוכן:
   git push -u origin studio/run50-K
   נוגעים רק ב-data/studio/run50 וב-scripts/studio/briefs/run50-K.py.
9. בסוף, data/studio/run50/DONE-K.json עם:
   - לכל משבצת: slug, עבר או לא, ראשי או גיבוי, כמה תמונות נוצרו, איזו נבחרה, מצב, כיסוי דיו, הערה של שורה
   - דקות של התקנה, ייצור ועיבוד
   commit ו-push. זה הסימן לסשן המתאם שסיימת.
10. בדקה 100: עוצרים, מוסרים את מה שמוכן, וכותבים DONE-K.json עם מה שיש.
==================== סוף עבודת סשן עזר ====================
