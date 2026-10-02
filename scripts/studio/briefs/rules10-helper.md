# עבודת סשן עזר: rules10 (הריצה הראשונה לפי הכללים החדשים)

K הוא מספר העוזר שלך (1–8), ו-KK אותו מספר בשתי ספרות (01–08).

אתה עוזר K בריצה של MONO: שני עיצובים לחולצות, במודל שרץ על המכונה שלך, בלי שום שירות או API חיצוני.
- זמן מקסימלי: 100 דקות. אחרי דקה 80 לא מתחילים לייצר תמונה חדשה, ובדקה 95 עוצרים ומוסרים.
- אין אדם שמאשר: עבוד עד הסוף בלי לשאול שאלות, ודווח בקצרה.

**קודם כול קרא את scripts/studio/briefs/rules.md. כל מה שכתוב בו מחייב.** העיצובים שלך מופיעים ב-DESIGNS[K] בקובץ rules10.py: כותרת, משפחה, קטגוריה, אפשרויות oneink, פרומפט ראשי, ופרומפט גיבוי.

## המחולל: SDXL
- הפקודה: `python3 scripts/studio/generate_sdxl.py --jobs <jobs.json>`. כל תמונה לוקחת כ-5 דקות וכ-13.3GB זיכרון. **לעולם לא שני תהליכי יצירה במקביל.**
- הפרומפטים כבר כתובים ב-rules10.py. אם פרומפט נכשל פעמיים, מותר לשנות אותו בקובץ, באותה רוח וב-45–90 מילים.
- מה המחולל נוטה לעשות, ומה עושים עם זה:
  - **מסגרת, נייר שמנת או טקסט מזויף:** חותכים, או צובעים לנייר לפני oneink, ומציינים ב-brief.txt.
  - **אובייקט שחוזר כמה פעמים:** בוחרים seed שבו יש אובייקט אחד ושלם.

## השלבים
1. `git checkout -b studio/rules10-K` ורושמים את השעה.
2. מתקינים ברקע, מיד:
   `pip install torch --index-url https://download.pytorch.org/whl/cpu`
   `pip install pillow numpy opencv-python-headless scipy diffusers transformers accelerate safetensors peft`
3. מייצרים ברקע את 6 התמונות הראשיות, 3 seeds לכל עיצוב:
   `python3 scripts/studio/briefs/rules10.py K all main /tmp/rules10 > /tmp/jobs-main.json && python3 scripts/studio/generate_sdxl.py --jobs /tmp/jobs-main.json`
4. בוחרים בעין (Read על כל PNG, גם בחיתוך מוגדל) לפי בדיקת האמת בסעיף 4 ב-rules.md:
   - אנטומיה ומכניקה נכונות: סופרים רגליים, גלגלים וסנפירים;
   - חפץ אחד, לא שני חפצים שהתמזגו;
   - השם תואם את הציור.

   אם כל שלוש התמונות נפסלו, מריצים את הגיבוי של אותו עיצוב, אחרי שהפקודה הראשית הסתיימה:
   `python3 scripts/studio/briefs/rules10.py K <slot> backup /tmp/rules10 > /tmp/jobs-b.json && python3 scripts/studio/generate_sdxl.py --jobs /tmp/jobs-b.json`
5. ממירים לדיו אחת, תמיד ב-`--mode engrave`:
   `python3 scripts/studio/oneink.py <image> data/studio/rules10/KK-<slot>-<slug> <slug> --mode engrave --title "<TITLE>" <the design's options from rules10.py> [--crop ...] [--size ...]`
   - ב-`<slug>-check.json` וב-`print.json` חייב להופיע `"fails": []`.
   - אם נכשל: מנסים `--size 0.9`, חיתוך אחר, או התמונה הבאה.
   - נכשל כ"strip" (פס דק, למשל אובייקט רחב): בוחרים seed שבו האובייקט גבוה יותר, או חותכים צמוד.
   - "Study" מופיע בכותרת רק אם יש באמת שני מבטים או יותר (`--views 2`).
6. מוסרים בתיקייה `data/studio/rules10/KK-<slot>-<slug>/`:
   - קובץ ההדפס `<slug>.png`;
   - `<slug>-preview.png`;
   - `print.json`;
   - `sources/`, עם התמונה שנבחרה ו-brief.txt: פרומפט, seed, למה היא נבחרה, ומה נצבע או נחתך;
   - `<slug>.txt` עם השדות:
     - Title (Title Case);
     - Category (הקטגוריה מ-rules10.py);
     - **Family** (המשפחה מ-rules10.py);
     - Subject, Style ו-Medium: Drawn (illustration);
     - Description: משפט עובדתי אחד וקריצה יבשה אחת, באנגלית בריטית;
     - Tee colours: `White` לציור מוצלל, `Black, White` לקו מתאר (`--outline`);
     - Keywords: 5–10;
     - Model: SDXL;
     - Credit and source: "Original image made with a generative tool: Stability AI SDXL base 1.0 with the ByteDance SDXL-Lightning UNet (both CreativeML Open RAIL++-M, commercial use allowed). Run on MONO's own machine from MONO's brief; no source image. Heading set in Space Grotesk (SIL Open Font License 1.1)."

   את `check.json` לא מכניסים ל-commit.
7. כותבים `data/studio/rules10/DONE-K.json`. לכל עיצוב: slot, slug, passed, which, images, chosen, note, ושדה **truth**:
   `{"anatomy_or_mechanics_ok": true, "one_object": true, "title_matches": true, "note": "..."}`
   עיצוב שאחת התשובות בו היא false לא נמסר, ו-passed שלו false.
8. עושים commit מקומי לכל עיצוב, ו-push פעם אחת בלבד, בסוף, אחרי DONE-K.json: `git push -u origin studio/rules10-K`. נוגעים רק ב-data/studio/rules10. לא נוגעים בקטלוג ולא פותחים PR.

כל הודעת commit מסתיימת ב:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
