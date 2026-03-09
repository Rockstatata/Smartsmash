import gsap from 'gsap';

/**
 * Shows a brief notification toast (GSAP-powered).
 * @param {string} message - Toast message
 * @param {string} type - 'success' | 'error' | 'info'
 */
export function showNotification(message, type = 'info') {
  const bgColor =
    type === 'success'
      ? 'bg-green-500/20 border-green-500/30'
      : type === 'error'
        ? 'bg-red-500/20 border-red-500/30'
        : 'bg-champagne/20 border-champagne/30';

  const toast = document.createElement('div');
  toast.className = `fixed top-20 left-1/2 -translate-x-1/2 z-70 px-6 py-3 rounded-xl border ${bgColor} backdrop-blur-sm text-sm text-ivory font-medium`;
  toast.textContent = message;
  document.body.appendChild(toast);

  gsap.fromTo(toast, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' });

  setTimeout(() => {
    gsap.to(toast, {
      opacity: 0, y: -10, duration: 0.3, ease: 'power3.in',
      onComplete: () => toast.remove(),
    });
  }, 3000);
}
