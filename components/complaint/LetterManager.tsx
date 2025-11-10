'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/Provider';
import { Save, Lock, Send, FileText, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { FormattedLetter } from './FormattedLetter';

interface LetterManagerProps {
  complaintId: string;
  generatedLetter?: string;
  clientReference?: string;
  onLetterSaved?: () => void;
}

export function LetterManager({ complaintId, generatedLetter, clientReference, onLetterSaved }: LetterManagerProps) {
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<any>(null);
  const [sendForm, setSendForm] = useState({
    sentBy: '',
    sentMethod: 'post' as 'post' | 'email' | 'post_and_email' | 'fax',
    hmrcReference: '',
    notes: '',
  });

  const { data: savedLetters, refetch: refetchLetters } = trpc.letters.list.useQuery({ complaintId });
  
  const saveLetter = trpc.letters.save.useMutation({
    onSuccess: () => {
      refetchLetters();
      onLetterSaved?.();
      alert('Letter saved successfully!');
    },
  });

  const lockLetter = trpc.letters.lock.useMutation({
    onSuccess: () => {
      refetchLetters();
      alert('Letter locked! Ready to send.');
    },
  });

  const markAsSent = trpc.letters.markAsSent.useMutation({
    onSuccess: () => {
      refetchLetters();
      setShowSendDialog(false);
      alert('Letter marked as sent and added to timeline!');
    },
  });

  const handleSaveLetter = () => {
    if (!generatedLetter) return;
    
    saveLetter.mutate({
      complaintId,
      letterType: 'initial_complaint',
      letterContent: generatedLetter,
      notes: 'Auto-saved from generator',
    });
  };

  const handleLockLetter = (letterId: string) => {
    if (confirm('Lock this letter? Once locked, it cannot be regenerated.')) {
      lockLetter.mutate({ letterId });
    }
  };

  const handleSendLetter = (letter: any) => {
    setSelectedLetter(letter);
    setShowSendDialog(true);
  };

  const handleConfirmSent = () => {
    if (!selectedLetter || !sendForm.sentBy) {
      alert('Please fill in who sent the letter');
      return;
    }

    markAsSent.mutate({
      letterId: selectedLetter.id,
      ...sendForm,
    });
  };

  return (
    <div className="space-y-6">
      {/* Display current generated letter with formatting */}
      {generatedLetter && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Current Generated Letter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-900">Not saved yet</p>
                <p className="text-yellow-700">This letter will be lost if you refresh the page. Save it to keep it permanently.</p>
              </div>
            </div>

            <FormattedLetter 
              content={generatedLetter} 
              clientReference={clientReference || complaintId}
            />

            <Button onClick={handleSaveLetter} disabled={saveLetter.isLoading} className="gap-2 w-full">
              <Save className="h-4 w-4" />
              Save Letter to Database
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Saved letters list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Saved Letters ({savedLetters?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!savedLetters || savedLetters.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No saved letters yet. Generate and save a letter to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {savedLetters.map((letter: any) => (
                <div
                  key={letter.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {letter.letter_type.replace('_', ' ').toUpperCase()}
                        </span>
                        {letter.locked_at && (
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="h-3 w-3" />
                            Locked
                          </Badge>
                        )}
                        {letter.sent_at && (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Sent
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Generated: {format(new Date(letter.created_at), 'dd MMM yyyy HH:mm')}
                      </p>
                      {letter.sent_at && (
                        <>
                          <p className="text-sm">
                            <strong>Sent:</strong> {format(new Date(letter.sent_at), 'dd MMM yyyy')} via {letter.sent_method}
                          </p>
                          {letter.sent_by && (
                            <p className="text-sm">
                              <strong>Sent by:</strong> {letter.sent_by}
                            </p>
                          )}
                          {letter.hmrc_reference && (
                            <p className="text-sm">
                              <strong>HMRC Ref:</strong> {letter.hmrc_reference}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!letter.locked_at && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLockLetter(letter.id)}
                          className="gap-1"
                        >
                          <Lock className="h-3 w-3" />
                          Lock
                        </Button>
                      )}
                      {letter.locked_at && !letter.sent_at && (
                        <Button
                          size="sm"
                          onClick={() => handleSendLetter(letter)}
                          className="gap-1"
                        >
                          <Send className="h-3 w-3" />
                          Mark as Sent
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Letter preview (collapsed) */}
                  <details className="text-sm">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                      View letter content
                    </summary>
                    <div className="mt-3">
                      <FormattedLetter 
                        content={letter.letter_content} 
                        clientReference={clientReference || complaintId}
                      />
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send dialog */}
      {showSendDialog && selectedLetter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Mark Letter as Sent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sentBy">Sent by (name) *</Label>
                <Input
                  id="sentBy"
                  placeholder="e.g., James Howard"
                  value={sendForm.sentBy}
                  onChange={(e) => setSendForm({ ...sendForm, sentBy: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="sentMethod">Send method *</Label>
                <select
                  id="sentMethod"
                  value={sendForm.sentMethod}
                  onChange={(e) => setSendForm({ ...sendForm, sentMethod: e.target.value as any })}
                  className="w-full mt-1.5 rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="post">Post</option>
                  <option value="email">Email</option>
                  <option value="post_and_email">Post and Email</option>
                  <option value="fax">Fax</option>
                </select>
              </div>

              <div>
                <Label htmlFor="hmrcRef">HMRC Reference (optional)</Label>
                <Input
                  id="hmrcRef"
                  placeholder="e.g., Tracking number or receipt"
                  value={sendForm.hmrcReference}
                  onChange={(e) => setSendForm({ ...sendForm, hmrcReference: e.target.value })}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes..."
                  value={sendForm.notes}
                  onChange={(e) => setSendForm({ ...sendForm, notes: e.target.value })}
                  className="mt-1.5"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowSendDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmSent}
                  disabled={markAsSent.isLoading}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm Sent
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

