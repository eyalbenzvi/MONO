אתה צוות של שניים: מנהל מותג אופנה בינלאומי ומעצב-על של גרפיקה לחולצות. המשימה: לייצר 10 עיצובים מעולים לחולצות של MONO, בזמן של עד שעתיים, בלי שום שירות או API חיצוני. התמונות נוצרות במודל שרץ על המכונה של הסשן.

עובדים על הענף ccr-3caacdc3-1shlt2 של הריפו eyalbenzvi/MONO. אם הסשן נפתח על ענף אחר: git fetch origin ccr-3caacdc3-1shlt2 ו-git checkout ccr-3caacdc3-1shlt2.

== מגבלת זמן ==
רושמים את שעת ההתחלה (date) מיד.
- אחרי 100 דקות: לא מתחילים לייצר תמונות חדשות. מסיימים את מה שכבר נוצר, מוסרים ודוחפים.
- אחרי 120 דקות: הכול דחוף, והדוח הסופי נכתב.
אל תבזבז זמן על הסברים ארוכים בדרך. בכל 20 דקות שורת סטטוס קצרה אחת.

== קרא קודם (בקצרה, עד 5 דקות) ==
- docs/MONO-Design-Guidelines.pdf: ההנחיות להכנת עיצוב. כל עיצוב חייב לעמוד בהן.
- docs/brand-book.md, החלק "כללי תוכן וקטלוג".
- docs/content/studio.md
- scripts/studio/generate.py, scripts/studio/oneink.py, scripts/studio/briefs/pilot.py

== התקנה (ברקע, מיד אחרי הקריאה) ==
pip install pillow numpy opencv-python-headless scipy diffusers transformers accelerate safetensors peft
pip install torch --index-url https://download.pytorch.org/whl/cpu
ההורדה הראשונה של המודל (segmind/SSD-1B ו-latent-consistency/lcm-lora-ssd-1b) לוקחת כמה דקות. בזמן הזה כותבים את הפרומפטים.

== הטעם של היזם ==
איור מדעי ותיעודי אמיתי ומדויק, שרטוט נקי, הרבה שטח ריק, קו פתוח. כמו לוח טבע של תמנון, לווייתן כדיאגרמה, פינגווינים, הרים בקווים, מפרשית בתוכנית מפרשים.
סיסמה: "Real places. Real things. A deeper look."
מעל האיור: כותרת קטנה ומרווחת באותיות גדולות, ושורת משנה.

== 10 העיצובים ==
(כותרת | שורת משנה ל---sub | מצב | גודל | חולצות | הקומפוזיציה)
1. BLUE WHALE | Marine life · Anatomical study | line | 960x1088 | שתיהן | לווייתן כחול אחד במבט צד מלא, אופקי. קפלי הגרון, הסנפיר הקטן, הזנב. שוליים לבנים גדולים.
2. EMPEROR PENGUINS | Nature · Antarctica | line | 832x1216 | שתיהן | שני פינגווינים קיסריים בוגרים וגוזל ביניהם, עומדים, מבט חזיתי-צדי, בלי רקע.
3. SEA TURTLE | Marine life · Natural history plate | line | 960x1088 | שתיהן | צב ים ירוק אחד במבט מלמעלה, ארבעה סנפירים פרושים, לוחות השריון מפורטים.
4. PATAGONIA | Places · Torres del Paine | tone + --fade | 832x1216 | שתיהן | שלוש צריחי גרניט חדים מעל אגם, ענני רוח, השוליים מתפרקים לנייר.
5. VOLCANO | Science · Stratovolcano | line | 832x1216 | שתיהן | הר געש חרוטי אחד עם עמוד אפר מתפתל מעליו, מדרונות בקווים, בלי נוף מסביב.
6. LIGHTHOUSE | Maritime · Atlantic coast | tone + --fade | 832x1216 | שתיהן | מגדלור אבן גבוה על צוק, גלים נשברים בקצף, השוליים מתפרקים לנייר. בלי דמויות.
7. KITESURF | Sport · Wind and water | pen | 832x1216 | לבנה | כנף עפיפון גדולה בחלק העליון, קווים דקים יורדים לגולש קטן על גל קטן למטה. הרבה אוויר באמצע.
8. GRAPEVINE | Production · From vine to wine | line | 832x1216 | שתיהן | ענף גפן אחד עם אשכול ענבים כבד, שלושה עלים ומחושים מסולסלים. לוח בוטני.
9. BARN OWL | Nature · Tyto alba | line | 832x1216 | שתיהן | תנשמת אחת יושבת על ענף, מבט חזיתי, פני לב, נוצות מפורטות.
10. ALPINE VILLAGE | Villages · Under the peaks | tone + --fade | 832x1216 | שתיהן | כפר קטן עם מגדל כנסייה ובתי עץ, הרים מושלגים מאחור, השוליים מתפרקים לנייר.

את השורה "Tyto alba" כותבים רק אם הציפור בתמונה באמת תנשמת. כך גם בכל שם אחר: אומרים רק אמת.

== הפרומפטים לתמונות ==
- כותבים את כל עשרת הפרומפטים לקובץ scripts/studio/briefs/trial10.py, באותו מבנה של briefs/pilot.py. הקובץ מדפיס jobs.json.
- כל פרומפט באורך 200–300 מילים, באנגלית.
- הדברים החשובים ביותר בהתחלה, כי המודל שוקל אותם יותר: מה הנושא, כמה מכל דבר, ממה מורכבת התנוחה.
- אחר כך:
  - כל חלק בנפרד
  - הקו (חריטה, דיו, קווקוו, נקודות)
  - האור
  - הקומפוזיציה: הנושא כולו בתמונה, ממורכז, עם שוליים לבנים
  - "isolated on plain white paper"
