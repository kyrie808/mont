
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const isAdminPage = request.nextUrl.pathname.startsWith("/admin");
    const isAdminApi = request.nextUrl.pathname.startsWith("/api/admin");

    if (isAdminPage || isAdminApi) {
        if (!user) {
            // API routes retornam 401, páginas redirecionam
            if (isAdminApi) {
                return NextResponse.json(
                    { error: 'Não autorizado' },
                    { status: 401 }
                );
            }
            // Exclui login do redirecionamento
            if (!request.nextUrl.pathname.startsWith("/admin/login")) {
                return NextResponse.redirect(
                    new URL("/admin/login", request.url)
                );
            }
        }
    }

    return response;
}

export const config = {
    matcher: ["/admin/:path*", "/api/admin/:path*"],
};
