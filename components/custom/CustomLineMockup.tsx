"use client";

import { TeeMockup } from "@/components/TeeMockup";
import { CustomMockup } from "@/components/custom/CustomMockup";
import { useDrawn } from "@/components/custom/useCustom";
import type { CustomSpec } from "@/lib/custom/spec";
import type { BaseColor, ShirtProduct } from "@/types/shirt";

/** A bag line's picture when it's a made-for-you print: that print on the tee (the base design's picture until it's drawn). */
export default function CustomLineMockup({ shirt, color, spec, sizes, className }: { shirt: ShirtProduct; color: BaseColor; spec: CustomSpec; sizes: string; className?: string }) {
  const drawn = useDrawn(spec, color);
  return drawn ? <CustomMockup shirt={shirt} svg={drawn.svg} color={color} sizes={sizes} className={className} /> : <TeeMockup shirt={shirt} color={color} sizes={sizes} className={className} />;
}
