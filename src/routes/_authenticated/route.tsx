import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app/AppSidebar";
import { Ambience } from "@/components/motion/Ambience";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login", search: { redirect: location.pathname } });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="relative flex min-h-screen bg-background">
      <Ambience intensity="soft" className="fixed" />
      <AppSidebar />
      <div className="relative min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
