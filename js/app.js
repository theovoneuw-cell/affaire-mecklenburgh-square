(() => {
"use strict";

// ---------- Données (encodées pour ne pas se dévoiler à la lecture du code)
const D = (() => {
  const brut = atob(window.__D), cle = window.__K;
  const octets = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i) ^ cle.charCodeAt(i % cle.length);
  return JSON.parse(new TextDecoder().decode(octets));
})();

// ---------- État
const CLE = "mecklenburgh-1895-v1";
const neuf = () => ({ origine: {}, commence: false, temps: 0, connus: [], visites: {}, trajets: 0, docs: [], nouveaux: [], echant: [], temoins: [], vus: {}, indices: {}, notes: "", labo: [], lieu: null, piece: null, accusations: 0, fini: null, alerte90: false });
let S = neuf();
try { const s = JSON.parse(localStorage.getItem(CLE) || "null"); if (s) S = Object.assign(neuf(), s); } catch (e) {}
const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(S)); } catch (e) {} };

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const el = (tag, attrs = {}, html = "") => { const e = document.createElement(tag); for (const k in attrs) { if (k === "on") for (const ev in attrs.on) e.addEventListener(ev, attrs.on[ev]); else if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); } if (html) e.innerHTML = html; return e; };
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function toast(t) { const e = $("#toast"); e.innerHTML = t; e.classList.add("vu"); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove("vu"), 4200); }

// ---------- Son
let sonActif = true; try { sonActif = localStorage.getItem(CLE + "-son") !== "non"; } catch (e) {}
const ambA = $("#amb-a"), ambB = $("#amb-b"), voix = $("#voix");
let ambCourante = ambA, ambSrc = "";
function fondu(a, cible, ms) {
  clearInterval(a._f); const depart = a.volume, t0 = performance.now();
  a._f = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = depart + (cible - depart) * k; if (k >= 1) { clearInterval(a._f); if (cible === 0) a.pause(); } }, 50);
}
function ambiance(src) {
  if (!src || src === ambSrc) return;
  ambSrc = src;
  const sortante = ambCourante, entrante = ambCourante === ambA ? ambB : ambA;
  fondu(sortante, 0, 1500);
  entrante.src = src; entrante.volume = 0;
  if (sonActif) entrante.play().then(() => fondu(entrante, voix.paused ? .55 : .2, 1800)).catch(() => {});
  ambCourante = entrante;
}
function parler(src) {
  if (!src) return;
  voix.src = src; voix.volume = 1;
  if (sonActif) { voix.play().catch(() => {}); fondu(ambCourante, .18, 800); }
}
voix.addEventListener("ended", () => { if (sonActif) fondu(ambCourante, .55, 1500); });
function majSon() {
  $("#btn-son").textContent = "Son : " + (sonActif ? "oui" : "non");
  if (!sonActif) { [ambA, ambB, voix].forEach(a => a.pause()); }
  else if (ambCourante.src) { ambCourante.play().catch(() => {}); fondu(ambCourante, .55, 800); }
}
$("#btn-son").addEventListener("click", () => { sonActif = !sonActif; try { localStorage.setItem(CLE + "-son", sonActif ? "oui" : "non"); } catch (e) {} majSon(); });

// ---------- Écrans
function ecran(id) { $$(".ecran").forEach(e => e.classList.toggle("actif", e.id === id)); window.scrollTo(0, 0); }
$$("[data-aller]").forEach(b => b.addEventListener("click", () => ecran(b.dataset.aller)));
if (S.commence) $("#btn-reprendre").hidden = false;

function commencer() {
  if (S.commence && !confirm("Une enquête est déjà en cours. Tout effacer et recommencer ?")) return;
  S = neuf(); sauver();
  ecran("prologue");
  $(".prologue-photo").style.backgroundImage = `url(${D.prologue.photo})`;
  $("#prologue-contenu").innerHTML = D.prologue.texte;
  ambiance(D.prologue.ambiance); parler(D.prologue.son);
}
$("#btn-commencer").addEventListener("click", commencer);
$("#btn-commencer2").addEventListener("click", commencer);
$("#btn-jouer").addEventListener("click", () => {
  S.commence = true; S.lieu = "baker"; S.connus = Object.keys(D.lieux).filter(k => D.lieux[k].connu);
  donner(D.regles_debut, true); sauver();
  voix.pause(); entrerJeu(); ouvrirDoc("d01");
});
$("#btn-reprendre").addEventListener("click", () => entrerJeu());

function entrerJeu() {
  ecran("jeu"); majSon(); majBarre(); dessinerCarte(); vue(S.lieu ? "lieu" : "carte");
  if (S.lieu) afficherLieu(false);
}

