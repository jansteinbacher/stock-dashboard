"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "../../utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

// Assuming these components exist and handle their own logic
import LoginButton from "@/components/LoginLogoutButton";
import UserGreetText from "@/components/UserGreetText";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
      setLoading(false);
    };

    checkUser();
  }, [supabase]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-xl font-semibold text-gray-500">
          Loading...
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-24 bg-gray-50 dark:bg-gray-950">
      {isLoggedIn ? (
        // Authenticated Landing Page
        <div className="w-full max-w-2xl text-center space-y-8">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
            <UserGreetText />
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            Ready to analyze your investments? Dive into your portfolio, track performance, and make smarter decisions with a modern, clean interface.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Link href="/dashboard" passHref>
              <Button size="lg" className="rounded-full px-8 py-6 text-lg shadow-lg transition-transform transform hover:scale-105">
                Go to Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <div className="pt-4 sm:pt-0">
              <LoginButton />
            </div>
          </div>
        </div>
      ) : (
        // Unauthenticated Landing Page
        <Card className="w-full max-w-sm mx-auto p-6 sm:p-8 bg-white dark:bg-gray-900 text-center shadow-lg rounded-2xl">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Portfolio Analyzer
            </CardTitle>
            <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
              Sign in to manage and analyze your stock portfolio.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <LoginButton />
          </CardContent>
        </Card>
      )}
    </main>
  );
}