"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  ShieldCheck,
  Users,
  KeyRound,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Layers,
  FolderTree,
  Lock,
  Unlock,
  AlertCircle,
  Code2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface WorkspaceInfo {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  domain?: string | null;
  isActive: boolean;
  aiEnabled: boolean;
  createdAt: string;
}

interface WorkspaceStats {
  totalEmployees: number;
  totalTeams: number;
  totalAccessGroups: number;
  totalUsers: number;
  roleGrantsCount: number;
}

interface RoleCatalogItem {
  roleKey: string;
  permissionCount: number;
  permissions: Array<{ permissionKey: string; scopeType: string }>;
}

interface RoleGrantItem {
  id: string;
  principalUserId: string;
  principalEmployeeId?: string | null;
  roleKey: string;
  scopeType: string;
  scopeId?: string | null;
  validFrom: string;
  validTo?: string | null;
  reason?: string | null;
  userEmail: string;
  employee?: {
    displayName: string;
    jobTitle?: string | null;
    department?: string | null;
  } | null;
}

interface TeamItem {
  id: string;
  name: string;
  teamType: string;
  sbuId?: string | null;
  parentTeamId?: string | null;
}

interface AccessGroupItem {
  id: string;
  name: string;
  purpose?: string | null;
  memberCount: number;
}

interface UserItem {
  id: string;
  email: string;
  isRootAdmin: boolean;
  isSuperadmin: boolean;
  breakGlassEnabled: boolean;
  createdAt: string;
  employee?: {
    displayName: string;
    jobTitle?: string | null;
    department?: string | null;
  } | null;
}