// ---------- Chrono
setInterval(() => {
  if (!S.commence || S.fini || document.hidden || !$("#jeu").classList.contains("actif")) return;
  S.temps += 1; if (S.temps % 10 === 0) sauver();
  majBarre();
  if (S.temps >= 5400 && !S.alerte90) { S.alerte90 = true; sauver(); toast("Une heure et demie. Big Ben a sonné, et Lestrade s'impatiente. Il serait temps de conclure."); }
}, 1000);
function majBarre() {
  const m = Math.floor(S.temps / 60), h = Math.floor(m / 60);
  $("#chrono").textContent = (h ? h + " h " + String(m % 60).padStart(2, "0") : m + " min") + " / 1 h 30";
  $("#trajets").textContent = S.trajets + (S.trajets > 1 ? " trajets" : " trajet");
  const n = S.nouveaux.length; $("#nb-docs").textContent = "(" + S.docs.length + (n ? ", " + n + " nouv." : "") + ")";
  $("#menu-lieu").textContent = S.lieu ? D.lieux[S.lieu].nom : "Lieu actuel";
}

// ---------- Vues
function vue(id) {
  $$(".menu button").forEach(b => b.classList.toggle("actif", b.dataset.vue === id));
  $$(".vue").forEach(v => v.classList.toggle("actif", v.id === "vue-" + id));
  ({ dossier: afficherDossier, temoins: afficherTemoins, carnet: afficherCarnet, annuaire: afficherAnnuaire, indices: afficherIndices, conclure: afficherConclure, carte: dessinerCarte })[id]?.();
}
$$(".menu button").forEach(b => b.addEventListener("click", () => { vue(b.dataset.vue); if (b.dataset.vue === "lieu") afficherLieu(false); }));

// ---------- Pièces du dossier
function donner(ids, silencieux) {
  const neufs = (ids || []).filter(id => !S.docs.includes(id));
  const ou = S.lieu ? D.lieux[S.lieu].nom + (S.piece && D.lieux[S.lieu].pieces ? " · " + D.lieux[S.lieu].pieces[S.piece].nom : "") : "Baker Street";
  S.origine = S.origine || {};
  neufs.forEach(id => { S.docs.push(id); S.nouveaux.push(id); S.origine[id] = ou; });
  if (neufs.length && !silencieux) toast("Au dossier : " + neufs.map(id => "<b>" + D.documents[id].titre + "</b>").join(", "));
  sauver(); majBarre(); return neufs;
}
function echantillon(id) {
  if (!id || S.echant.includes(id)) return;
  S.echant.push(id); sauver(); toast("Échantillon recueilli : <b>" + D.labo.echantillons[id] + "</b>");
}

