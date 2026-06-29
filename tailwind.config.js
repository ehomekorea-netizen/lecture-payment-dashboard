/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        toss: {
          blue: '#1F2E5B',       // Deep Trust Navy (Primary)
          blueHover: '#172346',
          teal: '#00BCD4',       // Digital Transformation Aqua/Teal (Secondary)
          tealHover: '#009BB0',
          indigo: '#818CF8',     // Accent Glow
          bgLight: '#F8FAF8',    // Soft Warm-grey
          bgWhite: '#FFFFFF',
          textDark: '#0F172A',   // Dark Slate
          textMuted: '#475569',  // Medium Slate
          textSub: '#64748B',    // Muted slate
          border: '#E2E8F0',     // Light grey border
          red: '#EF4444',
          amber: '#F59E0B',
          green: '#10B981',
        }
      },
      fontFamily: {
        sans: ['Pretendard', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        toss: '0 4px 20px rgba(0, 0, 0, 0.05)',
        tossHover: '0 8px 30px rgba(0, 0, 0, 0.08)',
        modal: '0 20px 40px rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [],
}
