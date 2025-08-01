export default function LoadingPage() {
  return (
    <div className="flex items-center justify-center w-full h-screen">
      <div className="text-center">
        <svg
          className="animate-spin h-30 w-30 mx-auto text-primary"
          style={{ color: '#1263F0' }}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-label="Loading"
        >
          <circle
            className="opacity-25"
            cx="120"
            cy="120"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            className="opacity-75"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            d="M12 2a10 10 0 0110 10"
          />
        </svg>
        <p className="mt-6 text-xl font-semibold text-light">กำลังโหลด...</p>
      </div>
    </div>
  );
}