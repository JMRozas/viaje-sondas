/* Viaje de las sondas por el Sistema Solar — versión web.
   Versión simplificada del visor de escritorio (viaje_sondas.py): mismos datos, exportados a JSON por
   exportar_web.py. Todo se dibuja en <canvas>, a escala real, visto desde el norte de la eclíptica. */
"use strict";

// ------------------------------------------------------------------------------------------------
// Constantes
// ------------------------------------------------------------------------------------------------
const UA_KM = 149597870.7, C_KM_S = 299792.458, DIA_LUZ_UA = 86400 * C_KM_S / UA_KM;
const MAG_SOL_1UA = -26.74, MAG_LUNA_LLENA = -12.74, JD_J2000 = 2451545.0;
const DURACION_BREVE_S = 6, DURACION_BREVE_FOTOS_S = 12, DURACION_ORBITAL_S = 180;
const PAUSA_FOTO_ORBITAL_S = 4, PAUSA_FOTO_S = 2.5, DIAS_CERCA = 8, VENTANA_AVISO = 420, PASO_MS = 40;
// La versión de escritorio pide un paso cada 40 ms, pero dibujar cada paso con matplotlib le lleva más: lo
// que tarda de verdad lo mide al cerrar su ventana y exportar_web lo pasa a datos/indice.json (ms_por_paso).
// El navegador dibuja a 25 fotogramas por segundo, así que cada fotograma avanza solo esta fracción de un
// paso para ir al mismo ritmo (y igual de suave).
let RITMO = PASO_MS / 95;
const TEXTO = "#e6e9ef", TENUE = "#8a93a6", PANEL = "#11161f";

