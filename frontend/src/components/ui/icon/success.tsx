export function SuccessIcon() {
    return (
        <svg className="w-6 h-6">
            <circle cx="12" cy="12" r="12" className="fill-green-500" />
            <path
                d="M7 12.5L10 15.5L17 8.5"
                className="stroke-white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}