import DashboardShell from "@/components/DashboardShell";
import { getProducts } from "@/app/actions";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const products = await getProducts();

  return <DashboardShell initialProducts={products} />;
}
