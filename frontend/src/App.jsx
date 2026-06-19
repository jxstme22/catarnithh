import { useEffect, useState } from 'react';
import AsciiBackground from './components/AsciiBackground';
import './App.css';

function App() {
  const [art, setArt] = useState('');
  const [copied, setCopied] = useState(false);

  const cargo = 'click';
  const afterCargo =
    ' github below';

  useEffect(() => {
    fetch('/bg.txt')
      .then((res) => res.text())
      .then((text) => setArt(text))
      .catch(() => setArt(''));
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${cargo}${afterCargo}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 3200);
    } catch {
      // ignore
    }
  };

  return (
    <>
      {art && <AsciiBackground art={art} glitch={copied} />}
      <main className="landing landing--visible">
        <h1 className="title">ctarnith.</h1>
        <p className="tagline">
          a terminal trading for Pump.Fun's Mayhem mode.
        </p>

        <div className="install">
          <div
            className={`code ${copied ? 'code--copied' : ''}`}
            onClick={copy}
            role="button"
            tabIndex={0}
            aria-label="Copy install command"
          >
            <code>
              <span className="cargo">{cargo}</span>
              {afterCargo}
            </code>
            {copied ? (
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </div>
          <span className="hint">
            {copied
              ? 'Copied to clipboard'
              : 'Click to copy · Requires Rust + Helius API key'}
          </span>
        </div>

        <a
          className="github"
          href="https://github.com/YOUR_USERNAME/ctarnith"
          target="_blank"
          rel="noreferrer"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.84 1.236 1.84 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.42-1.305.763-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.31.465-2.381 1.235-3.221-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.911 1.23 3.221 0 4.609-2.807 5.624-5.48 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.293 0 .319.21.694.825.577C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
          GitHub
        </a>
      </main>
    </>
  );
}

export default App;
