'use client';

import { trpc } from '@/lib/trpc/Provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Book } from 'lucide-react';
import { useState } from 'react';

export default function KnowledgePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const { data: allKnowledge } = trpc.knowledge.list.useQuery({});
  const searchMutation = trpc.knowledge.search.useMutation({
    onSuccess: (data) => {
      setSearchResults(data);
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate({ query: searchQuery, threshold: 0.7, limit: 10 });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">
            HMRC Charter, CRG Guidance & Precedents
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Search */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Input
                placeholder="Search knowledge base..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searchMutation.isPending}>
                <Search className="h-4 w-4 mr-2" />
                {searchMutation.isPending ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {searchResults.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Search Results</h2>
            <div className="space-y-4">
              {searchResults.map((item: any) => (
                <Card key={item.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                        <Badge variant="secondary" className="mt-2">
                          {item.category}
                        </Badge>
                      </div>
                      {item.similarity && (
                        <Badge>
                          {(item.similarity * 100).toFixed(0)}% match
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {item.content.substring(0, 300)}...
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* All Knowledge */}
        <div>
          <h2 className="text-xl font-semibold mb-4">All Documents</h2>
          {allKnowledge && allKnowledge.length > 0 ? (
            <div className="space-y-4">
              {allKnowledge.map((item: any) => (
                <Card key={item.id}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <Book className="h-5 w-5 text-muted-foreground mt-1" />
                      <div>
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                        <Badge variant="secondary" className="mt-2">
                          {item.category}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {item.content.substring(0, 200)}...
                    </p>
                    {item.source && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Source: {item.source}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No knowledge base entries yet. Add HMRC guidance and precedents to get started.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

