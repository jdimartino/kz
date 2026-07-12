export default function LogoIcon({ className = "" }) {
    return (
        <img
            src="/logo.png"
            alt="La KZ"
            className={className}
            aria-label="La KZ"
        />
    )
}
