import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { motion } from "framer-motion";
import { Shield, UserPlus, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CITIES } from "@/lib/cities";
import { useIsRootAdmin } from "@/hooks/useIsRootAdmin";


const formSchema = z.object({
  email: z.string().trim().email({ message: "Enter a valid email" }).max(255),
  role: z.enum(["admin", "moderator"]),
  city: z.string().max(100).optional(),
});

type RoleAssignment = {
  user_id: string;
  email: string;
  role: "admin" | "moderator" | "user";
  city: string | null;
  status?: string;
};

const AdminUsers = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { isMainAdmin } = useIsRootAdmin();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "moderator">("moderator");
  const [city, setCity] = useState<string>("Ratlam");

  const { data: assignments = [], isLoading: listLoading } = useQuery({
    queryKey: ["role-assignments"],
    enabled: isMainAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_role_assignments");
      if (error) throw error;
      return (data ?? []) as RoleAssignment[];
    },
  });

  const grantMutation = useMutation({
    mutationFn: async (vals: z.infer<typeof formSchema>) => {
      const { error } = await supabase.rpc("admin_grant_role_by_email", {
        _email: vals.email,
        _role: vals.role,
        _city: vals.city && vals.city !== "__all__" ? vals.city : (null as unknown as string),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role granted");
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["role-assignments"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to grant role"),
  });

  const revokeMutation = useMutation({
    mutationFn: async (vals: { email: string; role: "admin" | "moderator" }) => {
      const { error } = await supabase.rpc("admin_revoke_role_by_email", {
        _email: vals.email,
        _role: vals.role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role revoked");
      queryClient.invalidateQueries({ queryKey: ["role-assignments"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to revoke role"),
  });

  const statusMutation = useMutation({
    mutationFn: async (v: { userId: string; status: string }) => {
      const { error } = await supabase.rpc("root_set_admin_status" as any, { _user_id: v.userId, _status: v.status });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Account status updated"); queryClient.invalidateQueries({ queryKey: ["role-assignments"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const handleGrant = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = formSchema.safeParse({ email, role, city });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    grantMutation.mutate(parsed.data);
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="text-center text-muted-foreground">Loading…</div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="mb-4 text-muted-foreground">Please sign in to continue.</p>
          <Button onClick={() => navigate("/auth")}>Sign in</Button>
        </div>
      </Layout>
    );
  }

  if (!isMainAdmin) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="mb-2 text-2xl font-bold">Restricted</h1>
          <p className="text-muted-foreground">
            Only the Platform Super Admin can manage user roles.
          </p>
        </div>
      </Layout>
    );
  }

  const adminCount = assignments.filter((a) => a.role === "admin").length;
  const moderatorCount = assignments.filter((a) => a.role === "moderator").length;

  return (
    <Layout>
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3">
            <Users className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold sm:text-3xl">Manage Users & Roles</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Grant or revoke admin / moderator access by email.
          </p>
        </motion.div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Admins</div>
              <div className="text-2xl font-bold">{adminCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Moderators</div>
              <div className="text-2xl font-bold">{moderatorCount}</div>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total assignments</div>
              <div className="text-2xl font-bold">{assignments.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5" /> Grant a role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGrant} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="email">User email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter user email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                  required
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moderator">Officer</SelectItem>
                    <SelectItem value="admin">City Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>City scope (optional)</Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CITIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={grantMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {grantMutation.isPending ? "Granting…" : "Grant role"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current role assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : assignments.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No role assignments yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((a) => {
                      const isSelf =
                        false;
                      return (
                        <TableRow key={`${a.user_id}-${a.role}-${a.city ?? ""}`}>
                          <TableCell className="font-medium break-all">User {a.user_id.slice(0, 8)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={a.role === "admin" ? "default" : "secondary"}
                              className="capitalize"
                            >
                              {a.role === "admin" ? "City Admin" : a.role === "moderator" ? "Officer" : a.role === "field_worker" ? "Field Worker" : a.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {a.city ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={(a.status ?? "active") === "active" ? "secondary" : "destructive"} className="capitalize">
                              {a.status ?? "active"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-1 whitespace-nowrap">
                            {(a.role === "admin" || a.role === "moderator") && (
                              <Button size="sm" variant="ghost" disabled={statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ userId: a.user_id, status: (a.status ?? "active") === "active" ? "suspended" : "active" })}>
                                {(a.status ?? "active") === "active" ? "Suspend" : "Reactivate"}
                              </Button>
                            )}
                            {a.role === "user" ? null : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isSelf || revokeMutation.isPending}
                                onClick={() =>
                                  window.confirm(`Remove the ${a.role} role from this account? Their complaints stay intact.`) &&
                                  revokeMutation.mutate({
                                    email: a.email,
                                    role: a.role as "admin" | "moderator",
                                  })
                                }
                              >
                                <UserMinus className="mr-1 h-3.5 w-3.5" />
                                Revoke
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminUsers;
