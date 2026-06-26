"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, ListChecks, LogOut, Users } from "lucide-react";
import { signOut } from "next-auth/react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/mode-toggle";

type AppSidebarUser = {
  nome?: string | null;
  email?: string | null;
  role: "COLABORADOR" | "DONO" | "CHEFE_SETOR";
};

function iniciais(nome?: string | null, email?: string | null): string {
  const base = nome?.trim() || email?.trim() || "?";
  const partes = base.split(/\s+/).filter(Boolean);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

type AppSidebarProps = {
  user: AppSidebarUser;
  contadorAlertas: number;
};

export function AppSidebar({ user, contadorAlertas }: AppSidebarProps) {
  const pathname = usePathname();
  const isDono = user.role === "DONO";
  const podeVerDashboards = user.role === "DONO" || user.role === "CHEFE_SETOR";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex shrink-0 items-center justify-center rounded-md bg-neutral-900 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
            <Image
              src="/logo-branco.png"
              alt="Agenda Fiscal"
              width={169}
              height={64}
              className="h-8 w-auto"
            />
          </div>
          {isDono ? (
            <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
              <span className="text-xs text-muted-foreground">Visão geral</span>
            </div>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname?.startsWith("/empresas")}
                >
                  <Link href="/empresas">
                    <Building2 />
                    <span>Empresas</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname?.startsWith("/tarefas")}>
                  <Link href="/tarefas">
                    <ListChecks />
                    <span>Tarefas</span>
                    {contadorAlertas > 0 && (
                      <span
                        className="ml-auto bg-destructive text-destructive-foreground text-xs font-normal min-w-5 h-5 flex items-center justify-center rounded-full px-1 group-data-[collapsible=icon]:hidden"
                        aria-label={`${contadorAlertas} tarefas com alertas de prazo`}
                      >
                        {contadorAlertas > 99 ? "99+" : contadorAlertas}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {podeVerDashboards && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname?.startsWith("/dashboards")}
                  >
                    <Link href="/dashboards">
                      <LayoutDashboard />
                      <span>Dashboards</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {isDono && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname?.startsWith("/usuarios")}
                  >
                    <Link href="/usuarios">
                      <Users />
                      <span>Usuários</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <Avatar size="sm">
                <AvatarFallback>{iniciais(user.nome, user.email)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-medium">{user.nome ?? user.email}</span>
                <span className="text-xs text-muted-foreground">
                  {isDono ? "Dono" : "Colaborador"}
                </span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user.nome ?? "Usuário"}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ModeToggle />
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/login" })}>
              <LogOut />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
