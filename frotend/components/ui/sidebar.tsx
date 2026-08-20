"use client";

import * as React from "react";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------- Context ----------
type SidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx)
    throw new Error("Sidebar components must be used within <SidebarProvider>");
  return ctx;
}

// ---------- Provider (wraps everything, owns open/collapsed state) ----------
type SidebarProviderProps = React.HTMLAttributes<HTMLDivElement> & {
  defaultOpen?: boolean;
};

export function SidebarProvider({
  defaultOpen = true,
  className,
  children,
  ...props
}: SidebarProviderProps) {
  const [collapsed, setCollapsed] = React.useState(!defaultOpen);

  return (
    <SidebarContext.Provider
      value={{ collapsed, toggle: () => setCollapsed((c) => !c) }}
    >
      <div
        className={cn("flex h-screen w-full overflow-hidden", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

// ---------- Sidebar itself ----------
type SidebarProps = React.HTMLAttributes<HTMLDivElement> & {
  collapsible?: "icon" | "none";
};

export function Sidebar({
  collapsible = "none",
  className,
  children,
  ...props
}: SidebarProps) {
  const { collapsed } = useSidebar();
  const isCollapsed = collapsible === "icon" && collapsed;

  return (
    <div
      data-collapsed={isCollapsed}
      className={cn(
        "flex h-screen shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        isCollapsed ? "w-16" : "w-64",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ---------- Content area next to the sidebar ----------
export function SidebarInset({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex min-h-screen flex-1 flex-col overflow-hidden bg-background",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarTrigger({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { toggle } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <PanelLeft className="size-4" />
    </button>
  );
}

// ---------- Structural sections ----------
export function SidebarHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-2 p-2", className)} {...props} />
  );
}

export function SidebarContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-1 flex-col gap-2 overflow-auto p-2", className)}
      {...props}
    />
  );
}

export function SidebarFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-2 p-2", className)} {...props} />
  );
}

export function SidebarGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function SidebarGroupLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { collapsed } = useSidebar();
  if (collapsed) return null;
  return (
    <div
      className={cn(
        "px-2 py-1 text-xs font-medium text-sidebar-foreground/60",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarGroupContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-0.5", className)} {...props} />;
}

export function SidebarMenu({
  className,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("flex flex-col gap-0.5", className)} {...props} />;
}

export function SidebarMenuItem({
  className,
  ...props
}: React.HTMLAttributes<HTMLLIElement>) {
  return <li className={cn("relative", className)} {...props} />;
}

// ---------- Menu button ----------
type SidebarMenuButtonProps = React.HTMLAttributes<HTMLElement> & {
  asChild?: boolean;
  isActive?: boolean;
  size?: "default" | "lg";
  tooltip?: string;
};

export const SidebarMenuButton = React.forwardRef<
  HTMLElement,
  SidebarMenuButtonProps
>(
  (
    {
      asChild,
      isActive,
      size = "default",
      tooltip,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const { collapsed } = useSidebar();

    const sharedClassName = cn(
      "flex w-full items-center gap-2 overflow-hidden rounded-md px-2 text-sm outline-none transition-colors",
      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
      size === "lg" ? "h-12" : "h-8",
      isActive &&
        "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
      collapsed && "justify-center px-0",
      className,
    );

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>;
      return React.cloneElement(child, {
        ref,
        className: cn(sharedClassName, child.props.className),
        title: collapsed ? tooltip : undefined,
        ...props,
      });
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        title={collapsed ? tooltip : undefined}
        className={sharedClassName}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  },
);
SidebarMenuButton.displayName = "SidebarMenuButton";
