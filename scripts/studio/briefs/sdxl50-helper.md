# עבודת סשן עזר — sdxl50

K = מספר העוזר שלך (1–13), KK = אותו מספר בשתי ספרות (01–13).

אתה עוזר K בריצה של MONO: 4 עיצובים טובים לחולצות בטעם של היזם, במודל שרץ על המכונה שלך, בלי שום שירות או API חיצוני. זמן מקסימלי 105 דקות; אחרי דקה 85 לא מתחילים ייצור חדש; בדקה 100 עוצרים ומוסרים. אין אדם שמאשר — עבוד עד הסוף בלי לשאול שאלות. ענה ודווח בקצרה.

העיצובים שלך: D[K] ב-sdxl50.py (משבצת: ראשי | הערה | גיבוי | הערה | מצב oneink | גודל | שורת משנה); הם מופיעים גם בהודעה שלך.
(הרשימה, הגדלים, המצבים והנגטיב המשותף כבר ב-scripts/studio/briefs/sdxl50.py.)

## הטעם של היזם (חשוב)
היזם בחר ארבע חולצות ייחוס. כל עוזר מקבל משבצת אחת בכל אחת מארבע השפות (D[...] ב-sdxl50.py; משבצת 1=A, 2=B, 3=C, 4=D):
- A — גיליון מחקר של חוקר טבע (חולצה לבנה, דיו שחורה): החיה/הצמח בגדול באמצע, חי ומפורט; שלד או אנטומיה וסקיצות פרטים קטנות מסביב; קווי קנה מידה דקים וסימני הערות זעירים לא קריאים.
- B — שרטוט צד טכני (חולצה לבנה): מכונה או מבנה אחד במבט צד נקי, קווי מבנה/חבלים, קו קרקע דק, עמודות "מפרט" דקות של סימנים. הרבה אוויר. **אובייקט אחד בלבד**, לא שורה של העתקים.
- C — רחוב/עיירה צפופים בעט ודיו (חולצה לבנה): בניינים ישנים, מרפסות, תריסים, צמחים, קווקוו עדין, מקצה לקצה, הקרקע נגמרת בקו ישר (--edge horizon).
- D — גיליון פטנט על שחור (חולצה שחורה, קו לבן כמו גיר): אובייקט אחד בגדול, חלקים מפורקים או חוזרים סביבו, עיגולי פרטים קטנים. בפרומפט "white chalk line drawing on a black background"; oneink מייצר את שני הקבצים — מוסרים לחולצה שחורה (Tee colours: Black). אם צריך, הופכים לכהה-על-בהיר לפני oneink כך שהדיו הוא הציור.

## המחולל: SDXL (חובה, לכל התמונות)
- python3 scripts/studio/generate_sdxl.py --jobs <jobs.json> — SDXL base 1.0 + SDXL-Lightning 8 צעדים, כ-5 דקות לתמונה, ~13.3GB זיכרון. **לעולם לא שני תהליכי יצירה במקביל** (נגמר הזיכרון). לא משתמשים ב-generate.py.
- אין negative ב-Lightning: האיסורים נכנסים לפרומפט עצמו, **במשפט הראשון**: "...on plain white paper, no text, no lettering, no frame, no border, no colour." (בגיליון D: "on a plain black background, no text, ...").
- 45–90 מילים לפרומפט. שבע המילים הראשונות: כמות, נושא, מבט.
- מה שלמדנו במבחן: Lightning מצייר יפה ונקי, אבל מוסיף מסגרת, נייר שמנת וטקסט מזויף, ולפעמים חוזר על האובייקט 3–4 פעמים. לכן: בוחרים seed שבו האובייקט אחד ושלם; מסגרת/שוליים נחתכים (oneink --crop או חיתוך לפני); טקסט מזויף קטן נצבע לנייר לפני oneink (ומציינים ב-brief.txt); טקסט גדול/מרכזי = פסילה.
- 3 seeds לכל ראשי (לא 4). הפקודה הראשית: 12 תמונות (~60 דקות). גיבוי: 3 seeds, רק אחרי שהפקודה הראשית נגמרה.

כלל האמת: כותרת עם שם מין/מקום/סוג רק אם התמונה באמת מראה אותו; אחרת שם כללי (SHARK STUDY, HILLTOP TOWN).

