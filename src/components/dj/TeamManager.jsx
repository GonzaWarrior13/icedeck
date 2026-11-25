import { userFacingError } from '@/lib/userFacingError';
import React, { useCallback, useEffect, useState } from 'react';
import { createTeam, getTeamMembers, getMyNickname, manageTeamMember, removeTeamMember, setMyNickname, transferTeamOwnership } from '@/api/supabaseClient';

// Team membership mutations are authorized by Supabase SECURITY DEFINER
// functions, not by role names in the browser.
export default function TeamManager({ team, user, onTeamsChanged }) {
  const canManage = ['owner', 'admin'].includes(team?.role);
  const isOwner = team?.role === 'owner';
  const [nickname, setNickname] = useState('');
  const [newTeam, setNewTeam] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('dj');
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const loadMembers = useCallback(async () => {
    if (canManage && team?.id) setMembers(await getTeamMembers(team.id));
    else setMembers([]);
  }, [canManage, team?.id]);
  useEffect(() => {
    let active = true;
    getMyNickname().then(name => { if (active) setNickname(typeof name === 'string' ? name : ''); }).catch(() => {});
    loadMembers().catch(err => { if (active) setError(userFacingError(err, 'Couldn’t load team members. Refresh the page to try again.')); });
    return () => { active = false; };
  }, [loadMembers, user?.id]);

  const run = async (action, success, failure, reload = false) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await action();
      if (reload) await loadMembers();
      await onTeamsChanged?.();
      setNotice(success);
      return true;
    } catch (err) { setError(userFacingError(err, failure)); return false; }
    finally { setBusy(false); }
  };
  return (
    <section className="border-t border-border pt-8 space-y-5">
      <div>
        <p className="section-label">Manage teams</p>
        <p className="text-sm text-muted-foreground mt-1">
          To add a teammate, use the email on their DropDeck account.
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
      <form onSubmit={e => {
        e.preventDefault();
        run(() => setMyNickname(nickname), 'Display name saved.', 'Couldn’t save your display name. Try again.');
      }} className="space-y-2">
        <label className="block text-sm font-medium">Display name</label>
        <div className="flex gap-2">
          <input className="min-w-0 flex-1 rounded border border-border bg-background p-2" value={nickname} maxLength={80} onChange={e => setNickname(e.target.value)} placeholder="Your display name" />
          <button disabled={busy} className="rounded border border-border px-3 py-2 disabled:opacity-50">Save</button>
        </div>
      </form>
      <form onSubmit={e => {
        e.preventDefault();
        run(() => createTeam(newTeam.trim()), 'Team created. Choose Switch team to open it.', 'Couldn’t create the team. Check the name and try again.')
          .then(ok => { if (ok) setNewTeam(''); });
      }} className="space-y-2">
        <label className="block text-sm font-medium">New team</label>
        <div className="flex gap-2">
          <input required minLength={1} maxLength={120} className="min-w-0 flex-1 rounded border border-border bg-background p-2" value={newTeam} onChange={e => setNewTeam(e.target.value)} placeholder="New team name" />
          <button disabled={busy || !newTeam.trim()} className="rounded bg-primary text-primary-foreground px-3 py-2 disabled:opacity-50">Create</button>
        </div>
      </form>
      {canManage && <>
        <div className="space-y-2">
          <p className="section-label">Members of {team.name}</p>
          {members.map(member => (
            <div key={member.user_id} className="flex flex-wrap items-center gap-2 rounded border border-border p-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{member.nickname || member.email}</p>
                <p className="text-xs text-muted-foreground truncate">{member.email}</p>
              </div>
              <span className="text-xs capitalize">{member.role}</span>
              {member.user_id !== user?.id && member.role !== 'owner' && (isOwner || member.role !== 'admin') && (
                <button type="button" disabled={busy}
                  onClick={() => { if (window.confirm('Remove this member from the team? They’ll lose access to its library and setlists.')) run(() => removeTeamMember(member.user_id), 'Member removed.', 'Couldn’t remove this member. Refresh the page and try again.', true); }}
                  className="rounded border border-destructive/50 px-2 py-1 text-destructive disabled:opacity-50">Remove</button>
              )}
              {isOwner && member.user_id !== user?.id && (
                <button type="button" disabled={busy}
                  onClick={() => { if (window.confirm('Transfer ownership to ' + member.email + '? You will become an admin.')) run(() => transferTeamOwnership(member.user_id), 'Ownership transferred.', 'Couldn’t transfer ownership. Check that this person is still a team member.', true); }}
                  className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50">Make owner</button>
              )}
            </div>
          ))}
        </div>
        <form className="space-y-2" onSubmit={e => {
          e.preventDefault();
          run(() => manageTeamMember(email.trim(), role), 'Team access saved.', 'Couldn’t save team access. Check that the email belongs to an existing account.', true).then(ok => { if (ok) setEmail(''); });
        }}>
          <label className="block text-sm font-medium">Add a member or change their role</label>
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Teammate’s account email"
            className="w-full rounded border border-border bg-background p-2" />
          <div className="flex gap-2">
            <select value={role} onChange={e => setRole(e.target.value)}
              className="min-w-0 flex-1 rounded border border-border bg-background p-2">
              {isOwner && <option value="admin">Admin</option>}
              <option value="dj">DJ</option>
              <option value="viewer">Viewer</option>
            </select>
            <button disabled={busy} className="rounded bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50">Save member</button>
          </div>
        </form>
      </>}
    </section>
  );
}
