'use client';
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const LogoutPage =  () => {
    const router = useRouter();
    useEffect(() => {
        const timeoutId = setTimeout(() => router.push("/"), 2000);
        return () => clearTimeout(timeoutId);
    }, [router]);
  return <div>You have logged out... redirecting in a sec.</div>;
};

export default LogoutPage;