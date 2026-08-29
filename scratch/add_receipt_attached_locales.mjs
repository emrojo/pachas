import fs from 'fs';
import path from 'path';

const localesDir = path.resolve('src/locales');

const translations = {
  es: { receiptAttached: 'Ticket adjunto', receiptAttachedDesc: 'Imagen capturada correctamente' },
  en: { receiptAttached: 'Receipt attached', receiptAttachedDesc: 'Image captured successfully' },
  gl: { receiptAttached: 'Recibo adxunto', receiptAttachedDesc: 'Imaxe capturada correctamente' },
  ca: { receiptAttached: 'Tiquet adjunt', receiptAttachedDesc: 'Imatge capturada correctament' },
  eu: { receiptAttached: 'Txartela erantsita', receiptAttachedDesc: 'Irudia ondo atera da' },
  va: { receiptAttached: 'Tiquet adjunt', receiptAttachedDesc: 'Imatge capturada correctament' },
  fr: { receiptAttached: 'Reçu joint', receiptAttachedDesc: 'Image capturée avec succès' },
  pt: { receiptAttached: 'Recibo anexado', receiptAttachedDesc: 'Imagem capturada com sucesso' },
  it: { receiptAttached: 'Scontrino allegato', receiptAttachedDesc: 'Immagine acquisita con successo' },
  de: { receiptAttached: 'Beleg angehängt', receiptAttachedDesc: 'Bild erfolgreich erfasst' },
  zh: { receiptAttached: '已附加收据', receiptAttachedDesc: '图片已成功捕获' },
  ja: { receiptAttached: 'レシート添付済み', receiptAttachedDesc: '画像が正常に撮影されました' },
  hi: { receiptAttached: 'रसीद संलग्न है', receiptAttachedDesc: 'तस्वीर सफलतापूर्वक कैप्चर की गई' },
  ru: { receiptAttached: 'Чек прикреплен', receiptAttachedDesc: 'Изображение успешно получено' },
  ar: { receiptAttached: 'تم إرفاق الإيصال', receiptAttachedDesc: 'تم التقاط الصورة بنجاح' },
  el: { receiptAttached: 'Επισυναπτόμενη απόδειξη', receiptAttachedDesc: 'Η εικόνα καταγράφηκε με επιτυχία' },
  tr: { receiptAttached: 'Fiş eklendi', receiptAttachedDesc: 'Görüntü başarıyla çekildi' },
  nl: { receiptAttached: 'Bon bijgevoegd', receiptAttachedDesc: 'Afbeelding succesvol vastgelegd' },
  af: { receiptAttached: 'Kwitansie aangeheg', receiptAttachedDesc: 'Beeld suksesvol vasgelê' },
};

for (const [lang, data] of Object.entries(translations)) {
  const filePath = path.join(localesDir, `${lang}.ts`);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes('receiptAttached:')) continue;

  content = content.replace(
    /scanWithCamera:\s*['"`].*?['"`],/,
    (match) => `${match}\n    receiptAttached: '${data.receiptAttached}',\n    receiptAttachedDesc: '${data.receiptAttachedDesc}',`
  );

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Updated ${lang}.ts with receiptAttached keys`);
}
