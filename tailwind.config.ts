import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        // Obsidian
        'bg-deep': 'var(--bg-deep)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-surface': 'var(--bg-surface)',
        'bg-hover': 'var(--bg-hover)',
        // Text
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'text-inverse': 'var(--text-inverse)',
        // Jade
        jade: {
          DEFAULT: 'var(--jade-primary)',
          accent: 'var(--jade-accent)',
          dim: 'var(--jade-dim)',
          glow: 'var(--jade-glow)',
        },
        // Feedback
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
        // Borders
        border: 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        // shadcn compat
        background: 'var(--bg-deep)',
        foreground: 'var(--text-primary)',
        primary: {
          DEFAULT: 'var(--jade-primary)',
          foreground: 'var(--text-inverse)',
        },
        secondary: {
          DEFAULT: 'var(--bg-surface)',
          foreground: 'var(--text-primary)',
        },
        destructive: {
          DEFAULT: 'var(--danger)',
          foreground: 'var(--text-primary)',
        },
        muted: {
          DEFAULT: 'var(--bg-surface)',
          foreground: 'var(--text-secondary)',
        },
        accent: {
          DEFAULT: 'var(--jade-accent)',
          foreground: 'var(--text-inverse)',
        },
        card: {
          DEFAULT: 'var(--bg-elevated)',
          foreground: 'var(--text-primary)',
        },
        popover: {
          DEFAULT: 'var(--bg-elevated)',
          foreground: 'var(--text-primary)',
        },
        input: 'var(--border-subtle)',
        ring: 'var(--jade-accent)',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        card: '0 10px 30px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.03) inset',
        elevated: '0 20px 60px rgba(0,0,0,0.5)',
        glow: '0 0 40px rgba(44,175,147,0.35)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        enter: 'cubic-bezier(0, 0, 0.2, 1)',
        exit: 'cubic-bezier(0.4, 0, 1, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 220ms cubic-bezier(0, 0, 0.2, 1) forwards',
        'slide-up': 'slideUp 320ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'pulse-jade': 'pulseJade 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        fadeInScale: 'fadeInScale 180ms cubic-bezier(0, 0, 0.2, 1) forwards',
        shimmer: 'shimmer 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseJade: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(44,175,147,0.35)' },
          '50%': { boxShadow: '0 0 0 12px rgba(44,175,147,0)' },
        },
        fadeInScale: {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [animate],
};

export default config;
