אתה הסשן המתאם של ריצת ניסיון: 10 עיצובים טובים לחולצות של MONO, בכשעה, בלי שום שירות או API חיצוני. העבודה מתפצלת ל-5 סשני עזר בענן, וכל אחד מהם מקבל מכונה משלו ושני עיצובים. אתה כותב את ההנחיות, מפעיל את סשני העזר, ממתין, ממזג ומדווח.

הריפו: eyalbenzvi/MONO. ענף הבסיס: ccr-3caacdc3-1shlt2. אם הסשן נפתח על ענף אחר: git fetch origin ccr-3caacdc3-1shlt2 ו-git checkout ccr-3caacdc3-1shlt2.

רושמים את שעת ההתחלה (date) מיד. בכל 15 דקות שורת סטטוס אחת קצרה. בלי הסברים ארוכים.

== שלב 0: לוודא שאפשר לפצל (2 דקות) ==
טוענים עם ToolSearch את הכלים create_session, get_session, list_events, send_message ו-archive_session. הם של שרת claude-code-remote.
- אם הם קיימים: עובדים לפי שלבים 1–4.
- אם לא: אומרים זאת בשורה אחת, ומבצעים בעצמך את מה שכתוב בחלק "עבודת סשן עזר" על כל 10 העיצובים, ברצף. זה ייקח כשעה וחצי.

== שלב 1: ההנחיות לתמונות (כ-10 דקות) ==
קוראים בקצרה:
- docs/MONO-Design-Guidelines.pdf
- docs/brand-book.md, החלק "כללי תוכן וקטלוג"
- scripts/studio/briefs/pilot.py
- scripts/studio/oneink.py

כותבים את scripts/studio/briefs/trial10.py, באותו מבנה של pilot.py. הקובץ מקבל מספר עוזר (1–5) ותיקיית פלט, ומדפיס jobs.json עם שני העיצובים של אותו עוזר ועם עיצוב הגיבוי שלו.

כל פרומפט באורך 200–300 מילים, באנגלית:
- **בהתחלה, כי המודל שוקל את ההתחלה יותר:** מה הנושא, כמה מכל דבר (מספרים מפורשים: "exactly two wings, two legs"), התנוחה, ממה הנושא מורכב.
- **אחר כך:**
  - כל חלק בנפרד
  - הקו (חריטה, דיו, קווקוו, נקודות)
  - האור
  - הקומפוזיציה: הנושא כולו בתמונה, ממורכז, עם שוליים לבנים
  - "isolated on plain white paper"
- **בסוף, מה אסור:**
  - no text, no letters, no numbers, no labels
  - no frame, no border, no ornaments, no decorative corners
  - no colour, no grey wash
  - no people, אלא אם כתוב אחרת
- **נגטיב משותף:** טקסט, מסגרת, קישוטים, פאנלים, צבע, אפור, טשטוש, תמונה, 3d, חיתוך בקצה, איברים מיותרים/חסרים/מתמזגים, אנטומיה מעוותת, שני נושאים.

הטעם של היזם: איור מדעי ותיעודי אמיתי ומדויק, שרטוט נקי, הרבה שטח ריק. כמו לוח טבע של תמנון, לווייתן כדיאגרמה, פינגווינים, הרים בקווים, מפרשית בתוכנית מפרשים. "Real places. Real things. A deeper look." מעל האיור: כותרת קטנה ומרווחת באותיות גדולות, ושורת משנה.

העיצובים, לפי עוזר:
(כותרת | שורת משנה | מצב oneink | גודל | חולצות | קומפוזיציה)

עוזר 1:
  01 BLUE WHALE | Marine life · Anatomical study | line | 960x1088 | שתיהן | לווייתן כחול אחד במבט צד מלא, אופקי. קפלי גרון, סנפיר גב קטן, זנב. שוליים לבנים גדולים.
  02 SEA TURTLE | Marine life · Natural history plate | line | 960x1088 | שתיהן | צב ים ירוק במבט מלמעלה, בדיוק ארבעה סנפירים פרושים, לוחות שריון מפורטים.
  גיבוי: JELLYFISH | Marine life · Natural history plate | line | 832x1216 | שתיהן | מדוזה אחת, כיפה ומחושים ארוכים זורמים למטה.

עוזר 2:
  03 EMPEROR PENGUINS | Nature · Antarctica | line | 832x1216 | שתיהן | שני פינגווינים קיסריים בוגרים וגוזל ביניהם, עומדים, בלי רקע.
  04 BARN OWL | Nature · Portrait of a hunter | line | 832x1216 | שתיהן | תנשמת אחת על ענף, מבט חזיתי, פני לב, נוצות מפורטות.
  גיבוי: SEAHORSE | Marine life · Natural history plate | line | 832x1216 | שתיהן | סוסון ים אחד במבט צד, זנב מסולסל.

