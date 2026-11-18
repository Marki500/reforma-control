document.documentElement.classList.add('js');

const screens = {
  resumen: { image: 'dashboard.jpg', location: 'Resumen de obra', title: 'Abre la app. Sitúate. Sigue.', description: 'Lo que necesita atención, las cifras de tu reforma y las decisiones pendientes. Una visión general antes de entrar al detalle.', alt: 'Resumen de obra de NIVEL: próximos pasos, gastos registrados, pagado y pendiente' },
  gastos: { image: 'gastos.jpg', location: 'Gastos y pagos', title: 'Cada euro, con su historia.', description: 'Consulta lo previsto, lo gastado y lo pendiente. Divide los pagos en fases y ten claro quién se encarga de cada gasto.', alt: 'Pantalla real de gastos con importes pagados, pendientes y pagos por fases' },
  materiales: { image: 'materiales.jpg', location: 'Materiales', title: 'Elegir también es poner orden.', description: 'Precios, cantidades, tiendas y estados, juntos. Guarda tus opciones y sigue cada material desde la primera búsqueda hasta la compra.', alt: 'Tabla de materiales real con un grifo, ventanas y un mueble de baño, sus precios y estados' },
  planos: { image: 'planos-v2.jpg', location: 'Editor de planos 2D', title: 'Las ideas se entienden mejor en un plano.', description: 'Dibuja paredes, coloca puertas y ventanas y ajusta tu distribución. Después explora el espacio con una vista 3D orientativa.', alt: 'Editor real de planos 2D de NIVEL con habitaciones, paredes y medidas' },
  facturas: { image: 'facturas-v2.jpg', location: 'Facturas', title: 'El documento y el gasto, conectados.', description: 'Guarda las facturas y revisa sus datos antes de registrarlas en Gastos. La IA puede ayudarte con la extracción; la última revisión es tuya.', alt: 'Pantalla real de facturas con documento, proveedor, número de factura y gasto vinculado' },
};

const tabs = [...document.querySelectorAll('[data-screen]')];
const productImage = document.querySelector('#product-image');
function animateImage(image) {
  image.classList.remove('image-swap');
  void image.offsetWidth;
  image.classList.add('image-swap');
}
function selectScreen(key, focus = false) {
  const screen = screens[key];
  if (!screen) return;
  tabs.forEach(tab => { const active = tab.dataset.screen === key; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; if (active && focus) tab.focus(); });
  const panel = document.querySelector('#product-panel');
  panel.setAttribute('aria-labelledby', `tab-${key}`);
  productImage.src = `assets/${screen.image}`;
  productImage.alt = screen.alt;
  productImage.parentElement.dataset.image = productImage.src;
  productImage.parentElement.dataset.title = screen.location;
  productImage.parentElement.setAttribute('aria-label', `Ampliar captura de ${screen.location}`);
  document.querySelector('#screen-location').textContent = `NIVEL / ${screen.location}`;
  document.querySelector('#screen-title').textContent = screen.title;
  document.querySelector('#screen-description').textContent = screen.description;
  animateImage(productImage);
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectScreen(tab.dataset.screen));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectScreen(tabs[next].dataset.screen, true); }
  });
});
document.querySelectorAll('[data-select-screen]').forEach(link => link.addEventListener('click', () => selectScreen(link.dataset.selectScreen)));

const planImage = document.querySelector('#plan-image');
document.querySelectorAll('[data-plan]').forEach(button => button.addEventListener('click', () => {
  const is3d = button.dataset.plan === '3d';
  document.querySelectorAll('[data-plan]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
  planImage.src = `assets/${is3d ? 'planos-3d' : 'planos-v2'}.jpg`;
  planImage.alt = is3d ? 'Visor 3D real de NIVEL con una distribución de dos habitaciones' : 'Editor real de planos 2D con paredes, puertas, ventanas y medidas';
  planImage.parentElement.dataset.image = planImage.src;
  planImage.parentElement.dataset.title = is3d ? 'Vista 3D de NIVEL' : 'Editor de planos 2D de NIVEL';
  animateImage(planImage);
}));

const dialog = document.querySelector('#image-dialog');
function openImage(src, title) {
  document.querySelector('#dialog-image').src = src;
  document.querySelector('#dialog-image').alt = title;
  document.querySelector('#dialog-title').textContent = title;
  dialog.showModal();
}
document.querySelectorAll('.image-zoom').forEach(button => button.addEventListener('click', () => openImage(button.dataset.image, button.dataset.title)));
document.querySelector('.expand-shot').addEventListener('click', () => openImage(productImage.src, document.querySelector('#screen-location').textContent));
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });

const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('#mobile-menu');
function closeMenu() { menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Abrir menú'); }
menuButton.addEventListener('click', () => { const open = menuButton.getAttribute('aria-expanded') !== 'true'; menu.hidden = !open; menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú'); });
menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { closeMenu(); menuButton.focus(); } });
document.addEventListener('click', event => { if (!menu.hidden && !menu.contains(event.target) && !menuButton.contains(event.target)) closeMenu(); });

const themeButton = document.querySelector('.theme-toggle');
const mediaTheme = matchMedia('(prefers-color-scheme: dark)');
let chosenTheme;
try { chosenTheme = localStorage.getItem('nivel-landing-theme'); } catch { /* Theme stays session-local when storage is unavailable. */ }
if (['light', 'dark'].includes(chosenTheme)) document.documentElement.dataset.theme = chosenTheme;
function isDark() { return document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : mediaTheme.matches; }
function updateThemeLabel() { themeButton.setAttribute('aria-label', `Cambiar a tema ${isDark() ? 'claro' : 'oscuro'}`); }
themeButton.addEventListener('click', () => { const theme = isDark() ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; try { localStorage.setItem('nivel-landing-theme', theme); } catch {} updateThemeLabel(); });
mediaTheme.addEventListener('change', updateThemeLabel);
updateThemeLabel();

const financeDetails = [...document.querySelectorAll('[data-finance]')];
financeDetails.forEach(detail => detail.addEventListener('toggle', () => { if (detail.open) financeDetails.forEach(other => { if (other !== detail) other.open = false; }); }));

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }), { threshold: .08 });
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
} else document.querySelectorAll('.reveal').forEach(element => element.classList.add('visible'));
