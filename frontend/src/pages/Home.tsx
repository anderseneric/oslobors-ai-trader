export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <h1
        className="text-7xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent animate-fade-in"
        style={{
          textShadow: '0 0 40px rgba(59, 130, 246, 0.6)',
          animation: 'fadeInScale 1.5s ease-out'
        }}
      >
        Eric's Trading AI
      </h1>

      <style>{`
        @keyframes fadeInScale {
          0% {
            opacity: 0;
            transform: scale(0.9);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fadeInScale 1.5s ease-out;
        }
      `}</style>
    </div>
  )
}