לקחי ריצת הניסיון: המודל הקודם (SSD-1B; היום SDXL, אותם לקחים בערך) טוב בנושא אחד, סימטרי, מוכר, חזיתי או מלמעלה, ובנופים בגוונים; הוא נכשל בספירה, בגוף ארוך במבט צד, בשרטוטים טכניים, ומתעלם מהוראות קומפוזיציה. פרומפט קצר עדיף על ארוך.

לקחי run50 (43/50 עברו; כל משבצות הראשים, הבוטניקה, הגן, ההרים והחוף עברו):
- נכשלו: גופים שטוחים במבט מלמעלה עם מעט פרטים (מנטה, צדפת מסרק), אלמוגים מסועפים, נוצה בודדת, מפתח, פרש שחמט, קסדת צלילה — מכניקה וצורות רזות יוצאות מעוותות או ריקות. בפרומפט: מרקם ופרטים פנימיים, לא רק צללית.
- מצב: line לרוב החיות והצמחים; pen שומר שיער וקווקוו עדין (צבי, שור, לוטוס, שפירית); tone לנופים, ירח וכוכבי לכת. בפרוסס של tone מתיחת רמות 0.25–0.62 מסירה רסטר מנומר; GrabCut לרינדור אפור דמוי-צילום.
- שוליים: בחר seed שבו הנושא כולו בתוך הדף (אוזניים/רעמה/כנפיים בקצה = פסילה). המודל מתעלם מספירה — אל תסמוך על "two"/"three".
- זיכרון: הרצה מקבילה של שני תהליכי יצירה גרמה ל-out-of-memory (דבורה). גיבוי רץ רק אחרי שהפקודה הראשית סיימה או בתור אחריה — לא במקביל.
- סיום לנוף: horizon/rect/arch לפי השדה --edge ברשימה (לא אליפסה; oval רק אם באמת יפה, לכל היותר אחד בעשרה). אם בגרסת החולצה השחורה של נוף הסיום נראה כמו שטח בהיר רציף — מסור רק גרסה לבנה עם Tee colours: White.
- אין negative ב-SDXL Lightning: כל האיסורים בתוך הפרומפט, בהתחלה.

1. git checkout -b studio/sdxl50-K ; רשום את השעה (date).
2. התקנה ברקע, מיד (קודם torch של CPU, כדי ש-accelerate לא ימשוך גרסת CUDA):
   pip install torch --index-url https://download.pytorch.org/whl/cpu
   pip install pillow numpy opencv-python-headless scipy diffusers transformers accelerate safetensors peft
3. כתוב scripts/studio/briefs/sdxl50-K.py עם PROMPTS = {1: {"main": "...", "backup": "..."}, ..., 4: {...}} — עכשיו רק "main" לארבע המשבצות (את "backup" כתוב רק כשצריך; sdxl50.py קורא רק את מה שמבוקש). 60–100 מילים לכל פרומפט, באנגלית:
   - שבע המילים הראשונות: כמות, נושא, מבט (למשל "One red deer stag, head and shoulders, front view").
   - מיד אחר כך, בקצרה: מה חייב ומה לא ("two antlers, symmetrical, both eyes").
   - משפט אחד לכל אחד: הקו, האור, הקומפוזיציה — לעיצוב שאינו נוף: "centred, the whole subject with wide white margins, plain white paper"; לנוף — לפי הסיום שנבחר לו (--edge, ראה צעד 6): horizon: "the ground ends in a clean straight line, empty white sky above"; rect: "a complete rectangular scene"; circle: "composed to fit inside a circle"; arch: "a tall scene under a round-topped window"; oval בלבד: "the scene fades softly into white paper at every edge".
   - בסוף שורה אחת: "No text, no frame, no border, no ornaments, no colour, no grey wash."
4. ייצור בפקודה אחת ברקע — 12 תמונות (3 seeds לכל ראשי):
   python3 scripts/studio/briefs/sdxl50.py K all main /tmp/sdxl50 > /tmp/jobs-main.json
   python3 scripts/studio/generate_sdxl.py --jobs /tmp/jobs-main.json
   כ-5 דקות לתמונה (~60 דקות). התמונות יוצאות לפי הסדר (משבצת 1 קודם): עבד כל משבצת ברגע שארבע התמונות שלה מוכנות.
