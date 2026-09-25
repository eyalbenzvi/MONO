import { ProductView } from "@/components/shop/ProductView";
import { SHIRTS } from "@/lib/catalog";

export const dynamicParams = false;

export function generateStaticParams() {
  return SHIRTS.map((s) => ({ id: s.id }));
}

export default function ProductPage({ params }: { params: { id: string } }) {
  return <ProductView id={params.id} />;
}
