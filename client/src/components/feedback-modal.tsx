import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Send, Lightbulb, Bug, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
}

export default function FeedbackModal({ isOpen, onClose, userEmail }: FeedbackModalProps) {
  const { toast } = useToast();
  const [category, setCategory] = useState<'idea' | 'bug' | ''>('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState(userEmail || '');

  const submitMutation = useMutation({
    mutationFn: (data: { type: string; message: string; userEmail: string | null }) =>
      apiRequest('POST', '/api/feedback', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feedback'] });
      toast({
        title: 'Feedback Sent',
        description: 'Thank you for your feedback!',
      });
      setCategory('');
      setDescription('');
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send feedback.',
        variant: 'destructive',
      });
    },
  });

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!category || !description.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please select a category and provide a description.',
        variant: 'destructive',
      });
      return;
    }

    submitMutation.mutate({
      type: category,
      message: description.trim(),
      userEmail: email.trim() || null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="feedback-modal-overlay"
    >
      <div className="w-full max-w-md mx-4 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl" data-testid="feedback-modal">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white" data-testid="text-feedback-title">Send Feedback</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-400"
            data-testid="button-close-feedback"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2" data-testid="label-category">Category</label>
            <div className="flex gap-2">
              <Button
                variant={category === 'idea' ? 'default' : 'outline'}
                onClick={() => setCategory('idea')}
                className={`flex-1 ${category === 'idea' ? 'bg-blue-600 border-blue-500' : 'bg-slate-700 border-slate-600 text-slate-300'}`}
                data-testid="button-category-idea"
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                New Idea
              </Button>
              <Button
                variant={category === 'bug' ? 'default' : 'outline'}
                onClick={() => setCategory('bug')}
                className={`flex-1 ${category === 'bug' ? 'bg-red-600 border-red-500' : 'bg-slate-700 border-slate-600 text-slate-300'}`}
                data-testid="button-category-bug"
              >
                <Bug className="w-4 h-4 mr-2" />
                Bug Report
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2" data-testid="label-description">Description</label>
            <Textarea
              placeholder="Describe your idea or the bug you found..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white min-h-[100px] resize-none"
              data-testid="input-feedback-description"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2" data-testid="label-email">
              Email <span className="text-slate-500">(optional)</span>
            </label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
              data-testid="input-feedback-email"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending || !category || !description.trim()}
            className="w-full bg-cyan-600"
            data-testid="button-submit-feedback-modal"
          >
            {submitMutation.isPending ? (
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
        </div>
      </div>
    </div>
  );
}