5. בחירה בעין (Read על PNG) — כל תמונה מלאה ובחיתוך מוגדל. פסילה אם: איברים מיותרים/חסרים/מתמזגים, שני ראשים, מבנה בלי היגיון; טקסט מזויף, מסגרת, קישוטים או פאנל; הנושא חתוך בקצה; מסה אפורה בלי פרטים; הנושא הפך לנוף (בעיצוב שאינו נוף); לא היית לובש את זה. בחר את הטובה מבין הארבע.
   אם כל הארבע נפסלו: כתוב "backup" לאותה משבצת ב-sdxl50-K.py והרץ (בפקודה נוספת, ברקע, אחרי שהפקודה הראשית סיימה — לא במקביל):
   python3 scripts/studio/briefs/sdxl50.py K <slot> backup /tmp/sdxl50 > /tmp/jobs-b<slot>.json ; python3 scripts/studio/generate_sdxl.py --jobs /tmp/jobs-b<slot>.json
   אחרי דקה 85 — המשבצת נשארת ריקה.
6. דיו אחת:
   python3 scripts/studio/oneink.py <image> data/studio/sdxl50/KK-<slot>-<slug> <slug> --mode <mode> [--edge horizon|rect|circle|arch|oval] --title "<TITLE>" --sub "<Sub>"
   סיום לנוף (סעיף 04 בהנחיות, "Scenes: how a picture ends"): horizon כברירת מחדל (הרים, צוקים, דיונות, מגדלור); rect לסצנה עמוסה (יער, אגם, פיורד); circle לירח, אי, גייזר, כוכב לכת; arch למפל, קניון, צריחים; oval — לכל היותר עיצוב אחד מתוך עשרה, ורק אם הוא באמת יפה. בחר לפני שכותבים את הפרומפט, וכתוב את הבחירה ב-brief.txt.
   ב-<slug>-check.json חייב להיות "fails": [] בכל גרסה. הסתכל בעין על התצוגה המקדימה, ובמצב tone על שני הקבצים: חול, כתמים, קווים שבורים, מסה, שטח בהיר רציף. אם נכשל: --size 0.9, line↔pen, או line↔tone; ואם עדיין — התמונה הבאה מבין הארבע.
   כלל האמת: שם מדעי/מקום/סוג בכותרת רק אם התמונה באמת מראה אותו (MATTERHORN רק אם ההר נראה כמו המטרהורן; אחרת ALPINE PEAK).
7. מסירה (סעיפים 08–09 בהנחיות) בכל data/studio/sdxl50/KK-<slot>-<slug>/:
   - קובץ/קבצי ההדפס, <slug>-preview.png
   - <slug>.txt עם: Title (Title Case, עד 40 תווים) · Category (אחת מעשר; Engravings לכל היותר לאחד מארבעת העיצובים שלך) · Subject · Style · Medium: Drawn (illustration) · Description (משפט עובדתי אחד וקריצה יבשה אחת, אנגלית בריטית, בלי סימני קריאה, בלי "premium"/"special") · Tee colours · Print size (מ-check.json) · Keywords (5–10) · Credit and source: "Original image made with a generative tool: Stability AI SDXL base 1.0 with the ByteDance SDXL-Lightning UNet (both CreativeML Open RAIL++-M, commercial use allowed). Run on MONO's own machine from MONO's brief; no source image. Heading set in Space Grotesk (SIL Open Font License 1.1)."
   - sources/ עם התמונה שנבחרה ו-brief.txt (פרומפט, seed, גודל, מודל, איזו מבין הארבע נבחרה ולמה)
   - check.json לא נכנס ל-commit.
8. commit מקומי של כל עיצוב מיד כשהוא מוכן. push פעם אחת בלבד, בסוף, אחרי DONE-K.json: git push -u origin studio/sdxl50-K (retry עם backoff אם הרשת נכשלה). נוגעים רק ב-data/studio/sdxl50 וב-scripts/studio/briefs/sdxl50-K.py. לא נוגעים בקטלוג, לא פותחים PR.
9. בסוף: data/studio/sdxl50/DONE-K.json עם: לכל משבצת slot, slug, passed, which (main/backup), images (כמה נוצרו), chosen (איזו), mode, ink_coverage, note (שורה); ובנוסף minutes: install / generate / process. commit ואז ה-push היחיד — זה הסימן לסשן המתאם שסיימת.
10. בדקה 100: עוצרים, מוסרים את מה שמוכן, וכותבים DONE-K.json עם מה שיש.
סוף כל הודעת commit:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
