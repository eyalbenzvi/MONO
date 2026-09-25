import { ProductView } from "@/components/shop/ProductView";
import { MOCK_SHIRTS } from "@/lib/mockData";

export const dynamicParams = false;

export function generateStaticParams() {
  return MOCK_SHIRTS.map((s) => ({ id: s.id }));
}

export default function ProductPage({ params }: { params: { id: string } }) {
  return <ProductView id={params.id} />;
}
