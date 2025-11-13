'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building2, Save, AlertCircle, CheckCircle2, User, LogIn } from 'lucide-react';
import { getPracticeSettings, savePracticeSettings, type PracticeSettings } from '@/lib/practiceSettings';
import { useUser } from '@/contexts/UserContext';
import { trpc } from '@/lib/trpc/Provider';
import Link from 'next/link';

export default function PracticeSettingsPage() {
  const { currentUser, setCurrentUser } = useUser();
  const { data: users } = trpc.users.list.useQuery();
  
  const [settings, setSettings] = useState<PracticeSettings>({
    firmName: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      postcode: '',
    },
    contact: {
      phone: '',
      email: '',
    },
    chargeOutRate: 185, // London professional rate (£150-250 typical)
    defaultSignatory: '',
  });
  
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load existing settings
    const existing = getPracticeSettings();
    if (existing) {
      setSettings(existing);
    }
  }, []);

  const handleSave = () => {
    try {
      // Basic validation
      if (!settings.firmName || !settings.address.line1 || !settings.address.city || 
          !settings.address.postcode || !settings.contact.phone || !settings.contact.email) {
        setError('Please fill in all required fields');
        return;
      }

      savePracticeSettings(settings);
      setSaved(true);
      setError('');
      
      // Reset success message after 3 seconds
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    }
  };

  const handleLoginAs = (user: any) => {
    setCurrentUser({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      organization_id: user.organization_id,
      job_title: user.job_title,
      phone: user.phone,
      is_active: user.is_active,
    });
    setSaved(false);
    setError('');
    // Show success message
    const tempSaved = saved;
    setSaved(true);
    setTimeout(() => setSaved(tempSaved), 2000);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-700 border-red-300';
      case 'manager': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'analyst': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'viewer': return 'bg-gray-100 text-gray-700 border-gray-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Practice Settings</h1>
            <p className="text-muted-foreground">Configure your firm's details for complaint letters</p>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {saved && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-600">Settings saved successfully!</p>
          </div>
        )}

        {/* Current User & Login As */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Current User
                </CardTitle>
                <CardDescription>
                  Select which user account you're working as
                </CardDescription>
              </div>
              <Link href="/users">
                <Button variant="outline" size="sm">
                  <User className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentUser ? (
              <div className="p-4 bg-white border-2 border-blue-300 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{currentUser.full_name || currentUser.email}</p>
                    <p className="text-sm text-muted-foreground">{currentUser.email}</p>
                    {currentUser.job_title && (
                      <p className="text-sm text-muted-foreground mt-1">{currentUser.job_title}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={getRoleBadgeColor(currentUser.role)}>
                    {currentUser.role.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  No user selected. Please select a user below to continue.
                </p>
              </div>
            )}

            <div>
              <Label className="text-base font-semibold mb-3 block">Available Users:</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {users && users.length > 0 ? (
                  users.filter((u: any) => u.is_active).map((user: any) => (
                    <div
                      key={user.id}
                      className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                        currentUser?.id === user.id
                          ? 'bg-blue-100 border-blue-300'
                          : 'bg-white hover:bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{user.full_name || user.email}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        {user.job_title && (
                          <p className="text-xs text-muted-foreground">{user.job_title}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${getRoleBadgeColor(user.role)}`}>
                          {user.role}
                        </Badge>
                        {currentUser?.id !== user.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLoginAs(user)}
                          >
                            <LogIn className="h-3 w-3 mr-1" />
                            Switch
                          </Button>
                        )}
                        {currentUser?.id === user.id && (
                          <Badge variant="default" className="bg-green-600">
                            Active
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No users found. <Link href="/users" className="text-blue-600 hover:underline">Add users here</Link>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Firm Details</CardTitle>
            <CardDescription>
              These details will appear on all generated complaint letters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="firmName">Firm Name *</Label>
              <Input
                id="firmName"
                placeholder="e.g., Richardson & Associates Chartered Accountants"
                value={settings.firmName}
                onChange={(e) => setSettings({ ...settings, firmName: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="address1">Address Line 1 *</Label>
                <Input
                  id="address1"
                  placeholder="e.g., 45 Victoria Street"
                  value={settings.address.line1}
                  onChange={(e) => setSettings({
                    ...settings,
                    address: { ...settings.address, line1: e.target.value }
                  })}
                  className="mt-1.5"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="address2">Address Line 2 (Optional)</Label>
                <Input
                  id="address2"
                  placeholder="e.g., Westminster"
                  value={settings.address.line2 || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    address: { ...settings.address, line2: e.target.value }
                  })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  placeholder="e.g., London"
                  value={settings.address.city}
                  onChange={(e) => setSettings({
                    ...settings,
                    address: { ...settings.address, city: e.target.value }
                  })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="postcode">Postcode *</Label>
                <Input
                  id="postcode"
                  placeholder="e.g., SW1H 0EU"
                  value={settings.address.postcode}
                  onChange={(e) => setSettings({
                    ...settings,
                    address: { ...settings.address, postcode: e.target.value }
                  })}
                  className="mt-1.5"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Details</CardTitle>
            <CardDescription>
              How HMRC should contact your firm
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g., 020 7946 0832"
                value={settings.contact.phone}
                onChange={(e) => setSettings({
                  ...settings,
                  contact: { ...settings.contact, phone: e.target.value }
                })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="e.g., complaints@yourfirm.co.uk"
                value={settings.contact.email}
                onChange={(e) => setSettings({
                  ...settings,
                  contact: { ...settings.contact, email: e.target.value }
                })}
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Professional Fees</CardTitle>
            <CardDescription>
              Used for calculating costs in complaint letters (CRG5225)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="chargeOutRate">Charge-Out Rate (£/hour)</Label>
              <Input
                id="chargeOutRate"
                type="number"
                placeholder="e.g., 185"
                value={settings.chargeOutRate || ''}
                onChange={(e) => setSettings({
                  ...settings,
                  chargeOutRate: parseInt(e.target.value) || undefined
                })}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Standard professional hourly rate for fee recovery (London typical: £150-250)
              </p>
            </div>

            <div>
              <Label htmlFor="signatory">Default Signatory (Optional)</Label>
              <Input
                id="signatory"
                placeholder="e.g., John Smith, Managing Partner"
                value={settings.defaultSignatory || ''}
                onChange={(e) => setSettings({
                  ...settings,
                  defaultSignatory: e.target.value
                })}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Who signs the letters (leave blank to use firm name)
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button onClick={handleSave} size="lg" className="gap-2">
            <Save className="h-4 w-4" />
            Save Settings
          </Button>
        </div>

        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm font-mono whitespace-pre-wrap">
{settings.firmName || '[Your Firm Name]'}

{settings.address.line1 || '[Address Line 1]'}
{settings.address.line2 && `${settings.address.line2}\n`}{settings.address.city || '[City]'}
{settings.address.postcode || '[Postcode]'}
Tel: {settings.contact.phone || '[Phone]'}
Email: {settings.contact.email || '[Email]'}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