export function AdministrationPage() {
  const [activeTab, setActiveTab] = useState<"workspace" | "roles" | "teams" | "users" | "api">("workspace");

  // State: Workspace
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [wsLoading, setWsLoading] = useState(true);
  const [savingWs, setSavingWs] = useState(false);

  // State: Roles & Grants
  const [catalog, setCatalog] = useState<RoleCatalogItem[]>([]);
  const [grants, setGrants] = useState<RoleGrantItem[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  // State: Teams & Access Groups
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [accessGroups, setAccessGroups] = useState<AccessGroupItem[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // State: Users & Break-Glass
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Dialogs
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [grantPrincipalUserId, setGrantPrincipalUserId] = useState("");
  const [grantRoleKey, setGrantRoleKey] = useState("lead");
  const [grantScopeType, setGrantScopeType] = useState("TENANT");
  const [grantReason, setGrantReason] = useState("");
  const [granting, setGranting] = useState(false);

  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamType, setTeamType] = useState("functional");
  const [creatingTeam, setCreatingTeam] = useState(false);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupPurpose, setGroupPurpose] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [isBreakGlassModalOpen, setIsBreakGlassModalOpen] = useState(false);
  const [selectedUserForBg, setSelectedUserForBg] = useState<UserItem | null>(null);
  const [bgReason, setBgReason] = useState("");
  const [togglingBg, setTogglingBg] = useState(false);

  // Global message / error banner
  const [banner, setBanner] = useState<{ text: string; isError?: boolean } | null>(null);

  const showBanner = (text: string, isError = false) => {
    setBanner({ text, isError });
    setTimeout(() => setBanner(null), 4000);
  };

  // Fetch Workspace Details
  const fetchWorkspace = useCallback(async () => {
    setWsLoading(true);
    try {
      const res = await fetch("/api/admin/workspace");
      if (!res.ok) throw new Error("Failed to load workspace");
      const data = await res.json();
      setWorkspace(data.workspace);
      setStats(data.stats);
    } catch (e: any) {
      showBanner(e.message, true);
    } finally {
      setWsLoading(false);
    }
  }, []);

  // Fetch Roles & Grants
  const fetchRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const res = await fetch("/api/admin/roles");
      if (!res.ok) throw new Error("Failed to load roles");
      const data = await res.json();
      setCatalog(data.catalog || []);
      setGrants(data.grants || []);
    } catch (e: any) {
      showBanner(e.message, true);
    } finally {
      setRolesLoading(false);
    }
  }, []);

  // Fetch Teams & Access Groups
  const fetchTeamsAndGroups = useCallback(async () => {
    setTeamsLoading(true);
    try {
      const [teamsRes, groupsRes] = await Promise.all([
        fetch("/api/admin/teams"),
        fetch("/api/admin/access-groups"),
      ]);
      if (teamsRes.ok) {
        const d = await teamsRes.json();
        setTeams(d.teams || []);
      }
      if (groupsRes.ok) {
        const d = await groupsRes.json();
        setAccessGroups(d.groups || []);
      }
    } catch (e: any) {
      showBanner(e.message, true);
    } finally {
      setTeamsLoading(false);
    }
  }, []);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e: any) {
      showBanner(e.message, true);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspace();
    fetchRoles();
    fetchUsers();
    fetchTeamsAndGroups();
  }, [fetchWorkspace, fetchRoles, fetchUsers, fetchTeamsAndGroups]);

  // Toggle AI features
  const handleToggleAi = async (enabled: boolean) => {
    setSavingWs(true);
    try {
      const res = await fetch("/api/admin/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiEnabled: enabled }),
      });
      if (!res.ok) throw new Error("Failed to update AI setting");
      const d = await res.json();
      setWorkspace(d.workspace);
      showBanner(`AI Assistant ${enabled ? "enabled" : "disabled"} successfully.`);
    } catch (e: any) {
      showBanner(e.message, true);
    } finally {
      setSavingWs(false);
    }
  };

  // Grant role
  const handleGrantRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantPrincipalUserId) {
      showBanner("Please select a target user", true);
      return;
    }
    setGranting(true);
    try {
      const res = await fetch("/api/admin/roles/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          principalUserId: grantPrincipalUserId,
          roleKey: grantRoleKey,
          scopeType: grantScopeType,
          reason: grantReason,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to grant role");
      }
      setIsGrantModalOpen(false);
      setGrantReason("");
      showBanner("Role successfully granted to user.");
      fetchRoles();
      fetchWorkspace();
    } catch (e: any) {
      showBanner(e.message, true);
    } finally {
      setGranting(false);
    }
  };

  // Revoke role
  const handleRevokeRole = async (grantId: string) => {
    if (!confirm("Are you sure you want to revoke this role grant?")) return;
    try {
      const res = await fetch("/api/admin/roles/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to revoke role");
      }
      showBanner("Role grant revoked.");
      fetchRoles();
      fetchWorkspace();
    } catch (e: any) {
      showBanner(e.message, true);
    }
  };

  // Create Team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingTeam(true);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName, teamType }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to create team");
      }
      setIsTeamModalOpen(false);
      setTeamName("");
      showBanner("Team created successfully.");
      fetchTeamsAndGroups();
      fetchWorkspace();
    } catch (e: any) {
      showBanner(e.message, true);
    } finally {
      setCreatingTeam(false);
    }
  };

  // Create Access Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingGroup(true);
    try {
      const res = await fetch("/api/admin/access-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName, purpose: groupPurpose }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to create access group");
      }
      setIsGroupModalOpen(false);
      setGroupName("");
      setGroupPurpose("");
      showBanner("Access group created successfully.");
      fetchTeamsAndGroups();
      fetchWorkspace();
    } catch (e: any) {
      showBanner(e.message, true);
    } finally {
      setCreatingGroup(false);
    }
  };

  // Toggle Break Glass
  const handleToggleBreakGlass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForBg) return;
    setTogglingBg(true);
    const targetState = !selectedUserForBg.breakGlassEnabled;
    try {
      const res = await fetch("/api/admin/users/break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: selectedUserForBg.id,
          enabled: targetState,
          reason: bgReason || "Emergency operational escalation",
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to toggle break glass status");
      }
      setIsBreakGlassModalOpen(false);
      setBgReason("");
      setSelectedUserForBg(null);
      showBanner(
        `Emergency Break-Glass status ${targetState ? "ACTIVATED" : "DEACTIVATED"} for user.`
      );
      fetchUsers();
    } catch (e: any) {
      showBanner(e.message, true);
    } finally {
      setTogglingBg(false);
    }
  };

  return (
    <div className="page-stack">
      {/* Banner */}
      {banner && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
            banner.isError
              ? "bg-red-500/10 text-red-600 border border-red-500/20"
              : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
          }`}
        >
          {banner.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Header */}
      <header className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Administration & Organization</h1>
            <Badge variant="outline" className="text-xs">
              org.manage_roles · Module 0 & 15
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Configure tenant workspaces, organization hierarchy, ReBAC roles, and emergency governance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "roles" && (
            <Button
              size="sm"
              onClick={() => setIsGrantModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Grant Role</span>
            </Button>
          )}

          {activeTab === "teams" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsGroupModalOpen(true)}
                className="flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>New Access Group</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setIsTeamModalOpen(true)}
                className="flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>New Team</span>
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchWorkspace();
              fetchRoles();
              fetchTeamsAndGroups();
              fetchUsers();
            }}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab("workspace")}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px ${
            activeTab === "workspace"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Workspace & Settings</span>
        </button>

        <button
          onClick={() => setActiveTab("roles")}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px ${
            activeTab === "roles"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Roles & ReBAC Governance</span>
        </button>

        <button
          onClick={() => setActiveTab("teams")}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px ${
            activeTab === "teams"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>Teams & Access Groups</span>
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px ${
            activeTab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Users & Emergency Break-Glass</span>
        </button>

        <button
          onClick={() => setActiveTab("api")}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-colors border-b-2 -mb-px ${
            activeTab === "api"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>API & OpenAPI 3.1</span>
        </button>
      </div>

      {/* Tab 1: Workspace & General Settings */}
      {activeTab === "workspace" && (
        <div className="space-y-6">
          {/* Stats Bar */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="panel p-4">
                <span className="text-xs text-muted-foreground">Active Employees</span>
                <div className="text-2xl font-bold mt-1">{stats.totalEmployees}</div>
              </div>
              <div className="panel p-4">
                <span className="text-xs text-muted-foreground">Functional Teams</span>
                <div className="text-2xl font-bold mt-1">{stats.totalTeams}</div>
              </div>
              <div className="panel p-4">
                <span className="text-xs text-muted-foreground">Access Groups</span>
                <div className="text-2xl font-bold mt-1">{stats.totalAccessGroups}</div>
              </div>
              <div className="panel p-4">
                <span className="text-xs text-muted-foreground">Auth Accounts</span>
                <div className="text-2xl font-bold mt-1">{stats.totalUsers}</div>
              </div>
              <div className="panel p-4">
                <span className="text-xs text-muted-foreground">Active Role Grants</span>
                <div className="text-2xl font-bold mt-1">{stats.roleGrantsCount}</div>
              </div>
            </div>
          )}

          {/* Profile Card */}
          {workspace && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="panel p-5 space-y-4">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span>Tenant Workspace Profile</span>
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Organization Name</span>
                    <span className="font-medium">{workspace.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Tenant Slug</span>
                    <span className="font-mono">{workspace.slug}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Domain</span>
                    <span className="font-mono">{workspace.domain || workspace.slug}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">
                      Active
                    </Badge>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Tenant ID</span>
                    <span className="font-mono text-xs opacity-75">{workspace.tenantId}</span>
                  </div>
                </div>
              </div>

              {/* Feature Configuration Card */}
              <div className="panel p-5 space-y-4">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>Feature & Intelligence Controls</span>
                </h3>

                <div className="p-4 rounded-lg bg-secondary/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        <span>AI Assistant Engine</span>
                        {workspace.aiEnabled ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                            ENABLED
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-[10px]">
                            DISABLED
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Enable Gemini agentic interface with ReBAC security guards.
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant={workspace.aiEnabled ? "outline" : "default"}
                      disabled={savingWs}
                      onClick={() => handleToggleAi(!workspace.aiEnabled)}
                    >
                      {workspace.aiEnabled ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-secondary/30 text-xs space-y-1 text-muted-foreground">
                  <div className="font-medium text-foreground">ReBAC Authorization Policy</div>
                  <p>
                    All modules adhere to strict hierarchical ReBAC contracts. UI checks are
                    navigational only; server-side engine validates every database mutation.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Roles & Permissions Governance */}
      {activeTab === "roles" && (
        <div className="space-y-6">
          {/* Roles Catalog */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span>System Role Catalog ({catalog.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {catalog.map((role) => (
                <div key={role.roleKey} className="panel p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm capitalize">{role.roleKey.replace("_", " ")}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {role.permissionCount} perms
                    </Badge>
                  </div>
                  <p className="text-muted-foreground line-clamp-2">
                    Default template with permissions across tickets, projects, time, and approvals.
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Active Grants Table */}
          <div className="panel overflow-hidden space-y-3">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Active Role Grants ({grants.length})</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Explicit ReBAC assignments governing user access across scopes.
                </p>
              </div>
              <Button size="sm" onClick={() => setIsGrantModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Grant Role
              </Button>
            </div>

            {rolesLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading role grants…</div>
            ) : grants.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No active role grants found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Target User</th>
                      <th className="text-left">Role Key</th>
                      <th className="text-left">Scope Type</th>
                      <th className="text-left">Valid From</th>
                      <th className="text-left">Reason / Context</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grants.map((grant) => (
                      <tr key={grant.id} className="border-b border-border/40 hover:bg-secondary/20 text-xs">
                        <td>
                          <div className="font-medium text-foreground">{grant.userEmail}</div>
                          {grant.employee && (
                            <div className="text-[11px] text-muted-foreground">
                              {grant.employee.displayName} · {grant.employee.jobTitle || grant.employee.department}
                            </div>
                          )}
                        </td>
                        <td>
                          <Badge variant="outline" className="font-mono text-[11px] uppercase">
                            {grant.roleKey}
                          </Badge>
                        </td>
                        <td>
                          <span className="px-1.5 py-0.5 rounded bg-secondary text-[11px] font-mono">
                            {grant.scopeType}
                          </span>
                        </td>
                        <td className="font-mono text-muted-foreground">
                          {new Date(grant.validFrom).toLocaleDateString()}
                        </td>
                        <td className="text-muted-foreground max-w-xs truncate">
                          {grant.reason || "—"}
                        </td>
                        <td className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokeRole(grant.id)}
                            className="text-red-500 hover:text-red-600 h-7 text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Revoke
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Teams & Access Groups */}
      {activeTab === "teams" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Teams Column */}
          <div className="panel overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-primary" />
                  <span>Organizational Teams ({teams.length})</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Formal reporting and delivery units.
                </p>
              </div>
              <Button size="sm" onClick={() => setIsTeamModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                New Team
              </Button>
            </div>

            {teamsLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading teams…</div>
            ) : teams.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No teams defined.</div>
            ) : (
              <div className="divide-y divide-border/40">
                {teams.map((t) => (
                  <div key={t.id} className="p-3.5 text-xs flex items-center justify-between hover:bg-secondary/10">
                    <div>
                      <div className="font-semibold text-foreground text-sm">{t.name}</div>
                      <div className="text-muted-foreground text-[11px]">Type: {t.teamType}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      active
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Access Groups Column */}
          <div className="panel overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span>Access Groups ({accessGroups.length})</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cross-functional project and policy groups.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setIsGroupModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                New Group
              </Button>
            </div>

            {teamsLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading access groups…</div>
            ) : accessGroups.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No access groups defined.</div>
            ) : (
              <div className="divide-y divide-border/40">
                {accessGroups.map((g) => (
                  <div key={g.id} className="p-3.5 text-xs flex items-center justify-between hover:bg-secondary/10">
                    <div>
                      <div className="font-semibold text-foreground text-sm">{g.name}</div>
                      <div className="text-muted-foreground text-[11px]">{g.purpose || "General purpose"}</div>
                    </div>
                    <Badge variant="outline" className="text-[11px]">
                      {g.memberCount} members
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Users & Emergency Break-Glass */}
      {activeTab === "users" && (
        <div className="panel overflow-hidden space-y-3">
          <div className="p-4 border-b border-border">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              <span>Tenant Accounts & Emergency Break-Glass Governance ({users.length})</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage authentication accounts, administrator status, and emergency access overrides per SOC 2 controls.
            </p>
          </div>

          {usersLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading user accounts…</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No user accounts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Email / Account</th>
                    <th className="text-left">Linked Profile</th>
                    <th className="text-left">Privilege Status</th>
                    <th className="text-left">Emergency Break-Glass</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/40 hover:bg-secondary/20 text-xs">
                      <td className="font-medium text-foreground">{u.email}</td>
                      <td>
                        {u.employee ? (
                          <div>
                            <span>{u.employee.displayName}</span>
                            <span className="text-muted-foreground text-[11px] block">
                              {u.employee.jobTitle || u.employee.department}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Unlinked</span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-1.5">
                          {u.isRootAdmin && (
                            <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[10px]">
                              Root Admin
                            </Badge>
                          )}
                          {u.isSuperadmin && (
                            <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]">
                              Superadmin
                            </Badge>
                          )}
                          {!u.isRootAdmin && !u.isSuperadmin && (
                            <Badge variant="outline" className="text-[10px]">
                              Standard User
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        {u.breakGlassEnabled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-muted-foreground">
                            <Lock className="w-3 h-3 opacity-60" />
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <Button
                          variant={u.breakGlassEnabled ? "destructive" : "outline"}
                          size="sm"
                          onClick={() => {
                            setSelectedUserForBg(u);
                            setIsBreakGlassModalOpen(true);
                          }}
                          className="h-7 text-xs"
                        >
                          {u.breakGlassEnabled ? (
                            <>
                              <Lock className="w-3 h-3 mr-1" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3 mr-1" />
                              Break Glass
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: OpenAPI 3.1 & Developer API Documentation */}
      {activeTab === "api" && (
        <div className="space-y-6">
          <div className="panel p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-primary" />
                  <span>OpenAPI 3.1 & Platform Developer Ecosystem</span>
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Standard OpenAPI 3.1 specifications, interactive contract explorer, and system telemetry endpoints.
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href="/api/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
                >
                  <Code2 className="w-4 h-4" />
                  <span>Launch Interactive Explorer</span>
                </a>
                <a
                  href="/api/openapi.json"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent transition-colors"
                >
                  <span>Download Spec JSON</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
              <div className="p-4 rounded-lg border border-border bg-card/50 space-y-2">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider">Specification Standard</div>
                <div className="text-lg font-bold">OpenAPI 3.1.0</div>
                <p className="text-xs text-muted-foreground">
                  Compliant with JSON Schema 2020-12, W3C TraceContext headers, and ReBAC security schemes.
                </p>
              </div>

              <div className="p-4 rounded-lg border border-border bg-card/50 space-y-2">
                <div className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Functional Surface</div>
                <div className="text-lg font-bold">16 Bounded Contexts</div>
                <p className="text-xs text-muted-foreground">
                  CRM, HRMS, Projects, Finance, Approvals, ATS, Onboarding, Documents, Time, and Control Plane.
                </p>
              </div>

              <div className="p-4 rounded-lg border border-border bg-card/50 space-y-2">
                <div className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Operations Catalog</div>
                <div className="text-lg font-bold">50+ REST Operations</div>
                <p className="text-xs text-muted-foreground">
                  Fully typed request bodies, responses, path parameters, and error contracts.
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-lg border border-border bg-secondary/30 space-y-3">
              <div className="text-sm font-medium">Quickstart cURL: WhoAmI & ReBAC Permissions</div>
              <pre className="p-3 rounded bg-background border border-border text-xs font-mono overflow-x-auto text-muted-foreground">
{`curl -X GET "http://localhost:3000/api/authz/whoami" \\
  -H "Cookie: ops_session=<your_session_token>"`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Grant Role */}
      <Dialog open={isGrantModalOpen} onOpenChange={setIsGrantModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Grant ReBAC Role</DialogTitle>
            <DialogDescription>
              Assign an authorized system role to a tenant account with specific scope boundaries.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGrantRole} className="space-y-4 text-sm mt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Target User</label>
              <select
                value={grantPrincipalUserId}
                onChange={(e) => setGrantPrincipalUserId(e.target.value)}
                required
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              >
                <option value="">Select a user account…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email} {u.employee ? `(${u.employee.displayName})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Role Key</label>
              <select
                value={grantRoleKey}
                onChange={(e) => setGrantRoleKey(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              >
                {catalog.map((r) => (
                  <option key={r.roleKey} value={r.roleKey}>
                    {r.roleKey} ({r.permissionCount} permissions)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Scope Boundary</label>
              <select
                value={grantScopeType}
                onChange={(e) => setGrantScopeType(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              >
                <option value="TENANT">TENANT (Full Organization)</option>
                <option value="SBU">SBU (Strategic Business Unit)</option>
                <option value="TEAM">TEAM (Direct Team)</option>
                <option value="SELF">SELF (Self Service)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Justification / Reason</label>
              <input
                type="text"
                placeholder="e.g. Project Delivery Lead promotion"
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsGrantModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={granting}>
                {granting ? "Granting…" : "Assign Role"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Create Team */}
      <Dialog open={isTeamModalOpen} onOpenChange={setIsTeamModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Organizational Team</DialogTitle>
            <DialogDescription>
              Define a functional, project, or operational team.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTeam} className="space-y-4 text-sm mt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Team Name</label>
              <input
                type="text"
                placeholder="e.g. Core Platform Engineering"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Team Type</label>
              <select
                value={teamType}
                onChange={(e) => setTeamType(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              >
                <option value="functional">Functional</option>
                <option value="project">Project</option>
                <option value="operational">Operational</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsTeamModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingTeam}>
                {creatingTeam ? "Creating…" : "Create Team"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Create Access Group */}
      <Dialog open={isGroupModalOpen} onOpenChange={setIsGroupModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Access Group</DialogTitle>
            <DialogDescription>
              Cross-functional circles for specialized authorization and compliance policies.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateGroup} className="space-y-4 text-sm mt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Group Name</label>
              <input
                type="text"
                placeholder="e.g. Security Incident Response"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Purpose / Description</label>
              <input
                type="text"
                placeholder="e.g. On-call emergency responders"
                value={groupPurpose}
                onChange={(e) => setGroupPurpose(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsGroupModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingGroup}>
                {creatingGroup ? "Creating…" : "Create Group"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Break-Glass Confirmation */}
      <Dialog open={isBreakGlassModalOpen} onOpenChange={setIsBreakGlassModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <span>
                {selectedUserForBg?.breakGlassEnabled ? "Deactivate" : "Activate"} Emergency Break-Glass
              </span>
            </DialogTitle>
            <DialogDescription>
              Emergency break-glass access bypasses standard approval workflows for critical outage
              resolution. Every action during break-glass is flagged for SOC 2 security review.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleToggleBreakGlass} className="space-y-4 text-sm mt-3">
            <div className="p-3 rounded bg-secondary/30 text-xs space-y-1">
              <div>
                Target Account: <strong>{selectedUserForBg?.email}</strong>
              </div>
              <div>
                Current Status:{" "}
                {selectedUserForBg?.breakGlassEnabled ? (
                  <span className="text-rose-600 font-semibold">Active Override</span>
                ) : (
                  <span>Normal Access</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Incident Ticket / Mandatory Justification</label>
              <input
                type="text"
                placeholder="e.g. INC-8921 Production Database Outage"
                value={bgReason}
                onChange={(e) => setBgReason(e.target.value)}
                required
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsBreakGlassModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={selectedUserForBg?.breakGlassEnabled ? "default" : "destructive"}
                disabled={togglingBg}
              >
                {togglingBg
                  ? "Processing…"
                  : selectedUserForBg?.breakGlassEnabled
                  ? "Confirm Deactivation"
                  : "Confirm Emergency Activation"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
