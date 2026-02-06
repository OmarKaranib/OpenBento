import { useState } from 'react';
import { X, Bug, Lightbulb, Send, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
  initialType?: 'bug' | 'idea';
}

export function FeedbackModal({ 
  isOpen, 
  onClose, 
  userEmail,
  initialType = 'idea'
}: FeedbackModalProps) {
  const [type, setType] = useState<'bug' | 'idea'>(initialType);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: (data: { message: string; type: string; userEmail?: string | null }) =>
      apiRequest('POST', '/api/feedback', data),
    onSuccess: () => {
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setSubmitted(false);
        setMessage('');
      }, 2000);
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    submitMutation.mutate({
      message: message.trim(),
      type,
      userEmail,
    });
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">Send Feedback</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {submitted ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Thank you!</h3>
            <p className="text-slate-400">Your feedback has been submitted.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6">
            {/* Type Selector */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => setType('idea')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  type === 'idea'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <Lightbulb className="w-5 h-5" />
                <span className="font-medium">Idea</span>
              </button>
              <button
                type="button"
                onClick={() => setType('bug')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  type === 'bug'
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <Bug className="w-5 h-5" />
                <span className="font-medium">Bug</span>
              </button>
            </div>

            {/* Message Input */}
            <div className="mb-6">
              <label htmlFor="feedback-message" className="block text-sm font-medium text-slate-300 mb-2">
                {type === 'bug' ? 'Describe the bug' : 'Share your idea'}
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  type === 'bug'
                    ? 'What went wrong? What did you expect to happen?'
                    : 'What feature would you like to see?'
                }
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 min-h-[120px] resize-none"
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitMutation.isPending || !message.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Feedback
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
