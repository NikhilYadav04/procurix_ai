import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { motion, useReducedMotion } from "framer-motion";
import { Package, ArrowRight, Mail } from "lucide-react";
import SideNav from "../components/SideNav";
import { Button } from "@/components/ui/button";
import { dur, ease } from "@/lib/motion";

interface SessionUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export default function SuppliersPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);

  // Fetch user data from session cookie
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Get user from session cookie
        const cookies = document.cookie.split(';');
        const sessionCookie = cookies.find(c => c.trim().startsWith('session='));

        if (!sessionCookie) {
          router.push("/login");
          return;
        }

        const sessionValue = sessionCookie.split('=')[1];
        const sessionData = JSON.parse(decodeURIComponent(sessionValue));

        if (!sessionData.user || sessionData.expiresAt <= Date.now()) {
          router.push("/login");
          return;
        }

        const userEmail = sessionData.user.email;

        // Set user from session
        setUser({
          id: sessionData.user.id,
          email: sessionData.user.email,
          name: sessionData.user.name,
          picture: sessionData.user.picture,
        });

        // Fetch customer data
        const customerResponse = await fetch(`/api/customer/${encodeURIComponent(userEmail)}`);
        if (customerResponse.ok) {
          const custData = await customerResponse.json();
          setCustomerData(custData);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setLoadError(true);
      }
    };

    fetchUserData();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout");
      document.cookie = "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <Head>
        <title>Suppliers | Procurix</title>
      </Head>

      <SideNav
        activePage="suppliers"
        user={user}
        customerData={customerData}
        onLogout={handleLogout}
      />

      <div className="md:ml-20 pb-20 md:pb-0">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-surface">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-[var(--radius-inner)] bg-secondary border border-border">
                <Package className="h-7 w-7 text-foreground" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-foreground text-balance">
                  Suppliers
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your supplier relationships.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-20">
          {loadError ? (
            // Error state
            <div className="mx-auto max-w-lg text-center" role="alert">
              <h2 className="text-2xl font-semibold text-foreground">
                Suppliers did not load
              </h2>
              <p className="mt-2 text-muted-foreground">
                Something went wrong while fetching your account. Check your connection and try again.
              </p>
              <Button size="lg" className="mt-6" onClick={() => window.location.reload()}>
                Try again
              </Button>
            </div>
          ) : !user ? (
            // Loading state
            <div className="mx-auto max-w-lg" aria-live="polite" aria-busy="true">
              <div className="mx-auto h-16 w-16 rounded-[var(--radius)] bg-secondary animate-pulse" />
              <div className="mx-auto mt-6 h-6 w-48 rounded-[var(--radius-inner)] bg-secondary animate-pulse" />
              <div className="mx-auto mt-3 h-4 w-72 max-w-full rounded-[var(--radius-inner)] bg-secondary animate-pulse" />
            </div>
          ) : (
            // Empty state: no suppliers yet
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur.enter, ease: ease.standard }}
              className="mx-auto max-w-lg text-center"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius)] border border-border bg-secondary">
                <Package className="h-8 w-8 text-foreground" aria-hidden="true" />
              </div>

              <h2 className="mt-6 text-2xl font-semibold text-foreground text-balance">
                No suppliers yet
              </h2>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                Suppliers appear here once you email them an RFP. Describe what you need
                on the dashboard and add vendor emails to send your first one.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button size="lg" onClick={() => router.push("/dashboard")}>
                  Create your first RFP
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>

              <div className="mt-10 flex items-start gap-3 rounded-[var(--radius)] border border-border bg-surface p-4 text-left">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-inner)] border border-border bg-secondary">
                  <Mail className="h-4 w-4 text-foreground" aria-hidden="true" />
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Once a vendor replies to an RFP with a quote, they show up here with
                  their contact details and bid history.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
