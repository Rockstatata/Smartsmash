/* ═══════════════════════════════════════════════════════════
   SmartSmash — Leaderboard Module
   Sortable agent ranking table with live data support
   ═══════════════════════════════════════════════════════════ */

var Leaderboard = (function () {
  'use strict';

  /* ─── Default Data ───────────────────────────────────── */

  /**
   * Default leaderboard data used when the API is unavailable.
   * Demonstrates the three classical AI agents under comparison.
   */
  var defaultData = [
    {
      rank: 1,
      name: 'Minimax',
      elo: 1847,
      winrate: 72.5,
      points: 2450,
      matches: 48,
      color: '#4A9EFF',
      description: 'Depth-limited search with alpha-beta pruning'
    },
    {
      rank: 2,
      name: 'MCTS',
      elo: 1792,
      winrate: 65.8,
      points: 2180,
      matches: 48,
      color: '#A855F7',
      description: 'Monte Carlo Tree Search with UCT selection'
    },
    {
      rank: 3,
      name: 'Fuzzy',
      elo: 1685,
      winrate: 52.1,
      points: 1720,
      matches: 48,
      color: '#4ade80',
      description: 'Fuzzy logic rule-based inference system'
    }
  ];

  var currentData = [];
  var currentSort = { field: 'elo', asc: false };

  /* ─── Initialization ─────────────────────────────────── */

  /**
   * Initializes the leaderboard table with data and event listeners.
   */
  function init() {
    currentData = JSON.parse(JSON.stringify(defaultData));
    renderTable();
    bindSortHeaders();
    tryLoadFromAPI();
  }

  /**
   * Attempts to load leaderboard data from the FastAPI backend.
   * Falls back to default data if the API is unavailable.
   */
  function tryLoadFromAPI() {
    if (typeof SmartSmashAPI === 'undefined') return;

    SmartSmashAPI.getLeaderboard().then(function (data) {
      if (data && Array.isArray(data) && data.length > 0) {
        currentData = data;
        sortData();
        renderTable();
      }
    });
  }


  /* ─── Rendering ──────────────────────────────────────── */

  /**
   * Renders the leaderboard table body with current data.
   */
  function renderTable() {
    var tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    currentData.forEach(function (agent, index) {
      var tr = document.createElement('tr');
      tr.className = 'border-b border-white/5';

      // Rank badge styling
      var rankBadge = '';
      if (agent.rank === 1) {
        rankBadge =
          '<span class="w-6 h-6 rounded-full bg-champagne/20 flex items-center justify-center text-xs font-bold text-champagne">' +
          agent.rank + '</span>';
      } else {
        rankBadge =
          '<span class="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-ivory-muted">' +
          agent.rank + '</span>';
      }

      // Win rate bar
      var winrateColor = agent.winrate >= 60 ? '#4ade80' : agent.winrate >= 45 ? '#fbbf24' : '#f87171';

      tr.innerHTML =
        '<td class="px-6 py-4">' + rankBadge + '</td>' +
        '<td class="px-6 py-4">' +
          '<div class="flex items-center gap-3">' +
            '<div class="w-2 h-2 rounded-full" style="background: ' + agent.color + '"></div>' +
            '<div>' +
              '<div class="font-semibold">' + agent.name + '</div>' +
              '<div class="text-[10px] text-ivory-muted font-data">' + agent.description + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td class="px-6 py-4 text-right font-data font-bold text-champagne">' + agent.elo + '</td>' +
        '<td class="px-6 py-4 text-right">' +
          '<div class="flex items-center justify-end gap-2">' +
            '<div class="w-16 h-1 bg-slate rounded-full overflow-hidden">' +
              '<div class="h-full rounded-full" style="width: ' + agent.winrate + '%; background: ' + winrateColor + '"></div>' +
            '</div>' +
            '<span class="font-data text-xs" style="color: ' + winrateColor + '">' + agent.winrate.toFixed(1) + '%</span>' +
          '</div>' +
        '</td>' +
        '<td class="px-6 py-4 text-right font-data">' + agent.points.toLocaleString() + '</td>' +
        '<td class="px-6 py-4 text-right font-data text-ivory-muted">' + agent.matches + '</td>';

      tbody.appendChild(tr);
    });
  }


  /* ─── Sorting ────────────────────────────────────────── */

  /**
   * Binds click handlers to sortable table headers.
   */
  function bindSortHeaders() {
    var headers = document.querySelectorAll('#leaderboard-table th[data-sort]');

    headers.forEach(function (th) {
      th.addEventListener('click', function () {
        var field = th.getAttribute('data-sort');

        // Toggle direction if same field, otherwise sort descending
        if (currentSort.field === field) {
          currentSort.asc = !currentSort.asc;
        } else {
          currentSort.field = field;
          currentSort.asc = false;
        }

        // Update header UI
        headers.forEach(function (h) {
          h.classList.remove('sort-active', 'sort-asc');
        });
        th.classList.add('sort-active');
        if (currentSort.asc) th.classList.add('sort-asc');

        sortData();
        renderTable();
      });
    });
  }

  /**
   * Sorts the current data array based on the active sort field.
   */
  function sortData() {
    var field = currentSort.field;
    var asc = currentSort.asc;

    currentData.sort(function (a, b) {
      var valA = a[field];
      var valB = b[field];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return asc ? -1 : 1;
      if (valA > valB) return asc ? 1 : -1;
      return 0;
    });

    // Update ranks based on current sort
    currentData.forEach(function (agent, index) {
      agent.rank = index + 1;
    });
  }


  /* ─── Public Interface ───────────────────────────────── */
  return {
    init: init,
    refresh: tryLoadFromAPI
  };

})();
