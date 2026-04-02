
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import AdminHeader from "../../../components/admin/AdminHeader";
import AdminNav from "../../../components/admin/AdminNav";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = cookies();

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
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/admin/login");
    }

    return (
        <div className="min-h-screen bg-mont-cream font-sans pb-20 md:pb-0">
            <AdminHeader userEmail={user.email} />
            <main className="container mx-auto px-4 py-6 max-w-4xl">
                {children}
            </main>
            <AdminNav />
        </div>
    );
}
