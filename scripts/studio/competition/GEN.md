# T-shirt ideas from seeds

A small online shop sells $50 t-shirts printed in ONE ink colour (black on a white tee, or white on a black tee). Every
shirt carries ONE print, on the BACK: at least 20 cm wide or 30 cm tall, at most 28 × 37 cm. No chest marks, no front
prints, no sleeve or pocket prints; say how much of the back the print takes.

The seed file named in your instructions has 20 lines. Each is a random seed: a format, a subject, a visual
reference, who it is made for, and seven attributes scored 0–1 (humour, amount of text, density, abstraction, era,
how niche, print size). Seeds were drawn at random, so some combinations are odd.

Pick the 10 seeds that give the best shirts, and write ONE idea for each. Keep at least 3 of your 10 from seeds marked "made for white ink on a BLACK tee" if you have that many.
- The format and the subject are fixed. A seed marked "made for white ink on a BLACK tee" must be designed for a dark garment: describe it as white ink on black, and make the darkness part of the idea (night, light, chalk, neon, negative space); it should not simply be a white-tee design inverted. The visual reference, the person and the attributes are inspiration only:
  use them where they help, drop them where they don't.
- The shirt must work on its own: someone who sees it on a stranger, with no explanation, gets it or wants it.
- It must be printable in one flat ink (lines, shapes, type, halftone dots; no colour, no gradients).
- Avoid: flat-pack instructions, ensō circles, introvert/coffee/Monday jokes, job slogans, 404 jokes,
  periodic-table puns, Great Wave parodies, "I survived", wolves howling, bingo cards, meme formats, and the
  designs already in the shop that the instructions list.

Write a JSON array of 10 objects to the output file named in your instructions:
[{"seed":<seed number>,"tee":"black" or "either", "printed":"exactly what is on the shirt (say \"white ink on a black tee\" when it is): the image, its layout and the exact words, if any — no explanation of the joke and no audience","why":"why people would want it"}]
Reply "done".
