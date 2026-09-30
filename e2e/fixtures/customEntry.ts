/**
 * The personalised prints' browser code, bundled for e2e/custom.desktop.spec.ts:
 * the drawing a CustomMockup does, and the template, with nothing of the app
 * around them.
 */
import { renderCustomSvg } from "@/lib/custom";
import { drawSvg, loadCanvasFonts, printCanvas } from "@/lib/custom/canvasSvg";
import { drawMockup, loadFontCss, loadImage, svgImage, withFonts } from "@/lib/custom/raster";
import { loadRenderer, prepareData } from "@/lib/custom/renderers";
import { MADE } from "@/lib/custom/products";

(window as unknown as { __custom: unknown }).__custom = { renderCustomSvg, drawMockup, drawSvg, printCanvas, loadCanvasFonts, loadFontCss, loadImage, svgImage, withFonts, loadRenderer, prepareData, MADE };
