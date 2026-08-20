"use client";

import { useContext, useState } from "react";
import {
  Activity,
  Bot,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  LayoutDashboard,
  LogOut,
  Map,
  Radio,
  Settings,
  Sprout,
  User,
  Zap,
} from "lucide-react";

import { AuthContext } from "@/context/AuthContext";

const navigation = [
  {
    section: "Overview",
    items: [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        name: "My Bots",
        href: "/dashboard/mybots",
        icon: Bot,
      },
      {
        name: "Connect Robot",
        href: "/dashboard/robots/connect",
        icon: CirclePlus,
      },
    ],
  },
  {
    section: "Farm",
    items: [
      {
        name: "Fields",
        href: "/dashboard/fields",
        icon: Map,
      },
      {
        name: "Tasks",
        href: "/dashboard/tasks",
        icon: Sprout,
      },
      {
        name: "Activity",
        href: "/dashboard/activity",
        icon: Activity,
      },
    ],
  },
  {
    section: "Monitoring",
    items: [
      {
        name: "Live Monitoring",
        href: "/dashboard/monitoring",
        icon: Radio,
      },
      {
        name: "Robot Status",
        href: "/dashboard/robots/status",
        icon: Zap,
      },
    ],
  },
];

interface DashboardSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function DashboardSidebar({
  mobileOpen = false,
  onMobileClose,
}: DashboardSidebarProps) {
  const { user, logout } = useContext(AuthContext);

  const [collapsed, setCollapsed] = useState(false);

  const handleNavigation = () => {
    onMobileClose?.();
  };

  return (
    <div
      className={`
        group flex h-full flex-col
        border-r border-slate-200 bg-white text-slate-900
        transition-[width] duration-300 ease-in-out
        ${collapsed ? "w-[72px]" : "w-64"}
      `}
    >
      {/* ───────────────── HEADER ───────────────── */}

      <div
        className={`
          flex h-14 shrink-0 items-center border-b
          ${collapsed ? "justify-center px-2" : "px-4"}
        `}
      >
        <a
          href="/dashboard"
          className={`
            flex min-w-0 items-center
            ${collapsed ? "justify-center" : "gap-3"}
          `}
        >
          <div
            className="
              flex h-8 w-8 shrink-0
              items-center justify-center
              rounded-lg
              bg-emerald-600
              text-white
            "
          >
            <Bot className="h-4 w-4" />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">AgriBot</p>

              <p className="truncate text-[11px] text-muted-foreground">
                Smart Farming
              </p>
            </div>
          )}
        </a>
      </div>

      {/* ───────────────── NAVIGATION ───────────────── */}

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-6">
          {navigation.map((group) => (
            <div key={group.section}>
              {/* Section title */}
              {!collapsed && (
                <div className="mb-2 px-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.section}
                  </p>
                </div>
              )}

              {/* Items */}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <a
                      key={item.name}
                      href={item.href}
                      onClick={handleNavigation}
                      title={collapsed ? item.name : undefined}
                      className={`
                        group/item
                        flex h-10 items-center
                        rounded-lg
                        text-sm font-medium
                        text-muted-foreground
                        transition-all
                        hover:bg-muted
                        hover:text-foreground
                        ${collapsed ? "justify-center px-0" : "gap-3 px-3"}
                      `}
                    >
                      <Icon
                        className="
                          h-[18px] w-[18px]
                          shrink-0
                          transition-transform
                          group-hover/item:scale-105
                        "
                      />

                      {!collapsed && (
                        <span className="truncate">{item.name}</span>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* ───────────────── USER ───────────────── */}

      <div className="border-t p-3">
        {/* Profile */}
        <div
          className={`
            flex items-center rounded-lg
            ${collapsed ? "justify-center" : "gap-3 px-2 py-2"}
          `}
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="
                h-9 w-9 shrink-0
                rounded-full
                object-cover
              "
            />
          ) : (
            <div
              className="
                flex h-9 w-9 shrink-0
                items-center justify-center
                rounded-full
                bg-muted
                text-sm font-semibold
              "
            >
              {user?.name ? (
                user.name.charAt(0).toUpperCase()
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
          )}

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user?.name || "Farmer"}
              </p>

              <p className="truncate text-xs text-muted-foreground">
                {user?.email || "No email"}
              </p>
            </div>
          )}
        </div>

        {/* Settings */}
        <a
          href="/dashboard/settings"
          onClick={handleNavigation}
          title={collapsed ? "Settings" : undefined}
          className={`
            mt-2 flex h-10 w-full
            items-center rounded-lg
            text-sm font-medium
            text-muted-foreground
            transition-colors
            hover:bg-muted
            hover:text-foreground
            ${collapsed ? "justify-center" : "gap-3 px-3"}
          `}
        >
          <Settings className="h-[18px] w-[18px] shrink-0" />

          {!collapsed && <span>Settings</span>}
        </a>

        {/* Logout */}
        <button
          type="button"
          onClick={() => void logout()}
          title={collapsed ? "Sign out" : undefined}
          className={`
            mt-1 flex h-10 w-full
            items-center rounded-lg
            text-sm font-medium
            text-muted-foreground
            transition-colors
            hover:bg-muted
            hover:text-foreground
            ${collapsed ? "justify-center" : "gap-3 px-3"}
          `}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />

          {!collapsed && <span>Sign out</span>}
        </button>
      </div>

      {/* ───────────────── COLLAPSE ───────────────── */}

      <div className="hidden border-t p-2 lg:block">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="
            flex h-9 w-full
            items-center justify-center
            rounded-lg
            text-muted-foreground
            transition-colors
            hover:bg-muted
            hover:text-foreground
          "
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
