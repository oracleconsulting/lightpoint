'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getPracticeSettings, savePracticeSettings, type PracticeSettings } from '@/lib/practiceSettings';

export default function PracticeSettingsPage() {
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

