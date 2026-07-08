'use client';

/**
 * Hand-built isometric cardboard box — the centerpiece of the drop stage.
 * `open` swaps the sealed cube for one with its flaps spread and a dark interior.
 */
export default function BoxArt({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 200 176" role="img" aria-label={open ? 'Opened box' : 'Sealed box'}>
      <defs>
        <linearGradient id="cbTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6ddb2" />
          <stop offset="1" stopColor="#e7c088" />
        </linearGradient>
        <linearGradient id="cbLeft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9a866" />
          <stop offset="1" stopColor="#bd8c4c" />
        </linearGradient>
        <linearGradient id="cbRight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c8924f" />
          <stop offset="1" stopColor="#a9773a" />
        </linearGradient>
        <linearGradient id="cbFlap" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2d6a6" />
          <stop offset="1" stopColor="#dcb47e" />
        </linearGradient>
        <clipPath id="topClip">
          <path d="M100 26 L174 66 L100 106 L26 66 Z" />
        </clipPath>
      </defs>

      {!open ? (
        <g>
          {/* faces */}
          <path d="M26 66 L100 106 L100 168 L26 128 Z" fill="url(#cbLeft)" />
          <path d="M100 106 L174 66 L174 128 L100 168 Z" fill="url(#cbRight)" />
          <path d="M100 26 L174 66 L100 106 L26 66 Z" fill="url(#cbTop)" />
          {/* front seam */}
          <path d="M100 106 L100 168" stroke="rgba(0,0,0,.16)" strokeWidth="2.5" />
          {/* packing tape cross on the lid */}
          <g clipPath="url(#topClip)">
            <rect x="90" y="20" width="20" height="94" fill="#f7e9c9" opacity=".85" />
            <rect x="20" y="58" width="160" height="16" fill="#f7e9c9" opacity=".7" />
          </g>
          {/* tape running down the front seam */}
          <rect x="93" y="106" width="14" height="62" fill="#f7e9c9" opacity=".6" />
          {/* soft top highlight */}
          <path d="M100 26 L174 66 L100 106 L26 66 Z" fill="url(#cbTop)" opacity="0" />
          <path d="M100 30 L150 57 L100 84 L50 57 Z" fill="#ffffff" opacity=".08" />
        </g>
      ) : (
        <g>
          {/* body faces (shorter) */}
          <path d="M40 100 L100 128 L100 172 L40 144 Z" fill="url(#cbLeft)" />
          <path d="M100 128 L160 100 L160 144 L100 172 Z" fill="url(#cbRight)" />
          {/* interior opening */}
          <path d="M100 72 L160 100 L100 128 L40 100 Z" fill="#6f5232" />
          <path d="M100 84 L146 100 L100 116 L54 100 Z" fill="#5a4026" />
          {/* four flaps spread open */}
          <path d="M40 100 L100 72 L94 40 L22 66 Z" fill="url(#cbFlap)" stroke="rgba(0,0,0,.06)" strokeWidth="1" />
          <path d="M100 72 L160 100 L178 68 L112 40 Z" fill="url(#cbTop)" stroke="rgba(0,0,0,.06)" strokeWidth="1" />
          <path d="M40 100 L100 128 L74 152 L14 116 Z" fill="url(#cbFlap)" opacity=".96" />
          <path d="M100 128 L160 100 L186 116 L128 152 Z" fill="url(#cbTop)" opacity=".96" />
          {/* front seam */}
          <path d="M100 128 L100 172" stroke="rgba(0,0,0,.16)" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}
