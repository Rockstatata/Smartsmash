/* ═══════════════════════════════════════════════════════════
   SmartSmash — Feature Components Module
   Diagnostic Shuffler, Telemetry Typewriter, Coach Cursor
   ═══════════════════════════════════════════════════════════ */

/**
 * Initializes all interactive feature card components.
 */
function initFeatures() {
  initDiagnosticShuffler();
  initTelemetryFeed();
  initCoachCursor();
}


/* ─── Diagnostic Shuffler ────────────────────────────────── */

/**
 * Cycles through sub-labels on the Engine Core card with a
 * smooth vertical shuffle animation.
 */
function initDiagnosticShuffler() {
  var label = document.querySelector('.diagnostic-label');
  if (!label) return;

  var labels = JSON.parse(label.getAttribute('data-labels'));
  var currentIndex = 0;

  setInterval(function () {
    // Shuffle out
    label.classList.add('shuffle-out');

    setTimeout(function () {
      currentIndex = (currentIndex + 1) % labels.length;
      label.textContent = labels[currentIndex];
      label.classList.remove('shuffle-out');
      label.classList.add('shuffle-in');

      // Tiny delay then reveal
      setTimeout(function () {
        label.classList.remove('shuffle-in');
      }, 50);
    }, 300);
  }, 2500);
}


/* ─── Telemetry Typewriter Feed ──────────────────────────── */

/**
 * Simulates a live agent telemetry feed with typewriter-style
 * messages appearing at random intervals.
 */
function initTelemetryFeed() {
  var feed = document.getElementById('telemetry-feed');
  if (!feed) return;

  var messages = [
    { prefix: '[Minimax]', text: 'evaluating depth=3', color: 'text-blue-400/80' },
    { prefix: '[Minimax]', text: 'alpha=-Infinity beta=Infinity', color: 'text-blue-400/80' },
    { prefix: '[Minimax]', text: 'pruning branch at node 47', color: 'text-blue-400/80' },
    { prefix: '[Minimax]', text: 'best action: SMASH zone=3', color: 'text-blue-400/80' },
    { prefix: '[MCTS]', text: 'rollout simulation #128', color: 'text-purple-400/80' },
    { prefix: '[MCTS]', text: 'UCT selection: node.visits=34', color: 'text-purple-400/80' },
    { prefix: '[MCTS]', text: 'expansion: new child DROP_SHOT', color: 'text-purple-400/80' },
    { prefix: '[MCTS]', text: 'backpropagation: reward=0.72', color: 'text-purple-400/80' },
    { prefix: '[Fuzzy]', text: 'rule triggered: stamina_low', color: 'text-green-400/80' },
    { prefix: '[Fuzzy]', text: 'membership(stamina)=0.3 LOW', color: 'text-green-400/80' },
    { prefix: '[Fuzzy]', text: 'defuzzified output: CLEAR', color: 'text-green-400/80' },
    { prefix: '[System]', text: 'reward updated', color: 'text-yellow-400/80' },
    { prefix: '[System]', text: 'state transition complete', color: 'text-yellow-400/80' },
    { prefix: '[System]', text: 'rally #14 concluded', color: 'text-yellow-400/80' },
    { prefix: '[Simulator]', text: 'validating action: SMASH', color: 'text-cyan-400/80' },
    { prefix: '[Simulator]', text: 'stamina cost: -8', color: 'text-cyan-400/80' },
    { prefix: '[Simulator]', text: 'shuttle_zone updated: 5→2', color: 'text-cyan-400/80' },
  ];

  var maxLines = 8;

  function addLine() {
    var msg = messages[Math.floor(Math.random() * messages.length)];

    var line = document.createElement('div');
    line.className = 'telemetry-line ' + msg.color;
    line.innerHTML = '&gt; <span class="text-ivory-muted">' + msg.prefix + '</span> ' + msg.text;

    feed.appendChild(line);

    // Remove old lines if too many
    var lines = feed.querySelectorAll('.telemetry-line');
    if (lines.length > maxLines) {
      lines[0].remove();
    }

    // Scroll to bottom
    feed.scrollTop = feed.scrollHeight;

    // Schedule next line
    var delay = 800 + Math.random() * 1500;
    setTimeout(addLine, delay);
  }

  // Start after a small delay
  setTimeout(addLine, 1500);
}


/* ─── Coach Cursor Text ──────────────────────────────────── */

/**
 * Cycles through coaching action strings with a typewriter
 * cursor animation effect.
 */
function initCoachCursor() {
  var textEl = document.getElementById('coach-cursor-text');
  if (!textEl) return;

  var actions = [
    'Adjust aggression',
    'Modify depth',
    'Toggle power usage',
    'Save configuration',
    'Optimize defense',
    'Set risk threshold'
  ];

  var currentAction = 0;
  var charIndex = 0;
  var isDeleting = false;
  var typeSpeed = 60;

  function type() {
    var currentText = actions[currentAction];

    if (!isDeleting) {
      // Typing
      textEl.textContent = currentText.substring(0, charIndex + 1);
      charIndex++;

      if (charIndex === currentText.length) {
        // Pause at end of word
        isDeleting = true;
        setTimeout(type, 2000);
        return;
      }
    } else {
      // Deleting
      textEl.textContent = currentText.substring(0, charIndex - 1);
      charIndex--;

      if (charIndex === 0) {
        isDeleting = false;
        currentAction = (currentAction + 1) % actions.length;
        setTimeout(type, 500);
        return;
      }
    }

    var speed = isDeleting ? typeSpeed / 2 : typeSpeed;
    setTimeout(type, speed);
  }

  // Start with the first action already displayed
  textEl.textContent = actions[0];
  charIndex = actions[0].length;
  isDeleting = true;
  setTimeout(type, 3000);
}


/* ─── Strategy Grid Interactivity ────────────────────────── */

/**
 * Adds interactive hover-and-click behavior to strategy grid cells.
 * Simulates the coach "adjusting" parameter values.
 */
function initStrategyGrid() {
  var cells = document.querySelectorAll('.strategy-cell');

  cells.forEach(function (cell) {
    cell.addEventListener('click', function () {
      var bar = cell.querySelector('.strategy-bar');
      if (!bar) return;

      // Randomise the bar width on click to simulate adjustment
      var newWidth = 20 + Math.floor(Math.random() * 70);
      bar.style.width = newWidth + '%';

      // Flash the cell border
      cell.style.borderColor = 'rgba(201, 168, 76, 0.5)';
      setTimeout(function () {
        cell.style.borderColor = '';
      }, 500);
    });
  });
}
