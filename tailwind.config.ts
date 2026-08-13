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
        // Tokens are declared as RGB channels in globals.css so the opacity
        // modifier works (`bg-bg-deep/80`). A hex behind `var()` makes Tailwind
        // emit `rgb(var(--x) / 0.8)`, which the browser drops to transparent.
        // Obsidian
        'bg-deep': 'rgb(var(--bg-deep-rgb) / <alpha-value>)',
        'bg-elevated': 'rgb(var(--bg-elevated-rgb) / <alpha-value>)',
        'bg-surface': 'rgb(var(--bg-surface-rgb) / <alpha-value>)',
        'bg-hover': 'rgb(var(--bg-hover-rgb) / <alpha-value>)',
        // Text
        'text-primary': 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        'text-inverse': 'rgb(var(--text-inverse-rgb) / <alpha-value>)',
        // Jade
        jade: {
          DEFAULT: 'rgb(var(--jade-primary-rgb) / <alpha-value>)',
          accent: 'rgb(var(--jade-accent-rgb) / <alpha-value>)',
          dim: 'rgb(var(--jade-dim-rgb) / <alpha-value>)',
          // Alpha is part of the glow itself — not alpha-modifiable.
          glow: 'var(--jade-glow)',
        },
        // Feedback
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
        info: 'rgb(var(--info-rgb) / <alpha-value>)',
        // Borders — alpha is baked into the token, so no modifier support here.
        border: 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        // shadcn compat
        background: 'rgb(var(--bg-deep-rgb) / <alpha-value>)',
        foreground: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--jade-primary-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--text-inverse-rgb) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--bg-surface-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--danger-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--bg-surface-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--jade-accent-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--text-inverse-rgb) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--bg-elevated-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'rgb(var(--bg-elevated-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        },
        input: 'var(--border-subtle)',
        ring: 'rgb(var(--jade-accent-rgb) / <alpha-value>)',
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
