import fs from 'fs';
import path from 'path';

const localesDir = path.resolve('src/locales');

const translations = {
  es: { takePhoto: 'Hacer foto', uploadFromGallery: 'Subir archivo' },
  en: { takePhoto: 'Take photo', uploadFromGallery: 'Upload file' },
  gl: { takePhoto: 'Facer foto', uploadFromGallery: 'Subir arquivo' },
  ca: { takePhoto: 'Fer foto', uploadFromGallery: 'Pujar arxiu' },
  eu: { takePhoto: 'Argazkia atera', uploadFromGallery: 'Fitxategia kargatu' },
  va: { takePhoto: 'Fer foto', uploadFromGallery: 'Pujar arxiu' },
  fr: { takePhoto: 'Prendre photo', uploadFromGallery: 'Téléverser' },
  pt: { takePhoto: 'Tirar foto', uploadFromGallery: 'Carregar ficheiro' },
  it: { takePhoto: 'Scatta foto', uploadFromGallery: 'Carica file' },
  de: { takePhoto: 'Foto aufnehmen', uploadFromGallery: 'Datei hochladen' },
  zh: { takePhoto: '拍照', uploadFromGallery: '上传文件' },
  ja: { takePhoto: '写真を撮る', uploadFromGallery: 'ファイルをアップロード' },
  hi: { takePhoto: 'फोटो लें', uploadFromGallery: 'फ़ाइल अपलोड करें' },
  ru: { takePhoto: 'Сделать фото', uploadFromGallery: 'Загрузить файл' },
  ar: { takePhoto: 'التقاط صورة', uploadFromGallery: 'رفع ملف' },
  el: { takePhoto: 'Λήψη φωτογραφίας', uploadFromGallery: 'Μεταφόρτωση αρχείου' },
  tr: { takePhoto: 'Fotoğraf çek', uploadFromGallery: 'Dosya yükle' },
  nl: { takePhoto: 'Foto maken', uploadFromGallery: 'Bestand uploaden' },
  af: { takePhoto: 'Neem foto', uploadFromGallery: 'Laai lêer op' },
};

for (const [lang, data] of Object.entries(translations)) {
  const filePath = path.join(localesDir, `${lang}.ts`);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes('takePhoto:')) continue;

  content = content.replace(
    /uploadReceipt:\s*['"`].*?['"`],/,
    (match) => `${match}\n    takePhoto: '${data.takePhoto}',\n    uploadFromGallery: '${data.uploadFromGallery}',`
  );

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Updated ${lang}.ts with camera keys`);
}
