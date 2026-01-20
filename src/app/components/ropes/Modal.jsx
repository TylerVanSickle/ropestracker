"use client";

export default function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-top">
          <h2 className="section-title" style={{ margin: 0 }}>
            {title}
          </h2>
          <button className="button" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="spacer-sm">{children}</div>
      </div>
    </div>
  );
}
