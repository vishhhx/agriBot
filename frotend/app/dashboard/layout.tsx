"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { DashboardSidebar } from "@/components/dashboard-sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
          className="
            fixed inset-0 z-40
            bg-black/50
            backdrop-blur-sm
            lg:hidden
          "
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          transition-transform duration-300
          lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <DashboardSidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* Mobile close */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
          className="
            absolute right-3 top-3
            rounded-md p-2
            text-muted-foreground
            hover:bg-muted
            lg:hidden
          "
        >
          <X className="h-4 w-4" />
        </button>
      </aside>

      {/* Content */}
      <div className="min-h-screen lg:pl-64">
        {/* Header */}
        <header
          className="
            sticky top-0 z-30
            flex h-14 shrink-0
            items-center gap-3
            border-b
            border-slate-200 bg-white/95
            px-4
            backdrop-blur
          "
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
            className="
              rounded-md p-2
              hover:bg-muted
              lg:hidden
            "
          >
            <Menu className="h-5 w-5" />
          </button>

          <h1 className="text-sm font-medium text-slate-800">Dashboard</h1>
        </header>

        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
      </div>
    </div>
  );
}
