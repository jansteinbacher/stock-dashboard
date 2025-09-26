import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Fügen Sie 'async' hinzu, falls 'cookies()' in Ihrer Umgebung ein Promise zurückgibt.
// Wenn Sie den Fehler "Did you forget to use 'await'?" sehen, ist dies die Lösung.
export async function createClient() { 
  // Verwenden Sie 'await' um sicherzustellen, dass Sie das tatsächliche Cookie-Objekt erhalten.
  const cookieStore = await cookies() 

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Wird in Server Components ignoriert, wenn die Session in der Middleware aktualisiert wird.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            // ✅ Korrigiert: Verwenden Sie cookieStore.delete(name) zum Löschen des Cookies.
            cookieStore.delete(name)
          } catch (error) {
            // Wird in Server Components ignoriert.
          }
        },
      },
    }
  )
}