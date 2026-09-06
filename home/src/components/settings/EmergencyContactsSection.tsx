/**
 * GOATEST Emergency Contacts Management Section
 * PMT-6 Part 4: CRUD up to 5 emergency contacts under user UID.
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../../context/ToastContext';
import { userService } from '../../services/userService';
import type { EmergencyContact } from '../../types';
import {
  Phone,
  UserPlus,
  Trash2,
  Star,
  ShieldAlert,
  Edit2,
  CheckCircle2,
  Users,
} from 'lucide-react';

export interface EmergencyContactsSectionProps {
  userId: string;
}

const RELATIONSHIPS = [
  'Spouse',
  'Parent',
  'Child',
  'Doctor',
  'Caretaker',
  'Friend',
  'Other',
];

export const EmergencyContactsSection: React.FC<EmergencyContactsSectionProps> = ({ userId }) => {
  const { addToast } = useToast();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [relationship, setRelationship] = useState<string>('Spouse');
  const [isPrimary, setIsPrimary] = useState<boolean>(false);
  const [notifyOnAlert, setNotifyOnAlert] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const loadContacts = async () => {
    if (!userId) return;
    try {
      const data = await userService.getEmergencyContacts(userId);
      setContacts(data);
    } catch (err) {
      console.warn('[EmergencyContacts] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [userId]);

  const handleOpenAdd = () => {
    if (contacts.length >= 5) {
      addToast({
        title: 'Limit Reached',
        description: 'Maximum of 5 emergency contacts allowed.',
        type: 'warning',
      });
      return;
    }
    setEditingId(null);
    setName('');
    setPhone('');
    setRelationship('Spouse');
    setIsPrimary(contacts.length === 0);
    setNotifyOnAlert(true);
    setNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (contact: EmergencyContact) => {
    setEditingId(contact.id);
    setName(contact.name);
    setPhone(contact.phone);
    setRelationship(contact.relationship || 'Other');
    setIsPrimary(!!contact.isPrimary);
    setNotifyOnAlert(contact.notifyOnAlert !== false);
    setNotes(contact.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !phone.trim()) {
      setFormError('Please provide both a contact name and phone number.');
      return;
    }

    setIsSaving(true);
    try {
      await userService.saveEmergencyContact(userId, {
        id: editingId || undefined,
        name: name.trim(),
        phone: phone.trim(),
        relationship,
        isPrimary,
        notifyOnAlert,
        notes: notes.trim(),
      });

      await loadContacts();
      setIsModalOpen(false);
      addToast({
        title: editingId ? 'Contact Updated' : 'Contact Added',
        description: `${name.trim()} saved as emergency contact.`,
        type: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save contact.';
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteContact = async (contact: EmergencyContact) => {
    try {
      await userService.deleteEmergencyContact(userId, contact.id);
      await loadContacts();
      addToast({
        title: 'Contact Removed',
        description: `${contact.name} was removed from emergency contacts.`,
        type: 'info',
      });
    } catch {
      addToast({
        title: 'Error',
        description: 'Could not delete emergency contact.',
        type: 'error',
      });
    }
  };

  const handleSetPrimary = async (contact: EmergencyContact) => {
    try {
      await userService.setPrimaryEmergencyContact(userId, contact.id);
      await loadContacts();
      addToast({
        title: 'Primary Contact Set',
        description: `${contact.name} set as primary contact.`,
        type: 'success',
      });
    } catch {
      addToast({
        title: 'Error',
        description: 'Could not update primary contact.',
        type: 'error',
      });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[var(--color-emergency)]" />
          <span className="text-xs font-bold text-white uppercase tracking-wide">
            Emergency Contacts ({contacts.length}/5)
          </span>
        </div>
        {contacts.length < 5 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenAdd}
            leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            className="text-xs !bg-white hover:!bg-white/90"
          >
            Add Contact
          </Button>
        )}
      </div>

      <Card padding="md" className="flex flex-col gap-3">
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Emergency contacts are notified when an emergency alert is triggered. All records remain privately isolated under your user account.
        </p>

        {isLoading ? (
          <div className="py-4 text-center text-xs text-slate-400">Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <div className="py-6 text-center flex flex-col items-center justify-center gap-2 text-slate-400 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
            <Users className="w-6 h-6 opacity-30" />
            <p className="text-xs">No emergency contacts added yet.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenAdd}
              className="text-xs mt-1"
            >
              Add First Contact
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between gap-3 text-left"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                        {contact.name}
                      </span>
                      {contact.isPrimary && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                          PRIMARY
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">
                      <span className="font-mono">{contact.phone}</span>
                      <span>·</span>
                      <span>{contact.relationship}</span>
                    </div>
                    {contact.notifyOnAlert && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Auto-notify enabled
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!contact.isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(contact)}
                      title="Set as primary"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(contact)}
                    title="Edit contact"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteContact(contact)}
                    title="Delete contact"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add / Edit Contact Dialog */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
        description="Emergency contacts are notified in critical events."
      >
        <form onSubmit={handleSaveContact} className="flex flex-col gap-3 py-2 text-left">
          <Input
            label="Contact Full Name"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Phone Number"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Relationship
            </label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              {RELATIONSHIPS.map((rel) => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--color-accent)]"
              />
              <span>Set as Primary Contact</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={notifyOnAlert}
                onChange={(e) => setNotifyOnAlert(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--color-accent)]"
              />
              <span>Transmit automatic alert during emergency</span>
            </label>
          </div>

          {formError && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : editingId ? 'Update Contact' : 'Save Contact'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
