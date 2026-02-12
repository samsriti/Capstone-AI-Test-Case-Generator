import React from 'react';
import { MdClose, MdWarning } from 'react-icons/md';

function ConfirmDialog({ 
  title = "Confirm Action", 
  message, 
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm, 
  onCancel,
  type = "danger" // danger, warning, info
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-header">
          <div className="confirm-icon-wrapper">
            <MdWarning size={24} className={`confirm-icon confirm-icon-${type}`} />
          </div>
          <button onClick={onCancel} className="modal-close-button">
            <MdClose size={24} />
          </button>
        </div>

        <div className="confirm-content">
          <h3>{title}</h3>
          <p>{message}</p>
        </div>

        <div className="confirm-actions">
          <button onClick={onCancel} className="confirm-cancel-button">
            {cancelText}
          </button>
          <button onClick={onConfirm} className={`confirm-button confirm-button-${type}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;