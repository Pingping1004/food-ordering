export function ErrorIcon() {
    return (
        <svg className="w-6 h-6">
            <circle cx="12" cy="12" r="12" className="fill-red-500" />
            <path
                d="M8 8L16 16M16 8L8 16"
                className="stroke-white"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}