- בסוף רשימה מפורשת של מה אסור:
  - no text, no letters, no numbers, no labels
  - no frame, no border, no ornaments, no decorative corners
  - no colour, no grey wash
  - no people, אלא אם הם חלק מהעיצוב (רק הגולש בעיצוב 7, קטן)
- נגטיב משותף: טקסט, מסגרת, קישוטים, פאנלים, צבע, אפור, טשטוש, תמונה, 3d, חיתוך בקצה, איברים מיותרים/חסרים/מתמזגים, אנטומיה מעוותת, שני נושאים.
- 2 seeds לכל עיצוב: 20 תמונות.

== ייצור ==
פקודה אחת ברקע, ל-20 התמונות:
python3 scripts/studio/generate.py --jobs <jobs.json> --lcm --steps 8
כ-3.5 דקות לתמונה, כלומר כ-70 דקות. לא להריץ במצב בלי --lcm, הוא איטי פי 5.
הסשן מקבל עדכון על כל תמונה שמסתיימת, ובינתיים מעבדים את מה שכבר מוכן. לא מחכים לסוף.

== בחירה (כל תמונה בעין) ==
פותחים כל תמונה ובוחרים את הטובה מכל זוג. תמונה נפסלת אם יש בה אחד מאלה:
- איברים מיותרים, חסרים או מתמזגים
- עוף עם שלוש רגליים, זנב כפול, מבנה בלי היגיון
- טקסט מזויף, מסגרת, קישוטי פינות או פאנלים
- הנושא חתוך בקצה
- מסה אפורה בלי פרטים
- לא היית לובש את זה
אם שתי הגרסאות נפסלות והזמן מאפשר (לפני דקה 100): משכתבים את הפרומפט לפי מה שהשתבש, ומייצרים עוד seed אחד. אחרת העיצוב נכתב בדוח כ"לא עבר" וממשיכים.

== דיו אחת ==
python3 scripts/studio/oneink.py <image> data/studio/<NN>-<slug> <slug> --mode <line|pen|tone> [--fade] --title "<TITLE>" --sub "<Sub>"
- אחר כך מסתכלים בעין על <slug>-preview.png, ובמצב tone גם על שני הקבצים. מחפשים "חול", כתמים, קווים שבורים או מסה אפורה.
- ב-<slug>-check.json חייב להיות "fails": [] בכל גרסה.
- אם משהו נכשל: לנסות --size 0.9 או מצב אחר (line↔pen). אם עדיין נכשל, העיצוב לא עובר.

== מסירה (לפי סעיפים 08 ו-09 בהנחיות) ==
בכל תיקייה data/studio/<NN>-<slug>/:
- <slug>.png (line/pen), או <slug>-black.png ו-<slug>-white.png (tone)
- <slug>-preview.png
- <slug>.txt עם השדות:
  - Title: באנגלית, Title Case, עד 40 תווים
  - Category: אחת מעשר הקטגוריות, לא Engravings. Botanical & Nature, Maps & Sky, Architecture, Photographs או Geometric לפי העניין.
  - Subject
  - Style
  - Medium: Drawn (illustration)
  - Description: משפט עובדתי אחד על מה שרואים, וקריצה יבשה וקצרה אחת, באנגלית בריטית. בלי "premium" ו-"special", ובלי סימני קריאה.
  - Tee colours
  - Print size: מ-check.json
  - Keywords: 5–10 מילים
  - Credit and source: "Original image made with a generative tool: Segmind SSD-1B (Apache 2.0) with the LCM LoRA for SSD-1B (CreativeML Open RAIL++-M); both allow commercial use. Run on MONO's own machine from MONO's brief; no source image. Heading set in Space Grotesk (SIL Open Font License 1.1)."
- sources/ עם:
  - התמונה שהמודל יצר
  - קובץ brief.txt עם הפרומפט, ה-seed, הגודל והמודל
check.json לא נמסר. מוחקים אותו מהתיקייה, או משאירים אותו מחוץ ל-commit.

== commit ו-push ==
- commit אחרי כל 2–3 עיצובים שנמסרו, ו-push ל-ccr-3caacdc3-1shlt2. המכונה נמחקת בסוף הסשן.
- לא נוגעים בקטלוג (data/shirts.json, public/prints) בריצה הזו, ולא מוחקים שום עיצוב קיים. זו ריצת ניסיון.

== דוח סופי ==
1. גיליון אחד data/studio/trial10-sheet.png: כל התצוגות המקדימות בטבלה, עם הכותרת מתחת לכל אחת. בלי הדמיות על חולצות.
2. בצ'אט, טבלה קצרה עם עמודה לכל אחד מאלה:
   - מספר
   - כותרת
   - עבר או לא עבר
   - כמה ניסיונות
   - מצב
   - כיסוי דיו
   - הערה אחת על מה שאפשר לשפר
3. כמה זמן לקח בפועל:
   - התקנה
   - כתיבת פרומפטים
   - ייצור
   - עיבוד
4. שלוש המסקנות החשובות ביותר לריצה הבאה: איזה סוג נושא המודל מצייר טוב ואיזה לא, ומה לשנות בפרומפטים.