// ---------- Carte
let carte = { z: .32, x: 0, y: 0, init: false };
const cadre = $("#carte-cadre"), carteEl = $("#carte");
function appliquerCarte() { carteEl.style.transform = `translate(${carte.x}px, ${carte.y}px) scale(${carte.z})`; $$(".epingle").forEach(p => p.style.transform = `translate(-50%, -100%) scale(${1 / carte.z * .42})`); }
function centrerSur(xp, yp) { const r = cadre.getBoundingClientRect(); carte.x = r.width / 2 - 3200 * carte.z * xp / 100; carte.y = r.height / 2 - 1900 * carte.z * yp / 100; borner(); appliquerCarte(); }
function borner() { const r = cadre.getBoundingClientRect(); const w = 3200 * carte.z, h = 1900 * carte.z; carte.x = Math.min(0, Math.max(r.width - w, carte.x)); carte.y = Math.min(0, Math.max(r.height - h, carte.y)); if (w < r.width) carte.x = (r.width - w) / 2; if (h < r.height) carte.y = (r.height - h) / 2; }
function zoomer(f, cx, cy) { const r = cadre.getBoundingClientRect(); cx ??= r.width / 2; cy ??= r.height / 2; const z2 = Math.min(1.2, Math.max(r.width / 3200, carte.z * f)); carte.x = cx - (cx - carte.x) * z2 / carte.z; carte.y = cy - (cy - carte.y) * z2 / carte.z; carte.z = z2; borner(); appliquerCarte(); }
$("#zoom-plus").addEventListener("click", e => { e.stopPropagation(); zoomer(1.3); });
$("#zoom-moins").addEventListener("click", e => { e.stopPropagation(); zoomer(1 / 1.3); });
cadre.addEventListener("wheel", e => { e.preventDefault(); const r = cadre.getBoundingClientRect(); zoomer(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
let glisse = null;
cadre.addEventListener("pointerdown", e => { if (e.target.closest("button")) return; glisse = { x: e.clientX, y: e.clientY, cx: carte.x, cy: carte.y }; cadre.setPointerCapture(e.pointerId); cadre.classList.add("glisse"); });
cadre.addEventListener("pointermove", e => { if (!glisse) return; carte.x = glisse.cx + e.clientX - glisse.x; carte.y = glisse.cy + e.clientY - glisse.y; borner(); appliquerCarte(); });
cadre.addEventListener("pointerup", () => { glisse = null; cadre.classList.remove("glisse"); });
window.addEventListener("resize", () => { borner(); appliquerCarte(); });

function dessinerCarte() {
  const ep = $("#epingles"); ep.innerHTML = "";
  S.connus.forEach(id => {
    const l = D.lieux[id];
    const b = el("button", { class: "epingle" + (id === S.lieu ? " ici" : S.visites[id] ? " visite" : ""), style: `left:${l.x}%;top:${l.y}%`, "aria-label": l.nom, on: { click: () => allerA(id) } }, `<span class="nom">${l.nom}</span><span class="tete"></span><span class="tige"></span>`);
    ep.appendChild(b);
  });
  const liste = $("#lieux-connus");
  liste.innerHTML = "<h3>Adresses connues</h3>";
  S.connus.forEach(id => { const l = D.lieux[id]; liste.appendChild(el("button", { class: "lieu-ligne", on: { click: () => allerA(id) } }, `<b>${l.nom}${id === S.lieu ? " · vous êtes ici" : ""}</b><span>${l.adresse || l.quartier}</span>`)); });
  requestAnimationFrame(() => { if (!carte.init) { carte.init = true; const l = D.lieux[S.lieu || "baker"]; centrerSur(42, 52); } borner(); appliquerCarte(); });
}

$("#form-aller").addEventListener("submit", e => {
  e.preventDefault();
  const q = norm($("#aller").value), ret = $("#aller-retour");
  if (q.length < 3) { ret.textContent = "Le cocher attend une adresse un peu plus précise."; return; }
  let trouves = Object.keys(D.lieux).filter(id => (D.lieux[id].cles || []).some(k => new RegExp("(^| )" + norm(k)).test(q)));
  if (!trouves.length && /(^| )lamb/.test(q)) trouves = ["gaskell", "lamb"];
  if (!trouves.length) { ret.textContent = "« Connais pas, m'sieur », dit le cocher. Aucune adresse utile ne correspond. Vérifiez l'orthographe, ou cherchez dans l'annuaire."; return; }
  if (trouves.length > 1) {
    ret.innerHTML = "Le cocher hésite : ";
    trouves.forEach(id => ret.appendChild(el("button", { class: "btn", style: "margin:4px 6px;font-size:17px;padding:4px 12px", on: { click: () => { ret.textContent = ""; allerA(id); } } }, D.lieux[id].nom)));
    return;
  }
  ret.textContent = ""; $("#aller").value = ""; allerA(trouves[0]);
});

function allerA(id) {
  if (!S.connus.includes(id)) S.connus.push(id);
  if (S.lieu !== id) { S.trajets += 1; S.lieu = id; S.piece = null; }
  S.visites[id] = (S.visites[id] || 0) + 1; sauver();
  vue("lieu"); afficherLieu(true); majBarre();
}

// ---------- Lieu
function photo(src, legende) { return `<figure class="photo-ancienne"><img src="${src}" alt="" onerror="this.closest('figure').style.display='none'"><figcaption>${legende}</figcaption></figure>`; }
function afficherLieu(arrivee) {
  const v = $("#vue-lieu"), l = D.lieux[S.lieu]; if (!l) return;
  if (arrivee && l.donne) donner(l.donne);
  if (arrivee && l.echantillons) l.echantillons.forEach(echantillon);
  const p = S.piece && l.pieces ? l.pieces[S.piece] : null;
  ambiance(p ? p.ambiance : l.ambiance);
  v.innerHTML = "";
  if (p) {
    if (arrivee !== false) { if (p.donne) donner(p.donne); if (p.echantillon) echantillon(p.echantillon); }
    v.appendChild(el("button", { class: "btn discret", style: "padding-left:0", on: { click: () => { S.piece = null; sauver(); afficherLieu(false); } } }, "← Retour au vestibule"));
    v.appendChild(el("div", { class: "lieu-tete" }, photo(p.photo, p.nom) + `<div><p class="lieu-adresse">${l.nom}</p><h2>${p.nom}</h2><div class="lieu-texte">${p.texte}</div></div>`));
    if (p.points) {
      const r = el("div", { class: "rubrique" }, "<h3>Examiner</h3>"), c = el("div", { class: "cases" });
      p.points.forEach(pt => c.appendChild(el("button", { class: "case" + (S.vus[pt.id] ? " vu" : ""), on: { click: () => examiner(pt) } }, `<b>${pt.nom}</b>`)));
      r.appendChild(c); v.appendChild(r);
    }
    if (p.personnages) v.appendChild(blocTemoins(p.personnages));
    return;
  }
  v.appendChild(el("div", { class: "lieu-tete" }, photo(l.photo, l.nom) + `<div><p class="lieu-adresse">${l.adresse || l.quartier}</p><h2>${l.nom}</h2><div class="lieu-texte">${l.texte}</div></div>`));
  if (l.pieces) {
    const r = el("div", { class: "rubrique" }, "<h3>Les pièces de la maison</h3>"), c = el("div", { class: "cases" });
    Object.entries(l.pieces).forEach(([pid, pc]) => c.appendChild(el("button", { class: "case", on: { click: () => { S.piece = pid; sauver(); afficherLieu(true); $("#vues .vue.actif").scrollTop = 0; } } }, `<b>${pc.nom}</b>`)));
    r.appendChild(c); v.appendChild(r);
  }
  if (l.actions) {
    const r = el("div", { class: "rubrique" }, "<h3>Dans le salon</h3>"), c = el("div", { class: "cases" });
    l.actions.forEach(a => c.appendChild(el("button", { class: "case", on: { click: () => action(a) } }, `<b>${a.nom}</b>`)));
    r.appendChild(c); v.appendChild(r);
  }
  if (l.personnages) v.appendChild(blocTemoins(l.personnages));
  if (l.type === "somerset") v.appendChild(formSomerset());
}
function blocTemoins(ids) {
  const r = el("div", { class: "rubrique" }, "<h3>Interroger</h3>"), c = el("div", { class: "cases" });
  ids.forEach(id => { const p = D.personnages[id]; c.appendChild(el("button", { class: "case temoin", on: { click: () => ficheTemoin(id, true) } }, `<img src="${p.portrait}" alt="" onerror="this.style.visibility='hidden'"><div><b>${p.nom}</b><span>${p.role}</span></div>`)); });
  r.appendChild(c); return r;
}
function examiner(pt) {
  S.vus[pt.id] = true; sauver();
  if (pt.type === "coffre") return ouvrirCoffre(pt);
  fenetre(`<h2>${pt.nom}</h2>${pt.texte}`);
  if (pt.donne) donner(pt.donne);
  if (pt.echantillon) echantillon(pt.echantillon);
  afficherLieu(false);
}

// ---------- Fenêtre
function fenetre(html, apres) { $("#fenetre-contenu").innerHTML = html; $("#fenetre").hidden = false; $(".fenetre-boite").scrollTop = 0; if (apres) apres($("#fenetre-contenu")); }
function fermerFenetre() { $("#fenetre").hidden = true; const a = $("#fenetre-contenu audio"); if (a) a.pause(); }
$("#fenetre-fermer").addEventListener("click", fermerFenetre);
$("#fenetre").addEventListener("click", e => { if (e.target.id === "fenetre") fermerFenetre(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (!$("#visionneuse").hidden) fermerVis(); else fermerFenetre(); } });

// ---------- Témoins
function ficheTemoin(id, surPlace) {
  const p = D.personnages[id];
  if (!S.temoins.includes(id)) { S.temoins.push(id); sauver(); }
  fenetre(`<div class="fiche-temoin"><figure class="portrait"><img src="${p.portrait}" alt="" onerror="this.style.visibility='hidden'"><figcaption>${p.nom}</figcaption></figure><div><h2>${p.nom}</h2><p class="role">${p.role}</p><div class="onglets"><button data-o="dep" class="actif">Déposition</button><button data-o="obs">Observer</button><button data-o="mon">Montrer une pièce</button></div><div id="temoin-zone"></div></div></div>`, z => {
    const zone = z.querySelector("#temoin-zone");
    const montrer = o => {
      z.querySelectorAll(".onglets button").forEach(b => b.classList.toggle("actif", b.dataset.o === o));
      if (o === "dep") zone.innerHTML = p.depose;
      if (o === "obs") zone.innerHTML = "<p class='role'>Holmes l'examine en silence, puis vous glisse à l'oreille :</p><ul class='observations'>" + p.observer.map(x => `<li>${x}</li>`).join("") + "</ul>";
      if (o === "mon") {
        zone.innerHTML = "<p>Quelle pièce lui montrez-vous ?</p>";
        const c = el("div", { class: "choix-pieces" });
        S.docs.forEach(did => c.appendChild(el("button", { on: { click: () => reagir(id, did, zone) } }, D.documents[did].titre)));
        zone.appendChild(c);
      }
    };
    z.querySelectorAll(".onglets button").forEach(b => b.addEventListener("click", () => montrer(b.dataset.o)));
    montrer("dep");
  });
}
function reagir(pid, did, zone) {
  const p = D.personnages[pid]; let r = (p.reactions || {})[did];
  let texte = r ? (typeof r === "string" ? r : r.texte) : (p.defaut || "Il examine la pièce et vous la rend. « Je ne vois pas ce que vous voulez dire. »");
  zone.innerHTML = `<p class="role">Vous lui montrez : ${D.documents[did].titre}</p><div class="reaction">${texte}</div>`;
  zone.appendChild(el("button", { class: "btn", style: "margin-top:16px", on: { click: () => zone.closest(".fiche-temoin").querySelector('[data-o="mon"]').click() } }, "Montrer autre chose"));
  if (r && r.donne) donner(r.donne);
}
function afficherTemoins() {
  const v = $("#vue-temoins"); v.innerHTML = "<h2>Témoins rencontrés</h2><p class='aide'>Relisez leurs dépositions, et montrez-leur une nouvelle pièce quand vous voulez : Holmes leur fait porter un mot par un des gamins de Baker Street.</p>";
  if (!S.temoins.length) { v.innerHTML += "<p>Personne encore.</p>"; return; }
  const c = el("div", { class: "temoins-grille" });
  S.temoins.forEach(id => { const p = D.personnages[id]; c.appendChild(el("button", { class: "case temoin", on: { click: () => ficheTemoin(id, false) } }, `<img src="${p.portrait}" alt="" onerror="this.style.visibility='hidden'"><div><b>${p.nom}</b><span>${p.role}</span></div>`)); });
  v.appendChild(c);
}

// ---------- Dossier et visionneuse
function afficherDossier() {
  const v = $("#vue-dossier"); v.innerHTML = "<h2>Dossier</h2><p class='aide'>Toutes les pièces recueillies, rangées par lieu de découverte. Cliquez pour ouvrir ; dans la visionneuse, faites glisser pour parcourir, zoomez avec + et −, et essayez le miroir quand un texte semble à l'envers.</p>";
  const groupes = {};
  S.docs.forEach(id => { const o = (S.origine && S.origine[id]) || "Baker Street"; (groupes[o] = groupes[o] || []).push(id); });
  Object.entries(groupes).forEach(([o, ids]) => {
    v.appendChild(el("h3", { class: "groupe-dossier" }, o));
    const g = el("div", { class: "dossier-grille" });
    ids.forEach(id => {
      const d = D.documents[id];
      const vign = d.audio ? `<div class="vignette audio"><div class="cylindre"></div></div>` : `<div class="vignette"><img src="${d.fichier}" alt="" loading="lazy"></div>`;
      g.appendChild(el("button", { class: "piece" + (S.nouveaux.includes(id) ? " nouveau" : ""), on: { click: () => ouvrirDoc(id) } }, vign + `<b>${d.titre}</b>`));
    });
    v.appendChild(g);
  });
}
let vis = { z: 1 };
function ouvrirDoc(id) {
  const d = D.documents[id];
  S.nouveaux = S.nouveaux.filter(x => x !== id); sauver(); majBarre();
  if ($("#vue-dossier").classList.contains("actif")) afficherDossier();
  if (d.audio) {
    return fenetre(`<h2>${d.titre}</h2><p class="role">Holmes remonte le moteur du phonographe et pose l'aiguille sur la cire.</p><div class="lecteur"><div class="phono"><div class="cylindre"></div></div><audio controls preload="auto" src="${d.audio}"></audio></div><p class="aide" style="color:#6b5a44">Écoutez jusqu'au bout. Plusieurs fois s'il le faut.</p>`, z => {
      const a = z.querySelector("audio"), ph = z.querySelector(".phono");
      a.addEventListener("play", () => { ph.classList.add("tourne"); fondu(ambCourante, .08, 600); });
      a.addEventListener("pause", () => { ph.classList.remove("tourne"); if (sonActif) fondu(ambCourante, .55, 1200); });
      a.addEventListener("ended", () => { ph.classList.remove("tourne"); if (sonActif) fondu(ambCourante, .55, 1200); });
    });
  }
  const img = $("#vis-img"); img.classList.remove("miroir");
  $("#vis-titre").textContent = d.titre; $("#visionneuse").hidden = false;
  img.onload = () => { const zone = $("#vis-zone"); vis.nat = img.naturalWidth; vis.z = Math.min(1, (zone.clientWidth - 60) / img.naturalWidth); img.style.width = img.naturalWidth * vis.z + "px"; zone.scrollTop = 0; };
  img.src = d.fichier;
}
function zoomVis(f) { vis.z = Math.min(2.5, Math.max(.15, vis.z * f)); $("#vis-img").style.width = vis.nat * vis.z + "px"; }
$("#vis-plus").addEventListener("click", () => zoomVis(1.25));
$("#vis-moins").addEventListener("click", () => zoomVis(.8));
$("#vis-miroir").addEventListener("click", () => $("#vis-img").classList.toggle("miroir"));
function fermerVis() { $("#visionneuse").hidden = true; }
$("#vis-fermer").addEventListener("click", fermerVis);
const vz = $("#vis-zone"); let vg = null;
vz.addEventListener("pointerdown", e => { vg = { x: e.clientX, y: e.clientY, l: vz.scrollLeft, t: vz.scrollTop }; vz.classList.add("glisse"); });
vz.addEventListener("pointermove", e => { if (!vg) return; vz.scrollLeft = vg.l - (e.clientX - vg.x); vz.scrollTop = vg.t - (e.clientY - vg.y); });
["pointerup", "pointerleave"].forEach(ev => vz.addEventListener(ev, () => { vg = null; vz.classList.remove("glisse"); }));
vz.addEventListener("wheel", e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomVis(e.deltaY < 0 ? 1.1 : .9); } }, { passive: false });

// ---------- Baker Street
function action(a) {
  if (a.type === "labo") return ouvrirLabo();
  if (a.type === "index") return ouvrirIndex();
  fenetre(`<h2>${a.nom}</h2>${a.texte}`); if (a.donne) donner(a.donne);
}
function ouvrirLabo() {
  const ech = S.echant;
  fenetre(`<h2>La table de chimie</h2><p class="role">Les becs Bunsen, les verres de montre tachés, une odeur d'acide. Holmes vous tend une pipette.</p>
  ${ech.length ? "" : "<p><b>Vous n'avez encore aucun échantillon à analyser.</b> Il faudra en recueillir sur les lieux ou parmi les pièces saisies.</p>"}
  <div class="labo"><div class="labo-choix"><h3>Échantillon</h3>${ech.map((e, i) => `<label><input type="radio" name="ech" value="${e}" ${i ? "" : "checked"}>${D.labo.echantillons[e]}</label>`).join("")}
  <h3>Réactif</h3>${Object.entries(D.labo.reactifs).map(([k, n], i) => `<label><input type="radio" name="rea" value="${k}" ${i ? "" : "checked"}>${n}</label>`).join("")}
  <button class="btn principal" id="essai" style="margin-top:14px" ${ech.length ? "" : "disabled"}>Faire l'essai</button></div>
  <div class="labo-paillasse"><div class="tube"><div class="liquide"></div></div><div class="labo-resultat" id="labo-res"></div></div></div>`, z => {
    const b = z.querySelector("#essai"); if (!b) return;
    b.addEventListener("click", () => {
      const e = z.querySelector("[name=ech]:checked").value, r = z.querySelector("[name=rea]:checked").value;
      const [coul, txt] = D.labo.resultats[e][r];
      const liq = z.querySelector(".liquide"), res = z.querySelector("#labo-res");
      liq.style.transition = "none"; liq.style.height = "0"; liq.style.backgroundColor = "#e9e2cf"; res.textContent = "…";
      requestAnimationFrame(() => requestAnimationFrame(() => { liq.style.transition = ""; liq.style.height = "62%"; liq.style.backgroundColor = coul; }));
      setTimeout(() => { res.textContent = txt; }, 1900);
      S.labo.push({ e, r, coul, txt }); sauver();
    });
  });
}
function ouvrirIndex() {
  fenetre(`<h2>L'index de Holmes</h2><p class="role">Des volumes reliés, classés par lettre, bourrés de coupures et de fiches. Que cherchez-vous ?</p><form id="f-index" style="display:flex;gap:10px;flex-wrap:wrap"><input id="q-index" placeholder="un nom, un mot" spellcheck="false" style="flex:1;min-width:200px"><button class="btn principal">Chercher</button></form><div id="r-index" style="margin-top:18px"></div>`, z => {
    z.querySelector("#f-index").addEventListener("submit", e => {
      e.preventDefault(); const q = norm(z.querySelector("#q-index").value); const out = z.querySelector("#r-index");
      if (q.length < 3) { out.innerHTML = "<p>Un mot un peu plus long, Watson.</p>"; return; }
      const t = D.index.find(x => x.mots.some(m => q.split(" ").some(w => w === norm(m) || (w.length > 4 && norm(m).startsWith(w)) || (norm(m).length > 4 && w.startsWith(norm(m))))));
      out.innerHTML = t ? t.texte : D.index_defaut;
      if (t && t.donne) donner(t.donne);
    });
    z.querySelector("#q-index").focus();
  });
}

// ---------- Coffre
function ouvrirCoffre(pt) {
  const deja = S.docs.includes(D.coffre.donne[0]);
  fenetre(`<h2>${pt.nom}</h2>${pt.texte}${deja ? "<p><i>Le coffre est ouvert. Vous en avez déjà retiré ce qui vous intéressait.</i></p>" : `<div class="coffre">${[0, 1, 2, 3].map(i => `<div class="molette"><button data-i="${i}" data-d="1" aria-label="Plus">▲</button><output id="m${i}">0</output><button data-i="${i}" data-d="-1" aria-label="Moins">▼</button></div>`).join("")}</div><div style="text-align:center"><button class="btn principal" id="tourner">Tourner la poignée</button></div><div id="coffre-res" style="margin-top:16px"></div>`}`, z => {
    if (deja) return; const v = [0, 0, 0, 0];
    z.querySelectorAll(".molette button").forEach(b => b.addEventListener("click", () => { const i = +b.dataset.i; v[i] = (v[i] + +b.dataset.d + 10) % 10; z.querySelector("#m" + i).textContent = v[i]; }));
    z.querySelector("#tourner").addEventListener("click", () => {
      const res = z.querySelector("#coffre-res");
      if (v.join("") === D.coffre.code) { res.innerHTML = D.coffre.texte; donner(D.coffre.donne); z.querySelector(".coffre").remove(); z.querySelector("#tourner").remove(); }
      else res.innerHTML = D.coffre.echec;
    });
  });
}

// ---------- Somerset House
function formSomerset() {
  const r = el("div", { class: "rubrique" }, `<h3>Demande de recherche (décès)</h3><form id="f-som" style="display:flex;gap:10px;flex-wrap:wrap;align-items:end"><label>Nom de famille<br><input id="s-nom" spellcheck="false"></label><label>Année<br><input id="s-an" inputmode="numeric" maxlength="4" style="width:110px"></label><button class="btn principal">Remettre au commis</button></form><div id="s-res" class="lieu-texte" style="margin-top:18px"></div>`);
  r.querySelector("#f-som").addEventListener("submit", e => {
    e.preventDefault(); const nom = norm(r.querySelector("#s-nom").value), an = r.querySelector("#s-an").value.trim(), out = r.querySelector("#s-res");
    if (!nom) { out.innerHTML = "<p>« Un nom, monsieur. »</p>"; return; }
    let t = D.somerset.find(x => x.nom.includes(nom) && x.annee && x.annee === an) || D.somerset.find(x => x.nom.includes(nom) && x.sansAnnee && !an) || D.somerset.find(x => x.nom.includes(nom) && !x.annee && !x.sansAnnee);
    out.innerHTML = t ? t.texte : D.somerset_defaut; if (t && t.donne) donner(t.donne);
  });
  return r;
}

// ---------- Carnet
function afficherCarnet() {
  const n = $("#notes"); n.value = S.notes;
  const j = $("#journal-labo");
  j.innerHTML = S.labo.length ? S.labo.map(x => `<div><i style="background:${x.coul}"></i><b>${D.labo.echantillons[x.e]}</b> + ${D.labo.reactifs[x.r]} : ${x.txt}</div>`).join("") : "<p class='aide'>Aucune analyse pour l'instant.</p>";
}
$("#notes").addEventListener("input", e => { S.notes = e.target.value; sauver(); });

// ---------- Annuaire
function afficherAnnuaire() { filtrerAnnuaire(); }
function filtrerAnnuaire() {
  const q = norm($("#annuaire-q").value);
  const l = D.annuaire.filter(a => !q || norm(a.join(" ")).includes(q)).sort((a, b) => a[0].localeCompare(b[0]));
  $("#annuaire-liste").innerHTML = l.map(a => `<div><b>${a[0]}</b>${a[1] ? ", <span>" + a[1] + "</span>" : ""} — ${a[2]}</div>`).join("") || "<p>Aucune entrée.</p>";
}
$("#annuaire-q").addEventListener("input", filtrerAnnuaire);

// ---------- Indices
function afficherIndices() {
  const v = $("#vue-indices"); v.innerHTML = "<h2>Indices</h2><p class='aide'>Chaque étape propose trois indices de plus en plus précis, puis sa solution. Chaque indice coûte un peu de votre score. Ne lisez que ce dont vous avez besoin.</p>";
  D.indices.forEach((p, i) => {
    const n = S.indices[i] || 0, b = el("div", { class: "piste" }, `<h3>${p.titre}</h3>`);
    for (let k = 0; k < Math.min(n, 3); k++) b.appendChild(el("p", { class: "revele" }, `<b>Indice ${k + 1}.</b> ${p.niveaux[k]}`));
    if (n >= 4) b.appendChild(el("p", { class: "revele sol" }, `<b>Solution de l'étape.</b> ${p.solution}`));
    const nv = el("div", { class: "niveaux" });
    if (n < 3) nv.appendChild(el("button", { on: { click: () => { S.indices[i] = n + 1; sauver(); afficherIndices(); } } }, `Voir l'indice ${n + 1}`));
    else if (n === 3) nv.appendChild(el("button", { class: "solution", on: { click: () => { if (confirm("Révéler la solution de cette étape ?")) { S.indices[i] = 4; sauver(); afficherIndices(); } } } }, "Révéler la solution de l'étape"));
    b.appendChild(nv); v.appendChild(b);
  });
  v.appendChild(el("div", { class: "piste" }, "<h3>Abandonner l'enquête</h3>"));
  v.lastChild.appendChild(el("div", { class: "niveaux" })).appendChild(el("button", { class: "solution", on: { click: () => { if (confirm("Lire toute la solution ? L'enquête n'aura plus de secret.") && confirm("Vraiment ? Holmes vous regarde.")) { S.abandon = true; sauver(); afficherVerite(); } } } }, "Lire toute la solution"));
}

// ---------- Le fin mot de l'affaire
function afficherVerite() {
  fenetre(`<h2>Le fin mot de l'affaire</h2>${D.verite}`);
}

// ---------- Conclure
function afficherConclure() {
  const v = $("#vue-conclure");
  if (S.fini) return afficherFin();
  v.innerHTML = `<h2>Conclure</h2><p class="aide">Holmes ne revient pas sur une accusation. Ne venez ici que lorsque vous êtes sûrs de vous. Une accusation fausse vous coûtera cher, mais vous pourrez reprendre l'enquête.</p>`;
  const f = el("form", { id: "f-conclure" });
  D.deductions.forEach((d, i) => f.appendChild(el("div", { class: "question" }, `<h3>${i + 1}. ${d.q}</h3>` + d.options.map((o, k) => `<label><input type="radio" name="q${i}" value="${k}" required>${o}</label>`).join(""))));
  f.appendChild(el("div", { class: "question" }, `<h3>${D.deductions.length + 1}. Qui a tué Cornelius Marsh ?</h3>` + Object.entries(D.suspects).map(([k, n]) => `<label><input type="radio" name="coupable" value="${k}" required>${n}</label>`).join("")));
  f.appendChild(el("button", { class: "btn principal" }, "Présenter vos conclusions à Holmes"));
  f.addEventListener("submit", e => {
    e.preventDefault();
    if (!confirm("Vos conclusions sont définitives. Les présenter ?")) return;
    const rep = D.deductions.map((d, i) => +f.querySelector(`[name=q${i}]:checked`).value);
    const coupable = f.querySelector("[name=coupable]:checked").value;
    const justes = rep.filter((r, i) => r === D.deductions[i].bonne).length;
    if (coupable !== D.coupable) {
      S.accusations += 1; sauver();
      v.innerHTML = `<div class="epilogue page-papier"><h2>${D.epilogues.erreur.titre}</h2>${D.epilogues.erreur.texte}<p class="score">${justes} déduction${justes > 1 ? "s" : ""} juste${justes > 1 ? "s" : ""} sur ${D.deductions.length}, mais le mauvais coupable.</p><button class="btn principal" id="reprendre">Reprendre l'enquête</button></div>`;
      parler(D.epilogues.erreur.son);
      v.querySelector("#reprendre").addEventListener("click", () => vue("carte"));
      return;
    }
    v.innerHTML = `<div class="epilogue page-papier"><h2>« C'est elle, Watson. »</h2><p>Holmes hoche lentement la tête. Il ne sourit pas.</p><p>« Vous avez raison. Et maintenant vient la partie de notre métier que je déteste. Nous pouvons remettre Margaret Pell à Lestrade, et elle sera pendue. Ou nous pouvons nous contenter de sauver Lionel, et laisser le brouillard faire le reste. La loi est claire. Le reste ne l'est pas. »</p><div class="choix-moral"><button data-c="condamner"><b>Condamner</b>Remettre toutes les preuves à Lestrade. Justice sera faite, selon la loi.</button><button data-c="absoudre"><b>Absoudre</b>Prouver l'innocence de Lionel, et taire le reste.</button></div></div>`;
    v.querySelectorAll("[data-c]").forEach(b => b.addEventListener("click", () => { S.fini = { choix: b.dataset.c, rep, temps: S.temps }; sauver(); afficherFin(); }));
  });
  v.appendChild(f);
}
function afficherFin() {
  const v = $("#vue-conclure"), F = S.fini, ep = D.epilogues[F.choix];
  const justes = F.rep.filter((r, i) => r === D.deductions[i].bonne).length;
  const nbInd = Object.values(S.indices).reduce((a, n) => a + Math.min(n, 3), 0), nbSol = Object.values(S.indices).filter(n => n >= 4).length;
  let score = 100 - (D.deductions.length - justes) * 8 - nbInd * 3 - nbSol * 8 - Math.max(0, S.trajets - 10) * 2 - S.accusations * 15;
  score = Math.max(0, score);
  const rang = score >= 90 ? "Holmes lui-même n'aurait pas fait mieux." : score >= 70 ? "Holmes vous tend sa pipe : c'est un honneur." : score >= 50 ? "Lestrade vous aurait engagés. Holmes, peut-être." : "L'affaire est résolue, mais Holmes a soupiré plus d'une fois.";
  const m = Math.floor(F.temps / 60);
  v.innerHTML = `<div class="epilogue page-papier"><h2>${ep.titre}</h2>${ep.texte}<hr><h3>Le dossier, point par point</h3>${D.deductions.map((d, i) => `<div class="verdict ${F.rep[i] === d.bonne ? "juste" : "faux"}"><b>${d.q}</b><br>${F.rep[i] === d.bonne ? "Juste" : "Faux. La réponse était : " + d.options[d.bonne]}. ${d.explique}</div>`).join("")}
  <h3>Votre enquête</h3><p class="score">${justes} déductions justes sur ${D.deductions.length} · ${S.trajets} trajets en fiacre (Holmes en aurait fait une dizaine) · ${nbInd} indice${nbInd > 1 ? "s" : ""}, ${nbSol} solution${nbSol > 1 ? "s" : ""} d'étape · ${S.accusations} fausse${S.accusations > 1 ? "s" : ""} accusation${S.accusations > 1 ? "s" : ""} · ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}</p>
  <p class="score">Score : <b>${score} / 100</b>. ${rang}</p>
  <button class="btn principal" id="voir-verite">Lire ce qui s'est vraiment passé</button>
  <button class="btn" id="rejouer">Recommencer depuis le début</button></div>`;
  parler(ep.son);
  v.querySelector("#voir-verite").addEventListener("click", afficherVerite);
  v.querySelector("#rejouer").addEventListener("click", () => { if (confirm("Effacer cette enquête et recommencer ?")) { S = neuf(); sauver(); location.reload(); } });
}
})();
