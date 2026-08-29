import fs from 'fs';
import path from 'path';

const localesDir = path.resolve('src/locales');

const translations = {
  es: {
    scanTicketPrompt: '¿Tienes el ticket o factura?',
    scanTicketDesc: 'Haz una foto o sube una imagen para autocompletar el gasto con IA',
    scanWithCamera: 'Hacer foto al ticket',
  },
  en: {
    scanTicketPrompt: 'Do you have the receipt or invoice?',
    scanTicketDesc: 'Take a photo or upload an image to auto-fill the expense with AI',
    scanWithCamera: 'Take photo of receipt',
  },
  gl: {
    scanTicketPrompt: 'Tes o recibo ou factura?',
    scanTicketDesc: 'Fai unha foto ou sube unha imaxe para autocompletar o gasto con IA',
    scanWithCamera: 'Facer foto ao recibo',
  },
  ca: {
    scanTicketPrompt: 'Tens el tiquet o factura?',
    scanTicketDesc: 'Fes una foto o puja una imatge per autocompletar la despesa amb IA',
    scanWithCamera: 'Fer foto al tiquet',
  },
  eu: {
    scanTicketPrompt: 'Txartela edo faktura al daukazu?',
    scanTicketDesc: 'Atera argazki bat gastua AI bidez automatikoki betetzeko',
    scanWithCamera: 'Atera argazkia txartelari',
  },
  va: {
    scanTicketPrompt: 'Tens el tiquet o factura?',
    scanTicketDesc: 'Fes una foto o puja una imatge per autocompletar la despesa amb IA',
    scanWithCamera: 'Fer foto al tiquet',
  },
  fr: {
    scanTicketPrompt: 'Avez-vous le reçu ou la facture ?',
    scanTicketDesc: 'Prenez une photo pour remplir automatiquement la dépense avec l\'IA',
    scanWithCamera: 'Photographier le reçu',
  },
  pt: {
    scanTicketPrompt: 'Tem o recibo ou fatura?',
    scanTicketDesc: 'Tire uma foto ou envie uma imagem para preencher a despesa com IA',
    scanWithCamera: 'Tirar foto do recibo',
  },
  it: {
    scanTicketPrompt: 'Hai lo scontrino o la fattura?',
    scanTicketDesc: 'Scatta una foto per compilare automaticamente la spesa con l\'IA',
    scanWithCamera: 'Fotografa lo scontrino',
  },
  de: {
    scanTicketPrompt: 'Haben Sie den Beleg oder die Rechnung?',
    scanTicketDesc: 'Machen Sie ein Foto, um die Ausgabe automatisch mit KI auszufüllen',
    scanWithCamera: 'Beleg fotografieren',
  },
  zh: {
    scanTicketPrompt: '您有收据或发票吗？',
    scanTicketDesc: '拍照或上传图片即可通过AI自动填充支出信息',
    scanWithCamera: '拍摄收据照片',
  },
  ja: {
    scanTicketPrompt: 'レシートまたは領収書はありますか？',
    scanTicketDesc: '写真を撮るだけでAIが支出内容を自動入力します',
    scanWithCamera: 'レシートを撮影',
  },
  hi: {
    scanTicketPrompt: 'क्या आपके पास रसीद या बिल है?',
    scanTicketDesc: 'AI से खर्च की जानकारी भरने के लिए फोटो लें या अपलोड करें',
    scanWithCamera: 'रसीद की फोटो लें',
  },
  ru: {
    scanTicketPrompt: 'Есть чек или квитанция?',
    scanTicketDesc: 'Сделайте фото или загрузите изображение для автозаполнения через ИИ',
    scanWithCamera: 'Сфотографировать чек',
  },
  ar: {
    scanTicketPrompt: 'هل لديك الإيصال أو الفاتورة؟',
    scanTicketDesc: 'التقط صورة لملء بيانات المصروف تلقائياً بالذكاء الاصطناعي',
    scanWithCamera: 'التقاط صورة للإيصال',
  },
  el: {
    scanTicketPrompt: 'Έχετε την απόδειξη ή το τιμολόγιο;',
    scanTicketDesc: 'Τραβήξτε φωτογραφία για αυτόματη συμπλήρωση του εξόδου με AI',
    scanWithCamera: 'Φωτογραφία απόδειξης',
  },
  tr: {
    scanTicketPrompt: 'Fiş veya faturanız var mı?',
    scanTicketDesc: 'Harcamayı yapay zeka ile otomatik doldurmak için fotoğraf çekin',
    scanWithCamera: 'Fişin fotoğrafını çek',
  },
  nl: {
    scanTicketPrompt: 'Heeft u de bon of factuur?',
    scanTicketDesc: 'Maak een foto om de uitgave automatisch in te vullen met AI',
    scanWithCamera: 'Foto maken van de bon',
  },
  af: {
    scanTicketPrompt: 'Het jy die kwitansie of faktuur?',
    scanTicketDesc: 'Neem \'n foto om die uitgawe outomaties in te vul met KI',
    scanWithCamera: 'Neem foto van kwitansie',
  },
};

for (const [lang, data] of Object.entries(translations)) {
  const filePath = path.join(localesDir, `${lang}.ts`);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes('scanTicketPrompt:')) continue;

  content = content.replace(
    /takePhoto:\s*['"`].*?['"`],/,
    (match) => `${match}\n    scanTicketPrompt: '${data.scanTicketPrompt}',\n    scanTicketDesc: '${data.scanTicketDesc}',\n    scanWithCamera: '${data.scanWithCamera}',`
  );

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Updated ${lang}.ts with scan hero keys`);
}
