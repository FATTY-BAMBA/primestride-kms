"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface Organization {
  id: string;
  name: string;
  role: string;
}

export default function OrgSwitcher() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [current, setCurrent] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/organizations")
      .then((r) => r.json())
      .then((d) => {
        if (d.organizations) {
          setOrgs(d.organizations);
          const saved = localStorage.getItem("activeOrgId");
          const found = d.organizations.find((o: Organization) => o.id === saved);
          setCurrent(found || d.organizations[0] || null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const switchOrg = async (org: Organization) => {
    localStorage.setItem("activeOrgId", org.id);
    setCurrent(org);
    await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: org.id }),
    });
    // Keep window.location.reload() - app-level state caches (Clerk session,
    // org context) require full reload. router.refresh() may leave stale state.
    window.location.reload();
  };

  if (loading) return <div className="h-9" />;

  if (orgs.length <= 1) {
    return current ? (
      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
        <Building2 className="h-3.5 w-3.5" />
        <span className="truncate">{current.name}</span>
      </div>
    ) : null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Building2 className="h-3.5 w-3.5" />
          <span className="flex-1 truncate text-left">{current?.name}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-400">
          Organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => switchOrg(org)}
            className="flex items-center justify-between"
          >
            <span className="truncate">{org.name}</span>
            {current?.id === org.id && (
              <Badge variant="secondary" className="h-4 text-[10px]">
                Active
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs text-slate-500">
          <Plus className="mr-2 h-3.5 w-3.5" />
          Create Organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