עוזר 3:
  05 PATAGONIA | Places · Torres del Paine | tone --fade | 832x1216 | שתיהן | שלושה צריחי גרניט חדים מעל אגם, השוליים מתפרקים לנייר.
  06 ALPINE VILLAGE | Villages · Under the peaks | tone --fade | 832x1216 | שתיהן | כפר קטן עם מגדל כנסייה ובתי עץ, הרים מושלגים מאחור, השוליים מתפרקים לנייר.
  גיבוי: PINE ON THE CLIFF | Places · Coast | tone --fade | 832x1216 | שתיהן | אורן בודד ומעוקם על צוק מעל הים.

עוזר 4:
  07 VOLCANO | Science · Stratovolcano | line | 832x1216 | שתיהן | הר געש חרוטי אחד, עמוד אפר מתפתל מעליו, מדרונות בקווים, בלי נוף מסביב.
  08 LIGHTHOUSE | Maritime · Atlantic coast | tone --fade | 832x1216 | שתיהן | מגדלור אבן על צוק, גלים נשברים בקצף, בלי דמויות, השוליים מתפרקים לנייר.
  גיבוי: STONE BRIDGE | Architecture · Old arch bridge | line | 960x1088 | שתיהן | גשר אבן עם שלוש קשתות מעל נהר שקט.

עוזר 5:
  09 KITESURF | Sport · Wind and water | pen | 832x1216 | לבנה | כנף עפיפון גדולה למעלה, קווים דקים לגולש קטן על גל קטן למטה, הרבה אוויר באמצע. גולש אחד, קטן, בלי פנים.
  10 GRAPEVINE | Production · From vine to wine | line | 832x1216 | שתיהן | ענף גפן אחד עם אשכול ענבים כבד, שלושה עלים, מחושים מסולסלים.
  גיבוי: CEP MUSHROOM | Nature · Boletus edulis | line | 832x1216 | שתיהן | שתי פטריות פורצ'יני על אדמת יער, אחת שלמה ואחת חתוכה לאורכה.

כלל האמת: שם מדעי בכותרת או בשורת המשנה רק אם מה שבתמונה באמת הוא. אחרת כותבים שורת משנה כללית.

commit ו-push של trial10.py לענף ccr-3caacdc3-1shlt2.

== שלב 2: הפעלת 5 סשני העזר (כ-5 דקות) ==
לכל עוזר K מ-1 עד 5, create_session עם:
- source_url: https://github.com/eyalbenzvi/MONO
- source_revision: ccr-3caacdc3-1shlt2
- title: "MONO trial10 helper K"
- prompt: החלק "עבודת סשן עזר" שלמטה, עם המספר K, ועם שלושת העיצובים של העוזר (מהרשימה בשלב 1)
- permission_mode: כמו שלך. **לא** plan, כי אז הסשן נעצר ומחכה לאישור.

רושמים את מזהי הסשנים.
אם המערכת מגבילה את מספר הסשנים במקביל: מפעילים כמה שאפשר. העוזרים שלא נפתחו נעשים בסשן הזה, במקביל לעבודת העוזרים האחרים.

== שלב 3: המתנה ==
- **לא** לבדוק בלולאת sleep קצרה.
- מפעילים Monitor עם until-loop. הוא עושה git fetch כל 60 שניות, ובודק אם בענפים studio/trial10-K קיים הקובץ data/studio/trial10/DONE-K.json.
- הוא מדווח על כל עוזר שסיים, ויוצא כשכולם סיימו, או אחרי 75 דקות מתחילת הריצה.
- **אם עוזר לא מתקדם** (אחרי 30 דקות עדיין אין לו ענף, או ש-get_session מראה failed):
  - בודקים ב-list_events מה קרה.
  - שולחים לו הודעה עם send_message, או עושים את העיצובים שלו כאן.

== שלב 4: מיזוג ודוח (כ-10 דקות) ==
1. ממזגים כל ענף studio/trial10-K לתוך ccr-3caacdc3-1shlt2 (merge, לא rebase). כל עוזר כותב לתיקיות משלו, ולכן לא אמורות להיות התנגשויות.
2. מכינים גיליון data/studio/trial10-sheet.png: כל התצוגות המקדימות בטבלה, עם הכותרת מתחת לכל אחת. בלי הדמיות על חולצות.
3. commit ו-push.
4. archive_session לכל עוזר שסיים.
5. בצ'אט, טבלה עם עמודה לכל אחד מאלה:
   - מספר
   - כותרת
   - עבר או לא עבר
   - האם זה הגיבוי
   - כמה ניסיונות
   - מצב
   - כיסוי דיו
   - הערה אחת
