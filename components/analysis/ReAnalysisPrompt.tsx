'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, RefreshCw, BookPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ReAnalysisPromptProps {
  analysis: any;
  onReAnalyze: (additionalContext: string) => void;
  onAddToPrecedents: (notes: string) => void;
  isReAnalyzing?: boolean;
  isAddingToPrecedents?: boolean;
}

export function ReAnalysisPrompt({
  analysis,
  onReAnalyze,
  onAddToPrecedents,
  isReAnalyzing = false,
  isAddingToPrecedents = false,
}: ReAnalysisPromptProps) {
  const [additionalContext, setAdditionalContext] = useState('');
  const [precedentNotes, setPrecedentNotes] = useState('');
  const [showAddToPrecedents, setShowAddToPrecedents] = useState(false);

  // Check if viability is low (0-30%)
  // The analysis object has 'successRate' field (e.g., 82)
  const viability = analysis?.successRate || 0;
  const isLowViability = viability <= 30;

  // Don't show if viability is good
  if (!isLowViability) {
    return null;
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50/50">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <CardTitle className="text-lg">Low Viability Detected</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                This complaint shows {viability}% viability. Consider providing additional context or adding this case to your precedent library.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
            {viability}% viable
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Re-analysis option */}
        <div className="space-y-2">
          <Label htmlFor="additional-context">
            Add Additional Context for Re-Analysis
          </Label>
          <Textarea
            id="additional-context"
            placeholder="Provide additional information that might strengthen the complaint:
            
- Specific dates or timelines not yet captured
- Additional HMRC correspondence or promises
- Client impact details (financial, health, business)
- Previous similar cases or patterns
- Specific Charter/CRG violations you've identified"
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            rows={6}
            disabled={isReAnalyzing}
          />
          <Button
            onClick={() => onReAnalyze(additionalContext)}
            disabled={!additionalContext.trim() || isReAnalyzing}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isReAnalyzing ? 'animate-spin' : ''}`} />
            {isReAnalyzing ? 'Re-Analyzing...' : 'Re-Analyze with Additional Context'}
          </Button>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-yellow-50 px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        {/* Add to precedents option */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="add-precedent"
              checked={showAddToPrecedents}
              onCheckedChange={(checked) => setShowAddToPrecedents(checked as boolean)}
            />
            <Label
              htmlFor="add-precedent"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              This is a novel complaint type - add to precedent library
            </Label>
          </div>

          {showAddToPrecedents && (
            <>
              <Textarea
                placeholder="Add notes about this precedent:
                
- Why is this complaint type unique?
- What makes it worth pursuing despite low initial viability?
- Key arguments or Charter violations to emphasize
- Similar cases you've handled successfully
- Recommended approach or strategy"
                value={precedentNotes}
                onChange={(e) => setPrecedentNotes(e.target.value)}
                rows={6}
                disabled={isAddingToPrecedents}
              />
              <Button
                onClick={() => onAddToPrecedents(precedentNotes)}
                disabled={!precedentNotes.trim() || isAddingToPrecedents}
                className="w-full"
                variant="secondary"
              >
                <BookPlus className="h-4 w-4 mr-2" />
                {isAddingToPrecedents ? 'Adding to Library...' : 'Add to Precedent Library'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Adding this to your precedent library will help the AI recognize similar cases in the future and improve viability assessments.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

