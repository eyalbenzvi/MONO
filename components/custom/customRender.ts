/**
 * What drawing a personalised print needs in the browser (the templates and
 * their data): one chunk, loaded when a page first shows or edits one, so a
 * product page without one carries none of it.
 */
export { customSummary, customTitle, decodeMake, encodeMake, renderCustomSvg } from "@/lib/custom";
export { loadCities, loadSky } from "@/lib/custom/data";
