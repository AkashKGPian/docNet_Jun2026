import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const DepartmentManager = ({ departments, onChange }) => {
  const [newDept, setNewDept] = useState('');
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAdd = async (event) => {
    event.preventDefault();
    const name = newDept.trim();
    if (!name) return;

    try {
      setBusy(true);
      const res = await api.post('/auth/staff/departments', { name });
      setNewDept('');
      onChange?.(res.data.departments);
      toast.success(`Added "${name}"`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add department.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (name) => {
    if (!window.confirm(`Remove department "${name}"? Doctors must be reassigned first.`)) return;

    try {
      setBusy(true);
      const res = await api.delete(`/auth/staff/departments/${encodeURIComponent(name)}`);
      onChange?.(res.data.departments);
      toast.success('Department removed.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to remove department.');
    } finally {
      setBusy(false);
    }
  };

  const startRename = (name) => {
    setRenaming(name);
    setRenameValue(name);
  };

  const handleRename = async (event) => {
    event.preventDefault();
    const to = renameValue.trim();
    if (!renaming || !to || to === renaming) {
      setRenaming(null);
      return;
    }

    try {
      setBusy(true);
      const res = await api.patch('/auth/staff/departments', { oldName: renaming, newName: to });
      onChange?.(res.data.departments);
      toast.success('Department renamed.');
      setRenaming(null);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to rename department.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dept-manager card">
      <div className="dept-manager__header">
        <h3><Layers size={18} /> Departments</h3>
        <p>Add departments before assigning doctors. Renaming updates all linked doctors.</p>
      </div>

      <form className="dept-add-row" onSubmit={handleAdd}>
        <input
          value={newDept}
          onChange={(e) => setNewDept(e.target.value)}
          placeholder="e.g. Neurology"
          disabled={busy}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !newDept.trim()}>
          <Plus size={16} /> Add
        </button>
      </form>

      <ul className="dept-list">
        {departments.length === 0 ? (
          <li className="dept-list__empty">No departments yet — add one above.</li>
        ) : (
          departments.map((dept) => (
            <li key={dept} className="dept-list__item">
              {renaming === dept ? (
                <form className="dept-rename-form" onSubmit={handleRename}>
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="btn btn-primary btn-sm">Save</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRenaming(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span className="dept-chip">{dept}</span>
                  <div className="dept-list__actions">
                    <button type="button" className="icon-btn" onClick={() => startRename(dept)} title="Rename">
                      <Pencil size={15} />
                    </button>
                    <button type="button" className="icon-btn icon-btn--danger" onClick={() => handleRemove(dept)} title="Remove">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default DepartmentManager;
