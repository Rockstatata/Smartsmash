/* ═══════════════════════════════════════════════════════════
   SmartSmash — Main Application Initializer
   Orchestrates all modules and global interactions
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── Boot Sequence ──────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', function () {
    console.log(
      '%c SmartSmash Arena %c v1.0 ',
      'background: #C9A84C; color: #0D0D12; font-weight: bold; padding: 4px 8px; border-radius: 4px 0 0 4px;',
      'background: #2A2A35; color: #FAF8F5; padding: 4px 8px; border-radius: 0 4px 4px 0;'
    );

    // Initialize Lucide icons
    if (window.lucide) {
      lucide.createIcons();
    }

    // Initialize modules in sequence
    initAnimations();
    initFeatures();
    initStrategyGrid();
    Leaderboard.init();
    GameCanvas.init();

    // Start protocol canvas micro-animations
    initProtocolCanvas1();
    initProtocolCanvas2();
    initProtocolCanvas3();

    // Check backend availability
    checkBackendStatus();

    console.log('[SmartSmash] All modules initialized.');
  });


  /* ─── Backend Health Check ───────────────────────────── */

  function checkBackendStatus() {
    if (typeof SmartSmashAPI === 'undefined') {
      updateStatusIndicator(false);
      return;
    }

    SmartSmashAPI.healthCheck().then(function (isHealthy) {
      updateStatusIndicator(isHealthy);
      if (isHealthy) {
        console.log('[SmartSmash] Backend connected.');
      } else {
        console.log('[SmartSmash] Backend offline — running in demo mode.');
      }
    });
  }

  /**
   * Updates the system status indicator (green/red dot in footer).
   */
  function updateStatusIndicator(isOnline) {
    var dots = document.querySelectorAll('.animate-pulse-slow');
    dots.forEach(function (dot) {
      if (isOnline) {
        dot.style.backgroundColor = '#4ade80';
      } else {
        dot.style.backgroundColor = '#fbbf24';
      }
    });

    // Update the text next to the footer dot
    var statusText = document.querySelector('footer .animate-pulse-slow + span');
    if (statusText) {
      statusText.textContent = isOnline ? 'System Operational' : 'Demo Mode';
    }
  }


  /* ─── Mobile Menu Controls ───────────────────────────── */

  window.toggleMobileMenu = function () {
    var menu = document.getElementById('mobile-menu');
    if (menu) {
      menu.classList.toggle('hidden');
      document.body.style.overflow = menu.classList.contains('hidden') ? '' : 'hidden';
    }
  };

  window.closeMobileMenu = function () {
    var menu = document.getElementById('mobile-menu');
    if (menu) {
      menu.classList.add('hidden');
      document.body.style.overflow = '';
    }
  };


  /* ─── Auth Modal Controls ────────────────────────────── */

  window.openAuthModal = function () {
    var modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';

      // Animate in
      gsap.fromTo(
        modal.querySelector('.bg-obsidian-light'),
        { opacity: 0, scale: 0.95, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'power3.out' }
      );
    }
  };

  window.closeAuthModal = function () {
    var modal = document.getElementById('auth-modal');
    if (modal) {
      gsap.to(modal.querySelector('.bg-obsidian-light'), {
        opacity: 0,
        scale: 0.95,
        y: 20,
        duration: 0.25,
        ease: 'power3.in',
        onComplete: function () {
          modal.classList.add('hidden');
          document.body.style.overflow = '';
        }
      });
    }
  };

  window.switchAuthTab = function (tab) {
    var signinForm = document.getElementById('signin-form');
    var signupForm = document.getElementById('signup-form');
    var tabs = document.querySelectorAll('.auth-tab');

    tabs.forEach(function (t) {
      t.classList.remove('active');
      t.style.color = '';
      t.style.borderColor = 'transparent';
    });

    if (tab === 'signin') {
      signinForm.classList.remove('hidden');
      signupForm.classList.add('hidden');
      tabs[0].classList.add('active');
    } else {
      signinForm.classList.add('hidden');
      signupForm.classList.remove('hidden');
      tabs[1].classList.add('active');
    }
  };

  window.handleSignIn = function (e) {
    e.preventDefault();
    var form = e.target;
    var email = form.querySelector('input[type="email"]').value;
    console.log('[Auth] Sign in attempt:', email);

    // Show a brief success animation
    var btn = form.querySelector('button[type="submit"]');
    var originalText = btn.textContent;
    btn.textContent = 'Entering...';
    btn.disabled = true;

    setTimeout(function () {
      btn.textContent = originalText;
      btn.disabled = false;
      closeAuthModal();
      showNotification('Welcome to the Arena!', 'success');
    }, 1500);
  };

  window.handleSignUp = function (e) {
    e.preventDefault();
    var form = e.target;
    var email = form.querySelectorAll('input[type="email"]')[0].value;
    console.log('[Auth] Sign up attempt:', email);

    var btn = form.querySelector('button[type="submit"]');
    var originalText = btn.textContent;
    btn.textContent = 'Creating...';
    btn.disabled = true;

    setTimeout(function () {
      btn.textContent = originalText;
      btn.disabled = false;
      closeAuthModal();
      showNotification('Account created. Welcome!', 'success');
    }, 1500);
  };


  /* ─── Notification System ────────────────────────────── */

  /**
   * Shows a brief notification toast.
   * @param {string} message - Toast message
   * @param {string} type - 'success' | 'error' | 'info'
   */
  window.showNotification = function (message, type) {
    var toast = document.createElement('div');
    var bgColor = type === 'success' ? 'bg-green-500/20 border-green-500/30'
      : type === 'error' ? 'bg-red-500/20 border-red-500/30'
      : 'bg-champagne/20 border-champagne/30';

    toast.className =
      'fixed top-20 left-1/2 -translate-x-1/2 z-[70] px-6 py-3 rounded-xl border '
      + bgColor + ' backdrop-blur-sm text-sm text-ivory font-medium';
    toast.textContent = message;

    document.body.appendChild(toast);

    gsap.fromTo(toast,
      { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }
    );

    setTimeout(function () {
      gsap.to(toast, {
        opacity: 0,
        y: -10,
        duration: 0.3,
        ease: 'power3.in',
        onComplete: function () {
          toast.remove();
        }
      });
    }, 3000);
  };


  /* ─── Smooth Scroll for Anchor Links ─────────────────── */

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;

    var targetId = link.getAttribute('href');
    if (targetId === '#') return;

    var target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });


  /* ─── Keyboard Shortcuts ─────────────────────────────── */

  document.addEventListener('keydown', function (e) {
    // Escape closes modals/menus
    if (e.key === 'Escape') {
      closeAuthModal();
      closeMobileMenu();
    }
  });

})();
