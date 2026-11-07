// Build : extrait le module WebAssembly du décodeur Opus (paquet « opus-decoder », utilisé par
// « ogg-opus-decoder ») dans un fichier .wasm. Cloudflare interdit de compiler du WebAssembly à
// l'exécution ; le Worker importe donc ce fichier précompilé et le donne au décodeur
// (OpusDecoder.module), qui saute alors sa propre compilation.
// Usage : node extraire_opus.mjs <dossier_build> <sortie.wasm>
import fs from "node:fs";
const racine = process.argv[2];
const { WASMAudioDecoderCommon } = await import(racine + "/node_modules/@wasm-audio-decoders/common/index.js");
const { default: EmscriptenWASM } = await import(racine + "/node_modules/opus-decoder/src/EmscriptenWasm.js");
new WASMAudioDecoderCommon();
new EmscriptenWASM(WASMAudioDecoderCommon); // définit EmscriptenWASM.wasm (chaîne compressée)
const octets = await WASMAudioDecoderCommon.inflateDynEncodeString(EmscriptenWASM.wasm);
if (!WebAssembly.validate(octets)) throw new Error("module Opus invalide");
fs.writeFileSync(process.argv[3], octets);
console.log(`  décodeur Opus précompilé : ${octets.length} octets`);
