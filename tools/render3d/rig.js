// Retarget do esqueleto do motor (Anim) para o rig reduzido do MakeHuman.
// Saída: para cada osso, rotação (quaternion, espaço de repouso -> pose), escala axial e posição da cabeça.
// Convenção: p_pose = h_pose + R * S * (p_rest - h_rest)
(function () {
let THREE;

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
let _m, _m0;

function rej(v, n) { return v.clone().sub(n.clone().multiplyScalar(v.dot(n))); }
function safeUnit(v, fb) { const l = v.length(); return l > 1e-6 ? v.clone().divideScalar(l) : fb.clone(); }

/** rotação que leva o par ortonormal (a0, b0) em (a, b) */
function frameRot(a0, b0, a, b) {
  const A0 = a0.clone().normalize(), B0 = rej(b0, A0).normalize(), C0 = A0.clone().cross(B0);
  const A = a.clone().normalize(), B = rej(b, A).normalize(), C = A.clone().cross(B);
  _m0.makeBasis(A0, B0, C0);
  _m.makeBasis(A, B, C);
  _m.multiply(_m0.transpose());
  return new THREE.Quaternion().setFromRotationMatrix(_m);
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
function fromTo(a, b) { return new THREE.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize()); }

/** decomposição swing-twist: parte de q que gira em torno de axis */
function twistOf(q, axis) {
  const r = new THREE.Vector3(q.x, q.y, q.z);
  const p = axis.clone().multiplyScalar(r.dot(axis));
  const t = new THREE.Quaternion(p.x, p.y, p.z, q.w);
  if (t.lengthSq() < 1e-12) return new THREE.Quaternion();
  return t.normalize();
}

function makeRig(data) {
  const bones = data.bones.map((b, i) => ({ ...b, i, h0: V(b.head), t0: V(b.tail) }));
  const B = Object.fromEntries(bones.map((b) => [b.name, b]));
  const lm = data.lm;
  const hipC = B.hips.h0, shC = B.hips.t0;

  // referenciais de repouso
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  const tU0 = shC.clone().sub(hipC).normalize();
  const tF0 = rej(X, tU0).normalize();

  const rest = {};
  for (const S of ['L', 'R']) {
    const up = B['upper.' + S], f1 = B['fore1.' + S], hand = B['hand.' + S];
    const sh0 = up.h0, el0 = f1.h0, wr0 = hand.h0;
    const A0 = el0.clone().sub(sh0).normalize();
    const B0 = wr0.clone().sub(el0).normalize();
    const F0 = rej(B0, A0).normalize(); // direção de flexão (antebraço vai para cá)
    const H0 = A0.clone().cross(F0);
    // mão: eixo dos dedos, palma (pela curvatura natural dos dedos) e polegar
    const k3 = B['f3-1.' + S].h0;
    const h0 = k3.clone().sub(wr0).normalize();
    const tip3 = B['f3-3.' + S].t0;
    const palm0 = rej(tip3.clone().sub(k3), h0).normalize();
    const thumb0 = rej(B['f2-1.' + S].h0.clone().sub(B['f5-1.' + S].h0), h0).normalize();
    const hs = Math.sign(palm0.dot(h0.clone().cross(thumb0))) || 1; // quiralidade
    // perna
    const th = B['thigh.' + S], sn = B['shin.' + S], ft = B['foot.' + S];
    const hip0 = th.h0, kn0 = sn.h0, an0 = ft.h0;
    const LA0 = kn0.clone().sub(hip0).normalize();
    const LF0 = rej(new THREE.Vector3(-1, 0, 0), LA0).normalize(); // canela flexiona para trás
    const LB0 = an0.clone().sub(kn0).normalize();
    const LH0 = LA0.clone().cross(LF0);
    const heel0 = V(lm['heel.' + S]), toe0 = V(lm['toe.' + S]);
    const fF0 = toe0.clone().sub(heel0).normalize();
    const fU0 = rej(Y, fF0).normalize();
    const mid0 = heel0.clone().add(toe0).multiplyScalar(0.5);
    // centro da palma (meio dos metacarpos) e meia espessura até a pele da palma (ajustada pela checagem de malha)
    const palmC0 = wr0.clone().lerp(k3, 0.55);
    rest[S] = {
      sh0, el0, wr0, A0, B0, F0, H0, la: sh0.distanceTo(el0), lb: el0.distanceTo(wr0),
      k3, h0, palm0, hs, palmC0, palmTh: 1.9,
      hip0, kn0, an0, LA0, LB0, LF0, LH0, ta: hip0.distanceTo(kn0), tb: kn0.distanceTo(an0),
      fF0, fU0, mid0,
    };
  }

  // curvatura dos dedos (graus) por modo de mão: pegada na barra, espalmada no chão, relaxada
  const CURL = { 1: [10, 30, 35], 2: [62, 80, 40], 3: [66, 82, 42], 4: [68, 82, 42], 5: [70, 80, 40] };
  const CURLS = {
    grip: CURL,
    // polegar com curvatura negativa: sai de baixo da palma (repouso do MakeHuman) para o plano dela
    flat: { 1: [-38, -12, -4], 2: [2, 4, 3], 3: [2, 4, 3], 4: [3, 5, 4], 5: [4, 6, 5] },
    relaxed: { 1: [8, 14, 14], 2: [18, 26, 16], 3: [22, 30, 18], 4: [26, 34, 20], 5: [30, 38, 22] },
  };
  // eixo de dobra de cada falange no espaço de repouso
  for (const b of bones) {
    const m = /^f(\d)-(\d)\.(L|R)$/.exec(b.name);
    if (!m) continue;
    const r = rest[m[3]];
    const d = b.t0.clone().sub(b.h0).normalize();
    let k = d.clone().cross(r.palm0);
    if (m[1] === '1') k = d.clone().cross(r.palm0.clone().add(r.h0.clone().multiplyScalar(-0.3))).normalize();
    b.curlAxis = k.normalize();
    b.curlDeg = CURL[m[1]][Number(m[2]) - 1];
  }

  // ponto de pegada (centro da barra) no espaço da mão em repouso: centro do "anel" formado pelos dedos fechados
  for (const S of ['L', 'R']) {
    const acc = new THREE.Vector3(); let n = 0;
    for (let f = 2; f <= 5; f++) {
      let q = new THREE.Quaternion(), prev = null, head = null;
      for (let k = 1; k <= 3; k++) {
        const b = B[`f${f}-${k}.${S}`];
        head = prev ? prev.head.clone().add(b.h0.clone().sub(prev.b.h0).applyQuaternion(prev.q)) : b.h0.clone();
        q = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(b.curlAxis, (b.curlDeg * Math.PI) / 180));
        acc.add(head); n++;
        prev = { b, head, q };
      }
      acc.add(prev.head.clone().add(prev.b.t0.clone().sub(prev.b.h0).applyQuaternion(prev.q))); n++;
    }
    rest[S].grip0 = acc.divideScalar(n);
    rest[S].relax0 = rest[S].wr0.clone().add(rest[S].h0.clone().multiplyScalar(rest[S].grip0.distanceTo(rest[S].wr0)));
  }

  const state = bones.map(() => ({ q: new THREE.Quaternion(), h: new THREE.Vector3(), scale: 1 }));
  const report = { reach: { L: 0, R: 0 }, legReach: { L: 0, R: 0 } };

  function setB(name, q, h, scale = 1) {
    const st = state[B[name].i];
    st.q.copy(q); st.h.copy(h); st.scale = scale;
  }
  // posição de um ponto de repouso p transformado pelo osso `name` (já posto)
  function xf(name, p) {
    const b = B[name], st = state[b.i];
    const d = p.clone().sub(b.h0);
    if (st.scale !== 1) {
      const ax = b.t0.clone().sub(b.h0).normalize();
      d.add(ax.multiplyScalar(d.dot(ax) * (st.scale - 1)));
    }
    return d.applyQuaternion(st.q).add(st.h);
  }

  function ik2(root, target, la, lb, poleDir) {
    const dv = target.clone().sub(root);
    let d = dv.length();
    const dir = dv.clone().divideScalar(d || 1);
    const maxd = (la + lb) * 0.9995;
    const short = Math.max(0, d - maxd);
    d = Math.min(Math.max(d, Math.abs(la - lb) + 1e-3), maxd);
    const ca = (la * la + d * d - lb * lb) / (2 * la * d);
    const sa = Math.sqrt(Math.max(0, 1 - ca * ca));
    const pd = safeUnit(rej(poleDir, dir), new THREE.Vector3(0, 0, 1));
    const mid = root.clone().add(dir.clone().multiplyScalar(la * ca)).add(pd.clone().multiplyScalar(la * sa));
    const end = root.clone().add(dir.clone().multiplyScalar(d));
    return { mid, end, pd, short };
  }

  // legScale: esticar coxa/canela para o comprimento do motor (desligado: osso rígido, comprimentos MakeHuman)
  // pelvisMax: compensação de altura da pelve do tempo em que motor e corpo tinham proporções diferentes;
  // desligada (0) desde que o motor usa as medidas deste corpo
  const opts = { legScale: false, pelvisMax: 0, floorY: 0 };

  /** osso auxiliar de articulação: meio ângulo entre os dois segmentos, empurrado para a ponta
   *  (patela/olécrano) proporcionalmente à flexão para preservar volume e marcar o "canto" */
  function helper(qA, qB, jointPose, tipDir, hb, push) {
    const q = qA.clone().slerp(qB, 0.5);
    const flex = qA.angleTo(qB); // rad
    const h = jointPose.clone().add(tipDir.clone().multiplyScalar(push * Math.sin(flex / 2)));
    // o pivô de repouso do auxiliar é a própria articulação: h0 -> jointPose (+ empurrão)
    return [q, h];
  }

  function footTarget(s, S) {
    const r = rest[S];
    const heel = V(s.heel[S]), toe = V(s.toe[S]), ank = V(s.ankle[S]);
    const fF = toe.clone().sub(heel).normalize();
    const fU = safeUnit(rej(ank.clone().sub(heel), fF), Y);
    const qFoot = frameRot(r.fF0, r.fU0, fF, fU);
    const midP = heel.clone().add(toe).multiplyScalar(0.5);
    const At = midP.clone().add(r.an0.clone().sub(r.mid0).applyQuaternion(qFoot));
    return { qFoot, At, fF };
  }

  /** modos de mão: { L, R } com 'grip' (segura aparelho), 'flat' (palma no chão) ou 'relaxed' (solta) */
  function pose(s, modes = { L: 'grip', R: 'grip' }) {
    let pelvis = V(s.pelvis);
    const up = V(s.up).normalize();
    const front = rej(V(s.front), up).normalize();
    const qT = frameRot(tF0, tU0, front, up);
    // pelve: desloca na vertical para que, com os comprimentos MakeHuman, o joelho tenha a mesma flexão
    // do motor com o pé plantado no alvo (sem esticar osso)
    report.pelvisDy = 0;
    if (!opts.legScale) {
      let acc = 0, n = 0;
      for (const S of ['L', 'R']) {
        const r = rest[S];
        const { At } = footTarget(s, S);
        const hipP = pelvis.clone().add(r.hip0.clone().sub(hipC).applyQuaternion(qT));
        const e1 = V(s.knee[S]).sub(V(s.hip[S])).normalize(), e2 = V(s.ankle[S]).sub(V(s.knee[S])).normalize();
        const c = Math.min(1, Math.max(-1, e1.dot(e2)));
        const dWant = Math.sqrt(r.ta * r.ta + r.tb * r.tb + 2 * r.ta * r.tb * c) * 0.998;
        const v = hipP.clone().sub(At);
        const vy = v.y, disc = vy * vy - v.lengthSq() + dWant * dWant;
        const dy = disc >= 0 ? (Math.abs(-vy + Math.sqrt(disc)) < Math.abs(-vy - Math.sqrt(disc)) ? -vy + Math.sqrt(disc) : -vy - Math.sqrt(disc)) : -vy;
        acc += dy; n++;
      }
      const dy = Math.max(-opts.pelvisMax, Math.min(opts.pelvisMax, acc / n));
      pelvis = pelvis.add(new THREE.Vector3(0, dy, 0));
      report.pelvisDy = dy;
    }
    for (const n of ['hips', 'spine', 'chest']) setB(n, qT, pelvis.clone().add(hipC.clone().sub(B.hips.h0).applyQuaternion(qT)));
    // pescoço e cabeça
    const neckP = xf('chest', B.neck.h0);
    const headMid0 = B.head.h0.clone().add(B.head.t0).multiplyScalar(0.5);
    const n0 = headMid0.clone().sub(B.neck.h0).normalize().applyQuaternion(qT);
    const nDir = V(s.head).sub(V(s.neck)).normalize();
    const qExtra = fromTo(n0, nDir);
    const qNeck = new THREE.Quaternion().slerp(qExtra, 0.5).multiply(qT);
    setB('neck', qNeck, neckP);
    const qHead = qExtra.clone().multiply(qT);
    setB('head', qHead, xf('neck', B.head.h0));

    for (const S of ['L', 'R']) {
      const O = S === 'L' ? 'R' : 'L';
      const r = rest[S];
      // ── braço
      // modo: 'grip' (polegar para a outra mão: barra em pegada pronada), { thumb: [x,y,z] } (pegada com o
      // polegar nessa direção: halter neutro, rosca supinada, manopla) ou { flat: k } (0 relaxada … 1 palma no chão)
      const m = modes[S] || 'grip';
      const grip = m === 'grip' || !!m.thumb;
      const kFlat = grip ? 0 : clamp01(m.flat ?? 0);
      const handP = V(s.hand[S]), wristE = V(s.wrist[S]);
      const hDir = handP.clone().sub(wristE).normalize();
      let qHand, W;
      if (grip) {
        const toOther = m.thumb ? V(m.thumb) : V(s.hand[O]).sub(handP);
        const thumb = safeUnit(rej(toOther, hDir), front);
        const palm = hDir.clone().cross(thumb).multiplyScalar(r.hs);
        qHand = frameRot(r.h0, r.palm0, hDir, palm);
        W = handP.clone().sub(r.grip0.clone().sub(r.wr0).applyQuaternion(qHand));
      } else {
        // relaxada: palma voltada para a linha média; espalmada: palma para baixo, dedos na direção do antebraço
        const medial = V(s.left).multiplyScalar(S === 'L' ? -1 : 1);
        const qRel = frameRot(r.h0, r.palm0, hDir, safeUnit(rej(medial, hDir), front.clone().multiplyScalar(-1)));
        const qFl = frameRot(r.h0, r.palm0, safeUnit(rej(hDir, Y), front), new THREE.Vector3(0, -1, 0));
        qHand = qRel.clone().slerp(qFl, kFlat);
        // âncora = o ponto da mão que o motor chama de "mão": centro da palma (apoiada) ou o ponto da pegada
        // no eixo da mão (solta, mesma distância do punho que a pegada); o motor já deu a altura certa
        const anchor0 = r.relax0.clone().lerp(r.palmC0, kFlat);
        W = handP.clone().sub(anchor0.sub(r.wr0).applyQuaternion(qHand));
      }
      // clavícula: segue o tronco, mas pode deprimir/protrair até 6 cm para alcançar
      const clavB = B['clav.' + S];
      const clavP = xf('chest', clavB.h0);
      let shP = xf('chest', r.sh0);
      const dist = W.distanceTo(shP);
      const need = dist - (r.la + r.lb) * 0.985;
      let qClav = qT.clone();
      if (need > 0) {
        const shift = Math.min(need, 6);
        const want = shP.clone().add(W.clone().sub(shP).normalize().multiplyScalar(shift));
        const qc = fromTo(shP.clone().sub(clavP), want.clone().sub(clavP));
        qClav = qc.multiply(qT);
      }
      setB('clav.' + S, qClav, clavP);
      shP = xf('clav.' + S, r.sh0);
      const pole = V(s.elbow[S]).sub(shP);
      // polo: cotovelo do motor; se o braço estiver quase reto, reforça "cotovelo para trás/fora"
      const sw = W.clone().sub(shP).normalize();
      let pr = rej(pole, sw);
      const fb = rej(front.clone().multiplyScalar(-1).add(V(s.left).multiplyScalar(S === 'L' ? 0.35 : -0.35)), sw).normalize();
      const wgt = Math.min(1, pr.length() / 3);
      pr = safeUnit(pr, fb).multiplyScalar(wgt).add(fb.clone().multiplyScalar(1 - wgt));
      const ik = ik2(shP, W, r.la, r.lb, pr);
      report.reach[S] = ik.short;
      const Aa = ik.mid.clone().sub(shP).normalize();
      const Fa = ik.pd.clone().multiplyScalar(-1);
      const qUp = frameRot(r.A0, r.F0, Aa, Fa);
      setB('upper.' + S, qUp, shP);
      const Ha = Aa.clone().cross(rej(Fa, Aa).normalize());
      const Ba = ik.end.clone().sub(ik.mid).normalize();
      const qF1 = frameRot(r.B0, r.H0, Ba, Ha);
      // torção do antebraço distribuída entre fore1 (20%), fore2 (65%) e a mão (100%)
      const rel = qF1.clone().invert().multiply(qHand);
      const tw = twistOf(rel, r.B0);
      const qF1t = qF1.clone().multiply(new THREE.Quaternion().slerp(tw, 0.2));
      const qF2 = qF1.clone().multiply(new THREE.Quaternion().slerp(tw, 0.65));
      setB('fore1.' + S, qF1t, ik.mid);
      if (B['elbow.' + S]) setB('elbow.' + S, ...helper(qUp, qF1, ik.mid, ik.pd, B['elbow.' + S], opts.olecranon ?? 0.7));
      setB('fore2.' + S, qF2, xf('fore1.' + S, B['fore2.' + S].h0));
      setB('hand.' + S, qHand, ik.end);
      // dedos
      for (let f = 1; f <= 5; f++) {
        let parent = 'hand.' + S;
        let q = qHand.clone();
        for (let k = 1; k <= 3; k++) {
          const nm = `f${f}-${k}.${S}`;
          const b = B[nm];
          const h = xf(parent, b.h0);
          const deg = grip ? CURLS.grip[f][k - 1] * (opts.grip ?? 1) : CURLS.relaxed[f][k - 1] + (CURLS.flat[f][k - 1] - CURLS.relaxed[f][k - 1]) * kFlat;
          q = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(b.curlAxis, (deg * Math.PI) / 180));
          setB(nm, q, h);
          parent = nm;
        }
      }
      // ── perna
      const ank = V(s.ankle[S]);
      const { qFoot, At, fF } = footTarget(s, S);
      const hipP = xf('hips', r.hip0);
      // comprimentos do motor (escala axial da coxa/canela)
      const eThigh = V(s.hip[S]).distanceTo(V(s.knee[S]));
      const eShin = V(s.knee[S]).distanceTo(ank);
      const la = opts.legScale ? eThigh : r.ta, lb = opts.legScale ? eShin : r.tb;
      const ha = At.clone().sub(hipP).normalize();
      let kp = rej(V(s.knee[S]).sub(hipP), ha);
      const kfb = rej(fF.clone(), ha).normalize();
      const kw = Math.min(1, kp.length() / 4);
      kp = safeUnit(kp, kfb).multiplyScalar(kw).add(kfb.clone().multiplyScalar(1 - kw));
      const lik = ik2(hipP, At, la, lb, kp);
      report.legReach[S] = lik.short;
      const LA = lik.mid.clone().sub(hipP).normalize();
      const LF = lik.pd.clone().multiplyScalar(-1);
      const qTh = frameRot(r.LA0, r.LF0, LA, LF);
      setB('thigh.' + S, qTh, hipP, la / r.ta);
      const LH = LA.clone().cross(rej(LF, LA).normalize());
      const LB = lik.end.clone().sub(lik.mid).normalize();
      const qSh = frameRot(r.LB0, r.LH0, LB, LH);
      setB('shin.' + S, qSh, lik.mid, lb / r.tb);
      if (B['knee.' + S]) setB('knee.' + S, ...helper(qTh, qSh, lik.mid, lik.pd, B['knee.' + S], opts.patella ?? 1.0));
      setB('foot.' + S, qFoot, lik.end);
      setB('toes.' + S, qFoot, xf('foot.' + S, B['toes.' + S].h0));
    }
    return state;
  }

  /** matrizes de skin (pose * repouso^-1) */
  function matrices(out) {
    for (const b of bones) {
      const st = state[b.i];
      const M = out[b.i];
      const ax = b.t0.clone().sub(b.h0).normalize();
      // S = I + (k-1) a a^T
      const k = st.scale - 1;
      const Sm = new THREE.Matrix4().set(
        1 + k * ax.x * ax.x, k * ax.x * ax.y, k * ax.x * ax.z, 0,
        k * ax.y * ax.x, 1 + k * ax.y * ax.y, k * ax.y * ax.z, 0,
        k * ax.z * ax.x, k * ax.z * ax.y, 1 + k * ax.z * ax.z, 0,
        0, 0, 0, 1);
      M.makeRotationFromQuaternion(st.q).multiply(Sm);
      const t = b.h0.clone().applyMatrix4(M).multiplyScalar(-1).add(st.h);
      M.setPosition(t);
    }
  }

  function restPose() {
    for (const b of bones) { state[b.i].q.identity(); state[b.i].h.copy(b.h0); state[b.i].scale = 1; }
  }

  return { bones, B, pose, matrices, restPose, report, opts, xf, rest };
}
globalThis.MHRig = { init(three) { THREE = three; _m = new THREE.Matrix4(); _m0 = new THREE.Matrix4(); }, makeRig };
})();
