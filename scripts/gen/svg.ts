/**
 * SVG primitives shared by the generators (one definition each, so every
 * set writes the same markup for the same thing).
 */
import { IH, IW, W, X0, Y0, n1 } from "./core";

/** Horizontal centre of the print. */
export const CX = W / 2;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The print's image area (inside the margins). */
export const IMAGE_BOX: Box = { x: X0, y: Y0, w: IW, h: IH };

/** A stroked path with round caps and joins. */
export const line = (d: string, ink: string, w: number) =>
  `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${n1(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;

/** Clip `body` to a rectangle (the image area by default). */
export const clip = (id: string, body: string, b: Box = IMAGE_BOX) =>
  `<clipPath id="${id}"><rect x="${n1(b.x)}" y="${n1(b.y)}" width="${n1(b.w)}" height="${n1(b.h)}"/></clipPath><g clip-path="url(#${id})">${body}</g>`;
