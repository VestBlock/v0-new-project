import { AuthStatusChecker } from '@/components/auth-status-checker';
import { Card } from '@/components/ui/card';

export default function AuthDebugPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold mb-8 gradient-text">
            Authentication Debugger
          </h1>

          <div className="space-y-8">
            <AuthStatusChecker />

            <Card className="p-6 bg-card/80 backdrop-blur">
              <h2 className="text-xl font-bold mb-4">
                Common Issues & Solutions
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">
                    Issue: Can't access protected pages after login
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    This usually happens when the session isn't properly stored
                    or recognized.
                  </p>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    <li>Check if cookies are enabled in your browser</li>
                    <li>Try clearing your browser cache and cookies</li>
                    <li>Use the "Bypass Auth" button during development</li>
                    <li>Check for CORS issues if using a different domain</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium">
                    Issue: Redirected back to login page after signing in
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    This can happen if the middleware is not recognizing your
                    authentication.
                  </p>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    <li>Check if the session is being properly set</li>
                    <li>Try using the "Bypass Auth" option</li>
                    <li>Check for errors in the browser console</li>
                    <li>Verify that your Supabase configuration is correct</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium">
                    Issue: API routes return unauthorized errors
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    This happens when API routes can't verify your
                    authentication.
                  </p>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    <li>
                      Check if your session token is being sent with requests
                    </li>
                    <li>
                      Verify that your API routes are properly checking
                      authentication
                    </li>
                    <li>
                      Try using the "Bypass Auth" option during development
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