// elementos keplerianos aproximados (JPL, Standish), J2000, eclíptica: a, e, I, L, varpi, Omega y por siglo
const ELEMENTOS = {
  "Mercurio": [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
               [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  "Venus": [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
            [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
  "Tierra": [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
             [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
  "Marte": [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
            [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  "Júpiter": [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
              [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  "Saturno": [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
              [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  "Urano": [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
            [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  "Neptuno": [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
              [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
  "Plutón": [[39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684],
             [-0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482]],
};
const PLANETAS = Object.keys(ELEMENTOS);
const COLOR_PLANETA = {
  "Mercurio": "#b0a99f", "Venus": "#e8cda2", "Tierra": "#4f9de0", "Marte": "#d0643a", "Júpiter": "#d8b08c",
  "Saturno": "#e3d18a", "Urano": "#9fe0e6", "Neptuno": "#5b7fe8", "Plutón": "#c9b6a0",
};
const FRANJAS = [
  [2.1, 3.3, "Cinturón de asteroides (2,1–3,3 UA)", "#a1887f"],
  [30.0, 50.0, "Cinturón de Kuiper (30–50 UA)", "#80cbc4"],
];
const DESCRIPCION = {
  "Voyager 1": "Júpiter y Saturno (1979-1980), el retrato de familia y el espacio interestelar",
  "Voyager 2": "Júpiter, Saturno, Urano y Neptuno (1979-1989); hoy, en el espacio interestelar",
  "Pioneer 10": "La primera en cruzar el cinturón de asteroides y en visitar Júpiter (1973)",
  "Pioneer 11": "Júpiter y Saturno (1974 y 1979)",
  "Galileo": "Venus, la Tierra, dos asteroides, el cometa Shoemaker-Levy 9 y 8 años en órbita de Júpiter",
  "Cassini": "Júpiter, Febe y 13 años en órbita de Saturno",
  "New Horizons": "Júpiter, Plutón y Arrokoth",
};
const COL_EVENTO = { planeta: "#90a4ae", choque: "#ff8a65", heliopausa: "#ef5350", fin: "#e57373", hito: "#ce93d8" };
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// ------------------------------------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------------------------------------
const $ = (s) => document.querySelector(s);
const clip = (x, a, b) => Math.max(a, Math.min(b, x));
const rad = (g) => g * Math.PI / 180;
const mod = (a, n) => ((a % n) + n) % n;

/** Número a la española: 18 190,5 */
function num(x, d = 1) {
  if (!isFinite(x)) return "—";
  const s = Math.abs(x).toFixed(d).split(".");
  const ent = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (x < 0 && Number(s.join(".")) !== 0 ? "-" : "") + ent + (s[1] ? "," + s[1] : "");
}
function redondo(x) {
  const e = 10 ** Math.floor(Math.log10(x));
  for (const m of [1, 2, 5, 10]) if (m * e >= x) return m * e;
  return 10 * e;
}
/** primer índice k con a[k] >= x (a creciente) */
function buscar(a, x) {
  let lo = 0, hi = a.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; }
  return lo;
}
function interp(ts, vs, t) {
  const n = ts.length;
  if (t <= ts[0]) return vs[0];
  if (t >= ts[n - 1]) return vs[n - 1];
  const k = buscar(ts, t);
  const t0 = ts[k - 1], t1 = ts[k], v0 = vs[k - 1], v1 = vs[k];
  if (v0 === null || v1 === null) return null;
  return v0 + (v1 - v0) * (t - t0) / (t1 - t0);
}
function arr(v) { return Float64Array.from(v, (x) => (x === null ? NaN : x)); }
function expandirTiempos(o) {
  if (o.t) return arr(o.t);
  const a = new Float64Array(o.n);
  for (let k = 0; k < o.n; k++) a[k] = o.t0 + k * o.dt;
  return a;
}
function hh(s) {
  return s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`
    : `${Math.floor(s / 60)} min ${Math.floor(s % 60)} s`;
}
function percentil(v, p) {
  const a = Array.from(v).filter((x) => isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return NaN;
  const k = (a.length - 1) * p / 100, f = Math.floor(k);
  return a[f] + (a[Math.min(f + 1, a.length - 1)] - a[f]) * (k - f);
}
function maximo(v) { let m = -Infinity; for (const x of v) if (x > m) m = x; return m; }
function base_plano(n) {
  const a = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const cruz = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  let u = cruz(n, a); const L = Math.hypot(...u); u = u.map((x) => x / L);
  return [u, cruz(n, u)];
}

// ------------------------------------------------------------------------------------------------
// Planetas (elementos keplerianos)
// ------------------------------------------------------------------------------------------------
function elementos(p, jd) {
  const [e0, de] = ELEMENTOS[p], T = (jd - JD_J2000) / 36525;
  return e0.map((v, k) => v + de[k] * T);
}
function rotar(xp, yp, w, om, inc) {
  const cw = Math.cos(w), sw = Math.sin(w), co = Math.cos(om), so = Math.sin(om), ci = Math.cos(inc), si = Math.sin(inc);
  return [(cw * co - sw * so * ci) * xp + (-sw * co - cw * so * ci) * yp,
          (cw * so + sw * co * ci) * xp + (-sw * so + cw * co * ci) * yp,
          (sw * si) * xp + (cw * si) * yp];
}
function posicionPlaneta(p, jd) {
  const [a, e, inc, L, varpi, om] = elementos(p, jd);
  const M = rad(mod(L - varpi + 180, 360) - 180);
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return rotar(a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E), rad(varpi - om), rad(om), rad(inc));
}
function orbitaPlaneta(p, n = 721) {
  const [a, e, inc, , varpi, om] = elementos(p, JD_J2000);
  const xs = new Float64Array(n), ys = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const E = 2 * Math.PI * k / (n - 1);
    const q = rotar(a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E), rad(varpi - om), rad(om), rad(inc));
    xs[k] = q[0]; ys[k] = q[1];
  }
  return [xs, ys];
}
const semieje = (p) => ELEMENTOS[p][0][0];
const ORBITAS = Object.fromEntries(PLANETAS.map((p) => [p, orbitaPlaneta(p)]));

// ------------------------------------------------------------------------------------------------
// Estado
// ------------------------------------------------------------------------------------------------
const V = {
  indice: null, d: null, svs: [], momentos: [], segmentos: [[0, 1]],
  t: 0, i: 0, jugando: false, velocidad: 20, ze: 0, enc: null, acercar: false, solo: false, sistemas: null,
  pausaFoto: null, pausa: null, fotoM: 0, _fRapido: new Map(), _fOrbital: new Map(),
  estadoVista: null, imgClave: null, pieMom: null, ampliada: false, timer: null, cargadosTodos: false,
};

// ------------------------------------------------------------------------------------------------
// Datos de una sonda
// ------------------------------------------------------------------------------------------------
function prepararSonda(j) {
  const N = j.N, x = arr(j.P.x), y = arr(j.P.y), z = arr(j.P.z);
  const r = new Float64Array(N), rho = new Float64Array(N), rmax = new Float64Array(N), lat = new Float64Array(N),
    v = new Float64Array(N);
  let m = 0;
  for (let k = 0; k < N; k++) {
    r[k] = Math.hypot(x[k], y[k], z[k]); rho[k] = Math.hypot(x[k], y[k]);
    m = Math.max(m, r[k]); rmax[k] = m;
    lat[k] = Math.asin(clip(z[k] / Math.max(r[k], 1e-9), -1, 1)) * 180 / Math.PI;
  }
  for (let k = 0; k < N; k++) {        // como np.gradient: diferencias centradas
    const a = Math.max(0, k - 1), b = Math.min(N - 1, k + 1);
    v[k] = Math.hypot(x[b] - x[a], y[b] - y[a], z[b] - z[a]) / (b - a || 1) * UA_KM / 86400;
  }
  const f0 = Date.UTC(+j.fecha0.slice(0, 4), +j.fecha0.slice(5, 7) - 1, +j.fecha0.slice(8, 10));
  const d = Object.assign({}, j, { x, y, z, r, rho, rmax, lat, v, f0, jd0: f0 / 86400000 + 2440587.5 });
  d.margen = 0.01 * (j.x_lim[1] - j.x_lim[0]) + 5;
  d.xlim = [j.x_lim[0] - d.margen, j.x_lim[1] + d.margen];
  // círculos: 1 día luz y las fronteras que cruzó (corte de la esfera a la altura de la sonda)
  d.circulos = [];
  const corte = (rr, texto, iCruce) => {
    if (iCruce === undefined) {
      let k = 0; while (k < N && r[k] < rr) k++;
      if (k >= N) return [rr, texto];
      iCruce = k;
    }
    const zz = z[iCruce];
    if (Math.abs(zz) < 0.05 * rr) return [rr, texto];
    return [Math.sqrt(Math.max(rr * rr - zz * zz, 0)), `${texto}; corte a ${num(Math.abs(zz), 0)} UA ${zz < 0 ? "bajo" : "sobre"} la eclíptica`];
  };
  const [rd, td] = corte(DIA_LUZ_UA, "1 día luz (173 UA)");
  d.circulos.push({ r: DIA_LUZ_UA, rd, texto: td, color: "#fff59d", desde: (i) => rmax[i] >= DIA_LUZ_UA, discontinua: true });
  for (const [k, nombre, col] of [["choque", "Choque de terminación", "#ff8a65"], ["heliopausa", "Heliopausa", "#ef5350"]]) {
    if (!j.fronteras[k]) continue;
    const [ic, rr] = j.fronteras[k];
    const [rdk, tk] = corte(rr, `${nombre} (${num(rr, 0)} UA, cruzado por la ${j.nombre})`, ic);
    d.circulos.push({ r: rr, rd: rdk, texto: tk, color: col, desde: (i) => i >= ic, discontinua: false });
  }
  // medidas: medias de 27 días y modelo
  for (const s of d.series) {
    s.v = arr(s.y);
    s.media = mediaMovil(s.v, 27, 7);
    if (s.modelo) {
      s.mod = new Float64Array(N);
      for (let k = 0; k < N; k++) {
        const rr = Math.max(r[k], 0.3);
        s.mod[k] = s.modelo === "parker" ? 3.5 / (rr * rr) * Math.sqrt(1 + rr * rr) : 6 / (rr * rr);
      }
    }
  }
  return d;
}
function mediaMovil(v, ancho, minimo) {
  const n = v.length, out = new Float64Array(n).fill(NaN), h = Math.floor(ancho / 2);
  let suma = 0, cuenta = 0;
  const pon = (k, s) => { if (k >= 0 && k < n && isFinite(v[k])) { suma += s * v[k]; cuenta += s; } };
  for (let k = -h; k <= h; k++) pon(k, 1);
  for (let k = 0; k < n; k++) {
    if (cuenta >= minimo) out[k] = suma / cuenta;
    pon(k - h, -1); pon(k + h + 1, 1);
  }
  return out;
}
const fechaDe = (t) => new Date(V.d.f0 + t * 86400000);
function textoFecha(t, conHora) {
  const f = fechaDe(t), p = (n) => String(n).padStart(2, "0");
  const s = `${f.getUTCFullYear()}-${p(f.getUTCMonth() + 1)}-${p(f.getUTCDate())}`;
  return conHora ? `${s} ${p(f.getUTCHours())}:${p(f.getUTCMinutes())}` : s;
}
function pHelio(t) {
  const d = V.d, k = clip(Math.floor(t), 0, d.N - 2), f = clip(t - k, 0, 1);
  return [d.x[k] * (1 - f) + d.x[k + 1] * f, d.y[k] * (1 - f) + d.y[k + 1] * f, d.z[k] * (1 - f) + d.z[k + 1] * f];
}

// ------------------------------------------------------------------------------------------------
// Un sobrevuelo (equivalente a DatosSobrevuelo de sobrevuelos_vista.py)
// ------------------------------------------------------------------------------------------------
class Sobrevuelo {
  constructor(meta, datos) {
    Object.assign(this, meta);
    this.R = meta.radio_km;
    const s = datos.sonda;
    this.ts = expandirTiempos(s); this.sx = arr(s.x); this.sy = arr(s.y); this.sz = arr(s.z);
    this.sats = {};
    for (const [nom, o] of Object.entries(datos.sats)) {
      const q = { orb: o.orb ? [arr(o.orb[0]), arr(o.orb[1])] : null };
      if (o.circ) q.circ = o.circ;
      else { q.t = expandirTiempos(o); q.x = arr(o.x); q.y = arr(o.y); }
      this.sats[nom] = q;
    }
    if (datos.sol) { this.solT = expandirTiempos(datos.sol); this.solX = arr(datos.sol.x); this.solY = arr(datos.sol.y); }
    this.mag = datos.mag ? { t: arr(datos.mag.t), b: arr(datos.mag.b) } : null;
    if (this.mag) {
      const b = this.mag.b.filter((x) => x > 0);
      this.magLo = percentil(b, 0.5); this.magHi = maximo(b);
    }
    if (datos.h_orb) { this.hT = arr(datos.h_orb.t); this.hH = arr(datos.h_orb.h); }
    this.imagenes.sort((a, b) => a[0] - b[0]);
    const [u, v] = base_plano(this.polo); this.u = u; this.v = v;
  }
  posSonda(t) {
    return [interp(this.ts, this.sx, t), interp(this.ts, this.sy, t), interp(this.ts, this.sz, t)];
  }
  posSat(nom, t) {
    const q = this.sats[nom];
    if (q.circ) {
      const c = q.circ, th = c.th0 + c.n * t;
      return [c.r * (Math.cos(th) * c.u[0] + Math.sin(th) * c.v[0]), c.r * (Math.cos(th) * c.u[1] + Math.sin(th) * c.v[1])];
    }
    return [interp(q.t, q.x, t), interp(q.t, q.y, t)];
  }
  sol(t) { return this.solT ? [interp(this.solT, this.solX, t), interp(this.solT, this.solY, t)] : null; }
  planetaHelio(t) {
    const s = this.sol(t);
    if (s) return [-s[0] / UA_KM, -s[1] / UA_KM];
    const q = posicionPlaneta(this.sistema, V.d.jd0 + t);
    return [q[0], q[1]];
  }
  velRel(t) {
    const dt = 1 / 1440, a = this.posSonda(t - dt), b = this.posSonda(t + dt);
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (2 * dt * 86400);
  }
  hEn(t) { return interp(this.hT, this.hH, t); }
  imagenEn(t) {
    let im = null;
    for (const x of this.imagenes) { if (x[0] <= t) im = x; else break; }
    return im;
  }
}

// ------------------------------------------------------------------------------------------------
// Carga
// ------------------------------------------------------------------------------------------------
async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}
async function cargarSobrevuelos(sistemas) {
  const metas = V.d.sobrevuelos.filter((m) => !sistemas || sistemas.includes(m.sistema));
  const datos = await Promise.all(metas.map((m) => json(m.archivo)));
  V.svs = metas.map((m, k) => new Sobrevuelo(m, datos[k]));
  V.momentos = (V.d.momentos || []).filter((m) => !sistemas || sistemas.includes(m.sistema));
  for (const m of V.momentos) for (const f of m.fotos) { const im = new Image(); im.src = f.img; }
  V._fRapido.clear(); V._fOrbital.clear();
}

async function empezar(opciones) {
  $("#cargando").hidden = false;
  try {
    const sonda = V.indice.sondas.find((s) => s.nombre === opciones.sonda);
    V.d = prepararSonda(await json(`datos/${sonda.clave}.json`));
    V.solo = opciones.modo === "sobrevuelos";
    V.acercar = V.solo || opciones.acercar;
    V.sistemas = (V.acercar && opciones.pasos) ? opciones.pasos : null;
    V.svs = []; V.momentos = []; V.cargadosTodos = false;
    if (V.acercar) await cargarSobrevuelos(V.sistemas);
    V.cargadosTodos = V.acercar && !V.sistemas;
    prepararSegmentos();
    V.ze = 0; V.enc = null; V.estadoVista = "inicio"; V.imgClave = null; V.pieMom = null; V.pausa = null;
    V.pausaFoto = null; V.fotoM = 0; V.jugando = false;
    $("#inicio").hidden = true; $("#visor").hidden = false; $("#controles").hidden = false; $("#volver").hidden = false;
    $("#b-zoom").hidden = V.solo;
    $("#b-zoom").textContent = V.acercar ? "Ampliar: sí" : "Ampliar: no";
    $("#b-play").textContent = "▶ Reproducir";
    prepararSeries();
    ajustarLienzos();
    $("#cabecera").textContent = "Lo que midió la sonda: medias diarias (fino) y de 27 días = una rotación solar " +
      "(grueso); discontinua: modelo teórico. Líneas verticales: sobrevuelos (letra del planeta), choque de " +
      "terminación (CT), heliopausa (HP)." + (V.d.faltan.length ? ` Sin datos publicados de la ${V.d.nombre} ` +
      `(no se dibujan): ${V.d.faltan.join(", ")}.` : "");
    if (V.solo && !V.svs.length && !V.momentos.length) {
      $("#pie").textContent = "No hay ninguno de los pasos elegidos: se muestra el viaje completo.";
    }
    ir(V.segmentos[0][0], true);
    if (!V.timer) V.timer = setInterval(paso, PASO_MS);
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    alert("No se pudieron cargar los datos: " + e.message);
  } finally {
    $("#cargando").hidden = true;
  }
}
function prepararSegmentos() {
  const d = V.d;
  if (V.solo && (V.svs.length || V.momentos.length)) {
    const segs = V.svs.map((sv) => [Math.max(0, sv.t_ini), Math.min(d.N - 1, sv.t_fin)]);
    for (const m of V.momentos) segs.push([Math.max(0, m.t - 15), Math.min(d.N - 1, m.t + 40)]);
    V.segmentos = segs.sort((a, b) => a[0] - b[0]);
  } else {
    V.segmentos = [[0, d.N - 1]];
  }
}

// ------------------------------------------------------------------------------------------------
// Tiempo: pasos, pausas en las fotos y momentos especiales
// ------------------------------------------------------------------------------------------------
function sobrevueloEn(t) {
  if (!V.acercar) return null;
  for (const sv of V.svs) if (sv.t_zoom_ini <= t && t <= sv.t_zoom_fin) return sv;
  return null;
}
function ventanaEn(t) {
  if (!V.acercar) return null;
  for (const sv of V.svs) if (sv.t_ini <= t && t <= sv.t_fin) return sv;
  return null;
}
function momentoEn(t) {
  if (!V.acercar) return null;
  for (const m of V.momentos) if (m.t <= t && t <= m.t + m.dias_foto) return m;
  return null;
}
function factorRapido(sv) {
  if (!V._fRapido.has(sv)) {
    const n = 3000, paso = (sv.t_zoom_fin - sv.t_zoom_ini) / (n - 1);
    let n1 = 0;
    for (let k = 0; k < n; k++) {
      const t = sv.t_zoom_ini + k * paso, p = sv.posSonda(t);
      const h = Math.max(4 * sv.R, 1.4 * Math.hypot(p[0], p[1])), v = Math.max(sv.velRel(t), 1);
      n1 += paso / (h / v / 86400);
    }
    const fotos = sv.imagenes.some((im) => sv.t_zoom_ini <= im[0] && im[0] <= sv.t_zoom_fin);
    V._fRapido.set(sv, n1 / ((fotos ? DURACION_BREVE_FOTOS_S : DURACION_BREVE_S) / 0.04));
  }
  return V._fRapido.get(sv);
}
function factorOrbital(sv) {
  if (!V._fOrbital.has(sv)) {
    let n1 = 0;
    for (let k = 1; k < sv.ts.length; k++) {
      const t = sv.ts[k - 1];
      if (t < sv.t_zoom_ini || t > sv.t_zoom_fin) continue;
      const dt = sv.ts[k] - t;
      const v = Math.max(Math.hypot(sv.sx[k] - sv.sx[k - 1], sv.sy[k] - sv.sy[k - 1], sv.sz[k] - sv.sz[k - 1]) / (dt * 86400), 1);
      n1 += dt / (sv.hEn(t) / v / 86400);
    }
    V._fOrbital.set(sv, n1 / ((sv.duracion_s || DURACION_ORBITAL_S) / 0.04));
  }
  return V._fOrbital.get(sv);
}
function dt(escala = 1) {
  let paso = V.velocidad * escala;
  const sv = sobrevueloEn(V.t);
  if (sv) {
    const p = sv.posSonda(V.t), dd = Math.hypot(p[0], p[1]);
    const h = Math.max(4 * sv.R, 1.4 * dd), v = Math.max(sv.velRel(V.t), 1);
    if (sv.orbital) {
      const x = escala * Math.max(1e-4, factorOrbital(sv) * sv.hEn(V.t) / v / 86400 * V.velocidad / 20);
      return V.ze < 0.98 ? Math.min(x, 0.05 * escala) : x;
    }
    if (sv.rapido) return escala * Math.max(1e-4, factorRapido(sv) * h / v / 86400 * V.velocidad / 20);
    paso = Math.min(paso, escala * Math.max(1 / 1440, 0.01 * h / v / 86400 * V.velocidad / 20));
    if (V.ze < 0.98) paso = Math.min(paso, 0.05 * escala);
  } else if (V.acercar) {
    for (const s of V.svs) {              // no pasar de largo: entrar justo al principio
      if (V.t < s.t_zoom_ini && s.t_zoom_ini <= V.t + paso) { paso = s.t_zoom_ini - V.t + 1e-6; break; }
    }
  }
  return paso;
}
const ahora = () => performance.now() / 1000;
function paso() {
  if (!V.d || $("#visor").hidden) return;
  let cambio = false;
  if (V.pausaFoto !== null) {
    if (V.jugando && ahora() < V.pausaFoto) return;
    V.pausaFoto = null;
  }
  if (V.pausa) {
    const [m, inicio] = V.pausa, tr = ahora() - inicio;
    if (tr < m.pausa_s && V.jugando) {
      const n = Math.max(1, m.fotos.length), k = Math.min(n - 1, Math.floor(tr / (m.pausa_s / n)));
      if (k !== V.fotoM) { V.fotoM = k; ir(V.t); }
      return;
    }
    V.pausa = null; V.fotoM = 0;
  }
  if (V.jugando) {
    let nuevo = V.t + dt(RITMO);
    const ahoraSv = sobrevueloEn(V.t);
    if (V.acercar && (!ahoraSv || ahoraSv.rapido || ahoraSv.orbital)) {
      for (const s of V.svs) {
        if (!(s.t_ini <= nuevo && V.t <= s.t_fin)) continue;
        const prox = s.imagenes.filter((im) => V.t < im[0] && im[0] <= nuevo &&
          (s.rapido || s.orbital || !(s.t_zoom_ini <= im[0] && im[0] <= s.t_zoom_fin))).map((im) => im[0]);
        if (prox.length) {
          nuevo = Math.min(...prox) + 1e-6;
          V.pausaFoto = ahora() + (s.orbital ? PAUSA_FOTO_ORBITAL_S : PAUSA_FOTO_S);
          break;
        }
      }
    }
    if (V.acercar) {
      for (const m of V.momentos) {
        if (V.t < m.t && m.t <= nuevo) { nuevo = m.t; V.pausa = [m, ahora()]; V.fotoM = 0; break; }
      }
    }
    for (let k = 0; k < V.segmentos.length; k++) {      // de un tramo al siguiente
      const [, b] = V.segmentos[k];
      if (V.t <= b && b < nuevo) {
        if (k + 1 < V.segmentos.length) { nuevo = V.segmentos[k + 1][0]; V.ze = 0; }
        else { nuevo = b; alternar(false); }
        break;
      }
    }
    V.t = nuevo; cambio = true;
  }
  const zeObj = sobrevueloEn(V.t) ? 1 : 0;
  if (Math.abs(V.ze - zeObj) > 1e-3) {
    V.ze += clip(zeObj - V.ze, -0.05 * RITMO, 0.05 * RITMO);
    if (Math.abs(V.ze - zeObj) < 0.02) V.ze = zeObj;
    cambio = true;
  }
  if (cambio) ir(V.t);
}
function ir(t, inmediato = false) {
  const a = V.segmentos[0][0], b = V.segmentos[V.segmentos.length - 1][1];
  V.t = clip(t, a, b);
  V.i = clip(Math.floor(V.t), 0, V.d.N - 1);
  if (inmediato) V.ze = sobrevueloEn(V.t) ? 1 : 0;
  if (!V.arrastrando) $("#s-t").value = Math.round(tAFrac(V.t) * 10000);
  dibujar();
}
function alternar(jugar) {
  const j = jugar === undefined ? !V.jugando : jugar;
  if (j && !V.jugando && V.t >= V.segmentos[V.segmentos.length - 1][1] - 1e-6) V.t = V.segmentos[0][0];
  V.jugando = j;
  $("#b-play").textContent = j ? "⏸ Pausa" : "▶ Reproducir";
}
function fracAT(f) {
  const largos = V.segmentos.map(([a, b]) => b - a), total = largos.reduce((x, y) => x + y, 0) || 1;
  let x = f * total;
  for (let k = 0; k < V.segmentos.length; k++) {
    if (x <= largos[k]) return V.segmentos[k][0] + x;
    x -= largos[k];
  }
  return V.segmentos[V.segmentos.length - 1][1];
}
function tAFrac(t) {
  const largos = V.segmentos.map(([a, b]) => b - a), total = largos.reduce((x, y) => x + y, 0) || 1;
  let x = 0;
  for (let k = 0; k < V.segmentos.length; k++) {
    const [a, b] = V.segmentos[k];
    if (t <= b) return (x + Math.max(0, t - a)) / total;
    x += largos[k];
  }
  return 1;
}
async function alternarZoom() {
  if (V.solo) return;
  V.acercar = !V.acercar;
  if (V.acercar && !V.cargadosTodos && !V.sistemas) {
    $("#cargando").hidden = false;
    try { await cargarSobrevuelos(null); V.cargadosTodos = true; } finally { $("#cargando").hidden = true; }
  }
  $("#b-zoom").textContent = V.acercar ? "Ampliar: sí" : "Ampliar: no";
  ir(V.t);
}

// ------------------------------------------------------------------------------------------------
// Lienzos
// ------------------------------------------------------------------------------------------------
const mapa = $("#mapa"), ctx = mapa.getContext("2d");
let DPR = 1, ESTRELLAS = [];
function ajustarLienzos() {
  DPR = window.devicePixelRatio || 1;
  const caja = mapa.getBoundingClientRect();
  mapa.width = Math.round(caja.width * DPR); mapa.height = Math.round(caja.height * DPR);
  let semilla = 7;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };
  ESTRELLAS = Array.from({ length: 450 }, () => [azar(), azar(), azar() ** 3 * 1.4 + 0.3]);
  for (const g of GRAFICAS) g.ajustar();
  if (V.d) dibujar();
}
window.addEventListener("resize", () => { clearTimeout(V._rs); V._rs = setTimeout(ajustarLienzos, 150); });

// ------------------------------------------------------------------------------------------------
// Dibujo del mapa
// ------------------------------------------------------------------------------------------------
function encuadre() {
  const d = V.d, i = V.i, rho = d.rho[i], s = clip((rho - 2) / 8, 0, 1);
  return [[0.5 * d.x[i] * s, 0.5 * d.y[i] * s], Math.max(1.75, rho * (1.25 - 0.625 * s))];
}
function dibujar() {
  const d = V.d, i = V.i, W = mapa.width, H = mapa.height;
  let [c, h] = encuadre();
  let sv = sobrevueloEn(V.t);
  if (!sv && V.ze > 0 && V.enc) sv = V.enc;
  const w = sv ? V.ze * V.ze * (3 - 2 * V.ze) : 0;
  let centro = null;
  if (sv) {
    centro = sv.planetaHelio(V.t);
    const p = sv.posSonda(V.t);
    let he = Math.max(4 * sv.R, 1.4 * Math.hypot(p[0], p[1])) / UA_KM;
    if (sv.orbital) he = sv.hEn(V.t) / UA_KM;
    if (V.t > sv.t_zoom_fin || V.t < sv.t_zoom_ini) {
      // saliendo de la vista ampliada: los datos del sobrevuelo se acaban y la sonda sigue; el encuadre
      // se abre lo necesario para que no se salga
      const ph = pHelio(V.t);
      he = Math.max(he, 1.25 * Math.hypot(ph[0] - centro[0], ph[1] - centro[1]));
    }
    const h0 = h;
    h = Math.exp((1 - w) * Math.log(h0) + w * Math.log(he));
    // el centro se desplaza al mismo ritmo que se cierra el encuadre: así el planeta (y la sonda, junto a
    // él) no se salen de la vista mientras se amplía o se reduce
    const f = h0 > he * 1.0001 ? (h - he) / (h0 - he) : 1 - w;
    c = [centro[0] + (c[0] - centro[0]) * f, centro[1] + (c[1] - centro[1]) * f];
  }
  V.enc = w > 0 ? sv : null;
  cambioDeVista(w > 0.5 ? sv : null, ventanaEn(V.t));

  const esc = W / (2 * h), X = (x) => W / 2 + (x - c[0]) * esc, Y = (y) => H / 2 - (y - c[1]) * esc;
  const enVista = (x, y, m = 0.04) => Math.abs(x - c[0]) < h * (1 - m) && Math.abs(y - c[1]) < h * (1 - m);
  const g = ctx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,0.45)";
  for (const [ex, ey, er] of ESTRELLAS) { g.beginPath(); g.arc(ex * W, ey * H, er * DPR, 0, 7); g.fill(); }
  const kt = 1.4 * clip(mapa.clientWidth / 800, 0.68, 1);   // letra algo menor en pantallas estrechas
  const fuente = (px, peso = "") => `${peso} ${px * kt * DPR}px system-ui, sans-serif`;
  const r = d.r[i], rmax = d.rmax[i], enPlaneta = w > 0.3;

  // rótulo de una curva en su trozo visible más cercano al centro
  const rotular = (texto, color, xs, ys, px = 7.5) => {
    let mejor = -1, dm = Infinity;
    for (let k = 0; k < xs.length; k += 2) {
      if (!enVista(xs[k], ys[k], 0.08)) continue;
      const q = (xs[k] - c[0]) ** 2 + (ys[k] - c[1]) ** 2;
      if (q < dm) { dm = q; mejor = k; }
    }
    if (mejor < 0) return;
    g.font = fuente(px); g.fillStyle = color; g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillText(texto, X(xs[mejor] + 0.012 * h), Y(ys[mejor] + 0.012 * h));
  };
  const circulo = (rr) => {
    const n = 721, xs = new Float64Array(n), ys = new Float64Array(n);
    for (let k = 0; k < n; k++) { xs[k] = rr * Math.cos(2 * Math.PI * k / (n - 1)); ys[k] = rr * Math.sin(2 * Math.PI * k / (n - 1)); }
    return [xs, ys];
  };

  // franjas y círculos característicos
  if (!enPlaneta) {
    for (const [r1, r2, txt, col] of FRANJAS) {
      if (rmax < r1) continue;
      g.beginPath(); g.arc(X(0), Y(0), r2 * esc, 0, 2 * Math.PI); g.arc(X(0), Y(0), r1 * esc, 0, 2 * Math.PI, true);
      g.globalAlpha = 0.16; g.fillStyle = col; g.fill("evenodd"); g.globalAlpha = 1;
      if ((r2 - r1) / h > 0.02) { const [xs, ys] = circulo((r1 + r2) / 2); rotular(txt, col, xs, ys); }
    }
    for (const cc of d.circulos) {
      if (!cc.desde(i)) continue;
      g.beginPath(); g.arc(X(0), Y(0), cc.rd * esc, 0, 2 * Math.PI);
      g.strokeStyle = cc.color; g.globalAlpha = 0.8; g.lineWidth = DPR;
      g.setLineDash(cc.discontinua ? [5 * DPR, 4 * DPR] : []); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      if (cc.rd / h > 0.03) { const [xs, ys] = circulo(cc.rd); rotular(cc.texto, cc.color, xs, ys); }
    }
  }

  // planetas y sus órbitas (en un sobrevuelo, el planeta va donde dice Horizons y su órbita se traslada)
  const jd = d.jd0 + V.t, pos = {};
  for (const p of PLANETAS) {
    let q = posicionPlaneta(p, jd), dx = 0, dy = 0;
    if (centro && sv && p === sv.sistema) { dx = centro[0] - q[0]; dy = centro[1] - q[1]; q = [centro[0], centro[1], q[2]]; }
    pos[p] = q;
    const a = semieje(p), visOrb = rmax >= a * 0.98 || p === "Tierra" || a < 1;
    if (visOrb) {
      const [xs, ys] = ORBITAS[p];
      g.beginPath();
      for (let k = 0; k < xs.length; k++) { const px = X(xs[k] + dx), py = Y(ys[k] + dy); k ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.strokeStyle = COLOR_PLANETA[p]; g.globalAlpha = 0.75; g.lineWidth = 0.8 * DPR;
      g.setLineDash(p === "Plutón" ? [5 * DPR, 4 * DPR] : []); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
    if (!(V.enc && p === V.enc.sistema && V.ze > 0.2)) {
      g.beginPath(); g.arc(X(q[0]), Y(q[1]), (a / h > 0.01 ? 2.6 : 1.3) * DPR, 0, 7);
      g.fillStyle = COLOR_PLANETA[p]; g.fill();
    }
    V._visOrb = V._visOrb || {}; V._visOrb[p] = visOrb;
  }

  // Sol: el brillo cae con la distancia
  const b = clip(1 - Math.log10(Math.max(r, 1)) / 2.4, 0.06, 1);
  const col = [1.0 * (0.35 + 0.65 * b), 0.86 * (0.35 + 0.65 * b), 0.55 * (0.35 + 0.65 * b) + 0.25 * b].map((v) => Math.round(clip(v, 0, 1) * 255));
  for (const [tam, alfa] of [[2600 * b * b + 40, 0.10 * b], [520 * b ** 1.5 + 18, 0.30 * b + 0.05], [70 * b + 10, 0.55 + 0.45 * b]]) {
    g.beginPath(); g.arc(X(0), Y(0), Math.sqrt(tam) * 0.62 * DPR, 0, 7);
    g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alfa})`; g.fill();
  }

  // capa del sobrevuelo
  let pSonda = null;
  if (sv && w > 0.02) pSonda = dibujarSobrevuelo(g, sv, centro, c, h, X, Y, esc, fuente, enVista);

  // trayectoria
  const k = Math.max(1, Math.floor(i / 5000)), ic = Math.min(i, d.i_contacto);
  if (w <= 0.3) {
    g.beginPath();
    for (let j = 0; j <= ic; j += k) { const px = X(d.x[j]), py = Y(d.y[j]); j ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.strokeStyle = d.color; g.lineWidth = 1.4 * DPR; g.stroke();
    if (i > d.i_contacto) {
      g.beginPath();
      for (let j = d.i_contacto; j <= i; j += k) { const px = X(d.x[j]), py = Y(d.y[j]); j === d.i_contacto ? g.moveTo(px, py) : g.lineTo(px, py); }
      g.setLineDash([3 * DPR, 3 * DPR]); g.globalAlpha = 0.6; g.lineWidth = DPR; g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
  }
  let ps = pHelio(V.t);
  if (pSonda && w > 0.3) ps = [pSonda[0], pSonda[1], 0];

  // nombres de los planetas: junto al planeta si se ve; si no, sobre el trozo de órbita visible
  const mom = (!sv) ? momentoEn(V.t) : null;
  const conMom = mom && (V.pausa || V.t - mom.t < 3);
  if (!conMom) {
    for (const p of PLANETAS) {
      if (sv && w > 0.3 && p === sv.sistema) continue;
      const a = semieje(p), q = pos[p];
      if (a / h < 0.05) continue;
      if (enVista(q[0], q[1])) {
        g.font = fuente(7.5); g.fillStyle = COLOR_PLANETA[p]; g.textAlign = "left";
        g.fillText(p, X(q[0] + 0.02 * h), Y(q[1] + 0.02 * h));
      } else if (V._visOrb[p]) {
        rotular(`órbita de ${p}`, COLOR_PLANETA[p], ORBITAS[p][0], ORBITAS[p][1]);
      }
    }
  }

  // la sonda
  V._pxSonda = [X(ps[0]) / W, Y(ps[1]) / H];      // (para comprobar que no se sale del encuadre)
  g.beginPath(); g.arc(X(ps[0]), Y(ps[1]), 4 * DPR, 0, 7); g.fillStyle = d.color; g.fill();
  g.lineWidth = 0.9 * DPR; g.strokeStyle = "#fff"; g.stroke();
  g.font = fuente(8.5, "bold"); g.fillStyle = d.color; g.textAlign = "left";
  g.fillText(d.nombre, X(ps[0] + 0.03 * h), Y(ps[1] + 0.03 * h));

  // momento especial: visuales desde la sonda
  if (conMom) dibujarMomento(g, mom, ps, pos, h, X, Y, fuente);

  // aviso
  let aviso = null;
  const ultimo = d.eventos.filter((e) => e[0] <= i && i - e[0] < VENTANA_AVISO);
  const cercaSat = sv ? sv.pasos_satelites.filter((p) => Math.abs(V.t - p[0]) < 0.4) : [];
  if (sv && w > 0.5 && cercaSat.length && Math.abs(V.t - cercaSat[0][0]) < Math.abs(V.t - sv.t_ca)) {
    const [ts_, nom_, d_] = cercaSat[0];
    aviso = `${textoFecha(ts_, true)} UTC · Pasa junto a ${nom_}: ${num(d_, 0)} km de su centro`;
  } else if (sv && w > 0.5 && Math.abs(V.t - sv.t_ca) < 0.75) {
    aviso = `${sv.fecha_ca} UTC · Máximo acercamiento a ${sv.sistema}: ${num(sv.d_ca, 0)} km del centro (${num(sv.d_ca / sv.R, 1)} ${sv.simbolo})`;
  } else if (sv && w > 0.5) {
    aviso = null;
  } else if (conMom) {
    aviso = mom.aviso;
  } else if (ultimo.length) {
    const e = ultimo[ultimo.length - 1];
    aviso = `${textoFecha(e[0])} · ${e[1]}`;
  }
  if (aviso) {
    g.font = fuente(10); const tw = g.measureText(aviso).width, pad = 6 * DPR;
    const bx = Math.max(4 * DPR, W / 2 - tw / 2 - pad), by = 8 * DPR, bw = Math.min(W - 8 * DPR, tw + 2 * pad);
    g.fillStyle = "rgba(0,0,0,0.75)"; g.strokeStyle = "#5c6b85"; g.lineWidth = DPR;
    const ba = 15 * kt * DPR;
    g.beginPath(); g.roundRect(bx, by, bw, ba, 5 * DPR); g.fill(); g.stroke();
    g.fillStyle = "#fff3c4"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(aviso, W / 2, by + ba / 2, bw - 2 * pad); g.textBaseline = "alphabetic";
  }

  // barra de escala
  const L = redondo(0.25 * 2 * h), frac = L / (2 * h);
  g.strokeStyle = "#fff"; g.lineWidth = 2 * DPR;
  g.beginPath(); g.moveTo(0.04 * W, 0.105 * H); g.lineTo((0.04 + frac) * W, 0.105 * H); g.stroke();
  let et;
  if (sv && w > 0.5) {
    const km = L * UA_KM;
    et = `${num(km, 0)} km  (${num(km / sv.R, km / sv.R < 10 ? 1 : 0)} ${sv.simbolo})`;
  } else {
    et = `${num(L, L >= 1 ? 0 : L < 0.1 ? 2 : 1)} UA` + (L < 1 ? `  (${num(L * UA_KM / 1e6, 1)} millones de km)` : "");
  }
  g.font = fuente(8); g.fillStyle = "#fff"; g.textAlign = "left"; g.fillText(et, 0.04 * W, 0.105 * H - 5 * DPR);

  dibujarPerfil(g, W, H, fuente);
  info();
  for (const gr of GRAFICAS) gr.pintar();
}

function dibujarSobrevuelo(g, sv, centro, c, h, X, Y, esc, fuente, enVista) {
  const t = V.t, R = sv.R / UA_KM, cx = centro[0], cy = centro[1];
  const KX = (km) => X(cx + km / UA_KM), KY = (km) => Y(cy + km / UA_KM);
  // órbitas de los satélites
  g.strokeStyle = "#5c6b85"; g.globalAlpha = 0.8; g.lineWidth = 0.6 * DPR;
  for (const q of Object.values(sv.sats)) {
    if (!q.orb) continue;
    const [xs, ys] = q.orb;
    g.beginPath();
    for (let k = 0; k < xs.length; k++) { const px = KX(xs[k]), py = KY(ys[k]); k ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  }
  g.globalAlpha = 1;
  // anillos (corona en el plano del ecuador, proyectada)
  for (const [r1, r2, colA] of sv.anillos) {
    const tenue = sv.sistema !== "Saturno";
    g.beginPath();
    for (const [rr, sentido] of [[r2, 1], [r1, -1]]) {
      for (let k = 0; k <= 180; k++) {
        const a = sentido * 2 * Math.PI * k / 180;
        const px = rr * (Math.cos(a) * sv.u[0] + Math.sin(a) * sv.v[0]), py = rr * (Math.cos(a) * sv.u[1] + Math.sin(a) * sv.v[1]);
        k ? g.lineTo(KX(px), KY(py)) : g.moveTo(KX(px), KY(py));
      }
      g.closePath();
    }
    g.globalAlpha = tenue ? 0.25 : 0.6; g.fillStyle = colA; g.fill("evenodd"); g.globalAlpha = 1;
  }
  // el cuerpo, con su mitad nocturna
  const rp = Math.max(R * esc, 0);
  g.beginPath(); g.arc(X(cx), Y(cy), rp, 0, 7); g.fillStyle = sv.color; g.fill();
  g.strokeStyle = "#fff"; g.lineWidth = 0.4 * DPR; g.stroke();
  const s = sv.sol(t);
  if (s) {
    const L = Math.hypot(s[0], s[1]) || 1, u = [s[0] / L, s[1] / L], ang = Math.atan2(u[1], u[0]);
    g.beginPath(); g.moveTo(X(cx), Y(cy));
    g.arc(X(cx), Y(cy), rp, -(ang + Math.PI / 2), -(ang + 3 * Math.PI / 2), true);
    g.closePath(); g.fillStyle = "rgba(0,0,0,0.55)"; g.fill();
    // flecha hacia el Sol
    g.strokeStyle = "#ffd27a"; g.lineWidth = 1.2 * DPR; g.beginPath();
    g.moveTo(X(cx + u[0] * 0.70 * h), Y(cy + u[1] * 0.70 * h)); g.lineTo(X(cx + u[0] * 0.86 * h), Y(cy + u[1] * 0.86 * h)); g.stroke();
    g.font = fuente(8); g.fillStyle = "#ffd27a"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("Sol", X(cx + u[0] * 0.92 * h), Y(cy + u[1] * 0.92 * h)); g.textBaseline = "alphabetic";
  }
  if (R / h < 0.01) { g.beginPath(); g.arc(X(cx), Y(cy), 2.5 * DPR, 0, 7); g.fillStyle = sv.color; g.fill(); }
  g.font = fuente(9, "bold"); g.fillStyle = sv.color; g.textAlign = "left";
  g.fillText(sv.sistema, X(cx + 1.1 * R + 0.01 * h), Y(cy + 1.1 * R + 0.01 * h));
  // satélites
  for (const nom of Object.keys(sv.sats)) {
    const q = sv.posSat(nom, t), px = cx + q[0] / UA_KM, py = cy + q[1] / UA_KM;
    g.beginPath(); g.arc(X(px), Y(py), 1.8 * DPR, 0, 7); g.fillStyle = "#cfd8dc"; g.fill();
    if (enVista(px, py, 0.05) && Math.hypot(q[0], q[1]) / UA_KM / h > 0.04) {
      g.font = fuente(7.5); g.fillStyle = "#b0bec5"; g.fillText(nom, X(px + 0.015 * h), Y(py + 0.015 * h));
    }
  }
  // trayectoria de la sonda (en la fase orbital, el último mes y, tenues, las órbitas anteriores)
  const k = buscar(sv.ts, t), k0 = sv.orbital ? buscar(sv.ts, t - 30) : 0;
  if (sv.orbital && k0 > 0) {
    g.beginPath();
    for (let j = 0; j <= k0; j += 3) { const px = KX(sv.sx[j]), py = KY(sv.sy[j]); j ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.strokeStyle = V.d.color; g.globalAlpha = 0.2; g.lineWidth = 0.5 * DPR; g.stroke(); g.globalAlpha = 1;
  }
  const p = sv.posSonda(t);
  g.beginPath();
  for (let j = k0; j < k; j++) { const px = KX(sv.sx[j]), py = KY(sv.sy[j]); j > k0 ? g.lineTo(px, py) : g.moveTo(px, py); }
  if (k > k0) g.lineTo(KX(p[0]), KY(p[1]));
  g.strokeStyle = V.d.color; g.lineWidth = 1.3 * DPR; g.stroke();
  return [cx + p[0] / UA_KM, cy + p[1] / UA_KM];
}

function dibujarMomento(g, m, ps, pos, h, X, Y, fuente) {
  const interiores = PLANETAS.filter((p) => semieje(p) < 0.12 * h);
  g.setLineDash([4 * DPR, 3 * DPR]); g.lineWidth = 0.9 * DPR;
  for (const p of PLANETAS) {
    const q = pos[p];
    const visto = m.planetas.includes(p), no = p in m.no_vistos;
    if (visto) {
      g.strokeStyle = COLOR_PLANETA[p]; g.globalAlpha = 0.9;
      g.beginPath(); g.moveTo(X(ps[0]), Y(ps[1])); g.lineTo(X(q[0]), Y(q[1])); g.stroke(); g.globalAlpha = 1;
    }
    if (!visto && !no) continue;
    const texto = `${p} ${visto ? "✓" : "✗"}`;
    let lx, ly, al = "left";
    if (interiores.includes(p)) {          // muy juntos cerca del Sol: rótulos en columna, con guía
      const j = interiores.indexOf(p);
      lx = -0.10 * h; ly = 0.13 * h - j * 0.05 * h; al = "right";
      g.setLineDash([]); g.strokeStyle = "#8a94a8"; g.lineWidth = 0.5 * DPR;
      g.beginPath(); g.moveTo(X(q[0]), Y(q[1])); g.lineTo(X(lx), Y(ly)); g.stroke();
      g.setLineDash([4 * DPR, 3 * DPR]); g.lineWidth = 0.9 * DPR;
      lx -= 0.005 * h;
    } else { lx = q[0] + 0.02 * h; ly = q[1] - 0.035 * h; }
    etiqueta(g, texto, X(lx), Y(ly), visto ? COLOR_PLANETA[p] : "#8a94a8", al, fuente(8));
  }
  g.strokeStyle = "#ffd27a"; g.globalAlpha = 0.9;
  g.beginPath(); g.moveTo(X(ps[0]), Y(ps[1])); g.lineTo(X(0), Y(0)); g.stroke(); g.globalAlpha = 1; g.setLineDash([]);
  etiqueta(g, "Sol", X(0.03 * h), Y(-0.045 * h), "#ffd27a", "left", fuente(8));
}
function etiqueta(g, texto, x, y, color, al, font) {
  g.font = font; g.textAlign = al; g.textBaseline = "middle";
  const tw = g.measureText(texto).width, x0 = al === "right" ? x - tw : x;
  g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(x0 - 2 * DPR, y - 7 * DPR, tw + 4 * DPR, 14 * DPR);
  g.fillStyle = color; g.fillText(texto, x, y); g.textBaseline = "alphabetic";
}

function dibujarPerfil(g, W, H, fuente) {
  const d = V.d, i = V.i, x0 = 0.66 * W, y0 = 0.775 * H, w = 0.32 * W, hh_ = 0.20 * H;
  g.fillStyle = "#05070b"; g.fillRect(x0, y0, w, hh_);
  g.strokeStyle = "#3a4356"; g.lineWidth = DPR; g.strokeRect(x0, y0, w, hh_);
  const L = Math.max(1.6, 1.15 * d.r[i]);
  const PX = (rho) => x0 + (rho + 0.12 * L) / (1.12 * L) * w, PY = (zz) => y0 + hh_ / 2 - zz / (0.66 * L) * hh_;
  g.save(); g.beginPath(); g.rect(x0, y0, w, hh_); g.clip();
  g.strokeStyle = "#4a5570"; g.lineWidth = 0.8 * DPR; g.beginPath(); g.moveTo(x0, PY(0)); g.lineTo(x0 + w, PY(0)); g.stroke();
  g.beginPath(); g.arc(PX(0), PY(0), 2.5 * DPR, 0, 7); g.fillStyle = "#ffd27a"; g.fill();
  const k = Math.max(1, Math.floor(i / 5000));
  g.beginPath();
  for (let j = 0; j <= i; j += k) { const px = PX(d.rho[j]), py = PY(d.z[j]); j ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.strokeStyle = d.color; g.lineWidth = 1.1 * DPR; g.stroke();
  g.beginPath(); g.arc(PX(d.rho[i]), PY(d.z[i]), 3 * DPR, 0, 7); g.fillStyle = d.color; g.fill();
  g.strokeStyle = "#fff"; g.lineWidth = 0.5 * DPR; g.stroke();
  g.restore();
  g.font = fuente(7); g.fillStyle = TENUE; g.textAlign = "center";
  g.fillText("Vista de perfil (eclíptica = línea)", x0 + w / 2, y0 - 4 * DPR);
  g.textAlign = "left"; g.font = fuente(6.5);
  g.fillText(`latitud eclíptica ${num(d.lat[i], 1)}°`, x0 + 4 * DPR, y0 + hh_ - 5 * DPR);
}

// ------------------------------------------------------------------------------------------------
// Panel de datos del momento
// ------------------------------------------------------------------------------------------------
function info() {
  const d = V.d, i = V.i, r = d.r[i];
  const m = MAG_SOL_1UA + 5 * Math.log10(Math.max(r, 1e-3)), vecesLuna = 10 ** (0.4 * (MAG_LUNA_LLENA - m));
  const tierra = posicionPlaneta("Tierra", d.jd0 + i);
  const dT = Math.hypot(d.x[i] - tierra[0], d.y[i] - tierra[1], d.z[i] - tierra[2]);
  const hitos = d.eventos.filter((e) => e[0] <= i && e[2] !== "auto").slice(-3);
  let estado = "";
  if (i > d.i_contacto) estado = `Sin contacto desde ${d.fin_contacto}: posición extrapolada.`;
  else if (i > d.i_fin_datos && d.hay_medio) estado = d.fin_mision ? "No hay datos del medio interplanetario de estas fechas." : "Sin datos publicados todavía para estas fechas.";
  let enc = "";
  if (V.enc && V.t >= V.enc.ts[0] && V.t <= V.enc.ts[V.enc.ts.length - 1]) {
    const sv = V.enc, p = sv.posSonda(V.t), dk = Math.hypot(...p);
    enc = `A ${num(dk, 0)} km de ${sv.sistema} (${num(dk / sv.R, 1)} ${sv.simbolo}), a ${num(sv.velRel(V.t), 1)} km/s de ${sv.sistema}`;
  }
  const html = [
    `<p class="fecha">${textoFecha(V.t, !!V.enc)}${V.enc ? " UTC" : ""}</p>`,
    enc ? `<p class="enc">${enc}</p>` : "",
    `<p>Distancia al Sol: ${num(r, 2)} UA (${num(r * UA_KM / 1e9, 2)} mil millones de km)</p>`,
    `<p>Distancia a la Tierra: ${num(dT, 2)} UA · la señal tarda ${hh(dT * UA_KM / C_KM_S)}</p>`,
    `<p>Velocidad respecto al Sol: ${num(d.v[i], 1)} km/s (${num(d.v[i] * 86400 * 365.25 / UA_KM, 2)} UA/año)</p>`,
    `<p>La luz del Sol tarda ${hh(r * UA_KM / C_KM_S)} en llegar · latitud eclíptica ${num(d.lat[i], 1)}°</p>`,
    `<p class="sol">Sol visto desde la sonda: magnitud ${num(m, 1)}, ${num(100 / (r * r), r > 10 ? 3 : 1)} % del brillo en la Tierra` +
      (vecesLuna > 1.5 ? `, aún ${num(vecesLuna, 0)} veces la Luna llena` : "") + "</p>",
    `<p class="hitos">Hitos: ${hitos.map((e) => `${textoFecha(e[0]).slice(0, 4)} ${e[1]}`).join(" · ") || "—"}${estado ? "<br>" + estado : ""}</p>`,
  ].join("");
  if (html !== V._infoHtml) { $("#info").innerHTML = html; V._infoHtml = html; }
  $("#t-txt").textContent = textoFecha(V.t, !!V.enc);
}

// ------------------------------------------------------------------------------------------------
// Foto, pies de figura y disposición (vista normal o ampliada)
// ------------------------------------------------------------------------------------------------
function cambioDeVista(sv, svFotos) {
  let im = svFotos ? svFotos.imagenEn(V.t) : null, titulo = svFotos ? svFotos.sistema : null;
  const mom = (!im && !sv) ? momentoEn(V.t) : null;
  if (mom) {
    const f = mom.fotos[Math.min(V.fotoM, mom.fotos.length - 1)];
    im = [mom.t, f.img, f.texto, f.dist, f.credito];
    titulo = mom.titulo_corto;
  }
  const clave = im ? im[1] : "sonda";
  const estado = sv ? sv.id : null, estadoMom = mom ? mom.id : null;
  if (estado !== V.estadoVista || estadoMom !== V.pieMom) {
    V.estadoVista = estado; V.pieMom = estadoMom;
    const ampliada = !!(sv || mom);
    $("#visor").classList.toggle("ampliada", ampliada);
    V.ampliada = ampliada;
    const pie = sv ? sv.pie : mom ? mom.pie : pieNormal();
    $("#pie").textContent = pie;
    for (const gr of GRAFICAS) gr.modo(sv, mom);
    V.imgClave = null;
  }
  if (clave !== V.imgClave) {
    V.imgClave = clave;
    const img = $("#foto-img");
    if (im) {
      img.src = im[1]; img.alt = im[2];
      $("#foto-titulo").textContent = `${V.d.nombre} · ${titulo}`;
      $("#foto-pie").innerHTML = `${textoFecha(im[0])} · ${im[3]}<br>${im[2]}<br><span class="credito">${im[4]}</span>`;
    } else {
      img.src = V.d.imagen || ""; img.alt = V.d.nombre;
      $("#foto-titulo").textContent = V.d.nombre;
      $("#foto-pie").textContent = "Imagen: NASA/JPL/ESA (dominio público)";
    }
    $("#foto-titulo").style.color = V.d.color;
  }
}
function pieNormal() {
  return `Vista desde el polo norte de la eclíptica a escala real (la misma escala en las dos direcciones). El ` +
    `encuadre se abre según se aleja la ${V.d.nombre}; las órbitas y franjas aparecen al superarlas. El Sol pierde ` +
    `brillo con la distancia (su magnitud aparente vista desde la sonda). Abajo a la derecha, la vista de perfil ` +
    `muestra cuánto se separa del plano de los planetas. La barra blanca da la escala. ${V.d.nota}`;
}

// ------------------------------------------------------------------------------------------------
// Gráficas de las medidas
// ------------------------------------------------------------------------------------------------
const GRAFICAS = [];
function prepararSeries() {
  const cont = $("#series");
  cont.innerHTML = "";
  GRAFICAS.length = 0;
  V.d.series.forEach((s, k) => {
    const cv = document.createElement("canvas");
    cont.append(cv);
    GRAFICAS.push(new Grafica(cv, s, k, V.d.series.length));
  });
  const sinB = document.createElement("div");
  sinB.className = "sin-b"; sinB.hidden = true; sinB.id = "sin-b";
  cont.append(sinB);
}
class Grafica {
  constructor(cv, s, k, n) {
    this.cv = cv; this.s = s; this.k = k; this.n = n; this.sv = null; this.mom = null;
    this.ylim0 = this.calcularYlim();
    this.ylim = this.ylim0; this.xlim = V.d.xlim; this.capas = null;
  }
  calcularYlim() {
    const y = this.s.v;
    if (this.s.log) {
      const v = Array.from(y).filter((x) => x > 0), lo = percentil(v, 0.3), hi = percentil(v, 99.7);
      return [lo / 1.6, Math.max(hi * 2.2, maximo(v) * 1.6)];
    }
    const lo = percentil(y, 0.3), hi = percentil(y, 99.7);
    return [lo - 0.1 * (hi - lo), hi + 0.35 * (hi - lo)];
  }
  ajustar() {
    const caja = this.cv.getBoundingClientRect();
    if (!caja.width) return;
    this.cv.width = Math.round(caja.width * DPR); this.cv.height = Math.round(caja.height * DPR);
    this.capas = null;
  }
  modo(sv, mom) {
    this.sv = sv; this.mom = mom;
    const amp = !!(sv || mom);
    const conMag = !!(sv && sv.mag);
    const visible = !amp || (this.k === 0 && this.s.titulo.startsWith("Campo"));
    const hayB = conMag || V.d.series.some((s) => s.titulo.startsWith("Campo"));
    this.cv.hidden = !visible;
    const sinB = $("#sin-b");
    if (this.k === 0) {
      sinB.hidden = !(amp && !hayB);
      if (amp && !hayB) sinB.textContent = sv ? sv.sin_mag : `Sin datos del campo magnético de la ${V.d.nombre}.`;
    }
    this.xlim = sv ? (sv.orbital ? [sv.t_ini, sv.t_fin] : [sv.t_ca - DIAS_CERCA, sv.t_ca + DIAS_CERCA]) : V.d.xlim;
    this.ylim = this.ylim0;
    if (conMag && this.k === 0) {
      this.ylim = [Math.min(this.ylim0[0], sv.magLo / 1.5), Math.max(this.ylim0[1], sv.magHi * 2)];
    }
    this.ajustar();
  }
  ultima() {        // la de abajo lleva las fechas
    const vis = GRAFICAS.filter((g) => !g.cv.hidden);
    return vis[vis.length - 1] === this;
  }
  geom() {
    const W = this.cv.width, H = this.cv.height, ml = 50 * DPR, mr = 6 * DPR, mt = 4 * DPR;
    const mb = (this.ultima() ? 18 : 4) * DPR;
    const [x0, x1] = this.xlim, [y0, y1] = this.ylim, log = this.s.log;
    const fy = log ? (v) => Math.log10(v) : (v) => v;
    const Y = (v) => mt + (1 - (fy(v) - fy(y0)) / (fy(y1) - fy(y0))) * (H - mt - mb);
    const X = (t) => ml + (t - x0) / (x1 - x0) * (W - ml - mr);
    return { W, H, ml, mr, mt, mb, X, Y };
  }
  construir() {
    const G = this.geom(), d = V.d, s = this.s, sv = this.sv, conMag = !!(sv && sv.mag && this.k === 0);
    const lienzo = () => { const c = document.createElement("canvas"); c.width = G.W; c.height = G.H; return c; };
    const fondo = lienzo(), datos = lienzo(), rot = lienzo();
    let g = fondo.getContext("2d");
    g.fillStyle = PANEL; g.fillRect(0, 0, G.W, G.H);
    g.font = `${8.5 * DPR}px system-ui, sans-serif`; g.fillStyle = TENUE; g.strokeStyle = "#1f2736"; g.lineWidth = 0.5 * DPR;
    // marcas del eje y
    const [y0, y1] = this.ylim;
    let marcas = [];
    if (s.log) {
      for (let e = Math.ceil(Math.log10(y0)); e <= Math.floor(Math.log10(y1)); e++) marcas.push([10 ** e, potencia(e)]);
    } else {
      const paso = redondo((y1 - y0) / 4);
      for (let v = Math.ceil(y0 / paso) * paso; v <= y1; v += paso) marcas.push([v, num(v, 0)]);
    }
    g.textAlign = "right"; g.textBaseline = "middle";
    for (const [v, txt] of marcas) {
      const py = G.Y(v);
      g.beginPath(); g.moveTo(G.ml, py); g.lineTo(G.W - G.mr, py); g.stroke();
      g.fillText(txt, G.ml - 3 * DPR, py);
    }
    // marcas del eje x
    g.textAlign = "center"; g.textBaseline = "top";
    for (const [t, txt] of marcasTiempo(this.xlim[0], this.xlim[1])) {
      const px = G.X(t);
      g.beginPath(); g.moveTo(px, G.mt); g.lineTo(px, G.H - G.mb); g.stroke();
      if (this.ultima()) g.fillText(txt, px, G.H - G.mb + 2 * DPR);
    }
    // datos
    g = datos.getContext("2d");
    g.save(); g.beginPath(); g.rect(G.ml, G.mt, G.W - G.ml - G.mr, G.H - G.mt - G.mb); g.clip();
    for (const [j, , tipo] of d.eventos) {
      if (tipo === "auto" || !COL_EVENTO[tipo]) continue;
      const px = G.X(j);
      g.strokeStyle = COL_EVENTO[tipo]; g.lineWidth = 0.8 * DPR; g.setLineDash([1.5 * DPR, 2 * DPR]);
      g.beginPath(); g.moveTo(px, G.mt); g.lineTo(px, G.H - G.mb); g.stroke(); g.setLineDash([]);
    }
    const linea = (xs, ys, color, lw, alfa, desde = 0, hasta = ys.length) => {
      g.beginPath(); let dentro = false;
      for (let k = desde; k < hasta; k++) {
        const v = ys[k];
        if (!isFinite(v) || (s.log && v <= 0)) { dentro = false; continue; }
        const px = G.X(xs(k)), py = G.Y(v);
        if (dentro) g.lineTo(px, py); else { g.moveTo(px, py); dentro = true; }
      }
      g.strokeStyle = color; g.lineWidth = lw * DPR; g.globalAlpha = alfa; g.stroke(); g.globalAlpha = 1;
    };
    const a0 = Math.max(0, Math.floor(this.xlim[0])), a1 = Math.min(d.N, Math.ceil(this.xlim[1]) + 1);
    if (conMag) {
      linea((k) => sv.mag.t[k], sv.mag.b, "#ffffff", 0.7, 0.9);
    } else {
      linea((k) => k, s.v, d.color, 0.5, 0.45, a0, a1);
      linea((k) => k, s.media, d.color, 1.5, 1, a0, a1);
      if (s.mod) linea((k) => k, s.mod, "#cfd8dc", 0.9, 0.8, a0, Math.min(a1, d.i_contacto + 1));
    }
    g.restore();
    // rótulos
    g = rot.getContext("2d");
    const caja = (texto, x, y, font, color) => {
      g.font = font; const tw = g.measureText(texto).width;
      g.fillStyle = "rgba(17,22,31,0.75)"; g.fillRect(x - 2 * DPR, y - 1 * DPR, tw + 4 * DPR, parseFloat(font) * 1.25 + 1 * DPR);
      g.fillStyle = color; g.textBaseline = "top"; g.textAlign = "left"; g.fillText(texto, x, y);
    };
    caja(s.titulo, G.ml + 4 * DPR, G.mt + 2 * DPR, `bold ${10 * DPR}px system-ui, sans-serif`, TEXTO);
    let expl = s.expl;
    if (this.sv || this.mom) {
      if (conMag && sv.orbital) expl = "Magnetómetro (medias horarias): fuera de la magnetosfera, el viento solar (~0,1-1 nT); dentro, cada periapsis es un pico.";
      else if (conMag) expl = "Magnetómetro (medias de 5 min): salto en el choque de proa y la magnetopausa; dentro, el campo del cuerpo crece al acercarse (si tiene campo propio).";
      else if (sv) expl = sv.sin_mag;
      else expl = `Lo que medía la ${d.nombre}: medias diarias del campo magnético.`;
    }
    caja(expl, G.ml + 4 * DPR, G.mt + 17 * DPR, `${8.2 * DPR}px system-ui, sans-serif`, TENUE);
    if (s.mod && !conMag) {
      g.font = `${8 * DPR}px system-ui, sans-serif`; g.fillStyle = TENUE; g.textAlign = "right"; g.textBaseline = "top";
      g.fillText(`- - ${s.modelo_txt}`, G.W - G.mr - 4 * DPR, G.mt + 2 * DPR);
    }
    this.capas = { fondo, datos, rot, G };
  }
  pintar() {
    if (this.cv.hidden || !this.cv.width) return;
    if (!this.capas) this.construir();
    const { fondo, datos, rot, G } = this.capas, g = this.cv.getContext("2d"), d = V.d;
    g.drawImage(fondo, 0, 0);
    const xc = clip(G.X(V.t), 0, G.W);
    if (xc > 0) g.drawImage(datos, 0, 0, xc, G.H, 0, 0, xc, G.H);
    g.drawImage(rot, 0, 0);
    // letras de los hitos ya pasados (solo en la primera gráfica)
    if (this === GRAFICAS.find((x) => !x.cv.hidden)) {
      g.font = `bold ${9 * DPR}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "bottom";
      for (const [j, , tipo, abrev] of d.eventos) {
        if (tipo === "auto" || !abrev || j > V.i || j < this.xlim[0] || j > this.xlim[1]) continue;
        g.fillStyle = COL_EVENTO[tipo]; g.fillText(abrev, G.X(j), G.H - G.mb - 2 * DPR);
      }
    }
    g.strokeStyle = "rgba(255,245,157,0.8)"; g.lineWidth = 0.8 * DPR;
    g.beginPath(); g.moveTo(xc, G.mt); g.lineTo(xc, G.H - G.mb); g.stroke();
  }
}
function potencia(e) {
  const sup = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  return "10" + String(e).split("").map((ch) => sup[ch]).join("");
}
function marcasTiempo(t0, t1) {
  const span = t1 - t0, out = [];
  const f0 = fechaDe(t0), f1 = fechaDe(t1), dia = (f) => (f.getTime() - V.d.f0) / 86400000;
  if (span > 3 * 365) {
    const anios = span / 365.25, paso = [1, 2, 5, 10, 20].find((p) => anios / p <= 10) || 50;
    for (let a = Math.ceil(f0.getUTCFullYear() / paso) * paso; a <= f1.getUTCFullYear(); a += paso) {
      const t = dia(new Date(Date.UTC(a, 0, 1)));
      if (t >= t0) out.push([t, String(a)]);
    }
  } else if (span > 60) {
    const meses = span / 30.4, paso = [1, 2, 3, 6, 12].find((p) => meses / p <= 10) || 12;
    let a = f0.getUTCFullYear(), m = f0.getUTCMonth() + 1;
    for (let n = 0; n < 200; n++, m++) {
      if (m > 11) { m = 0; a++; }
      if (m % paso) continue;
      const t = dia(new Date(Date.UTC(a, m, 1)));
      if (t > t1) break;
      if (t >= t0) out.push([t, m === 0 ? String(a) : `${MESES[m]} ${a}`]);
    }
  } else {
    const paso = [1, 2, 4, 7, 14].find((p) => span / p <= 10) || 14;
    const inicio = Math.ceil(t0 + (V.d.f0 % 86400000) / 86400000);
    for (let t = inicio; t <= t1; t += paso) {
      const f = fechaDe(t);
      out.push([t, `${f.getUTCDate()} ${MESES[f.getUTCMonth()]}`]);
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// Formulario de inicio
// ------------------------------------------------------------------------------------------------
const guardado = {
  leer() { try { return JSON.parse(localStorage.getItem("viaje-sondas") || "{}"); } catch { return {}; } },
  escribir(v) { try { localStorage.setItem("viaje-sondas", JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
};
function valoresForm() {
  const sonda = document.querySelector('input[name="sonda"]:checked')?.value;
  const modo = document.querySelector('input[name="modo"]:checked')?.value || "animacion";
  const acercar = $("#acercar").checked;
  const pasos = Array.from(document.querySelectorAll('input[name="paso"]:checked')).map((x) => x.value);
  return { sonda, modo, acercar, pasos };
}
function pintarPasos() {
  const v = valoresForm(), s = V.indice.sondas.find((x) => x.nombre === v.sonda), cont = $("#pasos");
  cont.innerHTML = "";
  for (const p of (s ? s.pasos : [])) {
    const l = document.createElement("label");
    l.innerHTML = `<input type="checkbox" name="paso" value="${p.sistema}" checked><span>${p.texto}</span>`;
    cont.append(l);
  }
}
function aplicarCondiciones() {
  const v = valoresForm();
  $("#f-acercar").hidden = v.modo !== "animacion";
  const verPasos = v.modo === "sobrevuelos" || v.acercar;
  $("#f-pasos").hidden = !verPasos;
  $("#l-pasos").textContent = (v.modo === "sobrevuelos" ? "3" : "4") + ". Qué cuerpos ver";
}
async function iniciar() {
  V.indice = await json("datos/indice.json");
  if (V.indice.ms_por_paso > PASO_MS) RITMO = PASO_MS / V.indice.ms_por_paso;
  const previo = guardado.leer(), cont = $("#sondas");
  for (const s of V.indice.sondas) {
    const l = document.createElement("label");
    l.innerHTML = `<input type="radio" name="sonda" value="${s.nombre}"><span class="punto" style="background:${s.color}"></span>` +
      `<span><b>${s.nombre}</b><small>${DESCRIPCION[s.nombre] || ""}</small></span>`;
    cont.append(l);
  }
  const elegida = V.indice.sondas.some((s) => s.nombre === previo.sonda) ? previo.sonda : V.indice.sondas[0].nombre;
  document.querySelector(`input[name="sonda"][value="${elegida}"]`).checked = true;
  if (previo.modo) document.querySelector(`input[name="modo"][value="${previo.modo}"]`).checked = true;
  $("#acercar").checked = !!previo.acercar;
  pintarPasos();
  if (previo.sonda === elegida && Array.isArray(previo.pasos)) {
    for (const x of document.querySelectorAll('input[name="paso"]')) x.checked = previo.pasos.includes(x.value);
  }
  aplicarCondiciones();
  $("#formulario").addEventListener("change", (e) => {
    if (e.target.name === "sonda") pintarPasos();
    aplicarCondiciones();
    $("#aviso-form").hidden = true;
  });
  $("#todos").onclick = () => document.querySelectorAll('input[name="paso"]').forEach((x) => { x.checked = true; });
  $("#ninguno").onclick = () => document.querySelectorAll('input[name="paso"]').forEach((x) => { x.checked = false; });
  $("#formulario").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = valoresForm();
    const verPasos = v.modo === "sobrevuelos" || v.acercar;
    if (verPasos && !v.pasos.length) {
      $("#aviso-form").textContent = "Marca al menos un cuerpo.";
      $("#aviso-form").hidden = false;
      return;
    }
    guardado.escribir(v);
    empezar({ sonda: v.sonda, modo: v.modo, acercar: v.modo === "animacion" && v.acercar, pasos: verPasos ? v.pasos : null });
  });
  // controles del visor
  $("#b-play").onclick = () => alternar();
  $("#b-ini").onclick = () => { alternar(false); ir(V.segmentos[0][0], true); };
  $("#b-zoom").onclick = () => alternarZoom();
  $("#volver").onclick = () => {
    alternar(false);
    $("#visor").hidden = true; $("#controles").hidden = true; $("#volver").hidden = true; $("#inicio").hidden = false;
  };
  const st = $("#s-t");
  st.addEventListener("input", () => { V.arrastrando = true; ir(fracAT(st.value / 10000)); });
  st.addEventListener("change", () => { V.arrastrando = false; });
  $("#s-v").addEventListener("input", (e) => { V.velocidad = +e.target.value; $("#v-txt").textContent = e.target.value; });
  document.addEventListener("keydown", (e) => {
    if ($("#visor").hidden) return;
    if (e.key === " ") { e.preventDefault(); alternar(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); ir(V.t + dt()); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); ir(V.t - dt()); }
    else if (e.key === "z" || e.key === "Z") alternarZoom();
    else if (e.key === "Home") ir(V.segmentos[0][0]);
    else if (e.key === "End") ir(V.segmentos[V.segmentos.length - 1][1]);
  });
}
iniciar().catch((e) => {
  console.error(e);
  $("#inicio").insertAdjacentHTML("beforeend", `<p class="aviso">No se pudo leer la lista de sondas (${e.message}). ` +
    "Si abres el fichero directamente desde el disco, el navegador no deja leer los datos: usa un servidor web " +
    "(por ejemplo, GitHub Pages o «python -m http.server» en esta carpeta).</p>");
});
