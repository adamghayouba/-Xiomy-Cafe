import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/config";

const LOGIN_PATH = "/login";

function clearSupabaseCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.set(cookie.name, "", {
        maxAge: 0,
        path: "/"
      });
    }
  }
}

export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();

  if (!env.isConfigured) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options as CookieOptions);
        });
      }
    }
  });

  const isLoginRoute = request.nextUrl.pathname.startsWith(LOGIN_PATH);

  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      const loginUrl = new URL(LOGIN_PATH, request.url);
      const redirect = isLoginRoute
        ? NextResponse.next({ request })
        : NextResponse.redirect(loginUrl);

      clearSupabaseCookies(request, redirect);
      return redirect;
    }

    if (!data.user && !isLoginRoute) {
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    }

    if (data.user && isLoginRoute) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return response;
  } catch {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    const redirect = isLoginRoute
      ? NextResponse.next({ request })
      : NextResponse.redirect(loginUrl);

    clearSupabaseCookies(request, redirect);
    return redirect;
  }
}
