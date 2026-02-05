import { useState, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Lightbulb, Bug, Loader2 } from 'lucide-react';

export default function Feedback() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');

  // Parse category from URL query param
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const urlCategory = params.get('category');
    if (urlCategory && ['idea', 'bug'].includes(urlCategory)) {
      setCategory(urlCategory);
    }
  }, [searchString]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!category || !description.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please select a category and provide a description.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          description: description.trim(),
          email: email.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Feedback Sent',
          description: 'Thank you for your feedback! We will review it shortly.',
        });
        setCategory('');
        setDescription('');
        setEmail('');
        setTimeout(() => setLocation('/'), 2000);
      } else {
        throw new Error(data.error || 'Failed to send feedback');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/')}
              className="text-slate-400 hover:text-white"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <CardTitle className="text-2xl text-white">Send Feedback</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            Have an idea or found a bug? Let us know and help improve OpenBento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="category" className="text-slate-300">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger 
                  id="category" 
                  className="bg-slate-700 border-slate-600 text-white"
                  data-testid="select-category"
                >
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="idea" className="text-white hover:bg-slate-600">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      New Idea
                    </div>
                  </SelectItem>
                  <SelectItem value="bug" className="text-white hover:bg-slate-600">
                    <div className="flex items-center gap-2">
                      <Bug className="w-4 h-4 text-red-400" />
                      Bug Report
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-slate-300">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your idea or the bug you found..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white min-h-[120px] resize-none"
                data-testid="input-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                Email <span className="text-slate-500">(optional)</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                data-testid="input-email"
              />
              <p className="text-xs text-slate-500">
                Provide your email if you would like us to follow up with you.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
              data-testid="button-submit-feedback"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Feedback
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
