import React from 'react';
import './ConfirmDialog.css';

const ConfirmDialog = ({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  onConfirm,
  onCancel,
  loading = false,
  variant = 'danger',
}) => {
  if (!open) return null;

  return (
    <div className="confirm-dialog-backdrop" onClick={onCancel} role="presentation">
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="confirm-dialog-title">{title}</h3>
        {message ? <p>{message}</p> : null}
        <div className="confirm-dialog__actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${variant === 'danger' ? 'confirm-dialog__confirm-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
