/**
 * Conversion de l'enregistrement du micro en WAV 16 kHz mono — dans le navigateur.
 * C'est exactement le format attendu par whisper.cpp, donc aucun ffmpeg n'est
 * nécessaire côté serveur, et l'audio n'est jamais converti par un outil tiers.
 */

const CIBLE_HZ = 16000;

/** Formats que MediaRecorder sait produire, par ordre de préférence. */
export function meilleurFormat() {
  const candidats = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4', // Safari
    'audio/ogg;codecs=opus',
  ];
  return candidats.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) ?? '';
}

/** Blob enregistré (webm/mp4) → { blob: WAV 16 kHz mono, duree: secondes }. */
export async function versWav16k(blobEnregistre) {
  const donnees = await blobEnregistre.arrayBuffer();

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  let decode;
  try {
    decode = await ctx.decodeAudioData(donnees);
  } finally {
    ctx.close();
  }

  // Rééchantillonnage + passage en mono via un rendu hors écran.
  const offline = new OfflineAudioContext(1, Math.ceil(decode.duration * CIBLE_HZ), CIBLE_HZ);
  const source = offline.createBufferSource();
  source.buffer = decode;
  source.connect(offline.destination);
  source.start();
  const rendu = await offline.startRendering();

  return { blob: encoderWav(rendu.getChannelData(0), CIBLE_HZ), duree: decode.duration };
}

/** Float32 [-1,1] → WAV PCM 16 bits. */
function encoderWav(echantillons, frequence) {
  const tampon = new ArrayBuffer(44 + echantillons.length * 2);
  const vue = new DataView(tampon);

  const texte = (offset, chaine) => {
    for (let i = 0; i < chaine.length; i++) vue.setUint8(offset + i, chaine.charCodeAt(i));
  };

  texte(0, 'RIFF');
  vue.setUint32(4, 36 + echantillons.length * 2, true);
  texte(8, 'WAVE');
  texte(12, 'fmt ');
  vue.setUint32(16, 16, true); // taille du bloc fmt
  vue.setUint16(20, 1, true); // PCM
  vue.setUint16(22, 1, true); // mono
  vue.setUint32(24, frequence, true);
  vue.setUint32(28, frequence * 2, true); // octets par seconde
  vue.setUint16(32, 2, true); // alignement
  vue.setUint16(34, 16, true); // bits par échantillon
  texte(36, 'data');
  vue.setUint32(40, echantillons.length * 2, true);

  let offset = 44;
  for (let i = 0; i < echantillons.length; i++) {
    const v = Math.max(-1, Math.min(1, echantillons[i]));
    vue.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    offset += 2;
  }

  return new Blob([tampon], { type: 'audio/wav' });
}
