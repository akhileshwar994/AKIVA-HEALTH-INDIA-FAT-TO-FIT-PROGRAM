/* ============================================================
   INDIA FAT TO FIT — Application Logic
   ============================================================ */

(function () {
  'use strict';

  // ===========================================
  // DARK MODE TOGGLE
  // ===========================================
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let currentTheme = 'light';

  function setTheme(theme) {
    currentTheme = theme;
    root.setAttribute('data-theme', theme);
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
      themeToggle.innerHTML = theme === 'dark'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
    // Update charts for theme
    updateChartsTheme();
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
  }

  // ===========================================
  // LUCIDE ICONS
  // ===========================================
  function initLucide() {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    } else {
      setTimeout(initLucide, 100);
    }
  }
  initLucide();

  // ===========================================
  // MOBILE HAMBURGER
  // ===========================================
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      mobileNav.classList.toggle('active');
      document.body.style.overflow = mobileNav.classList.contains('active') ? 'hidden' : '';
    });
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        mobileNav.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // ===========================================
  // SCROLL ANIMATIONS (IntersectionObserver)
  // ===========================================
  const animateElements = document.querySelectorAll('.animate-in');
  animateElements.forEach(el => el.classList.add('not-visible'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('not-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  animateElements.forEach(el => observer.observe(el));

  // ===========================================
  // ANIMATED COUNTERS
  // ===========================================
  function animateCounter(el) {
    const target = parseInt(el.dataset.count, 10);
    if (isNaN(target)) return;
    const duration = 1500;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('[data-count]').forEach(animateCounter);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.hero__stats, .crisis__stats').forEach(el => counterObserver.observe(el));

  // ===========================================
  // ACTIVE NAV LINK
  // ===========================================
  const navLinks = document.querySelectorAll('.nav__link');
  const sections = document.querySelectorAll('section[id]');

  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => link.classList.remove('active'));
        const active = document.querySelector(`.nav__link[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.3, rootMargin: '-80px 0px -50% 0px' });

  sections.forEach(s => navObserver.observe(s));

  // ===========================================
  // CHARTS
  // ===========================================
  let charts = {};

  function getChartColors() {
    const isDark = currentTheme === 'dark';
    return {
      text: isDark ? '#e8edf2' : '#1a1a2e',
      muted: isDark ? '#94a3b8' : '#5a6275',
      grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      red: '#E63946',
      gray: isDark ? '#64748b' : '#9ca3af',
      navy: '#1D3557',
      accent: '#457B9D',
      success: '#2A9D8F',
      warm: '#F4A261',
      gradientStops: ['#E63946', '#ff6b75', '#F4A261', '#2A9D8F', '#457B9D'],
    };
  }

  function updateChartsTheme() {
    if (typeof Chart === 'undefined') return;
    const c = getChartColors();
    Chart.defaults.color = c.muted;
    Chart.defaults.borderColor = c.grid;
    Object.values(charts).forEach(chart => {
      if (chart && chart.options) {
        if (chart.options.scales) {
          Object.values(chart.options.scales).forEach(scale => {
            if (scale.ticks) scale.ticks.color = c.muted;
            if (scale.grid) scale.grid.color = c.grid;
            if (scale.title) scale.title.color = c.muted;
          });
        }
        if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
          chart.options.plugins.legend.labels.color = c.muted;
        }
        chart.update('none');
      }
    });
  }

  function initCharts() {
    if (typeof Chart === 'undefined') {
      setTimeout(initCharts, 200);
      return;
    }

    const c = getChartColors();
    Chart.defaults.font.family = "'Satoshi', sans-serif";
    Chart.defaults.color = c.muted;
    Chart.defaults.borderColor = c.grid;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.padding = 16;

    const commonScaleOptions = {
      ticks: { color: c.muted, font: { size: 11 } },
      grid: { color: c.grid },
    };

    // CHART 3: Regional Obesity
    const regionCtx = document.getElementById('chartRegion');
    if (regionCtx) {
      charts.region = new Chart(regionCtx, {
        type: 'bar',
        data: {
          labels: ['South', 'North', 'West', 'Northwest', 'Central', 'East'],
          datasets: [{
            label: 'Obesity Prevalence (%)',
            data: [46.51, 45.33, 44.27, 43.3, 36.58, 32.96],
            backgroundColor: [
              '#E63946', '#ff4d5a', '#F4A261', '#F4A261', '#457B9D', '#457B9D'
            ],
            borderRadius: 6,
            borderSkipped: false,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.parsed.y}%`
              }
            }
          },
          scales: {
            y: { ...commonScaleOptions, beginAtZero: true, max: 55, title: { display: true, text: 'Prevalence (%)', color: c.muted } },
            x: { ...commonScaleOptions }
          },
          animation: { duration: 800, easing: 'easeOutCubic' }
        }
      });
    }

    // CHART 4: NFHS Trends
    const nfhsCtx = document.getElementById('chartNFHS');
    if (nfhsCtx) {
      charts.nfhs = new Chart(nfhsCtx, {
        type: 'line',
        data: {
          labels: ['NFHS-4 (2015-16)', 'NFHS-5 (2019-21)'],
          datasets: [
            {
              label: 'Men (18-49)',
              data: [37.71, 44.02],
              borderColor: '#457B9D',
              backgroundColor: 'rgba(69,123,157,0.1)',
              fill: true,
              tension: 0.4,
              pointRadius: 6,
              pointBackgroundColor: '#457B9D',
              borderWidth: 3,
            },
            {
              label: 'Women (18-49)',
              data: [36.14, 41.16],
              borderColor: '#E63946',
              backgroundColor: 'rgba(230,57,70,0.1)',
              fill: true,
              tension: 0.4,
              pointRadius: 6,
              pointBackgroundColor: '#E63946',
              borderWidth: 3,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { color: c.muted } },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%`
              }
            }
          },
          scales: {
            y: { ...commonScaleOptions, min: 30, max: 50, title: { display: true, text: 'Overweight/Obese (%)', color: c.muted } },
            x: { ...commonScaleOptions }
          },
          animation: { duration: 1000, easing: 'easeOutCubic' }
        }
      });
    }

    // State-wise top 10
    const statesCtx = document.getElementById('chartStates');
    if (statesCtx) {
      charts.states = new Chart(statesCtx, {
        type: 'bar',
        data: {
          labels: ['Puducherry', 'Chandigarh', 'Punjab', 'Delhi', 'Tamil Nadu', 'Kerala', 'Sikkim', 'Manipur', 'Telangana', 'Karnataka'],
          datasets: [{
            label: 'Overweight/Obese (%)',
            data: [46, 44, 41, 41, 40, 38, 35, 34, 30, 30],
            backgroundColor: function (ctx) {
              const val = ctx.raw;
              if (val >= 44) return '#E63946';
              if (val >= 40) return '#ff6b75';
              if (val >= 35) return '#F4A261';
              return '#457B9D';
            },
            borderRadius: 6,
            borderSkipped: false,
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `${ctx.parsed.x}%` } }
          },
          scales: {
            x: { ...commonScaleOptions, beginAtZero: true, max: 55, title: { display: true, text: 'Prevalence (%)', color: c.muted } },
            y: { ...commonScaleOptions }
          },
          animation: { duration: 800, easing: 'easeOutCubic' }
        }
      });
    }

    // CHART 1: STEP Trials
    const stepCtx = document.getElementById('chartSTEP');
    if (stepCtx) {
      charts.step = new Chart(stepCtx, {
        type: 'bar',
        data: {
          labels: ['STEP 1', 'STEP 2', 'STEP 3', 'STEP 4', 'STEP 5', 'STEP 8'],
          datasets: [
            {
              label: 'Semaglutide',
              data: [14.9, 9.6, 16.0, 17.4, 15.2, 15.8],
              backgroundColor: '#E63946',
              borderRadius: 6,
              borderSkipped: false,
            },
            {
              label: 'Placebo/Comparator',
              data: [2.4, 3.4, 5.7, 6.9, 2.6, 6.4],
              backgroundColor: '#9ca3af',
              borderRadius: 6,
              borderSkipped: false,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { color: c.muted } },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label}: -${ctx.parsed.y}%`,
                afterBody: function (tooltipItems) {
                  const labels = ['STEP 1', 'STEP 2', 'STEP 3', 'STEP 4', 'STEP 5', 'STEP 8'];
                  const pmcs = ['PMC9067867', 'PMC9067799', 'PMC7905697', 'PMC7988425', 'PMC9556320', 'PMC8753508'];
                  const idx = tooltipItems[0].dataIndex;
                  return `Source: ${pmcs[idx]}`;
                }
              }
            }
          },
          scales: {
            y: { ...commonScaleOptions, beginAtZero: true, max: 22, title: { display: true, text: 'Weight Loss (%)', color: c.muted } },
            x: { ...commonScaleOptions }
          },
          animation: { duration: 800, easing: 'easeOutCubic' }
        }
      });
    }

    // CHART 2: Drug Comparison
    const drugsCtx = document.getElementById('chartDrugs');
    if (drugsCtx) {
      charts.drugs = new Chart(drugsCtx, {
        type: 'bar',
        data: {
          labels: ['Tirzepatide 15mg', 'Semaglutide 2.4mg', 'Liraglutide 3mg', 'Orlistat', 'Diet & Exercise'],
          datasets: [{
            label: 'Average Weight Loss (%)',
            data: [22.5, 15.8, 8.0, 3.0, 2.4],
            backgroundColor: ['#2A9D8F', '#E63946', '#457B9D', '#F4A261', '#9ca3af'],
            borderRadius: 6,
            borderSkipped: false,
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `-${ctx.parsed.x}% weight loss` } }
          },
          scales: {
            x: { ...commonScaleOptions, beginAtZero: true, max: 28, title: { display: true, text: 'Weight Loss (%)', color: c.muted } },
            y: { ...commonScaleOptions }
          },
          animation: { duration: 800, easing: 'easeOutCubic' }
        }
      });
    }

    // CHART 5: Cardiovascular
    const cardioCtx = document.getElementById('chartCardio');
    if (cardioCtx) {
      charts.cardio = new Chart(cardioCtx, {
        type: 'doughnut',
        data: {
          labels: ['MACE Reduction', 'Stroke Reduction', 'Remaining Risk'],
          datasets: [{
            data: [20, 35, 45],
            backgroundColor: ['#E63946', '#2A9D8F', 'rgba(156,163,175,0.15)'],
            borderWidth: 0,
            hoverOffset: 8,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: { position: 'bottom', labels: { color: c.muted, padding: 12 } },
            tooltip: {
              callbacks: {
                label: ctx => {
                  if (ctx.label === 'Remaining Risk') return '';
                  return `${ctx.label}: ${ctx.parsed}%`;
                }
              }
            }
          },
          animation: { animateRotate: true, duration: 1000 }
        }
      });
    }

    // CHART 7: Weight Loss Timeline
    const timelineCtx = document.getElementById('chartTimeline');
    if (timelineCtx) {
      charts.timeline = new Chart(timelineCtx, {
        type: 'line',
        data: {
          labels: ['Week 0', 'Week 4', 'Week 12', 'Week 24', 'Week 44', 'Week 68'],
          datasets: [{
            label: 'Weight Loss (%)',
            data: [0, -3, -7, -11, -14, -15.8],
            borderColor: '#E63946',
            backgroundColor: function (ctx) {
              const chart = ctx.chart;
              const { ctx: canvasCtx, chartArea } = chart;
              if (!chartArea) return 'rgba(230,57,70,0.1)';
              const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, 'rgba(230,57,70,0.25)');
              gradient.addColorStop(1, 'rgba(230,57,70,0.02)');
              return gradient;
            },
            fill: true,
            tension: 0.4,
            pointRadius: 8,
            pointBackgroundColor: '#E63946',
            pointBorderColor: '#fff',
            pointBorderWidth: 3,
            pointHoverRadius: 12,
            borderWidth: 3,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.parsed.y}% weight loss`
              }
            }
          },
          scales: {
            y: { ...commonScaleOptions, min: -20, max: 2, reverse: false, title: { display: true, text: 'Weight Change (%)', color: c.muted } },
            x: { ...commonScaleOptions }
          },
          animation: { duration: 1200, easing: 'easeOutCubic' }
        }
      });
    }
  }

  // Lazy-init charts on scroll
  const chartSection = document.getElementById('crisis');
  if (chartSection) {
    const chartObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          initCharts();
          chartObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    chartObserver.observe(chartSection);
  }

  // Also init when science section is visible (for remaining charts)
  const scienceSection = document.getElementById('science');
  if (scienceSection) {
    const scienceObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          initCharts();
          scienceObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    scienceObserver.observe(scienceSection);
  }

  // ===========================================
  // EVIDENCE FILTER
  // ===========================================
  const filterBtns = document.querySelectorAll('.filter-btn');
  const evidenceCards = document.querySelectorAll('.evidence-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      evidenceCards.forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });

  // ===========================================
  // MULTI-STEP FORM
  // ===========================================
  let currentStep = 1;
  const totalSteps = 6;
  const form = document.getElementById('assessmentForm');
  const progressFill = document.getElementById('progressFill');
  const progressSteps = document.querySelectorAll('.form-progress__step');

  function showStep(step) {
    document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
    const target = document.querySelector(`[data-form-step="${step}"]`);
    if (target) target.classList.add('active');

    if (progressFill) progressFill.style.width = `${(step / totalSteps) * 100}%`;
    progressSteps.forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.step) === step);
    });
    currentStep = step;
    // Re-init lucide icons for new step
    initLucide();
  }

  document.querySelectorAll('.form-next').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentStep < totalSteps) {
        showStep(currentStep + 1);
      } else {
        showStep(totalSteps);
      }
    });
  });

  document.querySelectorAll('.form-prev').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentStep > 1) showStep(currentStep - 1);
    });
  });

  // BMI Calculator (within form)
  const weightInput = document.querySelector('[name="weight"]');
  const heightInput = document.querySelector('[name="height"]');
  const bmiDisplay = document.getElementById('bmiDisplay');
  const bmiValue = document.getElementById('bmiValue');
  const bmiClass = document.getElementById('bmiClass');

  function calculateBMI() {
    const w = parseFloat(weightInput?.value);
    const h = parseFloat(heightInput?.value) / 100;
    if (w && h && h > 0) {
      const bmi = (w / (h * h)).toFixed(1);
      if (bmiDisplay) bmiDisplay.style.display = 'block';
      if (bmiValue) bmiValue.textContent = bmi;
      let classification = '';
      let color = '';
      if (bmi < 18.5) { classification = 'Underweight'; color = '#457B9D'; }
      else if (bmi < 23) { classification = 'Normal (Indian Standard)'; color = '#2A9D8F'; }
      else if (bmi < 25) { classification = 'Overweight (Indian Standard)'; color = '#F4A261'; }
      else { classification = 'Obese (Indian Standard: BMI ≥25)'; color = '#E63946'; }
      if (bmiClass) { bmiClass.textContent = classification; bmiClass.style.color = color; }
    }
  }

  if (weightInput) weightInput.addEventListener('input', calculateBMI);
  if (heightInput) heightInput.addEventListener('input', calculateBMI);

  // ===========================================
  // COST CALCULATOR
  // ===========================================
  const calcProgram = document.getElementById('calcProgram');
  const calcDrug = document.getElementById('calcDrug');
  const calcTotal = document.getElementById('calcTotal');

  function updateCalc() {
    if (!calcProgram || !calcDrug || !calcTotal) return;
    const program = parseInt(calcProgram.value);
    const drug = parseInt(calcDrug.value);
    // Determine months based on program
    let months = 1;
    if (program === 12999) months = 3;
    else if (program === 21999) months = 6;
    else if (program === 29999) months = 12;
    // Drug discount for premium/total reset
    let drugDiscount = 1;
    if (program === 21999) drugDiscount = 0.9;
    if (program === 29999) drugDiscount = 0.8;
    const total = program + Math.round(drug * drugDiscount * months);
    calcTotal.textContent = '₹' + total.toLocaleString('en-IN');
  }

  if (calcProgram) calcProgram.addEventListener('change', updateCalc);
  if (calcDrug) calcDrug.addEventListener('change', updateCalc);
  updateCalc();

  // ===========================================
  // PAYMENT (Razorpay Demo)
  // ===========================================
  const payBtn = document.getElementById('payBtn');
  if (payBtn) {
    payBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Collect form data
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      // Validate consents
      const consents = form.querySelectorAll('[data-form-step="5"] input[type="checkbox"][required]');
      let allConsented = true;
      consents.forEach(c => { if (!c.checked) allConsented = false; });

      if (!allConsented) {
        alert('Please agree to all consent checkboxes before proceeding.');
        return;
      }

      // Demo: Save to in-memory store
      const submissions = window.__patientSubmissions || [];
      const weight = parseFloat(data.weight) || 0;
      const height = (parseFloat(data.height) || 170) / 100;
      const bmi = height > 0 ? (weight / (height * height)).toFixed(1) : 'N/A';

      submissions.push({
        name: data.name || 'Anonymous',
        email: data.email || 'N/A',
        phone: data.phone || 'N/A',
        bmi: bmi,
        program: data.program || 'N/A',
        status: 'Pending',
        date: new Date().toLocaleString('en-IN'),
      });
      window.__patientSubmissions = submissions;

      // Show success step
      showStep(7);
    });
  }

  // ===========================================
  // ADMIN PANEL
  // ===========================================
  const adminOverlay = document.getElementById('adminOverlay');
  const adminClose = document.getElementById('adminClose');
  const adminLogin = document.getElementById('adminLogin');
  const adminContent = document.getElementById('adminContent');
  const adminPassword = document.getElementById('adminPassword');
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  const adminTableBody = document.getElementById('adminTableBody');
  const adminEmpty = document.getElementById('adminEmpty');

  function checkHash() {
    if (window.location.hash === '#admin') {
      if (adminOverlay) adminOverlay.style.display = 'flex';
    } else if (window.location.hash === '#privacy' || window.location.hash === '#terms' || window.location.hash === '#refund') {
      showPolicy(window.location.hash.slice(1));
    }
  }

  window.addEventListener('hashchange', checkHash);
  checkHash();

  if (adminClose) {
    adminClose.addEventListener('click', () => {
      adminOverlay.style.display = 'none';
      history.replaceState(null, '', window.location.pathname);
      initLucide();
    });
  }

  if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', () => {
      if (adminPassword.value === 'akiva2024') {
        adminLogin.style.display = 'none';
        adminContent.style.display = 'block';
        renderAdminTable();
        initLucide();
      } else {
        alert('Invalid password.');
      }
    });
  }

  function renderAdminTable() {
    const submissions = window.__patientSubmissions || [];
    if (submissions.length === 0) {
      if (adminEmpty) adminEmpty.style.display = 'block';
      if (adminTableBody) adminTableBody.innerHTML = '';
      return;
    }
    if (adminEmpty) adminEmpty.style.display = 'none';
    if (adminTableBody) {
      adminTableBody.innerHTML = submissions.map((s, i) => `
        <tr>
          <td>${s.name}</td>
          <td>${s.email}</td>
          <td>${s.bmi}</td>
          <td>${s.program}</td>
          <td><span style="color:${s.status === 'Approved' ? '#2A9D8F' : s.status === 'Rejected' ? '#E63946' : '#F4A261'}">${s.status}</span></td>
          <td>
            <button class="admin-btn admin-btn--approve" onclick="window.__approvePatient(${i})">Approve</button>
            <button class="admin-btn admin-btn--reject" onclick="window.__rejectPatient(${i})">Reject</button>
            <button class="admin-btn admin-btn--info" onclick="window.__requestInfo(${i})">Info</button>
          </td>
        </tr>
      `).join('');
    }
  }

  window.__approvePatient = function (i) {
    if (window.__patientSubmissions && window.__patientSubmissions[i]) {
      window.__patientSubmissions[i].status = 'Approved';
      renderAdminTable();
    }
  };
  window.__rejectPatient = function (i) {
    if (window.__patientSubmissions && window.__patientSubmissions[i]) {
      window.__patientSubmissions[i].status = 'Rejected';
      renderAdminTable();
    }
  };
  window.__requestInfo = function (i) {
    if (window.__patientSubmissions && window.__patientSubmissions[i]) {
      window.__patientSubmissions[i].status = 'Info Requested';
      renderAdminTable();
    }
  };

  // ===========================================
  // POLICY MODALS
  // ===========================================
  const policyOverlay = document.getElementById('policyOverlay');
  const policyClose = document.getElementById('policyClose');
  const policyContent = document.getElementById('policyContent');

  const policies = {
    privacy: `
      <h2>Privacy Policy</h2>
      <p><strong>Last Updated: April 2026</strong></p>
      <h3>Data Protection (DPDP Act 2023 Compliance)</h3>
      <p>India Fat to Fit (operated by Akiva Health) is committed to protecting your personal and health data in compliance with the Digital Personal Data Protection Act, 2023.</p>
      <h3>Data We Collect</h3>
      <ul>
        <li>Personal identification information (name, email, phone, DOB, address)</li>
        <li>Health and medical data (weight, height, BMI, medical history, medications)</li>
        <li>Lifestyle information (diet, activity, sleep patterns)</li>
        <li>Payment information (processed securely via Razorpay — we do not store card details)</li>
      </ul>
      <h3>How We Use Your Data</h3>
      <p>Your data is used exclusively for: providing medical consultation, creating personalized treatment plans, processing payments, communicating about your treatment, and improving our services.</p>
      <h3>Data Retention</h3>
      <p>We retain your health data for the duration required by medical regulations and for 7 years after your last consultation, as required by Indian medical record-keeping laws.</p>
      <h3>Your Rights</h3>
      <p>Under DPDP Act 2023, you have the right to: access your data, correction, erasure (subject to medical regulations), and data portability.</p>
      <h3>Contact</h3>
      <p>Data Protection Officer: care@indiafattofit.com | +91-7801009912</p>
    `,
    terms: `
      <h2>Terms & Conditions</h2>
      <p><strong>Last Updated: April 2026</strong></p>
      <h3>Service Description</h3>
      <p>India Fat to Fit provides telehealth weight management services, including medical consultation, prescription of GLP-1 receptor agonist medications, and personalized diet plans.</p>
      <h3>Medical Disclaimer</h3>
      <p>Our services are provided by licensed medical practitioners. However, telehealth consultations have limitations. In case of medical emergency, contact local emergency services immediately.</p>
      <h3>Prescription Medications</h3>
      <p>GLP-1 medications are prescription drugs. Our doctors will determine eligibility based on your health assessment. Not everyone qualifies for treatment.</p>
      <h3>Payment Terms</h3>
      <p>All fees must be paid in advance. Program fees and medication costs are separate. Prices are subject to change without notice.</p>
      <h3>Refund Policy</h3>
      <p><strong>STRICTLY NO REFUND.</strong> All payments — consultation fees (₹999), program fees, and medication costs — are final and non-refundable under any circumstances.</p>
      <h3>Governing Law</h3>
      <p>These terms are governed by the laws of India. Any disputes shall be resolved in courts of Hyderabad, Telangana.</p>
    `,
    refund: `
      <h2>Refund Policy</h2>
      <p><strong>STRICTLY NO REFUND POLICY</strong></p>
      <p>India Fat to Fit (Akiva Health) maintains a strict no-refund policy on all services and products.</p>
      <h3>What This Means</h3>
      <ul>
        <li>Consultation fee (₹999) is non-refundable</li>
        <li>Program fees (₹4,999 - ₹29,999) are non-refundable</li>
        <li>Medication costs are non-refundable once ordered</li>
        <li>Supplement purchases are non-refundable</li>
        <li>No partial refunds, credits, or transfers</li>
      </ul>
      <h3>Why This Policy Exists</h3>
      <p>Medical consultations involve professional doctor time, personalized plan creation, and prescription generation — all of which are executed upon payment.</p>
      <h3>Acknowledgment</h3>
      <p>By proceeding with any payment, you explicitly acknowledge and agree to this no-refund policy.</p>
      <p>For concerns, contact: care@indiafattofit.com</p>
    `
  };

  function showPolicy(type) {
    if (policyOverlay && policyContent && policies[type]) {
      policyContent.innerHTML = policies[type];
      policyOverlay.style.display = 'flex';
      initLucide();
    }
  }

  if (policyClose) {
    policyClose.addEventListener('click', () => {
      policyOverlay.style.display = 'none';
      history.replaceState(null, '', window.location.pathname);
    });
  }

  // Handle policy links within page
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#privacy"], a[href^="#terms"], a[href^="#refund"]');
    if (link) {
      e.preventDefault();
      const type = link.getAttribute('href').slice(1);
      showPolicy(type);
    }
  });

  // ===========================================
  // NAV SCROLL EFFECT
  // ===========================================
  let lastScroll = 0;
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    const scroll = window.scrollY;
    if (nav) {
      if (scroll > 50) {
        nav.style.boxShadow = 'var(--shadow-md)';
      } else {
        nav.style.boxShadow = 'none';
      }
    }
    lastScroll = scroll;
  }, { passive: true });

})();
