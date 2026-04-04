
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { DollarSign, ShoppingBag, Package, AlertTriangle } from "lucide-react";
import DashboardCard from "../../../components/admin/DashboardCard";
import Link from "next/link";

export default async function AdminDashboard() {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch { }
                },
            },
        }
    );

    // Fetch data from view
    const { data, error } = await supabase
        .from("vw_admin_dashboard")
        .select("*")
        .single();

    if (error) {
        console.error("Error fetching dashboard data:", error);
    }

    const kpis = data || {
        faturamento_hoje: 0,
        pedidos_pendentes: 0,
        produtos_ativos: 0,
        produtos_estoque_baixo: 0,
    };

    const faturamentoFormatter = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    });

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-serif font-bold text-mont-espresso">
                    Visão Geral
                </h2>
                <p className="text-mont-gray text-sm">
                    Resumo de hoje, {new Date().toLocaleDateString("pt-BR")}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <DashboardCard
                    title="Faturamento"
                    value={faturamentoFormatter.format(
                        kpis.faturamento_hoje || 0
                    )}
                    icon={DollarSign}
                    color="gold"
                    description="Vendas de hoje"
                />
                <Link href="/admin/pedidos" className="block">
                    <DashboardCard
                        title="Pendentes"
                        value={kpis.pedidos_pendentes || 0}
                        icon={ShoppingBag}
                        color={kpis.pedidos_pendentes > 0 ? "danger" : "default"}
                        description="Pedidos aguardando"
                    />
                </Link>
                <DashboardCard
                    title="Prod. Ativos"
                    value={kpis.produtos_ativos || 0}
                    icon={Package}
                    color="default"
                />
                <DashboardCard
                    title="Estoque Baixo"
                    value={kpis.produtos_estoque_baixo || 0}
                    icon={AlertTriangle}
                    color={kpis.produtos_estoque_baixo > 0 ? "danger" : "default"}
                />
            </div>

            {/* Quick Action */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm text-center">
                <h3 className="font-serif font-bold text-lg text-mont-espresso mb-2">
                    Gestão Rápida
                </h3>
                <p className="text-gray-500 text-sm mb-4">
                    Gerencie pedidos pendentes ou atualize o catálogo.
                </p>
                <div className="grid grid-cols-1 gap-3">
                    <Link
                        href="/admin/pedidos"
                        className="w-full bg-mont-espresso text-mont-cream font-bold py-3 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        Ver Pedidos
                    </Link>
                    <Link
                        href="/admin/produtos"
                        className="w-full bg-white border border-mont-espresso text-mont-espresso font-bold py-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Gerenciar Produtos
                    </Link>
                </div>
            </div>
        </div>
    );
}
