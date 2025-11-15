'use client';

import { useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { trpc } from '@/lib/trpc/Provider';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  Settings, 
  FileText, 
  History, 
  RotateCcw, 
  Save,
  AlertCircle,
  Eye,
  Edit,
  CheckCircle,
  Info
} from 'lucide-react';
import Link from 'next/link';

interface Prompt {
  id: string;
  prompt_key: string;
  prompt_name: string;
  prompt_category: string;
  system_prompt: string;
  user_prompt_template: string | null;
  default_system_prompt: string;
  default_user_prompt_template: string | null;
  model_name: string;
  temperature: number;
  max_tokens: number;
  description: string | null;
  is_custom: boolean;
  version: number;
  last_modified_at: string;
}

export default function AISettingsPage() {
  const { currentUser, isAdmin } = useUser();
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedSystemPrompt, setEditedSystemPrompt] = useState('');
  const [editedUserPrompt, setEditedUserPrompt] = useState('');
  const [editedTemperature, setEditedTemperature] = useState(0.7);
  const [editedMaxTokens, setEditedMaxTokens] = useState(4000);

  // Check permissions
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Only administrators can access AI Settings.
            </p>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full">
                Return to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: prompts, isLoading, refetch } = trpc.aiSettings.listPrompts.useQuery();
  const updatePrompt = trpc.aiSettings.updatePrompt.useMutation({
    onSuccess: () => {
      refetch();
      setEditMode(false);
      alert('Prompt updated successfully!');
    },
  });

  const resetPrompt = trpc.aiSettings.resetPrompt.useMutation({
    onSuccess: () => {
      refetch();
      setSelectedPrompt(null);
      alert('Prompt reset to default!');
    },
  });

  const handleEdit = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setEditedSystemPrompt(prompt.system_prompt);
    setEditedUserPrompt(prompt.user_prompt_template || '');
    setEditedTemperature(prompt.temperature);
    setEditedMaxTokens(prompt.max_tokens);
    setEditMode(true);
  };

  const handleSave = () => {
    if (!selectedPrompt) return;

    updatePrompt.mutate({
      promptId: selectedPrompt.id,
      systemPrompt: editedSystemPrompt,
      userPromptTemplate: editedUserPrompt || null,
      temperature: editedTemperature,
      maxTokens: editedMaxTokens,
    });
  };

  const handleReset = (promptId: string) => {
    if (confirm('Reset this prompt to default? Your custom changes will be lost.')) {
      resetPrompt.mutate({ promptId });
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'analysis': return 'bg-blue-100 text-blue-800';
      case 'letter_generation': return 'bg-green-100 text-green-800';
      case 'knowledge_comparison': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Settings className="h-6 w-6 text-blue-600" />
                AI Settings
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                View and customize AI prompts used throughout Lightpoint
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard">
                <Button variant="outline">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left: Prompt List */}
          <div className="xl:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Prompts</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading prompts...
                  </div>
                ) : prompts && prompts.length > 0 ? (
                  <div className="space-y-2">
                    {prompts.map((prompt: Prompt) => (
                      <div
                        key={prompt.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedPrompt?.id === prompt.id
                            ? 'bg-blue-50 border-blue-300'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => {
                          setSelectedPrompt(prompt);
                          setEditMode(false);
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium text-sm">{prompt.prompt_name}</h3>
                          {prompt.is_custom && (
                            <Badge variant="outline" className="text-xs">
                              Custom
                            </Badge>
                          )}
                        </div>
                        <Badge className={`text-xs ${getCategoryColor(prompt.prompt_category)}`}>
                          {prompt.prompt_category.replace('_', ' ')}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-2">
                          v{prompt.version} • {prompt.model_name.split('/')[1]}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                    <p className="text-sm">No prompts found</p>
                    <p className="text-xs mt-1">Run SETUP_AI_PROMPT_MANAGEMENT.sql</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CHG Strategy Info */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  CHG Strategy
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p className="text-muted-foreground">
                  Now that you have the <strong>Complaint Handling Guidance (CHG)</strong> in your knowledge base:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                  <li>Hold HMRC to their own standards</li>
                  <li>Reference specific CHG sections they violated</li>
                  <li>Show what they SHOULD have done</li>
                  <li>Increase accountability and success rate</li>
                </ul>
                <p className="text-xs text-blue-600 font-medium mt-3">
                  ✓ Analysis and letter prompts already updated to leverage CHG
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right: Prompt Detail/Editor */}
          <div className="xl:col-span-2">
            {selectedPrompt ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedPrompt.prompt_name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedPrompt.description || 'No description available'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!editMode && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(selectedPrompt)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          {selectedPrompt.is_custom && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReset(selectedPrompt.id)}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reset
                            </Button>
                          )}
                        </>
                      )}
                      {editMode && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditMode(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={updatePrompt.isLoading}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="system" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="system">System Prompt</TabsTrigger>
                      <TabsTrigger value="user">User Prompt</TabsTrigger>
                      <TabsTrigger value="config">Configuration</TabsTrigger>
                    </TabsList>

                    {/* System Prompt Tab */}
                    <TabsContent value="system" className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          System Prompt
                          {!editMode && selectedPrompt.is_custom && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Modified from default
                            </Badge>
                          )}
                        </label>
                        {editMode ? (
                          <Textarea
                            value={editedSystemPrompt}
                            onChange={(e) => setEditedSystemPrompt(e.target.value)}
                            rows={20}
                            className="font-mono text-sm"
                          />
                        ) : (
                          <div className="p-4 bg-muted rounded-lg font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                            {selectedPrompt.system_prompt}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* User Prompt Tab */}
                    <TabsContent value="user" className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          User Prompt Template
                          <span className="text-muted-foreground font-normal ml-2">
                            (Use {'{placeholders}'} for variables)
                          </span>
                        </label>
                        {editMode ? (
                          <Textarea
                            value={editedUserPrompt}
                            onChange={(e) => setEditedUserPrompt(e.target.value)}
                            rows={15}
                            className="font-mono text-sm"
                            placeholder="Optional: Template for user prompt with {variables}"
                          />
                        ) : (
                          <div className="p-4 bg-muted rounded-lg font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                            {selectedPrompt.user_prompt_template || '(No user prompt template)'}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* Configuration Tab */}
                    <TabsContent value="config" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Model</label>
                          <Input
                            value={selectedPrompt.model_name}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Version</label>
                          <Input
                            value={`v${selectedPrompt.version}`}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Temperature (0-1)
                          </label>
                          {editMode ? (
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="1"
                              value={editedTemperature}
                              onChange={(e) => setEditedTemperature(parseFloat(e.target.value))}
                            />
                          ) : (
                            <Input
                              value={selectedPrompt.temperature}
                              disabled
                              className="bg-muted"
                            />
                          )}
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Max Tokens</label>
                          {editMode ? (
                            <Input
                              type="number"
                              step="100"
                              min="100"
                              max="10000"
                              value={editedMaxTokens}
                              onChange={(e) => setEditedMaxTokens(parseInt(e.target.value))}
                            />
                          ) : (
                            <Input
                              value={selectedPrompt.max_tokens}
                              disabled
                              className="bg-muted"
                            />
                          )}
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <h3 className="text-sm font-medium mb-3">Prompt Information</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Category:</span>
                            <Badge className={getCategoryColor(selectedPrompt.prompt_category)}>
                              {selectedPrompt.prompt_category.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <span className="font-medium">
                              {selectedPrompt.is_custom ? 'Custom' : 'Default'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Last Modified:</span>
                            <span className="font-medium">
                              {new Date(selectedPrompt.last_modified_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Select a prompt from the list to view and edit
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

