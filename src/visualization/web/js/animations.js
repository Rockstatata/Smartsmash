/* ═══════════════════════════════════════════════════════════
   SmartSmash — GSAP Animations Module
   Handles all scroll-triggered and entry animations
   ═══════════════════════════════════════════════════════════ */

/**
 * Initializes all GSAP-powered animations across the site.
 * Requires GSAP and ScrollTrigger to be loaded globally.
 */
function initAnimations() {
  gsap.registerPlugin(ScrollTrigger);

  // ─── Hero Entrance Animation ────────────────────────────
  const heroTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

  heroTimeline
    .to('#hero-line1', {
      opacity: 1,
      y: 0,
      duration: 1,
      delay: 0.3
    })
    .to('#hero-line2', {
      opacity: 1,
      y: 0,
      duration: 1
    }, '-=0.5')
    .to('#hero-sub', {
      opacity: 1,
      y: 0,
      duration: 0.8
    }, '-=0.4')
    .to('#hero-ctas', {
      opacity: 1,
      y: 0,
      duration: 0.8
    }, '-=0.3')
    .to('#scroll-indicator', {
      opacity: 0.6,
      y: 0,
      duration: 0.6
    }, '-=0.2');

  // Set initial transform states for hero elements
  gsap.set(['#hero-line1', '#hero-line2', '#hero-sub', '#hero-ctas'], {
    y: 30
  });
  gsap.set('#scroll-indicator', { y: 10 });


  // ─── Navbar Scroll Morph ────────────────────────────────
  ScrollTrigger.create({
    start: 'top -80',
    onUpdate: function (self) {
      var navbar = document.getElementById('navbar');
      if (self.direction === 1 && self.scroll() > 80) {
        navbar.classList.add('scrolled');
      } else if (self.scroll() <= 80) {
        navbar.classList.remove('scrolled');
      }
    }
  });

  // Hide scroll indicator on scroll
  ScrollTrigger.create({
    trigger: '#hero',
    start: 'top top',
    end: 'bottom center',
    onLeave: function () {
      gsap.to('#scroll-indicator', { opacity: 0, duration: 0.3 });
    },
    onEnterBack: function () {
      gsap.to('#scroll-indicator', { opacity: 0.6, duration: 0.3 });
    }
  });


  // ─── Feature Section Header ─────────────────────────────
  gsap.from('.feature-header', {
    scrollTrigger: {
      trigger: '.feature-header',
      start: 'top 85%',
      toggleActions: 'play none none reverse'
    },
    opacity: 0,
    y: 40,
    duration: 0.8,
    ease: 'power3.out'
  });


  // ─── Feature Cards Stagger ──────────────────────────────
  gsap.from('.feature-card', {
    scrollTrigger: {
      trigger: '.feature-card',
      start: 'top 85%',
      toggleActions: 'play none none reverse'
    },
    opacity: 0,
    y: 50,
    stagger: 0.15,
    duration: 0.8,
    ease: 'power3.out'
  });


  // ─── Philosophy Section ─────────────────────────────────
  gsap.from('.philosophy-text', {
    scrollTrigger: {
      trigger: '#philosophy',
      start: 'top 75%',
      toggleActions: 'play none none reverse'
    },
    opacity: 0,
    y: 40,
    duration: 1,
    ease: 'power3.out'
  });

  // Highlight glow pulse on the word "interpretable"
  gsap.from('.philosophy-highlight', {
    scrollTrigger: {
      trigger: '#philosophy',
      start: 'top 70%',
      toggleActions: 'play none none reverse'
    },
    textShadow: '0 0 0px rgba(201,168,76,0)',
    duration: 1.5,
    ease: 'power2.out',
    onComplete: function () {
      gsap.to('.philosophy-highlight', {
        textShadow: '0 0 30px rgba(201,168,76,0.3)',
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    }
  });


  // ─── Protocol Cards ────────────────────────────────────
  gsap.from('.protocol-card', {
    scrollTrigger: {
      trigger: '#protocol',
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    },
    opacity: 0,
    y: 60,
    stagger: 0.2,
    duration: 0.8,
    ease: 'power3.out'
  });


  // ─── Mode Cards ────────────────────────────────────────
  gsap.from('.mode-card', {
    scrollTrigger: {
      trigger: '#modes',
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    },
    opacity: 0,
    y: 50,
    stagger: 0.15,
    duration: 0.8,
    ease: 'power3.out'
  });


  // ─── Dashboard Cards ───────────────────────────────────
  gsap.from('.dashboard-card', {
    scrollTrigger: {
      trigger: '#history',
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    },
    opacity: 0,
    y: 40,
    scale: 0.95,
    stagger: 0.1,
    duration: 0.6,
    ease: 'power3.out'
  });


  // ─── Game Arena Section ─────────────────────────────────
  gsap.from('#game-arena .relative', {
    scrollTrigger: {
      trigger: '#game-arena',
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    },
    opacity: 0,
    y: 40,
    duration: 1,
    ease: 'power3.out'
  });


  // ─── Leaderboard Section ───────────────────────────────
  gsap.from('#leaderboard-table', {
    scrollTrigger: {
      trigger: '#leaderboard',
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    },
    opacity: 0,
    y: 30,
    duration: 0.8,
    ease: 'power3.out'
  });
}


// ─── Protocol Canvas Micro-Animations ─────────────────────

/**
 * Renders a rotating shuttlecock geometric motif on the given canvas.
 */
function initProtocolCanvas1() {
  var canvas = document.getElementById('protocol-canvas-1');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w = canvas.width;
  var h = canvas.height;
  var angle = 0;

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(angle);

    // Shuttlecock body (cone shape)
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.lineTo(-12, 15);
    ctx.lineTo(12, 15);
    ctx.closePath();
    ctx.fillStyle = 'rgba(201, 168, 76, 0.3)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Feather lines
    for (var i = 0; i < 5; i++) {
      var a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 20, Math.sin(a) * 20);
      ctx.strokeStyle = 'rgba(201, 168, 76, 0.2)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Cork (circle at bottom)
    ctx.beginPath();
    ctx.arc(0, 18, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(201, 168, 76, 0.5)';
    ctx.fill();

    ctx.restore();

    // Orbit ring
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 35, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    angle += 0.015;
    requestAnimationFrame(draw);
  }

  draw();
}

/**
 * Renders a scanning court grid animation on the given canvas.
 */
function initProtocolCanvas2() {
  var canvas = document.getElementById('protocol-canvas-2');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w = canvas.width;
  var h = canvas.height;
  var scanY = 0;
  var time = 0;

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // Draw court grid
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.1)';
    ctx.lineWidth = 0.5;

    // Vertical lines
    for (var x = 20; x < w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, h - 10);
      ctx.stroke();
    }

    // Horizontal lines
    for (var y = 20; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(w - 10, y);
      ctx.stroke();
    }

    // Scan line
    var scanLineY = 10 + (scanY % (h - 20));
    ctx.beginPath();
    ctx.moveTo(10, scanLineY);
    ctx.lineTo(w - 10, scanLineY);
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Scan glow
    var gradient = ctx.createLinearGradient(0, scanLineY - 15, 0, scanLineY + 5);
    gradient.addColorStop(0, 'rgba(201, 168, 76, 0)');
    gradient.addColorStop(0.8, 'rgba(201, 168, 76, 0.05)');
    gradient.addColorStop(1, 'rgba(201, 168, 76, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(10, scanLineY - 15, w - 20, 20);

    // Pulsing node at intersection
    var nodeX = 20 + Math.floor(Math.sin(time * 0.02) * 2 + 2) * 20;
    var nodeY = 20 + Math.floor(Math.cos(time * 0.015) * 2 + 2) * 20;
    var pulseAlpha = 0.3 + Math.sin(time * 0.05) * 0.2;
    ctx.beginPath();
    ctx.arc(nodeX, nodeY, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(201, 168, 76, ' + pulseAlpha + ')';
    ctx.fill();

    scanY += 0.5;
    time++;
    requestAnimationFrame(draw);
  }

  draw();
}

/**
 * Renders a pulsing rally waveform on the given canvas.
 */
function initProtocolCanvas3() {
  var canvas = document.getElementById('protocol-canvas-3');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w = canvas.width;
  var h = canvas.height;
  var time = 0;

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // Draw waveform
    ctx.beginPath();
    ctx.moveTo(0, h / 2);

    for (var x = 0; x < w; x++) {
      var y = h / 2 +
        Math.sin((x + time) * 0.05) * 15 +
        Math.sin((x + time * 1.5) * 0.08) * 8 +
        Math.sin((x + time * 0.7) * 0.12) * 5;
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = 'rgba(201, 168, 76, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fill below the waveform
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    var gradient = ctx.createLinearGradient(0, h / 2, 0, h);
    gradient.addColorStop(0, 'rgba(201, 168, 76, 0.08)');
    gradient.addColorStop(1, 'rgba(201, 168, 76, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Center line
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.06)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Pulse dot following the wave
    var pulseX = w / 2;
    var pulseY = h / 2 +
      Math.sin((pulseX + time) * 0.05) * 15 +
      Math.sin((pulseX + time * 1.5) * 0.08) * 8 +
      Math.sin((pulseX + time * 0.7) * 0.12) * 5;

    ctx.beginPath();
    ctx.arc(pulseX, pulseY, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(201, 168, 76, 0.8)';
    ctx.fill();

    // Glow around pulse dot
    ctx.beginPath();
    ctx.arc(pulseX, pulseY, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(201, 168, 76, 0.1)';
    ctx.fill();

    time += 1;
    requestAnimationFrame(draw);
  }

  draw();
}
