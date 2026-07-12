export default function LogoIcon({ className = "" }) {
    return (
        <svg
            viewBox="0 0 48 48"
            className={className}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Los 3 Cochinitos"
            role="img"
        >
            {/* Cuerpo alcancía */}
            <ellipse cx="24" cy="28" rx="16" ry="14" fill="#F472B6" stroke="#BE185D" strokeWidth="2" />
            {/* Ranura */}
            <rect x="14" y="12" width="20" height="4" rx="2" fill="#831843" />
            {/* Hocico */}
            <ellipse cx="40" cy="28" rx="5" ry="4" fill="#F9A8D4" stroke="#BE185D" strokeWidth="2" />
            {/* Fosas nasales */}
            <circle cx="41" cy="27" r="1" fill="#BE185D" />
            <circle cx="41" cy="29" r="1" fill="#BE185D" />
            {/* Ojo */}
            <circle cx="36" cy="22" r="2.5" fill="white" stroke="#BE185D" strokeWidth="1.5" />
            <circle cx="36.5" cy="21.5" r="1" fill="#1E293B" />
            {/* Oreja */}
            <ellipse cx="16" cy="18" rx="6" ry="5" fill="#F472B6" stroke="#BE185D" strokeWidth="2" transform="rotate(-15 16 18)" />
            {/* Oreja interna */}
            <ellipse cx="16" cy="18" rx="3" ry="2.5" fill="#F9A8D4" transform="rotate(-15 16 18)" />
            {/* Patas */}
            <rect x="14" y="38" width="6" height="5" rx="2" fill="#DB2777" />
            <rect x="28" y="38" width="6" height="5" rx="2" fill="#DB2777" />
            {/* Cola rizada */}
            <path d="M8 24 Q2 16 10 12" stroke="#BE185D" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
    )
}
