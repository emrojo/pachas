import fs from 'fs';
import path from 'path';

const localesDir = path.resolve('src/locales');

const translations = {
  es: "Descargar",
  en: "Download",
  gl: "Descargar",
  ca: "Descarregar",
  eu: "Deskargatu",
  va: "Descarregar",
  fr: "Télécharger",
  pt: "Descarregar",
  it: "Scarica",
  de: "Herunterladen",
  zh: "下载",
  ja: "ダウンロード",
  hi: "डाउनलोड करें",
  ru: "Скачать",
  ar: "تحميل",
  el: "Λήψη",
  tr: "İndir",
  nl: "Downloaden",
  af: "Aflaai"
};

for (const [lang, val] of Object.entries(translations)) {
  const filePath = path.join(localesDir, `${lang}.ts`);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes('downloadReceipt:')) continue;

  // Insert after viewReceipt
  content = content.replace(
    /viewReceipt:\s*['"`].*?['"`],/,
    (match) => `${match}\n    downloadReceipt: '${val}',`
  );

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Updated ${lang}.ts with downloadReceipt`);
}
