"use client";

export default function QuickQuote({
  quoteSizeInput,
  setQuoteSizeInput,
  quoteResult,
}) {
  return (
    <div className="card spacer-md">
      <div className="quote-row">
        <div>
          <h2 className="section-title">Quick wait quote</h2>
          <p className="muted helper">
            If a guest asks “what’s the wait for 5?”, type 5.
          </p>
        </div>

        <div className="quote-controls">
          <label className="field" style={{ margin: 0 }}>
            <span className="field-label">Party size</span>
            <input
              className="input"
              inputMode="numeric"
              value={quoteSizeInput}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") return setQuoteSizeInput("");
                if (!/^\d+$/.test(v)) return;
                setQuoteSizeInput(v);
              }}
              onBlur={() => {
                const n = Number(quoteSizeInput);
                if (!Number.isFinite(n) || n < 1) setQuoteSizeInput("1");
              }}
            />
          </label>
        </div>
      </div>

      <div className="estimate-row spacer-sm">
        <div>
          <span className="muted">Quoted wait:</span>{" "}
          <strong>{quoteResult.range}</strong>
        </div>
        <div>
          <span className="muted">Estimated start:</span>{" "}
          <strong>{quoteResult.estStartText}</strong>
        </div>
      </div>
    </div>
  );
}
