'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc/Provider';
import { useUser } from '@/contexts/UserContext';
import { Users, UserPlus, Mail, Phone, Briefcase, Shield, Clock, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface UserFormData {
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'analyst' | 'viewer';
  job_title: string;
  phone: string;
}

export default function UsersPage() {
  const { currentUser, canManageUsers } = useUser();
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    full_name: '',
    role: 'analyst',
    job_title: '',
    phone: '',
  });

  const { data: users, isLoading, refetch } = trpc.users.list.useQuery();
  const createUser = trpc.users.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsAddingUser(false);
      setFormData({ email: '', full_name: '', role: 'analyst', job_title: '', phone: '' });
    },
  });
  const updateUser = trpc.users.update.useMutation({
    onSuccess: () => {
      refetch();
      setEditingUserId(null);
    },
  });
  const toggleUserStatus = trpc.users.toggleStatus.useMutation({
    onSuccess: () => refetch(),
  });

  if (!canManageUsers) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to manage users. Contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-700 border-red-300';
      case 'manager': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'analyst': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'viewer': return 'bg-gray-100 text-gray-700 border-gray-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="h-3 w-3" />;
      case 'manager': return <Briefcase className="h-3 w-3" />;
      default: return <Users className="h-3 w-3" />;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUserId) {
      updateUser.mutate({ id: editingUserId, ...formData });
    } else {
      createUser.mutate(formData);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage team members, roles, and permissions
          </p>
        </div>
        {!isAddingUser && (
          <Button onClick={() => setIsAddingUser(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      {/* Add/Edit User Form */}
      {(isAddingUser || editingUserId) && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              {editingUserId ? 'Edit User' : 'Add New User'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    placeholder="John Smith"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3" />
                          Viewer - Read only
                        </div>
                      </SelectItem>
                      <SelectItem value="analyst">
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3" />
                          Analyst - Handle complaints
                        </div>
                      </SelectItem>
                      <SelectItem value="manager">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-3 w-3" />
                          Manager - Oversight + users
                        </div>
                      </SelectItem>
                      {currentUser?.role === 'admin' && (
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="h-3 w-3" />
                            Admin - Full access
                          </div>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job_title">Job Title</Label>
                  <Input
                    id="job_title"
                    placeholder="Senior Analyst"
                    value={formData.job_title}
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+44 20 1234 5678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsAddingUser(false);
                    setEditingUserId(null);
                    setFormData({ email: '', full_name: '', role: 'analyst', job_title: '', phone: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createUser.isPending || updateUser.isPending}>
                  {createUser.isPending || updateUser.isPending ? 'Saving...' : editingUserId ? 'Update User' : 'Add User'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members ({users?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading users...</p>
          ) : users && users.length > 0 ? (
            <div className="space-y-2">
              {users.map((user: any) => (
                <div
                  key={user.id}
                  className="group flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  {/* User Info */}
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {user.full_name || user.email}
                        {!user.is_active && (
                          <Badge variant="outline" className="bg-gray-100 text-gray-500 text-xs">
                            Inactive
                          </Badge>
                        )}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </div>
                    </div>
                    <div>
                      <Badge variant="outline" className={`${getRoleBadgeColor(user.role)} flex items-center gap-1 w-fit`}>
                        {getRoleIcon(user.role)}
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </Badge>
                      {user.job_title && (
                        <p className="text-xs text-muted-foreground mt-1">{user.job_title}</p>
                      )}
                    </div>
                    <div>
                      {user.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {user.phone}
                        </div>
                      )}
                      {user.last_login && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          Last: {format(new Date(user.last_login), 'PP')}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>Created: {format(new Date(user.created_at), 'PP')}</p>
                      {user.updated_at && user.updated_at !== user.created_at && (
                        <p>Updated: {format(new Date(user.updated_at), 'PP')}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {user.id !== currentUser?.id && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingUserId(user.id);
                          setFormData({
                            email: user.email,
                            full_name: user.full_name || '',
                            role: user.role,
                            job_title: user.job_title || '',
                            phone: user.phone || '',
                          });
                        }}
                        title="Edit user"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleUserStatus.mutate(user.id)}
                        title={user.is_active ? 'Deactivate user' : 'Activate user'}
                        className={user.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                      >
                        {user.is_active ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              No users found. Add your first team member above.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

