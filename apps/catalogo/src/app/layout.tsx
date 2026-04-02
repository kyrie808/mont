import { Playfair_Display, DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import type { Metadata } from 'next'
import PreloaderDismiss from '@/components/PreloaderDismiss'

const playfair = Playfair_Display({
    subsets: ['latin'],
    variable: '--font-playfair',
    display: 'swap',
})

const dmSans = DM_Sans({
    subsets: ['latin'],
    variable: '--font-dm-sans',
    display: 'swap',
})

const jetbrains = JetBrains_Mono({
    subsets: ['latin'],
    variable: '--font-jetbrains',
    display: 'swap',
})

export const metadata: Metadata = {
    title: 'Mont Distribuidora | Pão de Queijo Artesanal',
    description: 'Massas naturais congeladas e refrigeradas direto pra sua casa. Pão de queijo artesanal feito com alma na região do ABC paulista.',
    keywords: ['pão de queijo', 'chipa', 'massa congelada', 'artesanal', 'ABC paulista', 'São Bernardo'],
    authors: [{ name: 'Mont Distribuidora' }],
    openGraph: {
        title: 'Mont Distribuidora | Pão de Queijo Artesanal',
        description: 'Massas naturais congeladas e refrigeradas direto pra sua casa',
        type: 'website',
        locale: 'pt_BR',
        siteName: 'Mont Distribuidora',
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="pt-BR" className={`${playfair.variable} ${dmSans.variable} ${jetbrains.variable} bg-[#3D2B22]`}>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
(function() {
  history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  var style = document.createElement('style');
  style.textContent = [
    '@keyframes orbitConverge {',
    '  0% { transform: rotate(var(--a)) translateX(var(--d)) scale(0); opacity:0; }',
    '  15% { opacity:1; transform: rotate(calc(var(--a) + 45deg)) translateX(var(--d)) scale(1.5); }',
    '  35% { transform: rotate(calc(var(--a) + 180deg)) translateX(0) scale(0); opacity:1; }',
    '  100% { transform: rotate(calc(var(--a) + 180deg)) translateX(0) scale(0); opacity:0; }',
    '}',
    '@keyframes logoReveal {',
    '  0%,30% { opacity:0; transform:scale(0.9); filter:blur(5px); }',
    '  40% { opacity:1; transform:scale(1); filter:blur(0); }',
    '  80% { opacity:1; transform:scale(1); filter:blur(0); }',
    '  95%,100% { opacity:0; transform:scale(1.05); filter:blur(3px); }',
    '}',
    '#mont-preloader { position:fixed; inset:0; width:100vw; height:100vh; background:#000; z-index:99999; display:flex; align-items:center; justify-content:center; overflow:hidden; }',
    '#mont-preloader .particles { position:absolute; top:50%; left:50%; width:0; height:0; }',
    '#mont-preloader .particle { position:absolute; width:3px; height:3px; background:#C8A96E; border-radius:50%; box-shadow:0 0 8px #C8A96E; animation: orbitConverge 2.5s infinite ease-in-out; }',
    '#mont-preloader .logo { display:flex; flex-direction:column; align-items:center; animation: logoReveal 2.5s forwards; opacity:0; }',
    '#mont-preloader .logo svg { width:80px; height:60px; margin-bottom:15px; }',
    '#mont-preloader .logo h1 { font-size:3rem; color:#C8A96E; letter-spacing:0.15em; margin:0; font-family:serif; }',
    '#mont-preloader .logo span { color:#fff; font-size:0.75rem; letter-spacing:0.4em; margin-top:5px; font-family:sans-serif; text-transform:uppercase; }'
  ].join('');
  document.head.appendChild(style);

  var el = document.createElement('div');
  el.id = 'mont-preloader';
  el.innerHTML = [
    '<div class="particles" id="mont-particles"></div>',
    '<div class="logo">',
    '  <svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg">',
    '    <circle cx="50" cy="35" r="22" fill="#C8A96E"/>',
    '    <circle cx="43" cy="22" r="2.5" fill="#000" opacity="0.4"/>',
    '    <circle cx="60" cy="28" r="3.5" fill="#000" opacity="0.4"/>',
    '    <circle cx="53" cy="45" r="2" fill="#000" opacity="0.4"/>',
    '    <path d="M5,80 L35,25 L50,50 L65,25 L95,80 Z" fill="#000" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>',
    '    <path d="M20,80 L35,50 L50,70 L65,50 L80,80" fill="none" stroke="#C8A96E" stroke-width="2" stroke-linejoin="round"/>',
    '  </svg>',
    '  <h1>MONT</h1>',
    '  <span>Distribuidora</span>',
    '</div>'
  ].join('');

  function mountPreloader() {
    document.body.appendChild(el);
    var pc = document.getElementById('mont-particles');
    for (var i = 0; i < 45; i++) {
      var p = document.createElement('div');
      p.className = 'particle';
      p.style.setProperty('--a', (Math.random() * 360) + 'deg');
      p.style.setProperty('--d', (80 + Math.random() * 150) + 'px');
      p.style.animationDelay = (Math.random() * 0.2) + 's';
      pc.appendChild(p);
    }
  }

  if (document.body) {
    mountPreloader();
  } else {
    document.addEventListener('DOMContentLoaded', mountPreloader);
  }

  var startTime = Date.now();
  var MIN = window.location.pathname === '/' ? 2500 : 0;
  var removed = false;

  window.__dismissPreloader = function() {
    if (removed) return;
    removed = true;
    var elapsed = Date.now() - startTime;
    var wait = Math.max(0, MIN - elapsed);
    setTimeout(function() {
      var preloader = document.getElementById('mont-preloader');
      if (preloader) {
        preloader.style.transition = 'opacity 0.4s ease';
        preloader.style.opacity = '0';
        setTimeout(function() {
          if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
          window.scrollTo(0, 0);
        }, 400);
      }
    }, wait);
  };

  setTimeout(window.__dismissPreloader, 4000);
  window.addEventListener('load', window.__dismissPreloader);
})();
                        `
                    }}
                />
                <link rel="preload" href="/hero-cheese/pao_left.png" as="image" />
                <link rel="preload" href="/hero-cheese/pao_right.png" as="image" />
                <link rel="preload" href="/hero-cheese/cheese.png" as="image" />
            </head>
            <body className="font-body bg-mont-cream text-mont-espresso antialiased min-h-screen">
                <PreloaderDismiss />
                {children}
            </body>
        </html>
    )
}
