/**
 * What drawing a made-for-you print needs in the browser (the templates and
 * their data): one chunk, loaded when a page first shows one, so pages
 * without one carry none of it.
 */
export { customSummary, decodeMake, renderCustomSvg } from "@/lib/custom";
export { loadRenderer, prepareData } from "@/lib/custom/renderers";
export { loadCities, loadSky, searchCities } from "@/lib/custom/data";
export { drawMockup, loadImage } from "@/lib/custom/raster";
export { loadCanvasFonts } from "@/lib/custom/canvasSvg";
