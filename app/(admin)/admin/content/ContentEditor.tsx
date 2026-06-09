'use client';

import { useState } from 'react';
import { updatePageContent } from './actions';

interface ContentEditorProps {
  id: string;
  label: string;
  contentKey: string;
  initialContent: string;
}

export default function ContentEditor({ id, label, contentKey, initialContent }: ContentEditorProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    setSaved(false);
    await updatePageContent(id, formData);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-[#1a1a1a]/80 border border-zinc-800/80 rounded-2xl p-5 space-y-3 hover:border-zinc-700 transition-all duration-300">
      <div>
        <h3 className="font-bold text-white text-sm">{label}</h3>
        <p className="text-zinc-500 text-xs mt-0.5 font-mono">{contentKey}</p>
      </div>
      <form action={handleSubmit}>
        <textarea
          name="content"
          defaultValue={initialContent}
          rows={4}
          className="w-full px-3 py-2 rounded-lg bg-[#111111] border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all resize-y font-sans leading-relaxed"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-ez-pink text-white rounded-lg font-bold text-xs hover:bg-ez-pink/80 transition-all duration-300 cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && (
            <span className="text-green-400 text-xs font-semibold">Saved!</span>
          )}
        </div>
      </form>
    </div>
  );
}