6. כמה זמן לקח כל שלב.
7. שלוש מסקנות לריצה הבאה: מה המודל מצייר טוב ומה לא, ומה לשנות בהנחיות.

==================== עבודת סשן עזר (נשלח לכל עוזר) ====================
אתה עוזר K בריצת ניסיון של MONO. מייצרים שני עיצובים טובים לחולצות במודל שרץ על המכונה שלך, בלי שירות חיצוני. זמן מקסימלי: 60 דקות.

העיצובים שלך: [שני העיצובים והגיבוי, כפי שהם ברשימה].

1. ענף:
   git checkout -b studio/trial10-K
   רושמים את השעה.
2. התקנה ברקע, מיד:
   pip install pillow numpy opencv-python-headless scipy diffusers transformers accelerate safetensors peft
   pip install torch --index-url https://download.pytorch.org/whl/cpu
3. ההנחיות כבר כתובות:
   python3 scripts/studio/briefs/trial10.py K <dir> > jobs-K.json
   מייצרים קודם רק את שני העיצובים הראשונים, seed אחד לכל אחד:
   python3 scripts/studio/generate.py --jobs <קובץ עם שתי העבודות> --lcm --steps 8
   ברקע. כ-3.5 דקות לתמונה. לא להריץ בלי --lcm, זה איטי פי 5.
4. מסתכלים בעין על כל תמונה, מלאה ובחיתוך מוגדל. היא נפסלת אם יש בה אחד מאלה:
   - איברים מיותרים, חסרים או מתמזגים, או מבנה בלי היגיון
   - טקסט מזויף, מסגרת, קישוטי פינות או פאנלים
   - הנושא חתוך בקצה
   - מסה אפורה בלי פרטים
   - לא היית לובש את זה
   אם נפסלה: כותבים את ההנחיה מחדש לפי מה שהשתבש (למשל "exactly two legs, one head"), ומייצרים seed חדש. עד 3 ניסיונות לעיצוב. אחרי 3 כישלונות עוברים לעיצוב הגיבוי.
5. דיו אחת:
   python3 scripts/studio/oneink.py <image> data/studio/<NN>-<slug> <slug> --mode <mode> [--fade] --title "<TITLE>" --sub "<Sub>"
   - ב-<slug>-check.json חייב להיות "fails": [].
   - מסתכלים בעין על התצוגה המקדימה, ובמצב tone על שני הקבצים. מחפשים "חול", כתמים, קווים שבורים או מסה אפורה.
   - אם משהו נכשל: לנסות --size 0.9, או line↔pen.
6. מסירה, לפי סעיפים 08 ו-09 בהנחיות. בכל data/studio/<NN>-<slug>/:
   - קובץ ההדפס
   - <slug>-preview.png
   - <slug>.txt עם השדות:
     - Title: Title Case, עד 40 תווים
     - Category: לא Engravings
     - Subject
     - Style
     - Medium: Drawn (illustration)
     - Description: משפט עובדתי אחד וקריצה יבשה אחת, באנגלית בריטית, בלי סימני קריאה
     - Tee colours
     - Print size: מ-check.json
     - Keywords: 5–10
     - Credit and source: "Original image made with a generative tool: Segmind SSD-1B (Apache 2.0) with the LCM LoRA for SSD-1B (CreativeML Open RAIL++-M); both allow commercial use. Run on MONO's own machine from MONO's brief; no source image. Heading set in Space Grotesk (SIL Open Font License 1.1)."
   - sources/ עם התמונה שהמודל יצר ו-brief.txt (הפרומפט, ה-seed, הגודל והמודל)
   - check.json לא נכנס ל-commit.
7. commit ו-push של כל עיצוב מיד כשהוא מוכן:
   git push -u origin studio/trial10-K
   לא נוגעים בקטלוג (data/shirts.json, public/prints) ולא בשום קובץ אחר מחוץ ל-data/studio.
8. בסוף, הקובץ data/studio/trial10/DONE-K.json עם:
   - לכל עיצוב: slug, עבר או לא, האם הגיבוי, מספר ניסיונות, מצב, כיסוי דיו, הערה
   - זמני ההתקנה, הייצור והעיבוד
   commit ו-push. זה הסימן לסשן המתאם שסיימת.
9. אם מגיעים ל-55 דקות: עוצרים, מוסרים את מה שמוכן, וכותבים DONE-K.json עם מה שיש.
==================== סוף עבודת סשן עזר ====================
