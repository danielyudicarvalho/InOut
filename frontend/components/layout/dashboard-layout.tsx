"use client";

import { type ReactNode } from "react";
import {
  DashboardSidebar,
  type DashboardSidebarProps,
} from "./dashboard-sidebar";

export interface DashboardLayoutProps extends DashboardSidebarProps {
  children: ReactNode;
  className?: string;
}

export function DashboardLayout({
  children,
  className = "dashboard",
  ...sidebarProps
}: DashboardLayoutProps) {
  return (
    <main className={className}>
      <DashboardSidebar {...sidebarProps} />
      {children}
    </main>
  );
}
