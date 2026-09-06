import React, { useEffect, useState } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SectionHeader } from '../ui/PageHeader';
import { useToast } from '../../context/ToastContext';
import { clearUserOpenRouterKey, getAiConfiguration, hydrateUserOpenRouterKey, saveUserOpenRouterKey } from '../../services/aiConfigService';

export const AiConfigurationSection: React.FC = () => {
  const { addToast } = useToast();
  const [key, setKey] = useState('');
  const [hasUserKey, setHasUserKey] = useState(false);
  const [hasUniversalKey, setHasUniversalKey] = useState(false);
  const refresh = () => { const config = getAiConfiguration(); setHasUserKey(config.hasUserKey); setHasUniversalKey(config.hasUniversalKey); };
  useEffect(() => { void hydrateUserOpenRouterKey().finally(refresh); }, []);
  const handleSave = async () => { try { await saveUserOpenRouterKey(key); setKey(''); await hydrateUserOpenRouterKey(); refresh(); addToast({ title: 'AI Key Saved', description: hasUniversalKey ? 'Universal AI mode remains active.' : 'Your OpenRouter key is ready for AI requests.', type: 'success' }); } catch { addToast({ title: 'Invalid AI Key', description: 'The key could not be persisted.', type: 'error' }); } };
  const handleClear = async () => { await clearUserOpenRouterKey(); setKey(''); refresh(); addToast({ title: 'AI Key Removed', description: 'The locally saved user key was removed.', type: 'info' }); };
  return <div>
    <SectionHeader title="AI Configuration" />
    <Card padding="md" className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><KeyRound className="w-4 h-4" /><span>{hasUniversalKey ? 'Universal AI active' : hasUserKey ? 'Your OpenRouter key active' : 'AI key required'}</span></div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{hasUniversalKey ? 'This prototype build uses its configured universal key. Your personal key is only a fallback.' : 'Add your OpenRouter API key locally to enable direct AI requests without Cloud Run.'}</p>
      <Input label="OpenRouter API Key" type="password" autoComplete="off" placeholder={hasUserKey ? 'Saved securely on this device' : 'sk-or-v1-...'} value={key} onChange={(event) => setKey(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void handleSave(); } }} />
      <div className="flex gap-2"><Button type="button" variant="primary" size="sm" onClick={handleSave} disabled={!key.trim()}>Save Key</Button><Button type="button" variant="outline" size="sm" onClick={handleClear} disabled={!hasUserKey} leftIcon={<Trash2 className="w-3.5 h-3.5" />}>Remove Key</Button></div>
      <p className="text-[11px] text-amber-700 dark:text-amber-300">Prototype note: a direct universal key is extractable from an APK. Keys are never logged or sent to Firebase.</p>
    </Card>
  </div>;
};
