import fs from 'fs';
import path from 'path';

const localesDir = path.resolve('src/locales');

const translations = {
  es: {
    ocr: {
      scanningReceipt: 'Escaneando ticket con IA...',
      scanningReceiptSubtitle: 'Extrayendo importe, fecha y comercio automáticamente',
      detectedTitle: 'Datos detectados en el ticket',
      applyData: 'Autocompletar gasto',
      scanReceipt: 'Escanear ticket',
    },
    comments: {
      title: 'Comentarios',
      subtitle: 'Aclaraciones o notas del grupo',
      noComments: 'No hay comentarios en este gasto. ¡Sé el primero en comentar!',
      placeholder: 'Escribe un comentario o aclaración...',
      send: 'Enviar',
      loginRequired: 'Inicia sesión para dejar un comentario.',
      confirmDelete: '¿Eliminar este comentario?',
    },
  },
  en: {
    ocr: {
      scanningReceipt: 'Scanning receipt with AI...',
      scanningReceiptSubtitle: 'Automatically extracting amount, date and merchant',
      detectedTitle: 'Data detected in receipt',
      applyData: 'Autofill expense',
      scanReceipt: 'Scan receipt',
    },
    comments: {
      title: 'Comments',
      subtitle: 'Group clarifications or notes',
      noComments: 'No comments on this expense yet. Be the first to comment!',
      placeholder: 'Write a comment or clarification...',
      send: 'Send',
      loginRequired: 'Log in to leave a comment.',
      confirmDelete: 'Delete this comment?',
    },
  },
  gl: {
    ocr: {
      scanningReceipt: 'Escaneando ticket con IA...',
      scanningReceiptSubtitle: 'Extraendo importe, data e comercio automaticamente',
      detectedTitle: 'Datos detectados no ticket',
      applyData: 'Autocompletar gasto',
      scanReceipt: 'Escanear ticket',
    },
    comments: {
      title: 'Comentarios',
      subtitle: 'Aclaracións ou notas do grupo',
      noComments: 'Non hai comentarios neste gasto. Sé o primeiro en comentar!',
      placeholder: 'Escribe un comentario ou aclaración...',
      send: 'Enviar',
      loginRequired: 'Inicia sesión para deixar un comentario.',
      confirmDelete: 'Eliminar este comentario?',
    },
  },
  ca: {
    ocr: {
      scanningReceipt: 'Escanejant tiquet amb IA...',
      scanningReceiptSubtitle: 'Extraient import, data i comerç automàticament',
      detectedTitle: 'Dades detectades al tiquet',
      applyData: 'Autocompletar despesa',
      scanReceipt: 'Escanejar tiquet',
    },
    comments: {
      title: 'Comentaris',
      subtitle: 'Aclariments o notes del grup',
      noComments: 'No hi ha comentaris en aquesta despesa. Sigues el primer a comentar!',
      placeholder: 'Escriu un comentari o aclariment...',
      send: 'Enviar',
      loginRequired: 'Inicia sessió per deixar un comentari.',
      confirmDelete: 'Eliminar aquest comentari?',
    },
  },
  eu: {
    ocr: {
      scanningReceipt: 'Tiketa eskaneatzen AI-arekin...',
      scanningReceiptSubtitle: 'Zenbatekoa, data eta denda automatikoki ateratzen',
      detectedTitle: 'Tiketean hautemandako datuak',
      applyData: 'Gastuak automatikoki bete',
      scanReceipt: 'Tiketa eskaneatu',
    },
    comments: {
      title: 'Iruzkinak',
      subtitle: 'Taldearen argibideak edo oharrak',
      noComments: 'Gastu honetan ez dago iruzkinik. Izan lehena iruzkintzen!',
      placeholder: 'Idatzi iruzkin edo argibide bat...',
      send: 'Bidali',
      loginRequired: 'Hasi saioa iruzkin bat uzteko.',
      confirmDelete: 'Iruzkin hau ezabatu?',
    },
  },
  va: {
    ocr: {
      scanningReceipt: 'Escanejant tiquet amb IA...',
      scanningReceiptSubtitle: 'Extraient import, data i comerç automàticament',
      detectedTitle: 'Dades detectades al tiquet',
      applyData: 'Autocompletar despesa',
      scanReceipt: 'Escanejar tiquet',
    },
    comments: {
      title: 'Comentaris',
      subtitle: 'Aclariments o notes del grup',
      noComments: 'No hi ha comentaris en esta despesa. Sigues el primer a comentar!',
      placeholder: 'Escriu un comentari o aclariment...',
      send: 'Enviar',
      loginRequired: 'Inicia sessió per a deixar un comentari.',
      confirmDelete: 'Eliminar este comentari?',
    },
  },
  fr: {
    ocr: {
      scanningReceipt: 'Numérisation du reçu avec IA...',
      scanningReceiptSubtitle: 'Extraction automatique du montant, de la date et du commerçant',
      detectedTitle: 'Données détectées sur le reçu',
      applyData: 'Remplir automatiquement',
      scanReceipt: 'Numériser le reçu',
    },
    comments: {
      title: 'Commentaires',
      subtitle: 'Précisions ou notes du groupe',
      noComments: 'Aucun commentaire sur cette dépense. Soyez le premier à commenter !',
      placeholder: 'Écrire un commentaire ou une précision...',
      send: 'Envoyer',
      loginRequired: 'Connectez-vous pour laisser un commentaire.',
      confirmDelete: 'Supprimer ce commentaire ?',
    },
  },
  pt: {
    ocr: {
      scanningReceipt: 'Digitalizando recibo com IA...',
      scanningReceiptSubtitle: 'Extraindo valor, data e estabelecimento automaticamente',
      detectedTitle: 'Dados detetados no recibo',
      applyData: 'Preencher automaticamente',
      scanReceipt: 'Digitalizar recibo',
    },
    comments: {
      title: 'Comentários',
      subtitle: 'Esclarecimentos ou notas do grupo',
      noComments: 'Sem comentários nesta despesa. Seja o primeiro a comentar!',
      placeholder: 'Escreva um comentário ou esclarecimento...',
      send: 'Enviar',
      loginRequired: 'Inicie sessão para deixar um comentário.',
      confirmDelete: 'Eliminar este comentário?',
    },
  },
  it: {
    ocr: {
      scanningReceipt: 'Scansione scontrino con IA...',
      scanningReceiptSubtitle: 'Estrazione automatica di importo, data ed esercente',
      detectedTitle: 'Dati rilevati nello scontrino',
      applyData: 'Compila automaticamente',
      scanReceipt: 'Scansiona scontrino',
    },
    comments: {
      title: 'Commenti',
      subtitle: 'Chiarimenti o note del gruppo',
      noComments: 'Nessun commento su questa spesa. Sii il primo a commentare!',
      placeholder: 'Scrivi un commento o un chiarimento...',
      send: 'Invia',
      loginRequired: 'Accedi per lasciare un commento.',
      confirmDelete: 'Eliminare questo commento?',
    },
  },
  de: {
    ocr: {
      scanningReceipt: 'Beleg wird mit KI gescannt...',
      scanningReceiptSubtitle: 'Betrag, Datum und Händler werden automatisch extrahiert',
      detectedTitle: 'Auf dem Beleg erkannte Daten',
      applyData: 'Automatisch ausfüllen',
      scanReceipt: 'Beleg scannen',
    },
    comments: {
      title: 'Kommentare',
      subtitle: 'Klarstellungen oder Gruppennotizen',
      noComments: 'Noch keine Kommentare zu dieser Ausgabe. Sei der Erste!',
      placeholder: 'Kommentar oder Notiz schreiben...',
      send: 'Senden',
      loginRequired: 'Melde dich an, um einen Kommentar zu hinterlassen.',
      confirmDelete: 'Diesen Kommentar löschen?',
    },
  },
  zh: {
    ocr: {
      scanningReceipt: '正在使用 AI 扫描小票...',
      scanningReceiptSubtitle: '自动提取金额、日期和商家名称',
      detectedTitle: '小票中检测到的数据',
      applyData: '自动填充支出',
      scanReceipt: '扫描小票',
    },
    comments: {
      title: '评论',
      subtitle: '群组成员说明与备注',
      noComments: '该支出暂无评论。抢先发表第一条评论吧！',
      placeholder: '写下评论或说明...',
      send: '发送',
      loginRequired: '登录后即可发表评论。',
      confirmDelete: '删除此评论？',
    },
  },
  ja: {
    ocr: {
      scanningReceipt: 'AIでレシートをスキャン中...',
      scanningReceiptSubtitle: '金額、日付、店舗名を自動抽出中',
      detectedTitle: 'レシートから検出されたデータ',
      applyData: '自動入力する',
      scanReceipt: 'レシートをスキャン',
    },
    comments: {
      title: 'コメント',
      subtitle: 'グループ内の確認・補足メモ',
      noComments: 'この支出にはまだコメントがありません。最初のコメントを投稿しましょう！',
      placeholder: 'コメントや補足を記入...',
      send: '送信',
      loginRequired: 'コメントを投稿するにはログインしてください。',
      confirmDelete: 'このコメントを削除しますか？',
    },
  },
  hi: {
    ocr: {
      scanningReceipt: 'AI से रसीद स्कैन की जा रही है...',
      scanningReceiptSubtitle: 'राशि, दिनांक और विक्रेता की जानकारी निकाली जा रही है',
      detectedTitle: 'रसीद से मिले विवरण',
      applyData: 'स्वतः भरें',
      scanReceipt: 'रसीद स्कैन करें',
    },
    comments: {
      title: 'टिप्पणियाँ',
      subtitle: 'समूह की स्पष्टीकरण या नोट्स',
      noComments: 'इस खर्च पर कोई टिप्पणी नहीं है। पहली टिप्पणी करें!',
      placeholder: 'कोई टिप्पणी या स्पष्टीकरण लिखें...',
      send: 'भेजें',
      loginRequired: 'टिप्पणी करने के लिए लॉग इन करें।',
      confirmDelete: 'क्या यह टिप्पणी हटाएँ?',
    },
  },
  ru: {
    ocr: {
      scanningReceipt: 'Сканирование чека с ИИ...',
      scanningReceiptSubtitle: 'Автоматическое извлечение суммы, даты и названия заведения',
      detectedTitle: 'Данные, распознанные на чеке',
      applyData: 'Автозаполнить расход',
      scanReceipt: 'Сканировать чек',
    },
    comments: {
      title: 'Комментарии',
      subtitle: 'Уточнения и заметки участников',
      noComments: 'К этому расходу пока нет комментариев. Будьте первым!',
      placeholder: 'Напишите комментарий или уточнение...',
      send: 'Отправить',
      loginRequired: 'Войдите, чтобы оставить комментарий.',
      confirmDelete: 'Удалить этот комментарий?',
    },
  },
  ar: {
    ocr: {
      scanningReceipt: 'جارٍ فحص الإيصال بالذكاء الاصطناعي...',
      scanningReceiptSubtitle: 'استخراج المبلغ والتاريخ والمتجر تلقائياً',
      detectedTitle: 'البيانات المكتشفة في الإيصال',
      applyData: 'تعبئة تلقائية للبيانات',
      scanReceipt: 'مسح الإيصال',
    },
    comments: {
      title: 'التعليقات',
      subtitle: 'توضيحات وملاحظات المجموعة',
      noComments: 'لا توجد تعليقات على هذا المصروف بعد. كن أول من يعلّق!',
      placeholder: 'اكتب تعليقاً أو توضيحاً...',
      send: 'إرسال',
      loginRequired: 'سجل الدخول لإضافة تعليق.',
      confirmDelete: 'حذف هذا التعليق؟',
    },
  },
  el: {
    ocr: {
      scanningReceipt: 'Σάρωση απόδειξης με AI...',
      scanningReceiptSubtitle: 'Αυτόματη εξαγωγή ποσού, ημερομηνίας και καταστήματος',
      detectedTitle: 'Δεδομένα που εντοπίστηκαν στην απόδειξη',
      applyData: 'Αυτόματη συμπλήρωση',
      scanReceipt: 'Σάρωση απόδειξης',
    },
    comments: {
      title: 'Σχόλια',
      subtitle: 'Διευκρινίσεις ή σημειώσεις της ομάδας',
      noComments: 'Δεν υπάρχουν σχόλια για αυτό το έξοδο. Γράψτε το πρώτο!',
      placeholder: 'Γράψτε ένα σχόλιο ή διευκρίνιση...',
      send: 'Αποστολή',
      loginRequired: 'Συνδεθείτε για να αφήσετε σχόλιο.',
      confirmDelete: 'Διαγραφή αυτού του σχολίου;',
    },
  },
  tr: {
    ocr: {
      scanningReceipt: 'Fiş yapay zeka ile taranıyor...',
      scanningReceiptSubtitle: 'Tutar, tarih ve işletme adı otomatik olarak çıkarılıyor',
      detectedTitle: 'Fişte tespit edilen bilgiler',
      applyData: 'Harcamayı otomatik doldur',
      scanReceipt: 'Fişi tara',
    },
    comments: {
      title: 'Yorumlar',
      subtitle: 'Grup açıklamaları veya notları',
      noComments: 'Bu harcama için henüz yorum yok. İlk yorumu sen yap!',
      placeholder: 'Bir yorum veya açıklama yazın...',
      send: 'Gönder',
      loginRequired: 'Yorum yapmak için giriş yapın.',
      confirmDelete: 'Bu yorum silinsin mi?',
    },
  },
  nl: {
    ocr: {
      scanningReceipt: 'Bon scannen met AI...',
      scanningReceiptSubtitle: 'Bedrag, datum en winkelier automatisch extraheren',
      detectedTitle: 'Gegevens gedetecteerd op bon',
      applyData: 'Uitgave automatisch invullen',
      scanReceipt: 'Bon scannen',
    },
    comments: {
      title: 'Reacties',
      subtitle: 'Toelichting of groepsnotities',
      noComments: 'Nog geen reacties op deze uitgave. Wees de eerste!',
      placeholder: 'Schrijf een reactie of toelichting...',
      send: 'Verzenden',
      loginRequired: 'Log in om een reactie te plaatsen.',
      confirmDelete: 'Deze reactie verwijderen?',
    },
  },
  af: {
    ocr: {
      scanningReceipt: 'Skandeer kwitansie met KI...',
      scanningReceiptSubtitle: 'Onttrek outomaties bedrag, datum en handelaar',
      detectedTitle: 'Data opgespoor op kwitansie',
      applyData: 'Vul uitgawe outomaties in',
      scanReceipt: 'Skandeer kwitansie',
    },
    comments: {
      title: 'Kommentaar',
      subtitle: 'Groepstoeligting of notas',
      noComments: 'Geen kommentaar op hierdie uitgawe nie. Wees die eerste!',
      placeholder: 'Skryf \'n opmerking of toeligting...',
      send: 'Stuur',
      loginRequired: 'Teken in om \'n opmerking te los.',
      confirmDelete: 'Verwyder hierdie opmerking?',
    },
  },
};

for (const [lang, data] of Object.entries(translations)) {
  const filePath = path.join(localesDir, `${lang}.ts`);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes('ocr: {')) continue;

  // Format OCR section
  const ocrBlock = `  ocr: {\n` +
    Object.entries(data.ocr).map(([k, v]) => `    ${k}: '${v.replace(/'/g, "\\'")}',`).join('\n') +
    `\n  },\n`;

  // Format Comments section
  const commentsBlock = `  comments: {\n` +
    Object.entries(data.comments).map(([k, v]) => `    ${k}: '${v.replace(/'/g, "\\'")}',`).join('\n') +
    `\n  },\n`;

  // Insert before the closing `} as const;` or `};`
  content = content.replace(/(})(\s*(?:as const)?;\s*(?:type DeepStringRecord|$))/, (m, p1, p2) => {
    return `${ocrBlock}${commentsBlock}${p1}${p2}`;
  });

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Inserted ocr & comments to ${lang}.ts`);
}
